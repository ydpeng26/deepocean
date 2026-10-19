import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Camera,
  Check,
  Languages,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { listDives } from "@/lib/dives";
import {
  CERT_LEVELS,
  signedAvatarUrl,
  updateMyProfile,
  uploadAvatar,
  type Profile,
} from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "个人资料 · SupDiver" },
      { name: "description", content: "编辑你的 SupDiver 潜水员身份与公开资料。" },
    ],
  }),
  component: ProfilePage,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照",
    logs: "潜水日志",
    forum: "深蓝论坛",
    profile: "个人资料",
    logout: "退出",
    eyebrow: "DIVER PROFILE",
    title: "个人资料",
    intro: "让每一次被记录的下潜，都带着属于你的名字。",
    userId: "用户 ID",
    accountNote: "用户 ID 是你的唯一身份，邮箱和登录安全信息不会公开显示。",
    changeAvatar: "更换头像",
    uploading: "上传中…",
    identity: "基础资料",
    diveProfile: "潜水资料",
    displayName: "显示名称",
    bio: "个人简介",
    bioPlaceholder: "介绍一下你的潜水经历、喜欢的海域或下一次想去的地方…",
    cert: "当前最高证书",
    tanks: "累计潜水瓶数",
    save: "保存个人资料",
    saving: "保存中…",
    saved: "更改已保存",
    publicPreview: "公开资料预览",
    publicHint: "这些资料会显示在你的海洋护照中。",
    certified: "认证等级",
    dives: "潜水记录",
    countries: "到访海域",
    privacy: "隐私说明",
    privacyText: "邮箱、登录方式和账号安全信息不会出现在公开资料中。",
    complete: "资料完整度",
    identityComplete: "你的潜水员身份已准备就绪",
    load: "正在载入你的资料…",
    avatarHint: "支持常见图片格式，建议使用清晰的正方形头像。",
  },
  en: {
    passport: "Ocean Passport",
    logs: "Dive Logs",
    forum: "Deep Blue Forum",
    profile: "Profile",
    logout: "Sign out",
    eyebrow: "DIVER PROFILE",
    title: "Your profile",
    intro: "Let every logged descent carry a name that feels like yours.",
    userId: "User ID",
    accountNote: "Your user ID is unique. Email and account security details are never public.",
    changeAvatar: "Change photo",
    uploading: "Uploading…",
    identity: "Basic profile",
    diveProfile: "Diving profile",
    displayName: "Display name",
    bio: "Bio",
    bioPlaceholder: "Share your dive story, favorite waters, or where you want to go next…",
    cert: "Highest certification",
    tanks: "Total logged tanks",
    save: "Save profile",
    saving: "Saving…",
    saved: "Changes saved",
    publicPreview: "Public profile preview",
    publicHint: "These details appear in your Ocean Passport.",
    certified: "Certification",
    dives: "Dive logs",
    countries: "Places visited",
    privacy: "Privacy",
    privacyText:
      "Your email, sign-in method and account security details are never shown publicly.",
    complete: "Profile complete",
    identityComplete: "Your diver identity is ready",
    load: "Loading your profile…",
    avatarHint: "Common image formats are supported. A clear square photo works best.",
  },
} as const;

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const { profile, avatarUrl, isPending } = useProfile();
  const { data: dives = [] } = useQuery({ queryKey: ["dives"], queryFn: listDives });
  const [name, setName] = useState("");
  const [cert, setCert] = useState("");
  const [tanks, setTanks] = useState("0");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarPreviewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    },
    [],
  );

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setCert(profile.cert_level ?? "");
      setTanks(String(profile.tank_count ?? 0));
      setBio(profile.bio ?? "");
    }
  }, [profile]);
  const save = useMutation({
    mutationFn: () =>
      updateMyProfile({
        display_name: name.trim() || (language === "zh-CN" ? "潜水员" : "Diver"),
        cert_level: cert || null,
        tank_count: Math.max(0, Number(tanks) || 0),
        bio: bio.trim().slice(0, 300) || null,
      }),
    onSuccess: () => {
      queryClient.setQueryData(["profile"], profile ? {
        ...profile,
        display_name: name.trim() || (language === "zh-CN" ? "潜水员" : "Diver"),
        cert_level: cert || null,
        tank_count: Math.max(0, Number(tanks) || 0),
        bio: bio.trim().slice(0, 300) || null,
      } : profile);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      toast.success(language === "zh-CN" ? "个人资料已保存" : "Profile saved");
    },
    onError: () =>
      toast.error(language === "zh-CN" ? "保存失败，请重试" : "Couldn't save. Please try again."),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (path) => {
      queryClient.setQueryData<Profile | null>(["profile"], (current) =>
        current ? { ...current, avatar_url: path } : current,
      );
      void signedAvatarUrl(path)
        .then((signedUrl) => queryClient.setQueryData(["avatar-url", path], signedUrl))
        .catch(() => queryClient.invalidateQueries({ queryKey: ["avatar-url", path] }));
      toast.success(language === "zh-CN" ? "头像已更新" : "Photo updated");
    },
    onError: (error) => {
      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = null;
      setAvatarPreview(null);
      toast.error(
        error instanceof Error
          ? error.message
          : language === "zh-CN"
            ? "头像上传失败"
            : "Photo upload failed",
      );
    },
  });
  const displayedAvatar = avatarPreview ?? avatarUrl;
  const display = name.trim() || (language === "zh-CN" ? "潜水员" : "Diver");
  const initials = display.slice(0, 1).toUpperCase();
  const countries = useMemo(
    () => new Set(dives.map((dive) => dive.country.trim()).filter(Boolean)).size,
    [dives],
  );
  const complete = Math.round(
    ([name.trim(), cert, Number(tanks) > 0, displayedAvatar, bio.trim()].filter(Boolean).length / 5) * 100,
  );
  function changed(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="do-profile-page">
      <header className="do-passport-header do-profile-header">
        <Link to="/dives" className="do-brand" aria-label="SupDiver">
          <span className="do-brand-mark">
            <img src="/images/supdiver-wave-mark.svg" alt="" />
          </span>
          <b>SupDiver</b>
        </Link>
<MainNavigation />
        <div className="do-passport-header-actions">
          <button type="button" className="do-passport-language" onClick={toggleLanguage}>
            <Languages aria-hidden="true" />
            {language === "zh-CN" ? "EN" : "中文"}
          </button>
          <span className="do-passport-account">
            <Avatar>
              <AvatarImage src={displayedAvatar ?? undefined} alt={display} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span>{display}</span>
          </span>
          <button
            type="button"
            className="do-passport-logout"
            onClick={signOut}
            aria-label={c.logout}
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>
      <main id="profile-editor" className="do-profile-main">
        <section className="do-profile-intro">
          <span>{c.eyebrow}</span>
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
        </section>
        {isPending ? (
          <div className="do-profile-loading">{c.load}</div>
        ) : (
          <div className="do-profile-layout">
            <aside className="do-profile-identity-card">
              <div className="do-profile-avatar-wrap">
                <Avatar className="do-profile-avatar">
                  <AvatarImage src={displayedAvatar ?? undefined} alt={display} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  aria-label={c.changeAvatar}
                  disabled={upload.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera aria-hidden="true" />
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
                    const previewUrl = URL.createObjectURL(file);
                    avatarPreviewRef.current = previewUrl;
                    setAvatarPreview(previewUrl);
                    upload.mutate(file);
                  }
                  event.target.value = "";
                }}
              />
              <div className="do-profile-identity-copy">
                <small>SUPDIVER / PROFILE</small>
                <strong>{display}</strong>
                <span>@{profile?.id?.slice(0, 8) ?? "diver"}</span>
                {bio.trim() && <p className="do-profile-bio">{bio.trim()}</p>}
              </div>
              <dl className="do-profile-account-data">
                <div>
                  <dt>{c.userId}</dt>
                  <dd>{profile?.id?.slice(0, 8) ?? "—"}</dd>
                </div>
                <div>
                  <dt>{c.changeAvatar}</dt>
                  <dd>{upload.isPending ? c.uploading : c.changeAvatar}</dd>
                </div>
              </dl>
              <p className="do-profile-account-note">
                <ShieldCheck aria-hidden="true" />
                {c.accountNote}
              </p>
            </aside>
            <section className="do-profile-editor-panel">
              <div className="do-profile-section-heading">
                <div>
                  <span>01 / IDENTITY</span>
                  <h2>{c.identity}</h2>
                </div>
                <UserRound aria-hidden="true" />
              </div>
              <div className="do-profile-cover-upload">
                <div
                  className="do-profile-cover-upload-photo"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, rgba(0,16,38,.12), rgba(0,14,34,.5)), url('/images/user-cave-photo-hero-preview.jpg')",
                  }}
                >
                  <span>SUPDIVER</span>
                </div>
                <div>
                  <strong>{c.changeAvatar}</strong>
                  <p>{c.avatarHint}</p>
                </div>
                <button
                  type="button"
                  disabled={upload.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera aria-hidden="true" />
                  {upload.isPending ? c.uploading : c.changeAvatar}
                </button>
              </div>
              <div className="do-profile-fields">
                <label className="do-profile-wide">
                  <span>{c.displayName}</span>
                  <input
                    value={name}
                    maxLength={40}
                    onChange={(event) => changed(setName, event.target.value)}
                  />
                </label>
                <label className="do-profile-wide">
                  <span>{c.bio}</span>
                  <textarea
                    value={bio}
                    maxLength={300}
                    rows={4}
                    placeholder={c.bioPlaceholder}
                    onChange={(event) => changed(setBio, event.target.value)}
                  />
                  <small>{bio.length} / 300</small>
                </label>
              </div>
              <div className="do-profile-section-heading do-profile-dive-heading">
                <div>
                  <span>02 / DIVER</span>
                  <h2>{c.diveProfile}</h2>
                </div>
                <Waves aria-hidden="true" />
              </div>
              <div className="do-profile-fields">
                <label>
                  <span>{c.cert}</span>
                  <select value={cert} onChange={(event) => changed(setCert, event.target.value)}>
                    <option value="">—</option>
                    {CERT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{c.tanks}</span>
                  <input
                    type="number"
                    min="0"
                    value={tanks}
                    onChange={(event) => changed(setTanks, event.target.value)}
                  />
                </label>
              </div>
              <div className="do-profile-editor-footer">
                <span className="do-profile-save-status">
                  {saved && (
                    <>
                      <Check aria-hidden="true" />
                      {c.saved}
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="do-profile-save"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? (
                    <Waves aria-hidden="true" />
                  ) : saved ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Save aria-hidden="true" />
                  )}
                  {save.isPending ? c.saving : c.save}
                </button>
              </div>
            </section>
            <aside className="do-profile-preview-column">
              <section className="do-profile-public-card">
                <div
                  className="do-profile-public-photo"
                  style={{
                    backgroundImage:
                      "linear-gradient(0deg, rgba(0,12,31,.9), rgba(0,11,29,.06) 68%), url('/images/user-cave-photo-hero-preview.jpg')",
                  }}
                >
                  <span>{c.publicPreview}</span>
                  <div>
                    <small>@{profile?.id?.slice(0, 8) ?? "diver"}</small>
                    <strong>{display}</strong>
                    <p>{bio.trim() || c.publicHint}</p>
                  </div>
                </div>
                <div className="do-profile-public-stats">
                  <div>
                    <strong>{dives.length}</strong>
                    <small>{c.dives}</small>
                  </div>
                  <div>
                    <strong>{countries}</strong>
                    <small>{c.countries}</small>
                  </div>
                  <div>
                    <strong>{Math.max(0, Number(tanks) || 0)}</strong>
                    <small>{c.tanks}</small>
                  </div>
                </div>
                <div className="do-profile-cert-preview">
                  <Award aria-hidden="true" />
                  <span>
                    <small>{c.certified}</small>
                    <strong>{cert || "—"}</strong>
                  </span>
                </div>
                <p className="do-profile-public-hint">{c.publicHint}</p>
              </section>
              <section className="do-profile-completeness">
                <div
                  className="do-profile-complete-ring"
                  style={{
                    background: `conic-gradient(#54c9f7 0 ${complete}%, rgba(80,173,215,.12) ${complete}% 100%)`,
                  }}
                >
                  <span>
                    {complete}
                    <small>%</small>
                  </span>
                </div>
                <div>
                  <strong>{c.complete}</strong>
                  <p>{c.identityComplete}</p>
                </div>
              </section>
              <section className="do-profile-privacy">
                <ShieldCheck aria-hidden="true" />
                <div>
                  <strong>{c.privacy}</strong>
                  <p>{c.privacyText}</p>
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>
      <footer className="do-passport-footer">
        <span>SupDiver</span>
        <small>YOUR OCEAN. YOUR STORY.</small>
      </footer>
    </div>
  );
}
import { MainNavigation } from "@/components/MainNavigation";
