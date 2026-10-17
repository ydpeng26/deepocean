import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
};

export type GearInput = Omit<GearItem, "id" | "user_id" | "created_at">;

async function userId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("请先登录");
  return id;
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
