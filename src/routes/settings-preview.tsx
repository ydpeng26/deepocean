import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  CloudOff,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Languages,
  Laptop,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Waves,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/settings-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "设置与账号安全预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: SettingsPreview,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", profile: "个人资料", title: "设置与账号安全", eyebrow: "SETTINGS & SECURITY",
    intro: "管理登录方式、隐私边界和你的海洋数据", preview: "设计预览 · 以下操作仅展示交互，不会修改真实账号",
    account: "账号身份", member: "ydpeng7", email: "ydpe**7@163.com", verified: "邮箱已验证", security: "安全状态", strong: "保护良好", score: "安全评分",
    navAccount: "登录与安全", navPrivacy: "隐私与数据", navNotice: "通知设置", navDanger: "账号操作",
    signIn: "登录与安全", signInHint: "确认登录方式，并及时处理任何不属于你的活动", emailLogin: "登录邮箱", emailHint: "用于登录、找回密码和接收安全提醒", change: "修改", password: "账号密码", passwordHint: "上次修改于 2026 年 9 月 28 日", changePassword: "修改密码",
    google: "Google 账号", googleHint: "ydpdec26@gmail.com", linked: "已关联", unlink: "解除关联", twoStep: "两步验证", twoStepHint: "登录时增加一次动态验证，即使密码泄露也能保护账号", recommended: "建议开启", enabled: "已开启", enable: "开启两步验证", disable: "关闭",
    privacy: "隐私与数据", privacyHint: "决定哪些信息可以被其他潜水员看见", publicProfile: "公开个人海洋护照", publicHint: "其他用户可以查看你公开的潜水足迹和日志", region: "显示常驻地区", regionHint: "只展示城市，不公开精确位置", searchable: "允许通过用户 ID 找到我", searchableHint: "关闭后，其他用户无法通过搜索发现你的账号",
    notices: "安全通知", noticeHint: "重要账号活动始终会通过邮箱提醒", newLogin: "新设备登录提醒", syncNotice: "离线草稿同步完成提醒",
    devices: "登录设备", devicesHint: "发现陌生设备时，请立即退出并修改密码", current: "当前设备", mac: "这台 Mac · Safari", shanghai: "中国 · 上海", now: "正在使用", iphone: "iPhone 15 · 微信浏览器", nanjing: "中国 · 南京", last: "2 天前", signOut: "退出此设备", signedOut: "已退出",
    data: "数据与离线", synced: "所有草稿已同步", local: "当前设备没有待同步记录", openOffline: "查看离线草稿", export: "导出我的数据", exportHint: "生成包含日志、照片索引和个人资料的副本", preparing: "正在准备…", exportReady: "下载副本",
    danger: "账号操作", dangerHint: "这些操作会影响整个账号，请谨慎处理", deactivate: "停用账号", deactivateHint: "暂时隐藏资料，之后可重新登录恢复", delete: "永久删除账号", deleteHint: "删除账号、日志与已上传照片，操作不可撤销", manage: "管理",
    saved: "设置已保存", footer: "YOUR OCEAN. YOUR STORY.",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", profile: "Profile", title: "Settings & account security", eyebrow: "SETTINGS & SECURITY",
    intro: "Manage sign-in methods, privacy boundaries and your ocean data", preview: "Design preview · Interactions below do not change your real account",
    account: "Account identity", member: "ydpeng7", email: "ydpe**7@163.com", verified: "Email verified", security: "Security status", strong: "Well protected", score: "Security score",
    navAccount: "Sign-in & security", navPrivacy: "Privacy & data", navNotice: "Notifications", navDanger: "Account actions",
    signIn: "Sign-in & security", signInHint: "Review sign-in methods and respond to activity you do not recognise", emailLogin: "Sign-in email", emailHint: "Used to sign in, recover your password and receive security alerts", change: "Change", password: "Account password", passwordHint: "Last changed on Sep 28, 2026", changePassword: "Change password",
    google: "Google account", googleHint: "ydpdec26@gmail.com", linked: "Linked", unlink: "Unlink", twoStep: "Two-step verification", twoStepHint: "Add a dynamic verification step to protect your account even if your password is exposed", recommended: "Recommended", enabled: "Enabled", enable: "Enable two-step verification", disable: "Disable",
    privacy: "Privacy & data", privacyHint: "Choose what other divers can see", publicProfile: "Public ocean passport", publicHint: "Other users can view your public footprints and logs", region: "Show home region", regionHint: "Only the city is shown; precise location stays private", searchable: "Allow discovery by user ID", searchableHint: "When off, other users cannot find your account through search",
    notices: "Security notifications", noticeHint: "Important account activity is always sent by email", newLogin: "New-device sign-in alerts", syncNotice: "Offline draft sync alerts",
    devices: "Signed-in devices", devicesHint: "If a device looks unfamiliar, sign it out and change your password", current: "Current device", mac: "This Mac · Safari", shanghai: "Shanghai, China", now: "In use", iphone: "iPhone 15 · WeChat", nanjing: "Nanjing, China", last: "2 days ago", signOut: "Sign out device", signedOut: "Signed out",
    data: "Data & offline", synced: "All drafts synced", local: "No drafts are waiting on this device", openOffline: "View offline drafts", export: "Export my data", exportHint: "Create a copy of your logs, photo index and profile", preparing: "Preparing…", exportReady: "Download copy",
    danger: "Account actions", dangerHint: "These actions affect your whole account. Proceed carefully", deactivate: "Deactivate account", deactivateHint: "Temporarily hide your profile and restore it by signing in again", delete: "Permanently delete account", deleteHint: "Erase the account, logs and uploaded photos. This cannot be undone", manage: "Manage",
    saved: "Settings saved", footer: "YOUR OCEAN. YOUR STORY.",
  },
} as const;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" className="do-settings-toggle" aria-label={label} aria-pressed={checked} data-active={checked} onClick={onChange}><span /></button>;
}

function SettingsPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [twoStep, setTwoStep] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showRegion, setShowRegion] = useState(false);
  const [searchable, setSearchable] = useState(true);
  const [newLoginAlert, setNewLoginAlert] = useState(true);
  const [syncAlert, setSyncAlert] = useState(true);
  const [secondDevice, setSecondDevice] = useState(true);
  const [exportState, setExportState] = useState<"idle" | "preparing" | "ready">("idle");
  const securityScore = useMemo(() => twoStep ? 96 : 84, [twoStep]);

  function prepareExport() {
    if (exportState === "ready") return;
    setExportState("preparing");
    window.setTimeout(() => setExportState("ready"), 700);
  }

  return <div className="do-settings-page">
    <header className="do-passport-header do-settings-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview">{c.logs}</Link><Link to="/profile-preview">{c.profile}</Link><a href="#settings-account" aria-current="page">{language === "zh-CN" ? "设置" : "Settings"}</a></nav>
      <div className="do-passport-header-actions"><Link to="/offline-sync" className="do-passport-sync-link"><CloudOff aria-hidden="true" /><span>{language === "zh-CN" ? "离线草稿与同步" : "Offline drafts & sync"}</span></Link><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><span className="do-passport-account"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt={c.member} /><AvatarFallback>Y</AvatarFallback></Avatar><span>{c.member}</span></span></div>
    </header>

    <main className="do-settings-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <section className="do-settings-intro"><div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div><div className="do-settings-intro-mark"><Settings aria-hidden="true" /><span>SUPDIVER<br />ACCOUNT</span></div></section>

      <div className="do-settings-layout">
        <aside className="do-settings-identity">
          <div className="do-settings-kicker"><span>01 / IDENTITY</span><UserRound aria-hidden="true" /></div>
          <div className="do-settings-person"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt={c.member} /><AvatarFallback>Y</AvatarFallback></Avatar><strong>{c.member}</strong><span>{c.email}</span><em><Check aria-hidden="true" />{c.verified}</em></div>
          <div className="do-settings-score" style={{ "--settings-score": `${securityScore * 3.6}deg` } as React.CSSProperties}><div><ShieldCheck aria-hidden="true" /><strong>{securityScore}</strong><small>{c.score}</small></div></div>
          <div className="do-settings-security-state"><span>{c.security}</span><strong><ShieldCheck aria-hidden="true" />{c.strong}</strong></div>
          <nav className="do-settings-section-nav" aria-label={c.title}><a href="#settings-account"><LockKeyhole />{c.navAccount}<ChevronRight /></a><a href="#settings-privacy"><Eye />{c.navPrivacy}<ChevronRight /></a><a href="#settings-notice"><Bell />{c.navNotice}<ChevronRight /></a><a href="#settings-danger"><AlertTriangle />{c.navDanger}<ChevronRight /></a></nav>
        </aside>

        <div className="do-settings-centre">
          <section id="settings-account" className="do-settings-panel">
            <div className="do-settings-panel-heading"><div><span>02 / SECURITY</span><h2>{c.signIn}</h2><p>{c.signInHint}</p></div><LockKeyhole aria-hidden="true" /></div>
            <div className="do-settings-methods">
              <article><span className="do-settings-method-icon"><Mail /></span><div><strong>{c.emailLogin}</strong><p>{c.email}</p><small>{c.emailHint}</small></div><button type="button">{c.change}<ChevronRight /></button></article>
              <article><span className="do-settings-method-icon"><KeyRound /></span><div><strong>{c.password}</strong><p>••••••••••••</p><small>{c.passwordHint}</small></div><button type="button">{c.changePassword}<ChevronRight /></button></article>
              <article><span className="do-settings-method-icon"><Link2 /></span><div><strong>{c.google}</strong><p>{c.googleHint}</p><small className="do-settings-linked"><Check />{c.linked}</small></div><button type="button">{c.unlink}<ChevronRight /></button></article>
            </div>
            <div className="do-settings-two-step" data-enabled={twoStep}><span><Smartphone aria-hidden="true" /></span><div><small>{twoStep ? c.enabled : c.recommended}</small><h3>{c.twoStep}</h3><p>{c.twoStepHint}</p></div><button type="button" onClick={() => setTwoStep((value) => !value)}>{twoStep ? c.disable : c.enable}<ChevronRight /></button></div>
          </section>

          <section id="settings-privacy" className="do-settings-panel">
            <div className="do-settings-panel-heading"><div><span>03 / PRIVACY</span><h2>{c.privacy}</h2><p>{c.privacyHint}</p></div><Eye aria-hidden="true" /></div>
            <div className="do-settings-choice-list"><article><span><Globe2 /></span><div><strong>{c.publicProfile}</strong><p>{c.publicHint}</p></div><Toggle checked={publicProfile} onChange={() => setPublicProfile((value) => !value)} label={c.publicProfile} /></article><article><span><MapPin /></span><div><strong>{c.region}</strong><p>{c.regionHint}</p></div><Toggle checked={showRegion} onChange={() => setShowRegion((value) => !value)} label={c.region} /></article><article><span><UserRound /></span><div><strong>{c.searchable}</strong><p>{c.searchableHint}</p></div><Toggle checked={searchable} onChange={() => setSearchable((value) => !value)} label={c.searchable} /></article></div>
          </section>

          <section id="settings-notice" className="do-settings-panel do-settings-notice-panel">
            <div className="do-settings-panel-heading"><div><span>04 / ALERTS</span><h2>{c.notices}</h2><p>{c.noticeHint}</p></div><Bell aria-hidden="true" /></div>
            <div className="do-settings-notice-options"><label><span>{c.newLogin}</span><Toggle checked={newLoginAlert} onChange={() => setNewLoginAlert((value) => !value)} label={c.newLogin} /></label><label><span>{c.syncNotice}</span><Toggle checked={syncAlert} onChange={() => setSyncAlert((value) => !value)} label={c.syncNotice} /></label></div>
          </section>
        </div>

        <aside className="do-settings-right">
          <section className="do-settings-side-panel">
            <div className="do-settings-side-heading"><div><span>05 / DEVICES</span><h2>{c.devices}</h2></div><Laptop /></div><p>{c.devicesHint}</p>
            <div className="do-settings-device-list"><article data-current="true"><span><Laptop /></span><div><small>{c.current}</small><strong>{c.mac}</strong><em><MapPin />{c.shanghai}</em></div><b>{c.now}</b></article>{secondDevice && <article><span><Smartphone /></span><div><small>{c.last}</small><strong>{c.iphone}</strong><em><MapPin />{c.nanjing}</em></div><button type="button" onClick={() => setSecondDevice(false)}><LogOut />{c.signOut}</button></article>}{!secondDevice && <div className="do-settings-device-signed-out"><Check />{c.signedOut}</div>}</div>
          </section>

          <section className="do-settings-side-panel do-settings-data-panel">
            <div className="do-settings-side-heading"><div><span>06 / DATA</span><h2>{c.data}</h2></div><Database /></div>
            <div className="do-settings-sync-state"><span><Waves /></span><div><strong>{c.synced}</strong><small>{c.local}</small></div><Check /></div><Link to="/offline-sync" className="do-settings-side-link"><CloudOff />{c.openOffline}<ChevronRight /></Link>
            <div className="do-settings-export"><span><Download /></span><div><strong>{c.export}</strong><small>{c.exportHint}</small></div><button type="button" onClick={prepareExport}>{exportState === "preparing" ? c.preparing : exportState === "ready" ? c.exportReady : c.manage}</button></div>
          </section>

          <section id="settings-danger" className="do-settings-side-panel do-settings-danger-panel">
            <div className="do-settings-side-heading"><div><span>07 / ACCOUNT</span><h2>{c.danger}</h2></div><AlertTriangle /></div><p>{c.dangerHint}</p>
            <div className="do-settings-danger-actions"><button type="button"><span><strong>{c.deactivate}</strong><small>{c.deactivateHint}</small></span><ChevronRight /></button><button type="button"><Trash2 /><span><strong>{c.delete}</strong><small>{c.deleteHint}</small></span><ChevronRight /></button></div>
          </section>
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>{c.footer}</small></footer>
  </div>;
}
