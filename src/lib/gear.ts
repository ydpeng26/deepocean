import { supabase } from "@/integrations/supabase/client";
import { prepareWebImage } from "@/lib/images";

const GEAR_PHOTO_BUCKET = "gear-photos";

export type GearCategory = "bcd" | "regulator" | "computer" | "mask" | "fins" | "wetsuit" | "camera" | "other";

export type GearItem = {
  id: string;
  user_id: string;
  category: GearCategory;
  brand: string;
  model: string;
  purchased_on: string | null;
  next_service_on: string | null;
  serial_number: string | null;
  dive_count: number;
  notes: string | null;
  photo_path: string | null;
  created_at: string;
};

export type GearInput = Omit<GearItem, "id" | "user_id" | "created_at">;

async function userId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("请先登录");
  return id;
}

export async function uploadGearPhoto(file: File): Promise<string> {
  const id = await userId();
  const image = await prepareWebImage(file, { maxEdge: 1600, quality: 0.84 });
  const path = `${id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(GEAR_PHOTO_BUCKET).upload(path, image, {
    cacheControl: "31536000",
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signedGearPhotoUrls(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const unique = Array.from(new Set(paths));
  const { data, error } = await supabase.storage
    .from(GEAR_PHOTO_BUCKET)
    .createSignedUrls(unique, 60 * 60);
  if (error) throw error;
  return new Map((data ?? []).flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
}

export async function listGear(): Promise<GearItem[]> {
  const { data, error } = await supabase.from("gear_items").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGear(input: GearInput): Promise<GearItem> {
  const { data, error } = await supabase.from("gear_items").insert({ ...input, user_id: await userId() }).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateGear(id: string, input: GearInput): Promise<GearItem> {
  const { data, error } = await supabase.from("gear_items").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteGear(id: string) {
  const { error } = await supabase.from("gear_items").delete().eq("id", id);
  if (error) throw error;
}
