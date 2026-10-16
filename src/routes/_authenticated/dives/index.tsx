import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Award, Bookmark, CalendarDays, ChevronRight, CloudOff, Compass, Languages, LogOut, Plus, Users, Waves } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScubaTankIcon } from "@/components/ScubaTankIcon";
import { OfflineSyncBanner } from "@/components/OfflineSyncBanner";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { listDives, signedPhotoUrls, type Dive } from "@/lib/dives";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dives/")({
  head: () => ({ meta: [
    { title: "我的海洋护照 · SupDiver" },
    { name: "description", content: "回看潜水足迹、海洋记忆与每一次下潜。" },
  ] }),
  component: OceanPassport,
});

const copy = {
  "zh-CN": {
    navPassport: "海洋护照", navLogs: "潜水日志", navForum: "深蓝论坛", navProfile: "个人资料", logout: "退出", offlineSync: "离线草稿与同步",
    eyebrow: "YOUR OCEAN PASSPORT", heading: "的海洋护照", intro: "那些与海洋相遇的日子，都在这里慢慢汇成你的故事。",
    addDive: "记录一次下潜", journey: "我的海洋旅程", dives: "潜水次数", countries: "到访国家 / 地区",
    maxDepth: "最大深度", underwater: "水下时光", latest: "最近一次下潜", latestEmpty: "你的第一段海洋记忆，正等待被写下。",
    openLog: "查看这次潜水", begin: "记录第一次潜水", identity: "潜水员身份", cert: "潜水证级别", certEmpty: "尚未填写",
    tanks: "现有瓶数", editProfile: "编辑个人资料", footprints: "海洋足迹", footprintsIntro: "每一处到访的海域，都是护照上的一枚印章。",
    footprintsEmpty: "从第一处潜点开始，留下你的海洋足迹。", records: "潜水日志", recordsIntro: "按下潜日期，重温每一段水下故事。",
    all: "查看全部记录", collapse: "收起记录", recordsEmpty: "还没有潜水记录。出水后，把新鲜的记忆写在这里。",
    retry: "重新加载", loadError: "暂时无法读取潜水记录，请稍后重试。", loading: "正在载入你的海洋故事…",
    noSite: "未命名潜点", duration: "分钟", photoAlt: "最近一次潜水的照片",
    previewNote: "设计预览 · 以下为示例数据；正式页面将显示你的个人记录",
    displayName: "显示名称", userId: "用户ID", mapTitle: "我的潜水地图", gear: "我的装备", gearEmpty: "整理常用装备与保养记录，让每一次出发更安心。", gearManage: "管理我的装备", certificate: "潜水证书登记", certHint: "当前证书级别来自个人资料", certManage: "前往资料页登记", recent: "最近潜水", recentIntro: "刚刚写下的海洋记忆", countryCount: "已到访海域", noFootprints: "记录第一次下潜后，这里会出现你的海洋足迹。", likesReceived: "被喜欢", savesReceived: "被收藏", followers: "粉丝", favorites: "我的收藏", favoritesIntro: "那些让你想再次回到海里的故事", favoritesEmpty: "收藏论坛里的潜水故事后，它们会出现在这里。", viewForum: "去深蓝论坛看看", viewAllFavorites: "查看全部收藏",
  },
  en: {
    navPassport: "Ocean Passport", navLogs: "Dive Logs", navForum: "Deep Blue Forum", navProfile: "Profile", logout: "Sign out", offlineSync: "Offline drafts & sync",
    eyebrow: "YOUR OCEAN PASSPORT", heading: "'s ocean passport", intro: "Every day you met the ocean becomes part of your story here.",
    addDive: "Log a dive", journey: "My ocean journey", dives: "Dives", countries: "Countries / regions",
    maxDepth: "Max depth", underwater: "Time underwater", latest: "Latest dive", latestEmpty: "Your first ocean memory is waiting to be written.",
    openLog: "View this dive", begin: "Log your first dive", identity: "Diver profile", cert: "Certification", certEmpty: "Not added yet",
    tanks: "Current tanks", editProfile: "Edit profile", footprints: "Ocean footprints", footprintsIntro: "Every place you've visited leaves a stamp in your passport.",
    footprintsEmpty: "Start with your first dive site and leave an ocean footprint.", records: "Dive logs", recordsIntro: "Revisit each underwater story, newest first.",
    all: "View all logs", collapse: "Show fewer", recordsEmpty: "No dives yet. Capture your memories while they are still fresh.",
    retry: "Try again", loadError: "We couldn't load your dives. Please try again.", loading: "Loading your ocean story…",
    noSite: "Untitled dive site", duration: "min", photoAlt: "Photo from the latest dive",
    previewNote: "Design preview · Sample data only; your own records appear after sign-in",
    displayName: "Display name", userId: "User ID", mapTitle: "My Dive Map", gear: "My Gear", gearEmpty: "Keep everyday gear and service records together for every departure.", gearManage: "Manage my gear", certificate: "Dive Certifications", certHint: "Your current level comes from your profile", certManage: "Register in profile", recent: "Recent dives", recentIntro: "Your latest ocean memories", countryCount: "Places visited", noFootprints: "Log your first dive to begin your ocean map.", likesReceived: "Likes", savesReceived: "Saves", followers: "Followers", favorites: "My saved posts", favoritesIntro: "Stories that make you want to return to the ocean", favoritesEmpty: "Stories you save in the forum will appear here.", viewForum: "Explore the forum", viewAllFavorites: "View all saved stories",
  },
} as const;

const previewDives: Dive[] = [
  { id: "preview-crystal-bay", user_id: "preview", country: "Indonesia", site_name: "Crystal Bay", dive_date: "2026-08-30", weather: "晴", surface_temp: null, water_temp: 21, max_depth: 28, duration_min: 48, dive_type: "recreational", buddy_role: "instructor", buddy_name: "Raiyan", photo_urls: [], notes: null, created_at: "2026-08-30T12:00:00Z" },
  { id: "preview-moalboal", user_id: "preview", country: "Philippines", site_name: "Moalboal", dive_date: "2026-08-18", weather: "晴", surface_temp: null, water_temp: 27, max_depth: 18, duration_min: 52, dive_type: "recreational", buddy_role: null, buddy_name: null, photo_urls: [], notes: null, created_at: "2026-08-18T12:00:00Z" },
  { id: "preview-sipadan", user_id: "preview", country: "Malaysia", site_name: "Sipadan", dive_date: "2026-07-26", weather: "晴", surface_temp: null, water_temp: 28, max_depth: 24, duration_min: 46, dive_type: "recreational", buddy_role: null, buddy_name: null, photo_urls: [], notes: null, created_at: "2026-07-26T12:00:00Z" },
];

const englishCertifications: Record<string, string> = {
  "OW 开放水域": "OW · Open Water",
  "AOW 进阶开放水域": "AOW · Advanced Open Water",
  "Rescue 救援潜水员": "Rescue Diver",
  "Divemaster 潜水长": "Divemaster",
  "Instructor 教练": "Instructor",
  "自由潜 一星": "Freediving · Level 1",
  "自由潜 二星": "Freediving · Level 2",
  "自由潜 三星": "Freediving · Level 3",
  "技术潜水": "Technical Diving",
  "暂无": "Not added yet",
};

const countryCodes: Record<string, string> = {
  indonesia: "ID", 印尼: "ID", 印度尼西亚: "ID", 印度尼西亞: "ID",
  philippines: "PH", 菲律宾: "PH", 菲律賓: "PH", malaysia: "MY", 马来西亚: "MY", 馬來西亞: "MY",
  thailand: "TH", 泰国: "TH", 泰國: "TH", japan: "JP", 日本: "JP", china: "CN", 中国: "CN", 中國: "CN",
  vietnam: "VN", 越南: "VN", singapore: "SG", 新加坡: "SG", australia: "AU", 澳大利亚: "AU", 澳洲: "AU",
  maldives: "MV", 马尔代夫: "MV", 馬爾代夫: "MV", palau: "PW", 帕劳: "PW", 帛琉: "PW",
  egypt: "EG", 埃及: "EG", mexico: "MX", 墨西哥: "MX", fiji: "FJ", 斐济: "FJ", 斐濟: "FJ",
  usa: "US", "united states": "US", 美国: "US", 美國: "US", "sri lanka": "LK", 斯里兰卡: "LK",
  "papua new guinea": "PG", 巴布亚新几内亚: "PG", "east timor": "TL", "timor-leste": "TL", 东帝汶: "TL",
  "south korea": "KR", 韩国: "KR", 韓國: "KR", taiwan: "TW", 台湾: "TW", 台灣: "TW",
};

function countryFlag(country: string) {
  const code = countryCodes[country.trim().toLowerCase()];
  return code ? String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0))) : "🌐";
}
function WorldMap() {
  return <svg className="do-passport-world-map" viewBox="0 0 780 350" role="img" aria-label="Stylized world map" preserveAspectRatio="xMidYMid meet">
    <g className="do-passport-map-grid"><path d="M0 87H780M0 175H780M0 263H780M130 0V350M260 0V350M390 0V350M520 0V350M650 0V350" /></g>
    <g className="do-passport-map-land">
      <path d="M42 72 79 55 118 49 139 57 170 46 197 57 204 76 232 80 245 99 232 115 208 115 194 135 171 128 160 148 141 141 123 160 101 152 90 133 62 125 54 107 33 98Z" />
      <path d="m117 157 28 2 19 17 18 4 14 22-5 18 16 22-10 28-17 14-12 34-20 16-13-15 2-25-15-23-3-27-18-28-4-29Z" />
      <path d="m256 77 27-22 28 5 15 18-18 19-29 6-19-10Z" />
      <path d="m322 87 23-18 38 8 26-13 25 7 26-15 46 6 32-12 53 11 23 20 36 1 28 20-13 23-33 4-15 22-29-3-22 23-25-10-22 8-26-19-26 5-24-17-21 4-12-19-29-4-18-19-28 6Z" />
      <path d="m339 152 31-11 35 11 24 24-5 26-14 22-6 38-25 25-20-8-7-26-22-17-11-38 11-28Z" />
      <path d="m571 239 30-20 47 5 27 16 37 4 18 19-15 31-35 7-23-11-30 6-29-17-31-4Z" />
      <path d="m289 37 29-11 24 13-9 14-28-4ZM721 107l15 12-5 20-16-7ZM482 204l12 8-4 14-12-5Z" />
    </g>
    <g className="do-passport-map-coast"><path d="M54 107 62 125 90 133M141 141 160 148 171 128M196 220 207 242 197 270M370 141 405 152 429 176M581 238 601 219 648 224" /></g>
  </svg>;
}

export function OceanPassport({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [showAll, setShowAll] = useState(false);
  const { data: dives = [], isPending, isError, refetch } = useQuery({
    queryKey: preview ? ["passport-preview-dives"] : ["dives"],
    queryFn: listDives,
    enabled: !preview,
    initialData: preview ? previewDives : undefined,
  });
  const { profile: liveProfile, avatarUrl } = useProfile(!preview);
  const profile = preview ? { id: "preview-visitor", display_name: language === "zh-CN" ? "潜水员" : "Diver", avatar_url: null, cert_level: "AOW 进阶开放水域", tank_count: 18 } : liveProfile;
  const latest = dives[0];
  const latestPhotoPath = latest?.photo_urls?.[0];
  const { data: latestPhoto } = useQuery({
    queryKey: ["passport-latest-photo", latestPhotoPath],
    queryFn: async () => (await signedPhotoUrls([latestPhotoPath!]))[0] ?? null,
    enabled: !!latestPhotoPath,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const name = profile?.display_name?.trim() || (language === "zh-CN" ? "潜水员" : "Diver");
  const profileHref = preview ? "/profile-preview" : "/profile";
  const certificatesHref = preview ? "/certificates-preview" : "/profile";
  const gearHref = preview ? "/gear-preview" : "/profile";
  const countries = Array.from(new Set(dives.map((d) => d.country.trim()).filter(Boolean)));
  const maxDepth = dives.reduce((max, d) => Math.max(max, Number(d.max_depth) || 0), 0);
  const totalMinutes = dives.reduce((sum, d) => sum + (Number(d.duration_min) || 0), 0);
  const timeDisplay = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`;
  const visibleDives = showAll ? dives : dives.slice(0, 3);
  const date = (value: string) => new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en", {
    year: "numeric", month: language === "zh-CN" ? "long" : "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return <div className="do-passport">
    <header className="do-passport-header">
      <Link to="/dives" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}>
        <Link to="/dives" aria-current="page">{c.navPassport}</Link>
        <Link to="/dives/logs">{c.navLogs}</Link>
        <Link to="/forum">{c.navForum}</Link>
        <Link to={profileHref}>{c.navProfile}</Link>
      </nav>
      <div className="do-passport-header-actions">
        <Link to="/offline-sync" className="do-passport-sync-link"><CloudOff aria-hidden="true" /><span>{c.offlineSync}</span></Link>
        <button type="button" className="do-passport-language" onClick={toggleLanguage} aria-label={language === "zh-CN" ? "Switch to English" : "切换到中文"}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button>
        <Link to={profileHref} className="do-passport-account" aria-label={c.navProfile}><Avatar><AvatarImage src={avatarUrl ?? undefined} alt={name} /><AvatarFallback>{name.slice(0, 1)}</AvatarFallback></Avatar><span>{name}</span></Link>
        <button type="button" className="do-passport-logout" onClick={signOut} aria-label={c.logout}><LogOut aria-hidden="true" /></button>
      </div>
    </header>

    <main id="passport-overview" className="do-passport-main">
      {preview && <div className="do-passport-preview-note">{c.previewNote}</div>}
      {!preview && <OfflineSyncBanner dark />}
      <div className="do-passport-columns">
        <aside className="do-passport-profile-column" aria-label={c.identity}>
          <section className="do-passport-identity" aria-label={c.identity}>
            <div className="do-passport-panel-heading"><span className="do-passport-serial">SUPDIVER / 01</span></div>
            <div className="do-passport-identity-person"><Avatar className="do-passport-profile-avatar" style={{ width: 120, height: 120 }}><AvatarImage src={avatarUrl ?? undefined} alt={name} /><AvatarFallback className="do-passport-profile-avatar-fallback">{name.slice(0, 1)}</AvatarFallback></Avatar><div><h2 id="passport-identity-title">{name}</h2></div></div>
            <div className="do-passport-community-stats" aria-label={language === "zh-CN" ? "社区数据" : "Community stats"}><span><ScubaTankIcon /><strong>{preview ? "1,286" : "0"}</strong><small>{c.likesReceived}</small></span><span><Bookmark aria-hidden="true" /><strong>{preview ? "318" : "0"}</strong><small>{c.savesReceived}</small></span><span><Users aria-hidden="true" /><strong>{preview ? "246" : "0"}</strong><small>{c.followers}</small></span></div>
            <div className="do-passport-identity-row"><span>{c.dives}</span><strong>{isPending ? "—" : dives.length}</strong></div>
            <div className="do-passport-identity-row"><span>{c.countryCount}</span><strong>{isPending ? "—" : countries.length}</strong></div>
            <div className="do-passport-identity-row"><span>{c.underwater}</span><strong>{isPending || !totalMinutes ? "—" : timeDisplay}</strong></div>
            <div className="do-passport-identity-row"><span>{c.maxDepth}</span><strong>{isPending || !maxDepth ? "—" : `${maxDepth}m`}</strong></div>
            <div className="do-passport-identity-row"><span>{c.tanks}</span><strong>{profile?.tank_count ?? 0}</strong></div>
            <Link to={profileHref} className="do-passport-panel-link">{c.editProfile}<ChevronRight aria-hidden="true" /></Link>
          </section>
        </aside>

        <div className="do-passport-center-column">
          <section className="do-passport-summary" aria-labelledby="passport-summary-title">
            <div className="do-passport-summary-photo" />
            <div className="do-passport-summary-content"><span className="do-passport-section-label">02 / {c.journey}</span><h2 id="passport-summary-title">{c.journey}</h2><p>{c.intro}</p>
              <div className="do-passport-summary-stats"><span><strong>{isPending ? "—" : dives.length}</strong>{c.dives}</span><span><strong>{isPending ? "—" : countries.length}</strong>{c.countries}</span><span><strong>{isPending || !totalMinutes ? "—" : timeDisplay}</strong>{c.underwater}</span><span><strong>{isPending || !maxDepth ? "—" : `${maxDepth}m`}</strong>{c.maxDepth}</span></div>
            </div>
          </section>
          <section className="do-passport-map-panel" aria-label={c.mapTitle}>
            <div className="do-passport-panel-heading"><span>03 / {c.mapTitle}</span><Compass aria-hidden="true" /></div>
            <div className="do-passport-map-layout">
              <div className="do-passport-map-sidebar">
                <div className="do-passport-map-count"><strong>{isPending ? "—" : String(countries.length).padStart(2, "0")}</strong><span>{c.countryCount}</span></div>
                {countries.length > 0 && <ul className="do-passport-map-places">{countries.map((country) => <li key={country}><span className="do-passport-country-flag" aria-hidden="true">{countryFlag(country)}</span><span>{country}</span></li>)}</ul>}
              </div>
              <div className="do-passport-map-canvas"><WorldMap /></div>
            </div>
          </section>
          <section className="do-passport-gear-panel" aria-labelledby="passport-gear-title"><div className="do-passport-panel-heading"><span>04 / {c.gear}</span><Waves aria-hidden="true" /></div><div className="do-passport-gear-body"><div className="do-passport-gear-symbol"><Waves aria-hidden="true" /></div><div><h2 id="passport-gear-title">{c.gear}</h2><p>{c.gearEmpty}</p><Link to={gearHref} className="do-passport-panel-link">{c.gearManage}<ChevronRight aria-hidden="true" /></Link></div></div></section>
          <section className="do-passport-saved-panel" aria-labelledby="passport-saved-title"><div className="do-passport-panel-heading"><span>05 / {c.favorites}</span><Bookmark aria-hidden="true" /></div><div className="do-passport-saved-heading"><div><h2 id="passport-saved-title">{c.favorites}</h2><p>{c.favoritesIntro}</p>{preview ? <Link to="/saved-preview" className="do-passport-saved-link">{c.viewAllFavorites}<ChevronRight aria-hidden="true" /></Link> : <Link to="/forum" className="do-passport-saved-link">{c.viewAllFavorites}<ChevronRight aria-hidden="true" /></Link>}</div><strong>{preview ? "12" : "0"}</strong></div>{preview ? <div className="do-passport-saved-grid"><article><div style={{ backgroundImage: "linear-gradient(0deg, rgba(1,20,38,.48), transparent), url('/images/user-fish-hero-preview.jpg')" }}><span>Crystal Bay</span></div><h3>在冷水里遇见一只慢吞吞的 Mola mola</h3><small>ydpeng7 · 286 {c.likesReceived}</small></article><article><div style={{ backgroundImage: "linear-gradient(0deg, rgba(1,20,38,.48), transparent), url('/images/user-cave-photo-hero-preview.jpg')" }}><span>Moalboal</span></div><h3>沙丁鱼群遮住阳光的十秒钟</h3><small>lanhai_02 · 194 {c.likesReceived}</small></article></div> : <div className="do-passport-saved-empty"><Bookmark aria-hidden="true" /><p>{c.favoritesEmpty}</p><Link to="/forum">{c.viewForum}<ChevronRight aria-hidden="true" /></Link></div>}</section>
        </div>

        <aside className="do-passport-right-column">
          <section className="do-passport-cert-panel" aria-labelledby="passport-cert-title"><div className="do-passport-panel-heading"><span>06 / {c.certificate}</span><Award aria-hidden="true" /></div><div className="do-passport-cert-card"><span>SUPDIVER / CERTIFICATION</span><Award aria-hidden="true" /><strong id="passport-cert-title">{profile?.cert_level && profile.cert_level !== "暂无" ? language === "en" ? englishCertifications[profile.cert_level] ?? profile.cert_level : profile.cert_level : c.certEmpty}</strong><small>{c.certHint}</small></div><Link to={certificatesHref} className="do-passport-panel-link">{c.certManage}<ChevronRight aria-hidden="true" /></Link></section>
          <section id="passport-logs" className="do-passport-recent-panel" aria-labelledby="passport-recent-title"><div className="do-passport-panel-heading"><span>07 / {c.recent}</span><CalendarDays aria-hidden="true" /></div><h2 id="passport-recent-title">{c.recent}</h2><p className="do-passport-recent-intro">{c.recentIntro}</p>{latest && <div className="do-passport-recent-image" style={latestPhoto ? { backgroundImage: `linear-gradient(0deg, rgba(1,22,43,.35), rgba(1,22,43,.12)), url("${latestPhoto}")` } : undefined} role="img" aria-label={latestPhoto ? c.photoAlt : c.latest} />}{isPending ? <p className="do-passport-muted">{c.loading}</p> : isError ? <button type="button" className="do-passport-text-link" onClick={() => refetch()}>{c.loadError} {c.retry}<ArrowRight /></button> : dives.length ? <><ul className="do-passport-recent-list">{visibleDives.map((d) => <li key={d.id}><Link to="/dives/$id" params={{ id: d.id }}><span><strong>{d.site_name || c.noSite}</strong><small>{d.country} · {date(d.dive_date)}</small></span><ChevronRight aria-hidden="true" /></Link></li>)}</ul>{dives.length > 3 && <button type="button" className="do-passport-more" onClick={() => setShowAll((value) => !value)}>{showAll ? c.collapse : c.all}<ArrowRight aria-hidden="true" /></button>}</> : <div className="do-passport-recent-empty"><p>{c.latestEmpty}</p><Link to="/dives/new">{c.begin}<ArrowRight aria-hidden="true" /></Link></div>}<Link to="/dives/new" className="do-passport-recent-add"><Plus aria-hidden="true" />{c.addDive}</Link></section>
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
