import { supabase } from "@/integrations/supabase/client";
import { prepareWebImage } from "@/lib/images";

export const AVATAR_BUCKET = "avatars";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  cert_level: string | null;
  tank_count: number;
  bio: string | null;
};

export type PublicProfile = Profile & { created_at: string };

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
    .select("id, display_name, avatar_url, cert_level, tank_count, bio")
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
      bio: null,
    };
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert(fallback)
      .select("id, display_name, avatar_url, cert_level, tank_count, bio")
      .single();
    if (createError) {
      // Another simultaneous profile query may already have created the row.
      if (createError.code !== "23505") throw createError;
      const { data: existing, error: readError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, cert_level, tank_count, bio")
        .eq("id", user.id)
        .single();
      if (readError) throw readError;
      return existing as Profile;
    }
    return created as Profile;
  }
  return data as Profile;
}

export type ProfileUpdate = {
  display_name: string;
  cert_level: string | null;
  tank_count: number;
  bio: string | null;
};

export class ProfileConflictError extends Error {
  constructor() {
    super(
      "资料已在其他页面修改或删除，当前输入已保留。请复制需要的内容，再重新加载。 / Profile changed or was deleted elsewhere. Your edits are kept; copy them before reloading.",
    );
    this.name = "ProfileConflictError";
  }
}
const profileFields = ["display_name", "cert_level", "tank_count", "bio"] as const;

export async function updateMyProfile(
  input: ProfileUpdate,
  expectedUserId?: string,
  baseline?: Pick<Profile, keyof ProfileUpdate>,
): Promise<Profile> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("请先登录");
  if (expectedUserId && user.id !== expectedUserId)
    throw new Error("登录账号已变化，请重新载入资料");
  if (!baseline) throw new ProfileConflictError();
  let query = supabase.from("profiles").update(input).eq("id", user.id);
  for (const key of profileFields)
    query = baseline[key] === null ? query.is(key, null) : query.eq(key, baseline[key]!);
  const { data, error } = await query
    .select("id, display_name, avatar_url, cert_level, tank_count, bio")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const current = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, cert_level, tank_count, bio")
      .eq("id", user.id)
      .maybeSingle();
    if (current.error) throw current.error;
    const row = current.data;
    if (!row || !profileFields.every((key) => row[key] === input[key]))
      throw new ProfileConflictError();
    return row as Profile;
  }
  return data as Profile;
}

export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_diver_profile", {
    target_user_id: id,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function uploadAvatar(
  file: File,
  expectedUserId?: string,
  baselineAvatar?: string | null,
): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("请先登录");
  if (expectedUserId && user.id !== expectedUserId)
    throw new Error("登录账号已变化，请重新载入资料");
  if (baselineAvatar === undefined) throw new ProfileConflictError();
  const webImage = await prepareWebImage(file, { maxEdge: 640, quality: 0.84 });
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, webImage, {
    cacheControl: "31536000",
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const latest = await supabase.auth.getSession();
  if (latest.data.session?.user.id !== user.id) throw new Error("登录账号已变化，请重新载入资料");
  let mutation = supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
  mutation =
    baselineAvatar === null
      ? mutation.is("avatar_url", null)
      : mutation.eq("avatar_url", baselineAvatar);
  const { data: updated, error: updateError } = await mutation.select("id").maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new ProfileConflictError();
  return path;
}

export async function signedAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const cacheKey = `supdiver:avatar-url:${path}`;
  if (typeof window !== "undefined") {
    try {
      const cached = JSON.parse(window.localStorage.getItem(cacheKey) ?? "null") as {
        url?: string;
        expiresAt?: number;
      } | null;
      if (cached?.url && (cached.expiresAt ?? 0) > Date.now() + 60_000) return cached.url;
    } catch {
      window.localStorage.removeItem(cacheKey);
    }
  }
  const lifetimeSeconds = 7 * 24 * 60 * 60;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, lifetimeSeconds);
  if (error) throw error;
  const url = data?.signedUrl ?? null;
  if (url && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          url,
          expiresAt: Date.now() + (lifetimeSeconds - 60 * 60) * 1000,
        }),
      );
    } catch {
      // Private browsing and strict storage settings may disable local storage.
    }
  }
  return url;
}
