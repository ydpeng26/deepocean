import { normalizeCompanions, type DiveCompanion } from "@/lib/dive-companions";
import { supabase } from "@/integrations/supabase/client";
import { assertSupportedWebImage, prepareWebImage } from "@/lib/images";

export type DiveType = "recreational" | "freediving" | "technical";
export type BuddyRole = "instructor" | "buddy";

export type Dive = {
  id: string;
  user_id: string;
  country: string;
  region: string | null;
  site_name: string;
  dive_date: string;
  entry_time?: string | null;
  weather: string | null;
  surface_temp: number | null;
  water_temp: number | null;
  max_depth: number | null;
  duration_min: number | null;
  dive_type: DiveType;
  buddy_role: BuddyRole | null;
  buddy_name: string | null;
  companions?: DiveCompanion[] | null;
  photo_urls: string[];
  photo_thumbnail_urls: string[];
  notes: string | null;
  created_at: string;
  updated_at?: string;
};

export const DIVE_TYPE_LABELS: Record<DiveType, string> = {
  recreational: "休闲水肺",
  freediving: "自由潜",
  technical: "技术潜水",
};

export const BUDDY_ROLE_LABELS: Record<BuddyRole, string> = {
  instructor: "教练",
  buddy: "同伴",
};

export const WEATHER_OPTIONS = ["晴", "多云", "阴", "小雨", "大雨", "有风"];

export const PHOTO_BUCKET = "dive-photos";

export async function requireDiveOwner(expected?: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const owner = data.session?.user.id;
  if (error || !owner || (expected && owner !== expected)) {
    throw new Error("登录账号已变化，请重新打开记录后再操作");
  }
  return owner;
}

export function parseDiveNumber(
  value: string,
  label: string,
  kind: "temperature" | "depth" | "duration",
) {
  const raw = value.trim();
  if (!raw) return null;
  const pattern = kind === "duration" ? /^\d+$/ : /^-?\d+(?:\.\d)?$/;
  const number = Number(raw);
  const limit = kind === "temperature" ? 999.9 : kind === "depth" ? 9999.9 : 2147483647;
  if (
    !pattern.test(raw) ||
    !Number.isFinite(number) ||
    Math.abs(number) > limit ||
    (kind !== "temperature" && number < 0)
  ) {
    throw new Error(
      `${label}请填写${kind === "duration" ? "非负整数" : kind === "depth" ? "非负数字（最多一位小数）" : "数字（最多一位小数）"}`,
    );
  }
  return number;
}

export type DivePayload = Omit<Dive, "id" | "created_at" | "updated_at">;

function canonicalDiveCountry(value: string) {
  const groups = [
    ["Indonesia", "印尼", "印度尼西亚", "印度尼西亞"],
    ["Philippines", "菲律宾", "菲律賓"],
    ["Malaysia", "马来西亚", "馬來西亞"],
    ["Thailand", "泰国", "泰國"],
    ["Japan", "日本"],
    ["China", "中国", "中國"],
    ["Vietnam", "越南"],
    ["Singapore", "新加坡"],
    ["Australia", "澳大利亚", "澳大利亞", "澳洲"],
    ["Maldives", "马尔代夫", "馬爾代夫"],
    ["Palau", "帕劳", "帛琉"],
    ["Egypt", "埃及"],
    ["Mexico", "墨西哥"],
    ["Fiji", "斐济", "斐濟"],
    ["United States", "美国", "美國", "usa"],
    ["Sri Lanka", "斯里兰卡", "斯里蘭卡"],
    ["Papua New Guinea", "巴布亚新几内亚", "巴布亞新幾內亞"],
    ["Timor-Leste", "东帝汶", "東帝汶", "east timor"],
    ["South Korea", "韩国", "韓國"],
    ["Taiwan", "台湾", "台灣"],
  ];
  return (
    groups.find((group) =>
      group.some((name) => name.toLowerCase() === value.trim().toLowerCase()),
    )?.[0] ?? value.trim()
  );
}

export async function saveDive(
  payload: DivePayload,
  id: string,
  editing: boolean,
  expectedRevision?: string,
): Promise<Dive> {
  const owner = await requireDiveOwner(payload.user_id);
  if (editing && !expectedRevision)
    throw new Error(
      "缺少记录版本，请先重新打开记录；当前输入尚未保存 / Reopen the record before editing.",
    );
  if (payload.photo_urls.length > 6) throw new Error("照片和视频合计最多 6 个，请先移除部分附件");
  const existing = await supabase
    .from("dives")
    .select("*")
    .eq("id", id)
    .eq("user_id", owner)
    .maybeSingle();
  if (existing.error) throw existing.error;
  await requireDiveOwner(owner);
  const confirm = (row: Dive) => {
    // Country aliases are canonicalized by the database trigger.
    const matches = Object.entries(payload).every(([key, value]) =>
      key === "companions"
        ? value == null
          ? row.companions == null
          : JSON.stringify(normalizeCompanions(row.companions ?? [])) === JSON.stringify(normalizeCompanions(value as DiveCompanion[]))
        : key === "country"
        ? canonicalDiveCountry(row.country) === canonicalDiveCountry(payload.country)
        : JSON.stringify(row[key as keyof Dive]) === JSON.stringify(value),
    );
    if (row.user_id !== owner || !matches)
      throw new Error("这次保存可能已完成，但内容已变化；请先查看记录，不要重复创建");
    return row;
  };
  if (!editing && existing.data) return confirm(existing.data as Dive);
  if (editing && !existing.data) throw new Error("记录不存在或无权修改");
  const conflict = () =>
    new Error(
      "记录已被其他页面修改，请保留当前输入并重新查看最新记录，勿覆盖保存 / This record changed elsewhere. Keep your draft and review the latest record.",
    );
  if (editing && existing.data?.updated_at !== expectedRevision) {
    // A committed update with a lost response may be acknowledged, never overwritten.
    try {
      return confirm(existing.data as Dive);
    } catch {
      throw conflict();
    }
  }
  const result = editing
    ? await supabase
        .from("dives")
        .update(payload)
        .eq("id", id)
        .eq("user_id", owner)
        .eq("updated_at", expectedRevision!)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("dives")
        .insert({ ...payload, id })
        .select("*")
        .single();
  if (result.error) {
    if (!editing && result.error.code === "23505") {
      const retry = await supabase
        .from("dives")
        .select("*")
        .eq("id", id)
        .eq("user_id", owner)
        .single();
      if (!retry.error && retry.data) {
        await requireDiveOwner(owner);
        return confirm(retry.data as Dive);
      }
    }
    throw result.error;
  }
  await requireDiveOwner(owner);
  if (editing && !result.data) throw conflict();
  return result.data as Dive;
}

export async function listDives(): Promise<Dive[]> {
  const owner = await requireDiveOwner();
  const all: Dive[] = [];
  let expectedCount: number | null = null;
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    await requireDiveOwner(owner);
    const { data, error, count } = await supabase
      .from("dives")
      .select("*", { count: "exact" })
      .eq("user_id", owner)
      .order("dive_date", { ascending: false })
      .order("entry_time", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (expectedCount !== null && count !== expectedCount)
      throw new Error("潜水记录在读取期间发生变化，请重新加载");
    expectedCount = count;
    await requireDiveOwner(owner);
    all.push(...((data ?? []) as Dive[]));
    if ((data?.length ?? 0) < pageSize) {
      if (
        (expectedCount !== null && all.length !== expectedCount) ||
        new Set(all.map((dive) => dive.id)).size !== all.length
      )
        throw new Error("潜水记录未完整读取，请重新加载");
      return all;
    }
  }
}

export async function getDive(id: string): Promise<Dive> {
  const { data, error } = await supabase.from("dives").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("找不到这条潜水记录");
  return data as Dive;
}

export async function deleteDive(id: string) {
  const { error } = await supabase.from("dives").delete().eq("id", id);
  if (error) throw error;
}

export type UploadedPhotos = {
  photoPaths: string[];
  thumbnailPaths: string[];
};

export async function uploadPhotos(
  files: File[],
  userId: string,
  requestId: string,
): Promise<UploadedPhotos> {
  // Reject the whole selection before hashing/uploading any sibling attachment.
  for (const file of files) {
    if (file.type.startsWith("video/")) {
      if (file.size > 100 * 1024 * 1024) throw new Error("单个视频不能超过 100MB");
    } else assertSupportedWebImage(file);
  }
  const paths: string[] = [];
  const thumbnailPaths: string[] = [];
  const maxConcurrentUploads = 2;

  for (let start = 0; start < files.length; start += maxConcurrentUploads) {
    const batch = files.slice(start, start + maxConcurrentUploads);
    const uploaded = await Promise.all(
      batch.map(async (original) => {
        await requireDiveOwner(userId);
        if (original.type.startsWith("video/") && original.size > 100 * 1024 * 1024)
          throw new Error("单个视频不能超过 100MB");
        const digest = await crypto.subtle.digest("SHA-256", await original.arrayBuffer());
        const hash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        const id = `${requestId}-${hash}`;
        const upload = async (path: string, file: File, contentType: string) => {
          await requireDiveOwner(userId);
          const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
            cacheControl: "31536000",
            contentType,
            upsert: false,
          });
          // Same owner/request/content path is immutable and reusable after a lost reply.
          if (error && String((error as { statusCode?: string }).statusCode) !== "409") throw error;
        };
        if (original.type.startsWith("video/")) {
          if (original.size > 100 * 1024 * 1024) throw new Error("单个视频不能超过 100MB");
          const ext = original.name.split(".").pop()?.toLowerCase() || "mp4";
          const path = `${userId}/${id}.${ext}`;
          await upload(path, original, original.type || "video/mp4");
          return { path, thumbnailPath: "" };
        }
        const photo = await prepareWebImage(original, { maxEdge: 2400, quality: 0.84 });
        const thumbnail = await prepareWebImage(original, {
          maxEdge: 720,
          quality: 0.76,
          suffix: "-thumb",
        });
        const path = `${userId}/${id}.jpg`;
        const thumbnailPath = `${userId}/thumbs/${id}.jpg`;
        await Promise.all([
          upload(path, photo, "image/jpeg"),
          upload(thumbnailPath, thumbnail, "image/jpeg"),
        ]);
        return { path, thumbnailPath };
      }),
    );
    paths.push(...uploaded.map((item) => item.path));
    thumbnailPaths.push(...uploaded.map((item) => item.thumbnailPath));
  }

  return { photoPaths: paths, thumbnailPaths };
}

export function isVideoPath(path: string) {
  return /\.(mp4|mov|m4v|webm)$/i.test(path.split("?")[0]);
}

export async function signedPhotoUrls(paths: string[], expectedOwner?: string): Promise<string[]> {
  if (!paths.length) return [];
  const owner = await requireDiveOwner(expectedOwner);
  const urls = new Map<string, string>();
  const unique = Array.from(new Set(paths));
  for (let start = 0; start < unique.length; start += 100) {
    await requireDiveOwner(owner);
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(unique.slice(start, start + 100), 60 * 60);
    if (error) throw error;
    await requireDiveOwner(owner);
    for (const item of data ?? []) if (item.signedUrl) urls.set(item.path!, item.signedUrl);
  }
  return paths.map((path) => urls.get(path) ?? "");
}

export function diveCover(dive: Pick<Dive, "photo_urls" | "photo_thumbnail_urls">) {
  const index = dive.photo_urls.findIndex((path) => !isVideoPath(path));
  const thumbnail = index >= 0 ? dive.photo_thumbnail_urls?.[index] : null;
  return {
    path:
      index >= 0
        ? thumbnail && !isVideoPath(thumbnail)
          ? thumbnail
          : dive.photo_urls[index]
        : null,
    videoOnly: index < 0 && dive.photo_urls.some(isVideoPath),
  };
}

export function formatDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
