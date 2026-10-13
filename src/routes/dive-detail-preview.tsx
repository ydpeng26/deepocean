import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Camera, ChevronRight, Clock3, Droplets, Edit3, Eye, Languages, MapPin, Share2, Sun, Thermometer, UserRound, Waves, Wind } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/dive-detail-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "Crystal Bay 潜水详情预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: DiveDetailPreview,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", profile: "个人资料", back: "返回潜水日志", edit: "编辑记录", share: "分享",
    country: "印度尼西亚", region: "Nusa Penida", date: "2026年8月30日", diveNo: "DIVE #004", recreational: "休闲潜水", dayDive: "日潜",
    depth: "最大深度", duration: "潜水时长", gas: "气体类型", water: "水温", story: "深蓝记忆", photos: "潜水照片",
    note: "第一次到 Crystal Bay，这里的水温冷得超过想象，穿着 5mm 的湿衣依然冻得发抖。但是运气很好，在不到 30m 就看到了一只 Mola mola，它看着真的好呆啊。",
    environment: "环境条件", weather: "天气", sunny: "晴朗", visibility: "能见度", current: "水流", medium: "中等",
    diveInfo: "潜水信息", type: "潜水类型", guide: "潜水向导", entryExit: "入水 · 出水", entry: "入水", underwater: "水下旅程", exit: "出水", entryNote: "向 Crystal Bay 缓缓下降", guideNote: "与 Raiyan 一同探索", exitNote: "带着这一潜的记忆返回海面", equipment: "装备信息", kitNote: "这一潜所使用的装备",
    bcd: "浮力调整装置", computer: "潜水电脑", suit: "湿衣", tank: "气瓶", mask: "面镜", fins: "脚蹼", createCard: "生成分享纪念卡",
    cardText: "选择照片与数据，为这次潜水制作一张可以保存和分享的专属纪念卡。", create: "制作纪念卡", shareFeed: "分享到动态", bringDive: "把这一潜，带回海面之上",
    preview: "设计预览 · 以下为示例数据，正式页面将显示你的个人潜水记录", selectBackground: "选择背景", backgroundOption: "环境背景",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", profile: "Profile", back: "Back to dive logs", edit: "Edit log", share: "Share",
    country: "Indonesia", region: "Nusa Penida", date: "Aug 30, 2026", diveNo: "DIVE #004", recreational: "Recreational", dayDive: "Day dive",
    depth: "Max depth", duration: "Dive time", gas: "Gas type", water: "Water", story: "Ocean memory", photos: "Dive photos",
    note: "My first time at Crystal Bay was colder than I imagined—even a 5mm wetsuit could not stop the shivering. Then, before 30 metres, a Mola mola appeared. It looked wonderfully unhurried and a little silly.",
    environment: "Environmental conditions", weather: "Weather", sunny: "Sunny", visibility: "Visibility", current: "Current", medium: "Moderate",
    diveInfo: "Dive information", type: "Dive type", guide: "Dive guide", entryExit: "Entry · Exit", entry: "Entry", underwater: "Underwater journey", exit: "Exit", entryNote: "Descending into Crystal Bay", guideNote: "Exploring with Raiyan", exitNote: "Returning with a new ocean memory", equipment: "Equipment", kitNote: "The equipment used on this dive",
    bcd: "BCD", computer: "Dive computer", suit: "Wetsuit", tank: "Tank", mask: "Mask", fins: "Fins", createCard: "Create a share card",
    cardText: "Choose a photo and dive data to create a keepsake made for saving and sharing.", create: "Create keepsake", shareFeed: "Share to feed", bringDive: "Bring this dive back to the surface",
    preview: "Design preview · Sample data only; your own dive appears after sign-in", selectBackground: "Choose background", backgroundOption: "Environment background",
  },
} as const;

const photos = [
  "/images/user-fish-hero-preview.jpg",
  "/images/user-cave-photo-hero-preview.jpg",
  "/images/supdiver-six-orange-fish-hero.png",
];

function DiveDetailPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [selectedPhoto, setSelectedPhoto] = useState(photos[0]);
  const [environmentPhoto, setEnvironmentPhoto] = useState(photos[1]);
  const [showEnvironmentPicker, setShowEnvironmentPicker] = useState(false);

  return <div className="do-detail-page">
    <header className="do-passport-header do-detail-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview" aria-current="page">{c.logs}</Link><Link to="/profile-preview">{c.profile}</Link></nav>
      <div className="do-passport-header-actions"><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><span className="do-passport-account"><Avatar><AvatarFallback>潜</AvatarFallback></Avatar><span>preview-visitor</span></span></div>
    </header>

    <main className="do-detail-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <div className="do-detail-toolbar"><Link to="/logs-preview"><ArrowLeft aria-hidden="true" />{c.back}</Link><div><button type="button"><Edit3 aria-hidden="true" />{c.edit}</button><button type="button"><Share2 aria-hidden="true" />{c.share}</button></div></div>

      <section className="do-detail-heading">
        <div><div className="do-detail-location"><MapPin aria-hidden="true" />🇮🇩 {c.country} · {c.region}</div><h1>Crystal Bay</h1><div className="do-detail-tags"><span><CalendarDays aria-hidden="true" />{c.date}</span><span>{c.diveNo}</span><span>{c.recreational}</span><span>{c.dayDive}</span></div></div>
        <div className="do-detail-number"><small>SUPDIVER LOGBOOK</small><strong>004</strong></div>
      </section>

      <section className="do-detail-hero">
        <div className="do-detail-gallery">
          <div className="do-detail-main-photo" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,8,20,.02), rgba(0,10,24,.28)), url('${selectedPhoto}')` }}><span><Camera aria-hidden="true" />1 / {photos.length}</span></div>
          <div className="do-detail-thumbnails">{photos.map((photo, index) => <button key={photo} type="button" data-active={selectedPhoto === photo} onClick={() => setSelectedPhoto(photo)} style={{ backgroundImage: `url('${photo}')` }} aria-label={`${c.photos} ${index + 1}`} />)}<button type="button" className="do-detail-more-photos"><span>+9</span><small>{c.photos}</small></button></div>
        </div>
        <aside className="do-detail-story">
          <span>01 / {c.story}</span><p>{c.note}</p><div className="do-detail-story-signature">preview-visitor · Crystal Bay</div>
        </aside>
      </section>

      <section className="do-detail-primary-stats">
        <div><Droplets aria-hidden="true" /><span><strong>28 m</strong><small>{c.depth}</small></span></div><div><Clock3 aria-hidden="true" /><span><strong>48 min</strong><small>{c.duration}</small></span></div><div><Wind aria-hidden="true" /><span><strong>Air</strong><small>{c.gas}</small></span></div><div><Thermometer aria-hidden="true" /><span><strong>21 °C</strong><small>{c.water}</small></span></div>
      </section>

      <div className="do-detail-experience">
        <section className="do-detail-ocean-field">
          <div className="do-detail-ocean-backdrop" style={{ backgroundImage: `url('${environmentPhoto}')` }} />
          <div className="do-detail-narrative-heading"><span>02 / {c.environment}</span><h2>{c.environment}</h2><p>CRYSTAL BAY · 08:30</p></div>
          <div className="do-detail-background-picker"><button type="button" aria-expanded={showEnvironmentPicker} onClick={() => setShowEnvironmentPicker((open) => !open)}><Camera aria-hidden="true" />{c.selectBackground}</button>{showEnvironmentPicker && <div className="do-detail-background-options" aria-label={c.backgroundOption}>{photos.map((photo, index) => <button key={photo} type="button" data-active={environmentPhoto === photo} onClick={() => { setEnvironmentPhoto(photo); setShowEnvironmentPicker(false); }} style={{ backgroundImage: `url('${photo}')` }} aria-label={`${c.backgroundOption} ${index + 1}`} />)}</div>}</div>
          <div className="do-detail-floating-reading do-detail-reading-water"><Thermometer aria-hidden="true" /><small>{c.water}</small><strong>21 °C</strong></div>
          <div className="do-detail-floating-reading do-detail-reading-weather"><Sun aria-hidden="true" /><small>{c.weather}</small><strong>{c.sunny}</strong></div>
          <div className="do-detail-floating-reading do-detail-reading-visibility"><Eye aria-hidden="true" /><small>{c.visibility}</small><strong>20 m+</strong></div>
          <div className="do-detail-floating-reading do-detail-reading-current"><Waves aria-hidden="true" /><small>{c.current}</small><strong>{c.medium}</strong></div>
          <span className="do-detail-field-depth">— 12 m</span>
        </section>

        <section className="do-detail-depth-journey">
          <div className="do-detail-narrative-heading"><span>03 / {c.diveInfo}</span><h2>{c.diveInfo}</h2><p>{c.recreational} · {c.dayDive}</p></div>
          <svg className="do-detail-depth-path" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true"><path d="M85 42 C300 40 218 240 435 250 S660 465 895 364" /><path className="do-detail-depth-path-glow" d="M85 42 C300 40 218 240 435 250 S660 465 895 364" /></svg>
          <div className="do-detail-depth-mark do-detail-depth-entry"><i><Droplets aria-hidden="true" /></i><small>{c.entry}</small><strong>10:01</strong><p>{c.entryNote}</p></div>
          <div className="do-detail-depth-mark do-detail-depth-guide"><i><UserRound aria-hidden="true" /></i><small>{c.underwater}</small><strong>Raiyan</strong><p>{c.guideNote}</p></div>
          <div className="do-detail-depth-mark do-detail-depth-max"><b>28</b><em>m</em><small>{c.depth}</small></div>
          <div className="do-detail-depth-mark do-detail-depth-exit"><i><Waves aria-hidden="true" /></i><small>{c.exit}</small><strong>10:49</strong><p>{c.exitNote}</p></div>
          <span className="do-detail-depth-scale do-detail-scale-zero">0 m</span><span className="do-detail-depth-scale do-detail-scale-mid">15 m</span><span className="do-detail-depth-scale do-detail-scale-bottom">30 m</span>
        </section>

        <section className="do-detail-card-entry">
          <div className="do-detail-card-stack" aria-hidden="true"><i /><i /><div><span>SUPDIVER · 004</span><strong>Crystal Bay</strong><small>28 m · 48 min · 21 °C</small></div></div>
          <div className="do-detail-postcard-copy"><span>04 / SHARE YOUR OCEAN</span><h2>{c.bringDive}</h2><p>{c.cardText}</p><Link to="/share-card-preview" className="do-detail-create-card"><Camera aria-hidden="true" />{c.create}<ChevronRight aria-hidden="true" /></Link></div>
        </section>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
