import { supabase } from "@/integrations/supabase/client";
import { prepareWebImage } from "@/lib/images";

// These tables are introduced by the marine encounters migration.
const db = supabase as any;
export type Encounter = {
  id: string;
  user_id: string;
  author_name: string;
  species_name: string;
  encountered_on: string;
  location: string;
  photo_path: string;
  needs_help: boolean;
  created_at: string;
  imageUrl?: string;
};
export type Suggestion = {
  id: string;
  encounter_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
async function user(expectedId?: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw Error("请先登录");
  if (expectedId && data.session.user.id !== expectedId) throw Error("账号已变化，请重新载入");
  return data.session.user;
}
export async function listEncounters(help: boolean): Promise<Encounter[]> {
  const current = await user();
  let query = db.from("marine_encounters").select("*").order("created_at", { ascending: false });
  query = help ? query.eq("needs_help", true) : query.eq("user_id", current.id);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Encounter[];
  if (!rows.length) return [];
  const { data: images, error: imageError } = await supabase.storage
    .from("marine-photos")
    .createSignedUrls(
      rows.map((row) => row.photo_path),
      3600,
    );
  if (imageError) throw imageError;
  const urls = new Map(images?.map((image) => [image.path, image.signedUrl]));
  return rows.map((row) => ({ ...row, imageUrl: urls.get(row.photo_path) ?? undefined }));
}
export async function saveEncounter(
  input: {
    file?: File | null;
    species_name: string;
    encountered_on: string;
    location: string;
    needs_help: boolean;
  },
  existing?: Encounter,
  requestId: string = crypto.randomUUID(),
  expectedUser?: string,
): Promise<Encounter> {
  const current = await user(expectedUser);
  if (existing && existing.user_id !== current.id) throw Error("只能编辑自己的记录");
  const species = input.species_name.trim() || (input.needs_help ? "待识别" : "");
  const location = input.location.trim();
  const calendar = new Date(input.encountered_on + "T00:00:00Z");
  if (
    !species ||
    species.length > 120 ||
    !location ||
    location.length > 200 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.encountered_on) ||
    Number.isNaN(calendar.valueOf()) ||
    calendar.toISOString().slice(0, 10) !== input.encountered_on
  )
    throw Error("请填写有效的生物名称、日期和地点");
  const id = existing?.id ?? requestId;
  let path = existing?.photo_path;
  if (input.file) {
    if (!input.file.type.startsWith("image/")) throw Error("请选择图片文件");
    if (!input.file.size || input.file.size > 20 * 1024 * 1024)
      throw Error("原始图片请大于 0 且不超过 20MB");
    const image = await prepareWebImage(input.file, { maxEdge: 1600, quality: 0.85 });
    const digest = await crypto.subtle.digest("SHA-256", await image.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    path = `${current.id}/${id}-${hash}.jpg`;
    await user(current.id);
    const { error } = await supabase.storage
      .from("marine-photos")
      .upload(path, image, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
    if (error && String((error as { statusCode?: string }).statusCode) !== "409") throw error;
  }
  if (!path) throw Error("请上传相遇照片");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", current.id)
    .maybeSingle();
  if (profileError) throw profileError;
  const payload = {
    user_id: current.id,
    author_name: profile?.display_name || "潜水员",
    species_name: species,
    encountered_on: input.encountered_on,
    location,
    needs_help: input.needs_help,
    photo_path: path,
  };
  // Never delete uploaded or replaced photos during save: a failed response may
  // represent an already committed row. Private leftovers require separate cleanup.
  const confirmRetry = async () => {
    const { data, error } = await db
      .from("marine_encounters")
      .select("*")
      .eq("id", id)
      .eq("user_id", current.id)
      .maybeSingle();
    if (error) throw error;
    if (
      data &&
      !["user_id", "species_name", "encountered_on", "location", "needs_help", "photo_path"].every(
        (key) => data[key] === payload[key as keyof typeof payload],
      )
    )
      throw Error("此请求已保存不同内容，请重新载入后编辑");
    return data as Encounter | null;
  };
  if (!existing) {
    const prior = await confirmRetry();
    if (prior) return prior;
  }
  await user(current.id);
  const query = existing
    ? db.from("marine_encounters").update(payload).eq("id", id).eq("user_id", current.id)
    : db.from("marine_encounters").insert({ id, ...payload });
  const { data, error } = await query.select("*").single();
  if (error) {
    if (!existing && error.code === "23505") {
      const prior = await confirmRetry();
      if (prior) return prior;
    }
    throw error;
  }
  if (!data || data.id !== id || data.user_id !== current.id) throw Error("未确认保存，请重试");
  return data;
}
export async function deleteEncounter(encounter: Encounter) {
  const current = await user();
  const { error } = await db
    .from("marine_encounters")
    .delete()
    .eq("id", encounter.id)
    .eq("user_id", current.id);
  if (error) throw error;
  await supabase.storage.from("marine-photos").remove([encounter.photo_path]);
}
export async function listSuggestions(id: string): Promise<Suggestion[]> {
  const { data, error } = await db
    .from("marine_suggestions")
    .select("*")
    .eq("encounter_id", id)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
export async function addSuggestion(id: string, body: string) {
  const current = await user();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", current.id)
    .maybeSingle();
  const { error } = await db.from("marine_suggestions").insert({
    encounter_id: id,
    user_id: current.id,
    author_name: profile?.display_name || "潜水员",
    body: body.trim(),
  });
  if (error) throw error;
}

export async function shareEncounterToForum(encounter: Encounter): Promise<string> {
  const current = await user();
  if (encounter.user_id !== current.id) throw Error("只能转发自己的记录");
  const { data: existing, error: lookupError } = await db
    .from("forum_posts")
    .select("id")
    .eq("source_encounter_id", encounter.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing.id;
  const path = `${current.id}/encounter-${encounter.id}.jpg`;
  const { data: image, error: downloadError } = await supabase.storage
    .from("marine-photos")
    .download(encounter.photo_path);
  if (downloadError || !image) throw downloadError ?? Error("无法读取相遇照片");
  const { error: uploadError } = await supabase.storage
    .from("forum-media")
    .upload(path, image, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
  if (
    uploadError &&
    !["409", "Duplicate"].includes(String((uploadError as any).statusCode)) &&
    !uploadError.message.toLowerCase().includes("already exists")
  )
    throw uploadError;
  const { data, error } = await db.rpc("share_marine_encounter", { target_id: encounter.id });
  if (error) throw error;
  return data;
}
