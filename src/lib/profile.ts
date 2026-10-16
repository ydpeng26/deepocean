import { supabase } from "@/integrations/supabase/client";

export const AVATAR_BUCKET = "avatars";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  cert_level: string | null;
  tank_count: number;
};

export const CERT_LEVELS = [
  "OW 开放水域",
  "AOW 进阶开放水域",
  "Rescue 救援潜水员",
  "Divemaster 潜水长",
  "Instructor 教练",
  "自由潜 一星",
  "自由潜 二星",
  "自由潜 三星",
  "技术潜水",
  "暂无",
];

export async function getMyProfile(): Promise<Profile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, cert_level, tank_count")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const fallback = {
      id: user.id,
      display_name: user.email?.split("@")[0] ?? "潜水员",
      avatar_url: null,
      cert_level: null,
      tank_count: 0,
    };
    await supabase.from("profiles").insert(fallback);
    return fallback;
  }
  return data as Profile;
}

export async function updateMyProfile(input: {
  display_name: string;
  cert_level: string | null;
  tank_count: number;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("请先登录");
  const { error } = await supabase.from("profiles").update(input).eq("id", user.id);
  if (error) throw error;
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("请先登录");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", user.id);
  if (updateError) throw updateError;
  return path;
}

export async function signedAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
