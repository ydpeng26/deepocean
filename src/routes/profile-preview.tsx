import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Award,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Languages,
  MapPin,
  Save,
  ShieldCheck,
  UserRound,
  Upload,
  Waves,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/profile-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "个人资料编辑预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ProfilePreview,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", profile: "个人资料", eyebrow: "DIVER PROFILE", title: "个人资料",
    intro: "让每一次被记录的下潜，都带着属于你的名字", preview: "设计预览 · 修改内容会同步显示在右侧公开资料卡片中",
    account: "账号身份", userId: "用户 ID", joined: "加入 SupDiver", accountNote: "用户 ID 是你的唯一身份，注册后暂不支持修改",
    avatar: "个人头像", changeAvatar: "更换头像", cover: "个人主页背景", uploadCover: "上传背景图", coverHint: "建议使用横向水下照片，上传后会立即显示在公开资料预览中", identity: "基础资料", diveProfile: "潜水资料",
    displayName: "显示名称", bio: "个人简介", location: "常驻地区", language: "常用语言", diveSince: "开始潜水年份",
    homeWater: "最常去的海域", cert: "当前最高证书", tanks: "累计潜水瓶数", save: "保存个人资料", saved: "更改已保存",
    publicPreview: "公开资料预览", publicHint: "以下内容会出现在你的海洋护照和公开动态中", certified: "认证等级",
    memberSince: "加入时间", dives: "累计潜水", countries: "到访海域", privacy: "隐私说明", privacyText: "邮箱、登录方式和账号安全信息不会出现在公开资料中",
    bioDefault: "喜欢在水下寻找那些安静又奇妙的瞬间。", china: "中国 · 南京", ocean: "印度尼西亚 · 巴厘岛", chinese: "中文（简体）", public: "公开", private: "不公开",
    saving: "保存中…", editCertificate: "管理潜水证书", complete: "资料完整度", identityComplete: "你的潜水员身份已初具轮廓",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", profile: "Profile", eyebrow: "DIVER PROFILE", title: "Your profile",
    intro: "Let every logged descent carry a name that feels like yours", preview: "Design preview · Changes appear instantly in the public profile card",
    account: "Account identity", userId: "User ID", joined: "Joined SupDiver", accountNote: "Your user ID is unique and cannot currently be changed after registration",
    avatar: "Profile photo", changeAvatar: "Change photo", cover: "Profile background", uploadCover: "Upload background", coverHint: "A horizontal underwater photo works best and appears instantly in the public preview", identity: "Basic profile", diveProfile: "Diving profile",
    displayName: "Display name", bio: "Bio", location: "Home location", language: "Preferred language", diveSince: "Diving since",
    homeWater: "Favourite waters", cert: "Highest certification", tanks: "Total dives", save: "Save profile", saved: "Changes saved",
    publicPreview: "Public profile preview", publicHint: "This information appears in your Ocean Passport and public posts", certified: "Certification",
    memberSince: "Member since", dives: "Total dives", countries: "Places visited", privacy: "Privacy", privacyText: "Your email, sign-in method and account security details are never shown publicly",
    bioDefault: "I love finding quiet, unexpected moments beneath the surface.", china: "Nanjing, China", ocean: "Bali, Indonesia", chinese: "Simplified Chinese", public: "Public", private: "Private",
    saving: "Saving…", editCertificate: "Manage certifications", complete: "Profile complete", identityComplete: "Your diver identity is taking shape",
  },
} as const;

const avatarChoices = [
  "/images/user-fish-hero-preview.jpg",
  "/images/user-cave-photo-hero-preview.jpg",
  "/images/supdiver-six-orange-fish-hero.png",
];

function ProfilePreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(avatarChoices[0]);
  const [coverPhoto, setCoverPhoto] = useState("/images/user-cave-photo-hero-preview.jpg");
  const [showAvatars, setShowAvatars] = useState(false);
  const [displayName, setDisplayName] = useState("ydpeng7");
  const [bio, setBio] = useState(c.bioDefault);
  const [location, setLocation] = useState(c.china);
  const [showLocation, setShowLocation] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState(c.chinese);
  const [diveSince, setDiveSince] = useState("2024");
  const [homeWater, setHomeWater] = useState(c.ocean);
  const [certification, setCertification] = useState("AOW · Advanced Open Water");
  const [tanks, setTanks] = useState("18");
  const [saved, setSaved] = useState(false);
  const initials = useMemo(() => (displayName.trim() || "D").slice(0, 1).toUpperCase(), [displayName]);

  function markChanged(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }

  return <div className="do-profile-page">
    <header className="do-passport-header do-profile-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview">{c.logs}</Link><a href="#profile-editor" aria-current="page">{c.profile}</a></nav>
      <div className="do-passport-header-actions"><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><span className="do-passport-account"><Avatar><AvatarImage src={avatar} alt={displayName} /><AvatarFallback>{initials}</AvatarFallback></Avatar><span>{displayName || "preview-visitor"}</span></span></div>
    </header>

    <main id="profile-editor" className="do-profile-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <section className="do-profile-intro"><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></section>

      <div className="do-profile-layout">
        <aside className="do-profile-identity-card">
          <div className="do-profile-avatar-wrap">
            <Avatar className="do-profile-avatar"><AvatarImage src={avatar} alt={displayName} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
            <button type="button" aria-label={c.changeAvatar} onClick={() => setShowAvatars((open) => !open)}><Camera aria-hidden="true" /></button>
          </div>
          <div className="do-profile-identity-copy"><small>SUPDIVER / PROFILE</small><strong>{displayName || "preview-visitor"}</strong><span>@preview-visitor</span></div>
          {showAvatars && <div className="do-profile-avatar-choices">{avatarChoices.map((choice) => <button key={choice} type="button" data-active={avatar === choice} style={{ backgroundImage: `url('${choice}')` }} onClick={() => { setAvatar(choice); setShowAvatars(false); setSaved(false); }} />)}</div>}
          <dl className="do-profile-account-data"><div><dt>{c.userId}</dt><dd>preview-visitor</dd></div><div><dt>{c.joined}</dt><dd>2026.08</dd></div></dl>
          <p className="do-profile-account-note"><ShieldCheck aria-hidden="true" />{c.accountNote}</p>
        </aside>

        <section className="do-profile-editor-panel">
          <div className="do-profile-section-heading"><div><span>01 / IDENTITY</span><h2>{c.identity}</h2></div><UserRound aria-hidden="true" /></div>
          <div className="do-profile-cover-upload">
            <div className="do-profile-cover-upload-photo" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,16,38,.12), rgba(0,14,34,.5)), url('${coverPhoto}')` }}><span>{c.cover}</span></div>
            <div><strong>{c.cover}</strong><p>{c.coverHint}</p></div>
            <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) { setCoverPhoto(URL.createObjectURL(file)); setSaved(false); } event.target.value = ""; }} />
            <button type="button" onClick={() => coverInputRef.current?.click()}><Upload aria-hidden="true" />{c.uploadCover}</button>
          </div>
          <div className="do-profile-fields">
            <label><span>{c.displayName}</span><input value={displayName} maxLength={40} onChange={(event) => markChanged(setDisplayName, event.target.value)} /></label>
            <div className="do-profile-field"><div className="do-profile-field-heading"><span>{c.location}</span><button type="button" data-active={showLocation} aria-pressed={showLocation} onClick={() => { setShowLocation((visible) => !visible); setSaved(false); }}>{showLocation ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{showLocation ? c.public : c.private}</button></div><input value={location} onChange={(event) => markChanged(setLocation, event.target.value)} /></div>
            <label className="do-profile-wide"><span>{c.bio}</span><textarea value={bio} maxLength={160} onChange={(event) => markChanged(setBio, event.target.value)} /><small>{bio.length} / 160</small></label>
            <label><span>{c.language}</span><select value={preferredLanguage} onChange={(event) => markChanged(setPreferredLanguage, event.target.value)}><option>{c.chinese}</option><option>English</option></select></label>
            <label><span>{c.diveSince}</span><input type="number" min="1950" max="2026" value={diveSince} onChange={(event) => markChanged(setDiveSince, event.target.value)} /></label>
          </div>

          <div className="do-profile-section-heading do-profile-dive-heading"><div><span>02 / DIVER</span><h2>{c.diveProfile}</h2></div><Waves aria-hidden="true" /></div>
          <div className="do-profile-fields">
            <label className="do-profile-wide"><span>{c.homeWater}</span><input value={homeWater} onChange={(event) => markChanged(setHomeWater, event.target.value)} /></label>
            <label><span>{c.cert}</span><select value={certification} onChange={(event) => markChanged(setCertification, event.target.value)}><option>OW · Open Water</option><option>AOW · Advanced Open Water</option><option>Rescue Diver</option><option>Divemaster</option></select></label>
            <label><span>{c.tanks}</span><input type="number" min="0" value={tanks} onChange={(event) => markChanged(setTanks, event.target.value)} /></label>
          </div>
          <div className="do-profile-editor-footer"><Link to="/certificates-preview" className="do-profile-cert-link">{c.editCertificate}<ChevronRight aria-hidden="true" /></Link><button type="button" className="do-profile-save" onClick={() => setSaved(true)}>{saved ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}{saved ? c.saved : c.save}</button></div>
        </section>

        <aside className="do-profile-preview-column">
          <section className="do-profile-public-card">
            <div className="do-profile-public-photo" style={{ backgroundImage: `linear-gradient(0deg, rgba(0,12,31,.9), rgba(0,11,29,.06) 68%), url('${coverPhoto}')` }}><span>{c.publicPreview}</span><div><small>@preview-visitor</small><strong>{displayName || "preview-visitor"}</strong><p>{bio}</p></div></div>
            {showLocation && <div className="do-profile-public-location"><MapPin aria-hidden="true" /><span><small>{c.location}</small><strong>{location}</strong></span></div>}
            <div className="do-profile-public-stats"><div><strong>{tanks || "0"}</strong><small>{c.dives}</small></div><div><strong>03</strong><small>{c.countries}</small></div><div><strong>{diveSince}</strong><small>{c.diveSince}</small></div></div>
            <div className="do-profile-cert-preview"><Award aria-hidden="true" /><span><small>{c.certified}</small><strong>{certification}</strong></span></div>
            <p className="do-profile-public-hint">{c.publicHint}</p>
          </section>
          <section className="do-profile-completeness"><div className="do-profile-complete-ring"><span>85<small>%</small></span></div><div><strong>{c.complete}</strong><p>{c.identityComplete}</p></div></section>
          <section className="do-profile-privacy"><ShieldCheck aria-hidden="true" /><div><strong>{c.privacy}</strong><p>{c.privacyText}</p></div></section>
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
