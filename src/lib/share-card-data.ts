import { supabase } from "@/integrations/supabase/client";
import { requireDiveOwner, PHOTO_BUCKET, type Dive } from "@/lib/dives";

export function cardPhotoPaths(dive: Pick<Dive, "photo_urls" | "user_id">) {
  return Array.from(
    new Set(
      dive.photo_urls.filter(
        (path) =>
          path.startsWith(dive.user_id + "/") &&
          !path.includes("..") &&
          !/[?#\\]/.test(path) &&
          /\.(jpe?g|png|webp)$/i.test(path),
      ),
    ),
  );
}

export async function loadCardDive(
  id: string,
  owner: string,
  signal = AbortSignal.timeout(15000),
): Promise<Dive> {
  await requireDiveOwner(owner);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error("invalid_record");
  const { data, error } = await supabase
    .from("dives")
    .select("*")
    .eq("id", id)
    .eq("user_id", owner)
    .abortSignal(signal)
    .maybeSingle();
  await requireDiveOwner(owner);
  if (error || !data || data.user_id !== owner || data.id !== id) throw Error("unavailable_record");
  return data as Dive;
}

// Private Storage read in this browser only; no signed link or private ID is shared.
export async function loadCardPhoto(id: string, owner: string, path: string, signal: AbortSignal) {
  const dive = await loadCardDive(id, owner, signal);
  if (!cardPhotoPaths(dive).includes(path) || signal.aborted) throw Error("unavailable_photo");
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path, {}, { signal });
  await requireDiveOwner(owner);
  if (signal.aborted || error || !data || !data.size || data.size > 10 * 1024 * 1024)
    throw Error("unavailable_photo");
  if (!/^image\/(jpeg|png|webp)$/i.test(data.type)) throw Error("unsupported_photo");
  return { dive, photo: data };
}

export async function loadCardSignature(owner: string, signal = AbortSignal.timeout(15000)) {
  await requireDiveOwner(owner);
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name")
    .eq("id", owner)
    .abortSignal(signal)
    .maybeSingle();
  await requireDiveOwner(owner);
  if (error || !data || data.id !== owner) throw Error("unavailable_signature");
  return data.display_name ?? "";
}
