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

export async function uploadPhotos(files: File[], userId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function signedPhotoUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean);
}

export function formatDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
