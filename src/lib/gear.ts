import { supabase } from "@/integrations/supabase/client";
import { prepareWebImage } from "@/lib/images";

const GEAR_PHOTO_BUCKET = "gear-photos";

export type GearCategory =
  "bcd" | "regulator" | "computer" | "mask" | "fins" | "wetsuit" | "camera" | "other";

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
  updated_at: string;
};

export type GearInput = Omit<GearItem, "id" | "user_id" | "created_at" | "updated_at">;

export class GearConflictError extends Error {
  constructor() {
    super("装备已在其他页面修改或删除。当前输入已保留，请先复制需要的内容，再加载最新记录。");
    this.name = "GearConflictError";
  }
}

async function userId(expectedId?: string) {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("请先登录");
  if (expectedId && id !== expectedId) throw new Error("账号已变化，请重新载入");
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
  return new Map(
    (data ?? []).flatMap((item) => (item.signedUrl ? [[item.path, item.signedUrl] as const] : [])),
  );
}

export async function listGear(): Promise<GearItem[]> {
  const { data, error } = await supabase
    .from("gear_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function validateGear(input: GearInput): GearInput {
  if (!input.brand.trim() && !input.model.trim()) throw Error("请填写品牌或型号");
  if (!Number.isInteger(input.dive_count) || input.dive_count < 0 || input.dive_count > 2147483647)
    throw Error("使用次数须为有效的非负整数");
  return {
    category: input.category,
    brand: input.brand.trim(),
    model: input.model.trim(),
    purchased_on: input.purchased_on || null,
    next_service_on: input.next_service_on || null,
    serial_number: input.serial_number || null,
    dive_count: input.dive_count,
    notes: input.notes || null,
    photo_path: input.photo_path || null,
  };
}
export async function createGear(
  input: GearInput,
  id: string = crypto.randomUUID(),
  expectedUser?: string,
): Promise<GearItem> {
  const owner = await userId(expectedUser),
    values = validateGear(input);
  const retry = async () => {
    const { data, error } = await supabase
      .from("gear_items")
      .select("*")
      .eq("id", id)
      .eq("user_id", owner)
      .maybeSingle();
    if (error) throw error;
    if (
      data &&
      !Object.entries(values).every(([key, value]) => data[key as keyof typeof data] === value)
    )
      throw Error("此请求已保存不同内容，请重新载入后编辑");
    return data;
  };
  const prior = await retry();
  if (prior) return prior;
  await userId(owner);
  const { data, error } = await supabase
    .from("gear_items")
    .insert({ id, ...values, user_id: owner })
    .select("*")
    .single();
  if (error?.code === "23505") {
    const saved = await retry();
    if (saved) return saved;
  }
  if (error) throw error;
  if (!data || data.id !== id || data.user_id !== owner) throw Error("未确认保存，请重试");
  return data;
}

export async function updateGear(
  id: string,
  input: GearInput,
  expectedUser: string,
  expectedRevision: string,
): Promise<GearItem> {
  const owner = await userId(expectedUser);
  if (!expectedRevision) throw new GearConflictError();
  const values = validateGear(input);
  // The revision predicate is evaluated atomically with the write, not just
  // during a preflight read that another editor could race.
  const { data, error } = await supabase
    .from("gear_items")
    .update(values)
    .eq("id", id)
    .eq("user_id", owner)
    .eq("updated_at", expectedRevision)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  await userId(owner);
  if (!data) {
    // A lost reply can hide a committed write. Confirm identical saved values
    // without reapplying the stale payload or advancing the editor baseline.
    const current = await supabase
      .from("gear_items")
      .select("*")
      .eq("id", id)
      .eq("user_id", owner)
      .maybeSingle();
    if (current.error) throw current.error;
    await userId(owner);
    const saved = current.data;
    if (
      saved &&
      saved.id === id &&
      saved.user_id === owner &&
      Object.entries(values).every(([key, value]) => saved[key as keyof typeof saved] === value)
    )
      return saved;
    throw new GearConflictError();
  }
  if (data.id !== id || data.user_id !== owner) throw Error("未确认保存，请重试");
  return data;
}

export async function deleteGear(id: string, expectedUser: string, expectedRevision: string) {
  const owner = await userId(expectedUser);
  if (!expectedRevision) throw new GearConflictError();
  const { data, error } = await supabase
    .from("gear_items")
    .delete()
    .eq("id", id)
    .eq("user_id", owner)
    .eq("updated_at", expectedRevision)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  await userId(owner);
  if (!data) throw new GearConflictError();
}
