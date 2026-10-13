import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  CloudOff,
  Droplets,
  Languages,
  MapPin,
  Save,
  Thermometer,
  Upload,
  Waves,
  Wind,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/new-dive-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "记录一次下潜 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: NewDivePreview,
});

const photos = [
  "/images/user-fish-hero-preview.jpg",
  "/images/user-cave-photo-hero-preview.jpg",
  "/images/supdiver-six-orange-fish-hero.png",
];

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", profile: "个人资料", back: "返回潜水日志",
    eyebrow: "NEW DIVE LOG", title: "记录一次下潜", intro: "趁记忆尚未褪色，把刚刚发生的故事留下来",
    autosaved: "已自动暂存", preview: "设计预览 · 四个步骤可直接切换，当前填写内容仅保存在此预览中",
    steps: ["地点与时间", "潜水数据", "深蓝记忆", "确认保存"],
    stepNotes: ["这一潜发生在哪里", "记录水下的真实数据", "留下照片与所思所想", "回看并保存这一潜"],
    stepEyebrows: ["01 / PLACE & TIME", "02 / DIVE DATA", "03 / OCEAN MEMORY", "04 / REVIEW"],
    stepTitles: ["从哪里开始这一潜？", "水下发生了什么？", "这一潜，想留下什么？", "确认你的潜水记录"],
    country: "国家 / 地区", region: "海岛 / 城市", site: "潜点名称", diveCenter: "潜店", guide: "潜水向导",
    date: "潜水日期", entryTime: "入水时间", depth: "最大深度", duration: "潜水时长", water: "水温", gas: "气体类型",
    visibility: "能见度", current: "水流", weather: "天气", diveType: "潜水类型", photos: "潜水照片", memory: "深蓝记忆",
    photoHint: "选择一张照片作为这一潜的封面，也可以继续添加更多照片", upload: "添加照片", cover: "封面",
    memoryHint: "照片记录了画面，文字会留下当时真正的感受", previous: "上一步", next: "下一步", save: "保存潜水记录", offline: "保存为离线草稿",
    summary: "这一潜", summaryHint: "右侧摘要会随填写内容更新", recreational: "休闲潜水", moderate: "中等", sunny: "晴朗",
    reviewPlace: "地点与时间", reviewData: "潜水数据", reviewMemory: "深蓝记忆", edit: "返回修改", ready: "一切准备就绪",
    readyNote: "保存后，这一潜将出现在你的潜水日志与海洋护照中", minutes: "分钟",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", profile: "Profile", back: "Back to dive logs",
    eyebrow: "NEW DIVE LOG", title: "Log a dive", intro: "Before the memory fades, keep the story that just happened",
    autosaved: "Draft autosaved", preview: "Design preview · Jump between all four steps; entries stay only in this preview",
    steps: ["Place & time", "Dive data", "Ocean memory", "Review & save"],
    stepNotes: ["Where this dive happened", "Keep the real underwater data", "Save photos and reflections", "Review and keep this dive"],
    stepEyebrows: ["01 / PLACE & TIME", "02 / DIVE DATA", "03 / OCEAN MEMORY", "04 / REVIEW"],
    stepTitles: ["Where did this dive begin?", "What happened underwater?", "What will you remember?", "Review your dive log"],
    country: "Country / region", region: "Island / city", site: "Dive site", diveCenter: "Dive center", guide: "Dive guide",
    date: "Dive date", entryTime: "Entry time", depth: "Max depth", duration: "Dive time", water: "Water temperature", gas: "Gas type",
    visibility: "Visibility", current: "Current", weather: "Weather", diveType: "Dive type", photos: "Dive photos", memory: "Ocean memory",
    photoHint: "Choose a cover photo for this dive, then add more if you like", upload: "Add photos", cover: "Cover",
    memoryHint: "Photos keep the scene. Words keep what it felt like", previous: "Previous", next: "Next", save: "Save dive log", offline: "Save offline draft",
    summary: "This dive", summaryHint: "The summary updates as you type", recreational: "Recreational", moderate: "Moderate", sunny: "Sunny",
    reviewPlace: "Place & time", reviewData: "Dive data", reviewMemory: "Ocean memory", edit: "Edit", ready: "Ready to surface",
    readyNote: "Once saved, this dive will appear in your dive logs and Ocean Passport", minutes: "min",
  },
} as const;

type FieldKey = "country" | "region" | "site" | "diveCenter" | "guide" | "date" | "entryTime" | "depth" | "duration" | "water" | "gas" | "visibility" | "current" | "weather" | "diveType" | "memory";

const initialFields: Record<FieldKey, string> = {
  country: "Indonesia",
  region: "Nusa Penida",
  site: "Crystal Bay",
  diveCenter: "Blue Corner",
  guide: "Raiyan",
  date: "2026-08-30",
  entryTime: "10:01",
  depth: "28",
  duration: "48",
  water: "21",
  gas: "Air",
  visibility: "20m+",
  current: "中等",
  weather: "晴朗",
  diveType: "休闲潜水",
  memory: "第一次到 Crystal Bay，这里的水温冷得超过想象，穿着 5mm 的湿衣依然冻得发抖。但是运气很好，在不到 30m 就看到了一只 Mola mola，它看着真的好呆啊。",
};

function NewDivePreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState(initialFields);
  const [selectedPhoto, setSelectedPhoto] = useState(photos[0]);
  const update = (key: FieldKey, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const formattedDate = useMemo(() => {
    if (!fields.date) return "—";
    const [year, month, day] = fields.date.split("-");
    return language === "zh-CN" ? `${year}年${Number(month)}月${Number(day)}日` : `${month}/${day}/${year}`;
  }, [fields.date, language]);

  const textField = (key: FieldKey, label: string, options?: { type?: string; suffix?: string; wide?: boolean }) => (
    <label className={options?.wide ? "do-record-field do-record-field-wide" : "do-record-field"}>
      <span>{label}</span>
      <div className="do-record-input-wrap"><input type={options?.type ?? "text"} value={fields[key]} onChange={(event) => update(key, event.target.value)} />{options?.suffix && <em>{options.suffix}</em>}</div>
    </label>
  );

  return <div className="do-record-page">
    <header className="do-passport-header do-record-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview" aria-current="page">{c.logs}</Link><Link to="/profile-preview">{c.profile}</Link></nav>
      <div className="do-passport-header-actions"><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><span className="do-passport-account"><Avatar><AvatarFallback>潜</AvatarFallback></Avatar><span>preview-visitor</span></span></div>
    </header>

    <main className="do-record-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <div className="do-record-toolbar"><Link to="/logs-preview"><ArrowLeft aria-hidden="true" />{c.back}</Link><span><Check aria-hidden="true" />{c.autosaved}</span></div>
      <section className="do-record-intro"><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></section>

      <div className="do-record-workspace">
        <aside className="do-record-steps" aria-label={language === "zh-CN" ? "记录步骤" : "Log steps"}>
          {c.steps.map((label, index) => <button key={label} type="button" data-active={step === index} data-complete={index < step} onClick={() => setStep(index)}>
            <i>{index < step ? <Check aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</i><span><strong>{label}</strong><small>{c.stepNotes[index]}</small></span>
          </button>)}
          <div className="do-record-steps-footer"><Waves aria-hidden="true" /><span>YOUR OCEAN<br />YOUR STORY</span></div>
        </aside>

        <section className="do-record-form-panel">
          <div className="do-record-form-heading"><span>{c.stepEyebrows[step]}</span><h2>{c.stepTitles[step]}</h2></div>

          {step === 0 && <div className="do-record-fields">
            {textField("country", c.country)}{textField("region", c.region)}{textField("site", c.site, { wide: true })}{textField("diveCenter", c.diveCenter)}{textField("guide", c.guide)}{textField("date", c.date, { type: "date" })}{textField("entryTime", c.entryTime, { type: "time" })}
          </div>}

          {step === 1 && <div className="do-record-fields do-record-data-fields">
            {textField("depth", c.depth, { suffix: "m" })}{textField("duration", c.duration, { suffix: c.minutes })}{textField("water", c.water, { suffix: "°C" })}{textField("gas", c.gas)}{textField("visibility", c.visibility)}
            <label className="do-record-field"><span>{c.current}</span><select value={fields.current} onChange={(event) => update("current", event.target.value)}><option>{c.moderate}</option><option>{language === "zh-CN" ? "微弱" : "Mild"}</option><option>{language === "zh-CN" ? "强" : "Strong"}</option></select></label>
            <label className="do-record-field"><span>{c.weather}</span><select value={fields.weather} onChange={(event) => update("weather", event.target.value)}><option>{c.sunny}</option><option>{language === "zh-CN" ? "多云" : "Cloudy"}</option><option>{language === "zh-CN" ? "雨" : "Rain"}</option></select></label>
            <label className="do-record-field"><span>{c.diveType}</span><select value={fields.diveType} onChange={(event) => update("diveType", event.target.value)}><option>{c.recreational}</option><option>{language === "zh-CN" ? "放流潜水" : "Drift dive"}</option><option>{language === "zh-CN" ? "夜潜" : "Night dive"}</option></select></label>
          </div>}

          {step === 2 && <div className="do-record-memory-form">
            <div className="do-record-memory-title"><div><strong>{c.photos}</strong><small>{c.photoHint}</small></div><button type="button"><Upload aria-hidden="true" />{c.upload}</button></div>
            <div className="do-record-photo-picker">{photos.map((photo, index) => <button type="button" key={photo} data-active={selectedPhoto === photo} onClick={() => setSelectedPhoto(photo)} style={{ backgroundImage: `linear-gradient(0deg, rgba(0,12,31,.2), transparent), url('${photo}')` }}>{selectedPhoto === photo && <span><Check aria-hidden="true" />{c.cover}</span>}<small>{String(index + 1).padStart(2, "0")}</small></button>)}<button type="button" className="do-record-photo-add"><Camera aria-hidden="true" /><span>{c.upload}</span></button></div>
            <label className="do-record-memory-input"><span>{c.memory}</span><small>{c.memoryHint}</small><textarea value={fields.memory} onChange={(event) => update("memory", event.target.value)} /></label>
          </div>}

          {step === 3 && <div className="do-record-review">
            <div className="do-record-ready"><i><Check aria-hidden="true" /></i><div><strong>{c.ready}</strong><p>{c.readyNote}</p></div></div>
            <article><header><span>01</span><strong>{c.reviewPlace}</strong><button type="button" onClick={() => setStep(0)}>{c.edit}</button></header><p><b>{fields.site}</b> · {fields.region}, {fields.country}</p><small>{formattedDate} · {fields.entryTime} · {fields.diveCenter} · {fields.guide}</small></article>
            <article><header><span>02</span><strong>{c.reviewData}</strong><button type="button" onClick={() => setStep(1)}>{c.edit}</button></header><div className="do-record-review-data"><b>{fields.depth} m</b><b>{fields.duration} {c.minutes}</b><b>{fields.water} °C</b><b>{fields.gas}</b></div><small>{fields.visibility} · {fields.current} · {fields.weather} · {fields.diveType}</small></article>
            <article><header><span>03</span><strong>{c.reviewMemory}</strong><button type="button" onClick={() => setStep(2)}>{c.edit}</button></header><p>{fields.memory}</p></article>
            <div className="do-record-save-actions"><button type="button" className="do-record-save-primary"><Save aria-hidden="true" />{c.save}</button><button type="button"><CloudOff aria-hidden="true" />{c.offline}</button></div>
          </div>}

          <footer className="do-record-form-nav"><button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft aria-hidden="true" />{c.previous}</button><span>{step + 1} / 4</span>{step < 3 ? <button type="button" className="do-record-next" onClick={() => setStep((current) => Math.min(3, current + 1))}>{c.next}<ArrowRight aria-hidden="true" /></button> : <i />}</footer>
        </section>

        <aside className="do-record-summary">
          <div className="do-record-summary-heading"><div><span>{c.summary}</span><small>{c.summaryHint}</small></div><b>#{String(5).padStart(3, "0")}</b></div>
          <div className="do-record-summary-photo" style={{ backgroundImage: `linear-gradient(0deg, rgba(0,12,30,.72), rgba(0,9,26,.02) 64%), url('${selectedPhoto}')` }}><span><Camera aria-hidden="true" />{photos.length}</span><div><small>{fields.country} · {fields.region}</small><strong>{fields.site || "—"}</strong></div></div>
          <div className="do-record-summary-date"><CalendarDays aria-hidden="true" /><span><small>{c.date}</small><strong>{formattedDate}</strong></span></div>
          <div className="do-record-summary-metrics"><div><Droplets aria-hidden="true" /><strong>{fields.depth || "—"}<em>m</em></strong><small>{c.depth}</small></div><div><Clock3 aria-hidden="true" /><strong>{fields.duration || "—"}<em>min</em></strong><small>{c.duration}</small></div><div><Thermometer aria-hidden="true" /><strong>{fields.water || "—"}<em>°C</em></strong><small>{c.water}</small></div></div>
          <div className="do-record-summary-meta"><span><Wind aria-hidden="true" />{fields.gas}</span><span><Waves aria-hidden="true" />{fields.visibility}</span><span><MapPin aria-hidden="true" />{fields.guide}</span></div>
          <blockquote>{fields.memory}</blockquote>
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
