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
import { profileAge, profileToday } from "@/lib/profile-demographics";
import "@/styles/profile-demographics.css";
import {
  CERT_LEVELS,
  signedAvatarUrl,
  updateMyProfile,
  uploadAvatar,
  uploadProfileBackground,
  ProfileConflictError,
  type Profile,
  type ProfileUpdate,
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
    changeBackground: "更换个人主页背景图",
    backgroundHint: "支持 JPG、PNG、WebP，最大 10MB，建议使用横向图片。选择后自动保存，不会更改头像。",
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
    loadError: "暂时无法读取个人资料，请重新加载后再编辑。",
    retry: "重新加载",
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
    changeBackground: "Change homepage background",
    backgroundHint: "JPG, PNG or WebP, up to 10MB. A landscape image works best. Saves automatically without changing your avatar.",
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
    loadError: "Your profile couldn't be loaded. Please reload before editing.",
    retry: "Reload profile",
    avatarHint: "Common image formats are supported. A clear square photo works best.",
  },
} as const;

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const backgroundFileRef = useRef<HTMLInputElement>(null);
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const { profile, avatarUrl, backgroundUrl, isPending, isError, refetch } = useProfile();
  const { data: dives = [] } = useQuery({ queryKey: ["dives"], queryFn: listDives });
  const [name, setName] = useState("");
  const [cert, setCert] = useState("");
  const [tanks, setTanks] = useState("0");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [region, setRegion] = useState("");
  const [agePublic, setAgePublic] = useState(false);
  const [regionPublic, setRegionPublic] = useState(false);
  const age = profileAge(birthDate);
  function loadDemographics(value: Profile) {
    setBirthDate(value.birth_date ?? "");
    setRegion(value.region ?? "");
    setAgePublic(value.age_public ?? false);
    setRegionPublic(value.region_public ?? false);
  }
  const [saved, setSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarPreviewRef = useRef<string | null>(null);
  const initializedAccount = useRef<string | null>(null);
  const editBaseline = useRef<Profile | null>(null);
  const [conflict, setConflict] = useState(false);
  const operationRef = useRef<"save" | "upload" | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    };
  }, []);

  useEffect(() => {
    // Avatar/cache refreshes must never reset unsaved text in this editor.
    if (profile && initializedAccount.current !== profile.id) {
      initializedAccount.current = profile.id;
      editBaseline.current = { ...profile };
      setConflict(false);
      setName(profile.display_name ?? "");
      setCert(profile.cert_level ?? "");
      setTanks(String(profile.tank_count ?? 0));
      setBio(profile.bio ?? "");
      loadDemographics(profile);
    }
  }, [profile]);
  const save = useMutation({
    mutationFn: ({
      values,
      accountId,
      baseline,
    }: {
      values: ProfileUpdate;
      accountId: string;
      baseline: Pick<Profile, keyof ProfileUpdate>;
    }) => updateMyProfile(values, accountId, baseline),
    onSuccess: (confirmed: Profile) => {
      if (!mountedRef.current) return;
      // Only the database-confirmed values may be labelled as saved.
      queryClient.setQueryData(["profile"], confirmed);
      editBaseline.current = { ...confirmed };
      setConflict(false);
      setName(confirmed.display_name ?? "");
      setCert(confirmed.cert_level ?? "");
      setTanks(String(confirmed.tank_count));
      setBio(confirmed.bio ?? "");
      loadDemographics(confirmed);
      void queryClient.invalidateQueries({ queryKey: ["public-profile", confirmed.id] });
      setSaved(true);
      toast.success(language === "zh-CN" ? "个人资料已保存" : "Profile saved");
    },
    onError: (error) => {
      if (mountedRef.current && error instanceof ProfileConflictError) setConflict(true);
      if (mountedRef.current)
        toast.error(
          language === "zh-CN"
            ? "保存失败，修改内容已保留，请重试"
            : "Couldn't save. Your edits are kept; please try again.",
        );
    },
    onSettled: () => {
      operationRef.current = null;
    },
  });
  const upload = useMutation({
    mutationFn: ({
      file,
      accountId,
      baselineAvatar,
    }: {
      file: File;
      accountId: string;
      baselineAvatar: string | null;
    }) => uploadAvatar(file, accountId, baselineAvatar),
    onSuccess: (path, { accountId }) => {
      if (!mountedRef.current) return;
      queryClient.setQueryData<Profile | null>(["profile"], (current) =>
        current ? { ...current, avatar_url: path } : current,
      );
      void signedAvatarUrl(path)
        .then((signedUrl) => {
          if (mountedRef.current) queryClient.setQueryData(["avatar-url", path], signedUrl);
        })
        .catch(() => {
          if (mountedRef.current)
            void queryClient.invalidateQueries({ queryKey: ["avatar-url", path] });
        });
      void queryClient.invalidateQueries({ queryKey: ["public-profile", accountId] });
      toast.success(language === "zh-CN" ? "头像已更新" : "Photo updated");
    },
    onError: (error) => {
      if (!mountedRef.current) return;
      if (error instanceof ProfileConflictError) setConflict(true);
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
    onSettled: () => {
      operationRef.current = null;
    },
  });
  const backgroundUpload = useMutation({
    mutationFn: ({ file, accountId, baseline }: {
      file: File; accountId: string; baseline: string | null;
    }) => uploadProfileBackground(file, accountId, baseline),
    onSuccess: (path, { accountId }) => {
      if (!mountedRef.current) return;
      queryClient.setQueryData<Profile | null>(["profile"], (current) =>
        current?.id === accountId ? { ...current, background_url: path } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["profile-background-url", path] });
      toast.success(language === "zh-CN" ? "个人主页背景图已更新" : "Homepage background updated");
    },
    onError: (error) => {
      if (!mountedRef.current) return;
      if (error instanceof ProfileConflictError) setConflict(true);
      toast.error(error instanceof Error ? error.message : language === "zh-CN"
        ? "背景图上传失败，原背景未更改" : "Upload failed. Your previous background is unchanged.");
    },
    onSettled: () => { operationRef.current = null; },
  });
  const busy = save.isPending || upload.isPending || backgroundUpload.isPending;
  const displayedAvatar = avatarPreview ?? avatarUrl;
  const display = name.trim() || (language === "zh-CN" ? "潜水员" : "Diver");
  const initials = display.slice(0, 1).toUpperCase();
  const countries = useMemo(
    () => new Set(dives.map((dive) => dive.country.trim()).filter(Boolean)).size,
    [dives],
  );
  const complete = Math.round(
    ([name.trim(), cert, Number(tanks) > 0, displayedAvatar, bio.trim()].filter(Boolean).length /
      5) *
      100,
  );
  function changed<T,>(setter: (value: T) => void, value: T) {
    if (operationRef.current) return;
    setter(value);
    setSaved(false);
  }
  function saveProfile() {
    if (
      operationRef.current ||
      conflict ||
      isPending ||
      isError ||
      !profile ||
      !editBaseline.current
    )
      return;
    const count = Number(tanks);
    if (birthDate && age === null) {
      toast.error(language === "zh-CN" ? "请填写有效且不晚于今天的出生日期" : "Enter a valid date of birth, no later than today.");
      return;
    }
    if (!Number.isInteger(count) || count < 0 || count > 2147483647) {
      toast.error(
        language === "zh-CN"
          ? "潜水瓶数请填写有效的非负整数"
          : "Enter a valid non-negative whole number of tanks.",
      );
      return;
    }
    operationRef.current = "save";
    setSaved(false);
    save.mutate({
      accountId: profile.id,
      baseline: { ...editBaseline.current },
      values: {
        display_name: name.trim() || (language === "zh-CN" ? "潜水员" : "Diver"),
        cert_level: cert || null,
        tank_count: count,
        bio: bio.trim().slice(0, 300) || null,
        birth_date: birthDate || null,
        region: region.trim() || null,
        age_public: agePublic,
        region_public: regionPublic,
      },
    });
  }
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }
  async function reloadProfile() {
    if (
      operationRef.current ||
      !window.confirm(
        language === "en"
          ? "Discard unsaved profile edits and load the latest profile?"
          : "放弃尚未保存的资料修改并加载最新资料？",
      )
    )
      return;
    operationRef.current = "save";
    try {
      const result = await refetch();
      if (!mountedRef.current) return;
      if (result.error || !result.data || result.data.id !== profile?.id) {
        toast.error(c.loadError);
        return;
      }
      const latest = result.data;
      editBaseline.current = { ...latest };
      setName(latest.display_name ?? "");
      setCert(latest.cert_level ?? "");
      setTanks(String(latest.tank_count));
      setBio(latest.bio ?? "");
      loadDemographics(latest);
      setConflict(false);
      setSaved(false);
    } catch {
      if (mountedRef.current) toast.error(c.loadError);
    } finally {
      operationRef.current = null;
    }
  }

  return (
    <div className="do-profile-page" style={backgroundUrl ? {
      backgroundImage: `linear-gradient(rgba(0,12,30,.82), rgba(0,12,30,.94)), url(${JSON.stringify(backgroundUrl)})`,
      backgroundSize: "cover", backgroundPosition: "center top", backgroundAttachment: "fixed",
    } : undefined}>
      <main id="profile-editor" className="do-profile-main">
        <section className="do-profile-intro">
          <span>{c.eyebrow}</span>
          <h1>{c.title}</h1>
          <p>{c.intro}</p>
        </section>
        {conflict && (
          <div role="alert">
            <p>
              {language === "en"
                ? "Profile changed elsewhere. Your edits are kept; copy them before reloading."
                : "资料已在其他页面修改，当前输入已保留，请先复制需要的内容再重新加载。"}
            </p>
            <button type="button" disabled={busy} onClick={() => void reloadProfile()}>
              {c.retry}
            </button>
          </div>
        )}
        {isPending ? (
          <div className="do-profile-loading">{c.load}</div>
        ) : isError || !profile ? (
          <div className="do-profile-loading" role="alert">
            <p>{c.loadError}</p>
            <button type="button" className="do-profile-save" onClick={() => void refetch()}>
              {c.retry}
            </button>
          </div>
        ) : (
          <div className="do-profile-layout" aria-busy={busy}>
            <aside className="do-profile-identity-card">
              <div className="do-profile-avatar-wrap">
                <Avatar className="do-profile-avatar">
                  <AvatarImage src={displayedAvatar ?? undefined} alt={display} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  aria-label={c.changeAvatar}
                  disabled={busy}
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
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && !operationRef.current && !conflict && profile && !isError) {
                    operationRef.current = "upload";
                    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
                    const previewUrl = URL.createObjectURL(file);
                    avatarPreviewRef.current = previewUrl;
                    setAvatarPreview(previewUrl);
                    upload.mutate({
                      file,
                      accountId: profile.id,
                      baselineAvatar: profile.avatar_url,
                    });
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
              <Link to="/settings" className="m-5 inline-block text-sm text-sky-400 underline">
                {language === "zh-CN" ? "账号设置与注销" : "Account settings & deletion"}
              </Link>
            </aside>
            <section className="do-profile-editor-panel">
              <div className="do-profile-section-heading">
                <div>
                  <span>01 / IDENTITY</span>
                  <h2>{c.identity}</h2>
                </div>
                <UserRound aria-hidden="true" />
              </div>
              <input
                ref={backgroundFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                hidden
                disabled={busy || conflict}
                aria-label={c.changeBackground}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && !operationRef.current && !conflict && profile && !isError) {
                    operationRef.current = "upload";
                    backgroundUpload.mutate({
                      file, accountId: profile.id, baseline: profile.background_url ?? null,
                    });
                  }
                  event.target.value = "";
                }}
              />
              <div className="do-profile-cover-upload">
                <div
                  className="do-profile-cover-upload-photo"
                  style={{
                    backgroundImage:
                      `linear-gradient(90deg, rgba(0,16,38,.12), rgba(0,14,34,.5)), url(${JSON.stringify(backgroundUrl ?? "/images/user-cave-photo-hero-preview.jpg")})`,
                  }}
                >
                  <span>SUPDIVER</span>
                </div>
                <div>
                  <strong>{c.changeBackground}</strong>
                  <p>{c.backgroundHint}</p>
                </div>
                <button type="button" disabled={busy || conflict} onClick={() => backgroundFileRef.current?.click()}>
                  <Camera aria-hidden="true" />
                  {backgroundUpload.isPending ? c.uploading : c.changeBackground}
                </button>
              </div>
              <div className="do-profile-fields">
                <div>
                  <label>
                    <span>{language === "zh-CN" ? "出生日期（选填，仅自己可见）" : "Date of birth (optional, private)"}</span>
                    <input aria-label="birth-date" type="date" min="1900-01-01" max={profileToday()} value={birthDate} disabled={busy} onChange={(event) => changed(setBirthDate, event.target.value)} />
                  </label>
                  <small>{language === "zh-CN" ? `年龄：${age === null ? "未填写" : `${age} 岁`}。公开时仅显示年龄，不显示出生日期。` : `Age: ${age ?? "not provided"}. Only age can be public, never your date of birth.`}</small>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <input style={{ width: "auto" }} aria-label="age-public" type="checkbox" checked={agePublic} disabled={busy} onChange={(event) => changed(setAgePublic, event.target.checked)} />
                    <span>{language === "zh-CN" ? "公开展示年龄" : "Show age publicly"}</span>
                  </label>
                </div>
                <div>
                  <label>
                    <span>{language === "zh-CN" ? "地区（选填）" : "Region (optional)"}</span>
                    <input aria-label="region" value={region} maxLength={80} disabled={busy} placeholder={language === "zh-CN" ? "例如：中国 · 上海（无需详细地址）" : "e.g. China · Shanghai (no street address)"} onChange={(event) => changed(setRegion, event.target.value)} />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <input style={{ width: "auto" }} aria-label="region-public" type="checkbox" checked={regionPublic} disabled={busy} onChange={(event) => changed(setRegionPublic, event.target.checked)} />
                    <span>{language === "zh-CN" ? "公开展示地区" : "Show region publicly"}</span>
                  </label>
                </div>
                <label className="do-profile-wide">
                  <span>{c.displayName}</span>
                  <input
                    value={name}
                    disabled={busy}
                    maxLength={40}
                    onChange={(event) => changed(setName, event.target.value)}
                  />
                </label>
                <label className="do-profile-wide">
                  <span>{c.bio}</span>
                  <textarea
                    value={bio}
                    disabled={busy}
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
              <Link
                to="/certificates"
                className="do-profile-cert-link"
                style={{ margin: "18px 28px 0" }}
              >
                <Award aria-hidden="true" />
                {language === "zh-CN"
                  ? "管理我的证书档案与正面照片"
                  : "Manage my certificates and front photos"}
              </Link>
              <div className="do-profile-fields">
                <label>
                  <span>{c.cert}</span>
                  <select
                    disabled={busy}
                    value={cert}
                    onChange={(event) => changed(setCert, event.target.value)}
                  >
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
                    max="2147483647"
                    step="1"
                    disabled={busy}
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
                  disabled={busy || conflict}
                  onClick={saveProfile}
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
                      `linear-gradient(0deg, rgba(0,12,31,.9), rgba(0,11,29,.06) 68%), url(${JSON.stringify(backgroundUrl ?? "/images/user-cave-photo-hero-preview.jpg")})`,
                  }}
                >
                  <span>{c.publicPreview}</span>
                  <div>
                    <small>@{profile?.id?.slice(0, 8) ?? "diver"}</small>
                    <strong>{display}</strong>
                    <p>{bio.trim() || c.publicHint}</p>
                  </div>
                </div>
                {(agePublic && age !== null || regionPublic && region.trim()) && <p style={{ padding: "16px 28px", overflowWrap: "anywhere" }}>
                  {agePublic && age !== null && <span>{language === "zh-CN" ? `${age} 岁` : `Age ${age}`}</span>}
                  {agePublic && age !== null && regionPublic && region.trim() ? " · " : ""}
                  {regionPublic && region.trim()}
                </p>}
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
