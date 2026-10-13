import { useMemo, useRef, useState, type CSSProperties } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Backpack,
  CalendarDays,
  Check,
  ChevronRight,
  Footprints,
  Gauge,
  Glasses,
  Languages,
  Pencil,
  Plus,
  Save,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Upload,
  Watch,
  Waves,
  Wind,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/gear-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "潜水装备管理预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: GearPreview,
});

type GearItem = {
  id: string;
  category: "bcd" | "regulator" | "computer" | "mask" | "fins";
  name: string;
  brand: string;
  model: string;
  since: string;
  dives: number;
  service: string;
  serial: string;
  accent: string;
  icon: LucideIcon;
};

const gearItems: GearItem[] = [
  { id: "bcd", category: "bcd", name: "浮力控制装置", brand: "AQUALUNG", model: "PRO HD COMPACT", since: "2025-07-18", dives: 18, service: "2027-01-18", serial: "AQ-PHC-250718", accent: "#4fc8f0", icon: Backpack },
  { id: "regulator", category: "regulator", name: "调节器", brand: "SCUBAPRO", model: "MK25 EVO / S600", since: "2025-07-18", dives: 18, service: "2026-12-01", serial: "SP-MK25-1862", accent: "#4c91f4", icon: Wind },
  { id: "computer", category: "computer", name: "潜水电脑", brand: "SUUNTO", model: "D5", since: "2025-08-03", dives: 17, service: "—", serial: "SS-D5-908731", accent: "#58d4b6", icon: Watch },
  { id: "mask", category: "mask", name: "面镜", brand: "TUSA", model: "M-2001 PARAGON", since: "2025-06-20", dives: 21, service: "—", serial: "—", accent: "#8a7df0", icon: Glasses },
  { id: "fins", category: "fins", name: "脚蹼", brand: "SCUBAPRO", model: "GO SPORT", since: "2025-06-20", dives: 21, service: "—", serial: "—", accent: "#e3a95d", icon: Footprints },
];

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", certificates: "潜水证书", profile: "个人资料", gear: "潜水装备",
    eyebrow: "MY DIVE LOCKER", title: "我的潜水装备", intro: "熟悉每一件陪你下潜的装备，也记住它们与你共同经历的海洋",
    preview: "设计预览 · 装备资料与维护记录仅作为示例展示", locker: "装备库", lockerHint: "把常用装备、使用次数和保养时间整理在一起",
    total: "已登记装备", dives: "随行下潜", attention: "需要关注", add: "新增装备", categories: "装备分类", fullKit: "我的整套装备", fullKitHint: "点击任意装备，查看它的使用与维护档案",
    ready: "状态良好", selected: "当前选择", details: "装备档案", detailHint: "记录品牌、型号及维护信息，让每次出发更安心",
    category: "装备类型", brand: "品牌", model: "型号", purchased: "购入日期", service: "下次保养", serial: "序列号",
    edit: "编辑装备", save: "保存装备", saved: "已保存", cancel: "取消", photo: "装备照片", upload: "上传我的照片", noPhoto: "尚未上传装备照片", systemPhoto: "使用系统型号图", systemMatched: "系统已根据品牌与型号完成匹配", photoSource: "照片来源",
    history: "使用档案", diveCount: "累计使用", lastDive: "最近随行", lastDiveValue: "Crystal Bay · 2026.08.30", health: "装备状态", healthValue: "状态良好，可以继续使用",
    maintenance: "浮力控制装置保养提醒", firstUse: "首次使用日期", nextService: "下次保养日期", newTitle: "登记新装备", newHint: "补充装备资料后，它会加入你的个人装备库", member: "ydpeng7",
    types: { bcd: "浮力控制装置", regulator: "调节器", computer: "潜水电脑", mask: "面镜", fins: "脚蹼" },
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", certificates: "Certifications", profile: "Profile", gear: "Dive Gear",
    eyebrow: "MY DIVE LOCKER", title: "My dive gear", intro: "Know every piece that descends with you, and remember the oceans you explored together",
    preview: "Design preview · Gear and maintenance records are sample data", locker: "Dive locker", lockerHint: "Keep your everyday gear, usage and service schedule together",
    total: "Registered", dives: "Dives together", attention: "Needs attention", add: "Add gear", categories: "Gear categories", fullKit: "My complete kit", fullKitHint: "Select any item to view its usage and care record",
    ready: "Ready to dive", selected: "Selected", details: "Gear record", detailHint: "Keep brand, model and service details close for a safer departure",
    category: "Gear type", brand: "Brand", model: "Model", purchased: "Purchased", service: "Next service", serial: "Serial number",
    edit: "Edit gear", save: "Save gear", saved: "Saved", cancel: "Cancel", photo: "Gear photo", upload: "Upload my photo", noPhoto: "No gear photo uploaded", systemPhoto: "Use matched model image", systemMatched: "Matched automatically from brand and model", photoSource: "Photo source",
    history: "Usage record", diveCount: "Total dives", lastDive: "Last dive", lastDiveValue: "Crystal Bay · Aug 30, 2026", health: "Condition", healthValue: "In good condition and ready to dive",
    maintenance: "BCD service reminder", firstUse: "First use", nextService: "Next service", newTitle: "Register new gear", newHint: "Complete the details to add this item to your dive locker", member: "ydpeng7",
    types: { bcd: "BCD", regulator: "Regulator", computer: "Dive computer", mask: "Mask", fins: "Fins" },
  },
} as const;

function GearPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [selectedId, setSelectedId] = useState("computer");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [category, setCategory] = useState<GearItem["category"]>("computer");
  const [brand, setBrand] = useState("SUUNTO");
  const [model, setModel] = useState("D5");
  const [purchased, setPurchased] = useState("2025-08-03");
  const [service, setService] = useState("");
  const [serial, setSerial] = useState("SS-D5-908731");
  const [photoName, setPhotoName] = useState("");
  const [photoMode, setPhotoMode] = useState<"system" | "upload">("system");
  const photoInput = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => gearItems.find((item) => item.id === selectedId) ?? gearItems[2], [selectedId]);

  function choose(item: GearItem) {
    setSelectedId(item.id); setCategory(item.category); setBrand(item.brand); setModel(item.model); setPurchased(item.since); setService(item.service === "—" ? "" : item.service); setSerial(item.serial); setPhotoMode("system"); setPhotoName(""); setEditing(false); setAdding(false); setSaved(false);
  }
  function startAdd() {
    setCategory("bcd"); setBrand(""); setModel(""); setPurchased(""); setService(""); setSerial(""); setPhotoMode("system"); setPhotoName(""); setAdding(true); setEditing(true); setSaved(false);
  }
  function cancel() { choose(selected); }
  function save() { setSaved(true); setAdding(false); setEditing(false); }
  const ActiveIcon = selected.icon;
  const activeAccent = adding ? "#55c9f3" : selected.accent;

  return <div className="do-gear-page">
    <header className="do-passport-header do-gear-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview">{c.logs}</Link><a href="#gear-locker" aria-current="page">{c.gear}</a><Link to="/certificates-preview">{c.certificates}</Link><Link to="/profile-preview">{c.profile}</Link></nav>
      <div className="do-passport-header-actions"><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><span className="do-passport-account"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt={c.member} /><AvatarFallback>Y</AvatarFallback></Avatar><span>{c.member}</span></span></div>
    </header>

    <main id="gear-locker" className="do-gear-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <section className="do-gear-intro"><div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div><div className="do-gear-intro-gauge"><Gauge aria-hidden="true" /><span>READY<br />TO DIVE</span></div></section>

      <div className="do-gear-layout">
        <aside className="do-gear-summary">
          <div className="do-gear-kicker"><span>01 / LOCKER</span><ShieldCheck aria-hidden="true" /></div>
          <div className="do-gear-depth-dial"><div><Waves aria-hidden="true" /><strong>05</strong><small>{c.total}</small></div></div>
          <h2>{c.locker}</h2><p>{c.lockerHint}</p>
          <dl><div><dt>{c.dives}</dt><dd>21</dd></div><div><dt>{c.attention}</dt><dd>01</dd></div><div><dt>{c.ready}</dt><dd>04 / 05</dd></div></dl>
          <button type="button" className="do-gear-add" onClick={startAdd}><Plus aria-hidden="true" />{c.add}</button>
        </aside>

        <section className="do-gear-locker-panel">
          <div className="do-gear-section-heading"><div><span>02 / COMPLETE KIT</span><h2>{c.fullKit}</h2><p>{c.fullKitHint}</p></div><Sparkles aria-hidden="true" /></div>
          <div className="do-gear-stage" style={{ "--gear-accent": activeAccent } as CSSProperties}>
            <div className="do-gear-stage-rings"><i /><i /><i /></div>
            <div className="do-gear-stage-center"><span>{c.selected}</span><ActiveIcon aria-hidden="true" /><strong>{adding ? c.newTitle : language === "zh-CN" ? selected.name : c.types[selected.category]}</strong><small>{adding ? "SUPDIVER / NEW GEAR" : `${selected.brand} · ${selected.model}`}</small></div>
            <div className="do-gear-bubble do-gear-bubble-one" /><div className="do-gear-bubble do-gear-bubble-two" />
          </div>
          <div className="do-gear-grid">
            {gearItems.map((item, index) => { const Icon = item.icon; return <button key={item.id} type="button" data-active={!adding && item.id === selected.id} onClick={() => choose(item)} style={{ "--gear-accent": item.accent } as CSSProperties}>
              <span className="do-gear-card-number">0{index + 1}</span><span className="do-gear-card-icon"><Icon aria-hidden="true" /></span><span className="do-gear-card-copy"><small>{language === "zh-CN" ? item.name : c.types[item.category]}</small><strong>{item.brand}</strong><em>{item.model}</em></span><ChevronRight aria-hidden="true" />
            </button>; })}
          </div>
          {!adding && selected.category === "bcd" && <section className="do-gear-maintenance"><span><Wrench aria-hidden="true" /></span><div className="do-gear-maintenance-title"><small>{c.maintenance}</small><strong>{selected.brand} · {selected.model}</strong></div><div className="do-gear-maintenance-dates"><span><small>{c.firstUse}</small><strong>{selected.since}</strong></span><span><small>{c.nextService}</small><strong>{selected.service}</strong></span></div></section>}
        </section>

        <aside className="do-gear-detail">
          <div className="do-gear-section-heading"><div><span>03 / GEAR RECORD</span><h2>{adding ? c.newTitle : c.details}</h2></div>{!editing && <button type="button" className="do-gear-edit" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />{c.edit}</button>}</div>
          <p className="do-gear-detail-hint">{adding ? c.newHint : c.detailHint}</p>
          <div className="do-gear-form">
            <label><span>{c.category}</span><select value={category} disabled={!editing} onChange={(event) => setCategory(event.target.value as GearItem["category"])}>{Object.entries(c.types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className="do-gear-form-pair"><label><span>{c.brand}</span><input value={brand} disabled={!editing} onChange={(event) => setBrand(event.target.value)} /></label><label><span>{c.model}</span><input value={model} disabled={!editing} onChange={(event) => setModel(event.target.value)} /></label></div>
            <div className="do-gear-form-pair"><label><span>{c.purchased}</span><input type="date" value={purchased} disabled={!editing} onChange={(event) => setPurchased(event.target.value)} /></label><label><span>{c.service}</span><input type="date" value={service} disabled={!editing} onChange={(event) => setService(event.target.value)} /></label></div>
            <label><span>{c.serial}</span><input value={serial} disabled={!editing} onChange={(event) => setSerial(event.target.value)} /></label>
          </div>
          <section className="do-gear-photo-panel">
            <div className="do-gear-photo-heading"><span>{c.photoSource}</span><strong>{c.photo}</strong></div>
            <div className="do-gear-photo-preview" data-mode={photoMode} style={{ "--gear-accent": activeAccent } as CSSProperties}><ActiveIcon aria-hidden="true" /><div><small>{photoMode === "system" ? c.systemMatched : c.upload}</small><strong>{photoMode === "system" ? `${brand || selected.brand} · ${model || selected.model}` : photoName || c.noPhoto}</strong></div>{photoMode === "system" && <ScanSearch aria-hidden="true" />}</div>
            <input ref={photoInput} type="file" accept="image/*,.heic" hidden onChange={(event) => { const fileName = event.target.files?.[0]?.name ?? ""; setPhotoName(fileName); if (fileName) setPhotoMode("upload"); }} />
            <div className="do-gear-photo-actions"><button type="button" data-active={photoMode === "upload"} disabled={!editing} onClick={() => { setPhotoMode("upload"); photoInput.current?.click(); }}><Upload aria-hidden="true" />{c.upload}</button><button type="button" data-active={photoMode === "system"} disabled={!editing || (!brand && !model)} onClick={() => setPhotoMode("system")}><ScanSearch aria-hidden="true" />{c.systemPhoto}</button></div>
          </section>
          <div className="do-gear-usage"><div className="do-gear-kicker"><span>04 / {c.history}</span><CalendarDays aria-hidden="true" /></div><dl><div><dt>{c.diveCount}</dt><dd>{adding ? "0" : selected.dives}</dd></div><div><dt>{c.lastDive}</dt><dd>{adding ? "—" : c.lastDiveValue}</dd></div><div><dt>{c.health}</dt><dd>{adding ? "—" : c.healthValue}</dd></div></dl></div>
          {(editing || adding) && <div className="do-gear-actions"><button type="button" onClick={cancel}><X aria-hidden="true" />{c.cancel}</button><button type="button" onClick={save}>{saved ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}{saved ? c.saved : c.save}</button></div>}
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
