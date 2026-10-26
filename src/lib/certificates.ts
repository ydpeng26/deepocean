import { supabase } from "@/integrations/supabase/client";
import { prepareWebImage } from "@/lib/images";

const db = supabase;
export const CERTIFICATE_BUCKET = "certificate-fronts";
export type DiverCertificate = {
  id: string;
  user_id: string;
  agency: string;
  level: string;
  certificate_number: string | null;
  issued_on: string | null;
  issued_at: string | null;
  is_public: boolean;
  front_photo_path: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
export type PublicCertificate = Pick<
  DiverCertificate,
  "id" | "agency" | "level" | "issued_on" | "issued_at"
>;
export type CertificateInput = Pick<
  DiverCertificate,
  | "agency"
  | "level"
  | "certificate_number"
  | "issued_on"
  | "issued_at"
  | "is_public"
  | "front_photo_path"
>;
export class CertificateConflictError extends Error {
  constructor() {
    super(
      "证书已在其他页面修改或移除，当前输入已保留。请复制后重新打开最新记录。 / Certificate changed or was removed elsewhere. Your edits are kept; copy them before reopening the latest record.",
    );
    this.name = "CertificateConflictError";
  }
}

async function owner(expected?: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("请先登录 / Please sign in");
  const id = data.session.user.id;
  if (expected && id !== expected)
    throw new Error("账号已变化，请重新载入 / Account changed; reload the page");
  return id;
}
export function validateCertificate(input: CertificateInput): CertificateInput {
  const agency = input.agency.trim(),
    level = input.level.trim();
  if (!agency || agency.length > 60 || !level || level.length > 120)
    throw new Error("请填写机构与证书等级 / Enter the agency and certification");
  if ((input.certificate_number?.length ?? 0) > 120 || (input.issued_at?.length ?? 0) > 160)
    throw new Error("证书信息过长 / Certificate details are too long");
  if (input.issued_on) {
    const date = new Date(input.issued_on + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.issued_on) ||
      Number.isNaN(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== input.issued_on
    )
      throw new Error("签发日期无效 / Invalid issue date");
  }
  return {
    agency,
    level,
    certificate_number: input.certificate_number?.trim() || null,
    issued_on: input.issued_on || null,
    issued_at: input.issued_at?.trim() || null,
    is_public: input.is_public === true,
    front_photo_path: input.front_photo_path || null,
  };
}
export async function listCertificates(): Promise<DiverCertificate[]> {
  const userId = await owner(),
    rows: DiverCertificate[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db
      .from("diver_certificates")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("issued_on", { ascending: false, nullsFirst: false })
      .order("id")
      .range(start, start + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
export async function saveCertificate(
  id: string,
  input: CertificateInput,
  expectedUser: string,
  revision?: string | null,
): Promise<DiverCertificate> {
  const user_id = await owner(expectedUser),
    values = validateCertificate(input);
  if (revision === undefined || revision === "") throw new CertificateConflictError();
  const prior = async () => {
    const result = await db
      .from("diver_certificates")
      .select("*")
      .eq("id", id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (result.error) throw result.error;
    const row = result.data;
    if (
      row &&
      row.id === id &&
      row.user_id === user_id &&
      row.deleted_at === null &&
      Object.entries(values).every(([key, value]) => row[key as keyof DiverCertificate] === value)
    )
      return row;
    return null;
  };
  if (revision === null) {
    const existing = await db
      .from("diver_certificates")
      .select("*")
      .eq("id", id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const confirmed = await prior();
      if (confirmed) return confirmed;
      throw new CertificateConflictError();
    }
  }
  await owner(user_id);
  const mutation =
    revision === null
      ? db.from("diver_certificates").insert({ id, user_id, ...values })
      : db
          .from("diver_certificates")
          .update(values)
          .eq("id", id)
          .eq("user_id", user_id)
          .eq("updated_at", revision)
          .is("deleted_at", null);
  const { data, error } = await mutation.select("*").maybeSingle();
  await owner(user_id);
  if (error && error.code !== "23505") throw error;
  if (!data) {
    const confirmed = await prior();
    if (confirmed) return confirmed;
    throw new CertificateConflictError();
  }
  if (!data || data.user_id !== user_id) throw new Error("未确认保存 / Save not confirmed");
  return data;
}
export async function archiveCertificate(
  id: string,
  archived: boolean,
  expectedUser: string,
  revision?: string,
) {
  const userId = await owner(expectedUser);
  if (!revision) throw new CertificateConflictError();
  const { data, error } = await db
    .from("diver_certificates")
    .update({ deleted_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("updated_at", revision)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CertificateConflictError();
  await owner(userId);
  return data;
}
export async function uploadCertificateFront(id: string, file: File, expectedUser: string) {
  const userId = await owner(expectedUser);
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("请选择 10 MB 以内的 JPG、PNG 或 WebP / Choose a JPG, PNG or WebP up to 10 MB");
  const image = await prepareWebImage(file, { maxEdge: 2800, quality: 0.92 });
  const digest = await crypto.subtle.digest("SHA-256", await image.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const path = `${userId}/${id}-${hash}.jpg`;
  const { error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .upload(path, image, { contentType: "image/jpeg", upsert: false, cacheControl: "300" });
  if (error && String((error as { statusCode?: string }).statusCode) !== "409") throw error;
  return path;
}
export async function certificatePhotoUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
export async function publicCertificates(userId: string): Promise<PublicCertificate[]> {
  const { data, error } = await db.rpc("get_public_diver_certificates", { target_user_id: userId });
  if (error) throw error;
  return data ?? [];
}
