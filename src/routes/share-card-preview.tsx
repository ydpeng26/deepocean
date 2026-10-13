import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Camera, Check, Clock3, Download, Droplets, Image, Languages, MapPin, Share2, SlidersHorizontal, Thermometer } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/share-card-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "分享纪念卡预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ShareCardPreview,
});

const photos = [
  "/images/user-fish-hero-preview.jpg",
  "/images/user-cave-photo-hero-preview.jpg",
  "/images/supdiver-six-orange-fish-hero.png",
];

const copy = {
  "zh-CN": {
    back: "返回潜水详情", title: "制作纪念卡", subtitle: "把这一潜，带回海面之上", photo: "选择照片", template: "卡片风格", poster: "深海电影海报", content: "展示内容", position: "照片位置", left: "偏左", center: "居中", right: "偏右", date: "日期", location: "地点", data: "潜水数据", note: "随笔摘录", signature: "用户签名", download: "保存图片", share: "分享", preview: "4:5 成品预览", story: "冰冷的水流里，一只 Mola mola 从深蓝中缓缓出现。", country: "印度尼西亚 · Nusa Penida",
  },
  en: {
    back: "Back to dive details", title: "Create a keepsake", subtitle: "Bring this dive back to the surface", photo: "Choose a photo", template: "Card style", poster: "Deep-ocean film poster", content: "Visible details", position: "Photo position", left: "Left", center: "Center", right: "Right", date: "Date", location: "Location", data: "Dive data", note: "Story excerpt", signature: "Diver signature", download: "Save image", share: "Share", preview: "4:5 final preview", story: "In the cold current, a Mola mola slowly appeared from the deep blue.", country: "Indonesia · Nusa Penida",
  },
} as const;

type DisplayKey = "date" | "location" | "data" | "note" | "signature";

function ShareCardPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [photo, setPhoto] = useState(photos[0]);
  const [position, setPosition] = useState("center");
  const [display, setDisplay] = useState<Record<DisplayKey, boolean>>({ date: true, location: true, data: true, note: true, signature: true });
  const positionValue = position === "left" ? "35% center" : position === "right" ? "70% center" : "center";
  const toggle = (key: DisplayKey) => setDisplay((current) => ({ ...current, [key]: !current[key] }));

  return <div className="do-card-editor-page">
    <header className="do-card-editor-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <span>{c.preview}</span>
      <button type="button" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button>
    </header>

    <main className="do-card-editor-main">
      <aside className="do-card-editor-controls">
        <Link to="/dive-detail-preview" className="do-card-editor-back"><ArrowLeft aria-hidden="true" />{c.back}</Link>
        <div className="do-card-editor-intro"><span>SHARE YOUR OCEAN</span><h1>{c.title}</h1><p>{c.subtitle}</p></div>

        <section className="do-card-control-section"><div className="do-card-control-title"><Image aria-hidden="true" /><h2>{c.photo}</h2></div><div className="do-card-photo-options">{photos.map((item, index) => <button key={item} type="button" data-active={photo === item} onClick={() => setPhoto(item)} style={{ backgroundImage: `url('${item}')` }} aria-label={`${c.photo} ${index + 1}`}>{photo === item && <Check aria-hidden="true" />}</button>)}</div></section>

        <section className="do-card-control-section"><div className="do-card-control-title"><SlidersHorizontal aria-hidden="true" /><h2>{c.template}</h2></div><button type="button" className="do-card-template-choice" data-active="true"><span /><div><strong>{c.poster}</strong><small>01 · SUPDIVER ORIGINAL</small></div><Check aria-hidden="true" /></button></section>

        <section className="do-card-control-section"><div className="do-card-control-title"><Camera aria-hidden="true" /><h2>{c.position}</h2></div><div className="do-card-position-options">{(["left", "center", "right"] as const).map((item) => <button key={item} type="button" data-active={position === item} onClick={() => setPosition(item)}>{c[item]}</button>)}</div></section>

        <section className="do-card-control-section"><div className="do-card-control-title"><Check aria-hidden="true" /><h2>{c.content}</h2></div><div className="do-card-display-options">{(["date", "location", "data", "note", "signature"] as DisplayKey[]).map((key) => <label key={key}><span>{c[key]}</span><input type="checkbox" checked={display[key]} onChange={() => toggle(key)} /><i /></label>)}</div></section>
      </aside>

      <section className="do-card-stage">
        <div className="do-card-stage-light" />
        <article className="do-card-poster" style={{ backgroundImage: `url('${photo}')`, backgroundPosition: positionValue }}>
          <div className="do-card-poster-shade" />
          <div className="do-card-poster-top"><div className="do-card-poster-brand"><img src="/images/supdiver-wave-mark.svg" alt="" /><span>SUPDIVER</span></div><span>OCEAN MEMORY · 004</span></div>
          <div className="do-card-poster-copy">
            {display.location && <div className="do-card-poster-location"><MapPin aria-hidden="true" />{c.country}</div>}
            <h2>Crystal Bay</h2>
            {display.date && <div className="do-card-poster-date"><CalendarDays aria-hidden="true" />2026 年 08 月 30 日</div>}
            {display.note && <p>“{c.story}”</p>}
            {display.data && <div className="do-card-poster-stats"><span><Droplets aria-hidden="true" /><b>28 m</b><small>MAX DEPTH</small></span><span><Clock3 aria-hidden="true" /><b>48 min</b><small>DIVE TIME</small></span><span><Thermometer aria-hidden="true" /><b>21 °C</b><small>WATER</small></span></div>}
            {display.signature && <div className="do-card-poster-signature"><span>DIVER · preview-visitor</span><small>YOUR OCEAN. YOUR STORY.</small></div>}
          </div>
        </article>
        <div className="do-card-stage-actions"><button type="button"><Download aria-hidden="true" />{c.download}</button><button type="button"><Share2 aria-hidden="true" />{c.share}</button></div>
      </section>
    </main>
  </div>;
}
