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
export class EncounterConflictError extends Error {
  constructor() {
    super(
      "相遇记录已在其他页面修改或删除，当前输入与照片已保留。请复制后重新打开最新记录。 / Encounter changed or was deleted elsewhere. Your edits and photo are kept; copy them before reopening the latest record.",
    );
    this.name = "EncounterConflictError";
  }
}
const encounterFields = [
  "species_name",
  "encountered_on",
  "location",
  "needs_help",
  "photo_path",
  "created_at",
] as const;
function atEncounterBaseline<T extends { eq(key: string, value: string | boolean): T }>(
  query: T,
  original: Encounter,
) {
  for (const key of encounterFields) {
    if (original[key] === undefined || original[key] === null) throw new EncounterConflictError();
    query = query.eq(key, original[key]);
  }
  return query;
}
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
    ? atEncounterBaseline(
        db.from("marine_encounters").update(payload).eq("id", id).eq("user_id", current.id),
        existing,
      )
    : db.from("marine_encounters").insert({ id, ...payload });
  const { data, error } = await query.select("*").maybeSingle();
  await user(current.id);
  if (error) {
    if (!existing && error.code === "23505") {
      const prior = await confirmRetry();
      if (prior) return prior;
    }
    throw error;
  }
  if (!data && existing) {
    try {
      const confirmed = await confirmRetry();
      if (confirmed) return confirmed;
    } catch (error) {
      if (error instanceof Error && error.message === "此请求已保存不同内容，请重新载入后编辑")
        throw new EncounterConflictError();
      throw error;
    }
    throw new EncounterConflictError();
  }
  if (!data || data.id !== id || data.user_id !== current.id) throw Error("未确认保存，请重试");
  return data;
}
export async function deleteEncounter(encounter: Encounter) {
  const current = await user();
  if (encounter.user_id !== current.id) throw new EncounterConflictError();
  const { data, error } = await atEncounterBaseline(
    db.from("marine_encounters").delete().eq("id", encounter.id).eq("user_id", current.id),
    encounter,
  )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new EncounterConflictError();
  await user(current.id);
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
export async function addSuggestion(
  id: string,
  body: string,
  requestId: string = crypto.randomUUID(),
  expectedUser?: string,
): Promise<Suggestion> {
  const current = await user(expectedUser);
  const text = body.trim();
  if (!text || text.length > 1000) throw Error("建议请填写 1 至 1000 个字符");
  const confirm = (row: Suggestion) => {
    if (
      row.id !== requestId ||
      row.encounter_id !== id ||
      row.user_id !== current.id ||
      row.body !== text
    )
      throw Error("这次建议可能已保存不同内容，请重新载入核对");
    return row;
  };
  const prior = await db
    .from("marine_suggestions")
    .select("*")
    .eq("id", requestId)
    .eq("user_id", current.id)
    .maybeSingle();
  if (prior.error) throw prior.error;
  await user(current.id);
  if (prior.data) return confirm(prior.data);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", current.id)
    .maybeSingle();
  if (profileError) throw profileError;
  await user(current.id);
  const { data, error } = await db
    .from("marine_suggestions")
    .insert({
      id: requestId,
      encounter_id: id,
      user_id: current.id,
      author_name: profile?.display_name || "潜水员",
      body: text,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const retry = await db
        .from("marine_suggestions")
        .select("*")
        .eq("id", requestId)
        .eq("user_id", current.id)
        .single();
      await user(current.id);
      if (!retry.error && retry.data) return confirm(retry.data);
    }
    throw error;
  }
  await user(current.id);
  if (!data) throw Error("未确认建议保存，请重试");
  return confirm(data);
}

export async function shareEncounterToForum(
  encounter: Encounter,
  expectedUser?: string,
): Promise<string> {
  const current = await user(expectedUser);
  if (encounter.user_id !== current.id) throw Error("只能转发自己的记录");
  const { data: existing, error: lookupError } = await db
    .from("forum_posts")
    .select("id")
    .eq("source_encounter_id", encounter.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  await user(current.id);
  if (existing) return existing.id;
  const snapshot = await db
    .from("marine_encounters")
    .select("*")
    .eq("id", encounter.id)
    .eq("user_id", current.id)
    .single();
  if (snapshot.error) throw snapshot.error;
  const source = snapshot.data as Encounter | null;
  if (!source || source.user_id !== current.id || !source.photo_path.startsWith(current.id + "/"))
    throw Error("无法确认相遇照片，请重新载入");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source.photo_path));
  const version = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const path = `${current.id}/encounter-${encounter.id}-${version}.jpg`;
  await user(current.id);
  const { data: image, error: downloadError } = await supabase.storage
    .from("marine-photos")
    .download(source.photo_path);
  if (downloadError || !image) throw downloadError ?? Error("无法读取相遇照片");
  await user(current.id);
  const { error: uploadError } = await supabase.storage
    .from("forum-media")
    .upload(path, image, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
  if (uploadError && String((uploadError as { statusCode?: string }).statusCode) !== "409")
    throw uploadError;
  await user(current.id);
  const { data, error } = await db.rpc("share_marine_encounter_snapshot", {
    target_id: encounter.id,
    expected_photo_path: source.photo_path,
  });
  if (error) throw error;
  await user(current.id);
  if (typeof data !== "string" || !data) throw Error("未确认转发，请重试");
  return data;
}
