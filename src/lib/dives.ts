import { supabase } from "@/integrations/supabase/client";

export type DiveType = "recreational" | "freediving" | "technical";
export type BuddyRole = "instructor" | "buddy";

export type Dive = {
  id: string;
  user_id: string;
  country: string;
  site_name: string;
  dive_date: string;
  weather: string | null;
  surface_temp: number | null;
  water_temp: number | null;
  max_depth: number | null;
  duration_min: number | null;
  dive_type: DiveType;
  buddy_role: BuddyRole | null;
  buddy_name: string | null;
  photo_urls: string[];
  notes: string | null;
  created_at: string;
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

export async function listDives(): Promise<Dive[]> {
  const { data, error } = await supabase
    .from("dives")
    .select("*")
    .order("dive_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Dive[];
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

async function optimizePhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 2 * 1024 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.84),
    );
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "dive-photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function uploadPhotos(files: File[], userId: string): Promise<string[]> {
  const paths: string[] = [];
  const maxConcurrentUploads = 3;

  for (let start = 0; start < files.length; start += maxConcurrentUploads) {
    const batch = files.slice(start, start + maxConcurrentUploads);
    const uploaded = await Promise.all(batch.map(async (original) => {
      const file = await optimizePhoto(original);
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      return path;
    }));
    paths.push(...uploaded);
  }

  return paths;
}

export async function signedPhotoUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  return (data ?? [])
    .map((d) => d.signedUrl)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

export function formatDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
