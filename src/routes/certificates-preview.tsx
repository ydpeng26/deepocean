import { useMemo, useRef, useState, type CSSProperties } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Award,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileImage,
  Languages,
  MapPin,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  Waves,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/certificates-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "潜水证书管理预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: CertificatesPreview,
});

type Certificate = {
  id: string;
  agency: string;
  short: string;
  levelZh: string;
  levelEn: string;
  number: string;
  date: string;
  locationZh: string;
  locationEn: string;
  accent: string;
  public: boolean;
};

const certificates: Certificate[] = [
  { id: "ow", agency: "PADI", short: "OW", levelZh: "开放水域潜水员", levelEn: "Open Water Diver", number: "2508CN0271", date: "2025-08-09", locationZh: "印度尼西亚 · 蓝梦岛", locationEn: "Nusa Lembongan, Indonesia", accent: "#49c8ef", public: true },
  { id: "aow", agency: "PADI", short: "AOW", levelZh: "进阶开放水域潜水员", levelEn: "Advanced Open Water Diver", number: "2606CN1234", date: "2026-06-18", locationZh: "印度尼西亚 · 巴厘岛", locationEn: "Bali, Indonesia", accent: "#4b8cff", public: true },
  { id: "nitrox", agency: "SSI", short: "NITROX", levelZh: "高氧潜水员", levelEn: "Enriched Air Nitrox", number: "SSI-260821-18", date: "2026-08-21", locationZh: "菲律宾 · 薄荷岛", locationEn: "Bohol, Philippines", accent: "#49d7b0", public: false },
];

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", profile: "个人资料", certificates: "潜水证书", eyebrow: "DIVER CREDENTIALS",
    title: "潜水证书", intro: "每一次学习与进阶，都是你走向更广阔海洋的坐标", preview: "设计预览 · 这里将保存你的潜水认证与成长轨迹",
    archive: "认证档案", archiveHint: "把分散的潜水证书收进同一份海洋身份档案", total: "证书数量", agencies: "认证机构", highest: "当前最高等级",
    add: "新增证书", public: "公开", private: "仅自己可见", path: "我的深蓝之路", pathHint: "从第一次独立下潜，到探索更远的海域",
    current: "当前认证", holder: "持证人", certNo: "证书编号", issued: "签发日期", issuedAt: "签发地点", details: "证书详情", detailHint: "选择左侧路径中的证书，即可查看完整资料",
    agency: "认证机构", level: "证书等级", visibility: "展示权限", edit: "编辑证书", save: "保存证书", saved: "已保存", cancel: "取消",
    front: "电子证书正面", back: "电子证书背面", upload: "上传图片", uploadHint: "JPG、PNG 或 HEIC，单张不超过 10 MB", noFile: "尚未上传",
    newTitle: "登记新证书", newHint: "补充证书信息后，它会加入你的认证路径", numberPlaceholder: "输入证书编号", locationPlaceholder: "输入签发地点", levelPlaceholder: "输入证书等级",
    verify: "资料仅用于整理个人认证经历；你可以随时修改公开状态", latest: "最新获得", member: "ydpeng7", selected: "已选择",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", profile: "Profile", certificates: "Certifications", eyebrow: "DIVER CREDENTIALS",
    title: "Dive certifications", intro: "Every course and new qualification is a coordinate on your way to a wider ocean", preview: "Design preview · Your certifications and learning journey live here",
    archive: "Credential archive", archiveHint: "Keep every dive certification together in one ocean identity", total: "Certificates", agencies: "Agencies", highest: "Highest level",
    add: "Add certification", public: "Public", private: "Only me", path: "My certification path", pathHint: "From your first independent dive to farther waters",
    current: "Current credential", holder: "Diver", certNo: "Certificate no.", issued: "Issued", issuedAt: "Issued at", details: "Certificate details", detailHint: "Select a credential in the path to see its complete record",
    agency: "Agency", level: "Certification", visibility: "Visibility", edit: "Edit credential", save: "Save credential", saved: "Saved", cancel: "Cancel",
    front: "Certificate front", back: "Certificate back", upload: "Upload image", uploadHint: "JPG, PNG or HEIC, up to 10 MB", noFile: "Not uploaded",
    newTitle: "Add a certification", newHint: "Complete the details to add it to your certification path", numberPlaceholder: "Certificate number", locationPlaceholder: "Place of issue", levelPlaceholder: "Certification name",
    verify: "This record is for organising your credentials. You control whether it is public", latest: "Latest earned", member: "ydpeng7", selected: "Selected",
  },
} as const;

function CertificatesPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [selectedId, setSelectedId] = useState("aow");
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [saved, setSaved] = useState(false);
  const [frontFile, setFrontFile] = useState("");
  const [backFile, setBackFile] = useState("");
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => certificates.find((item) => item.id === selectedId) ?? certificates[1], [selectedId]);
  const [agency, setAgency] = useState(selected.agency);
  const [level, setLevel] = useState(language === "zh-CN" ? selected.levelZh : selected.levelEn);
  const [number, setNumber] = useState(selected.number);
  const [date, setDate] = useState(selected.date);
  const [location, setLocation] = useState(language === "zh-CN" ? selected.locationZh : selected.locationEn);

  function chooseCertificate(item: Certificate) {
    setSelectedId(item.id);
    setAgency(item.agency);
    setLevel(language === "zh-CN" ? item.levelZh : item.levelEn);
    setNumber(item.number);
    setDate(item.date);
    setLocation(language === "zh-CN" ? item.locationZh : item.locationEn);
    setIsPublic(item.public);
    setIsAdding(false);
    setIsEditing(false);
    setSaved(false);
  }

  function beginAdd() {
    setAgency("PADI");
    setLevel("");
    setNumber("");
    setDate("");
    setLocation("");
    setIsPublic(true);
    setFrontFile("");
    setBackFile("");
    setIsAdding(true);
    setIsEditing(true);
    setSaved(false);
  }

  function cancelEdit() {
    chooseCertificate(selected);
  }

  function saveCertificate() {
    setSaved(true);
    setIsAdding(false);
    setIsEditing(false);
  }

  const displayLevel = isAdding ? (level || c.newTitle) : language === "zh-CN" ? selected.levelZh : selected.levelEn;
  const formLevel = !isEditing && !isAdding ? displayLevel : level;
  const formLocation = !isEditing && !isAdding ? (language === "zh-CN" ? selected.locationZh : selected.locationEn) : location;
  const formattedDate = date ? new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "—";

  return <div className="do-cert-page">
    <header className="do-passport-header do-cert-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview">{c.logs}</Link><a href="#certificate-archive" aria-current="page">{c.certificates}</a><Link to="/profile-preview">{c.profile}</Link></nav>
      <div className="do-passport-header-actions"><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><span className="do-passport-account"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt={c.member} /><AvatarFallback>Y</AvatarFallback></Avatar><span>{c.member}</span></span></div>
    </header>

    <main id="certificate-archive" className="do-cert-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <section className="do-cert-intro"><div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div><div className="do-cert-intro-mark"><Award aria-hidden="true" /><span>SUPDIVER<br />CERTIFIED</span></div></section>

      <div className="do-cert-layout">
        <aside className="do-cert-summary-panel">
          <div className="do-cert-panel-kicker"><span>01 / ARCHIVE</span><ShieldCheck aria-hidden="true" /></div>
          <div className="do-cert-seal"><div><Award aria-hidden="true" /><strong>03</strong><small>{c.total}</small></div></div>
          <h2>{c.archive}</h2><p>{c.archiveHint}</p>
          <dl className="do-cert-overview-list"><div><dt>{c.agencies}</dt><dd>PADI · SSI</dd></div><div><dt>{c.highest}</dt><dd>AOW</dd></div><div><dt>{c.latest}</dt><dd>2026.08</dd></div></dl>
          <button type="button" className="do-cert-add" onClick={beginAdd}><Plus aria-hidden="true" />{c.add}</button>
        </aside>

        <section className="do-cert-vault">
          <div className="do-cert-section-heading"><div><span>02 / CREDENTIAL</span><h2>{c.current}</h2></div><span className="do-cert-status"><Check aria-hidden="true" />{c.selected}</span></div>
          <div className="do-cert-wallet" style={{ "--certificate-accent": selected.accent } as CSSProperties}>
            <div className="do-cert-wallet-watermark"><Waves aria-hidden="true" /></div>
            <div className="do-cert-wallet-top"><span>SUPDIVER / OCEAN CREDENTIAL</span><span>{agency || selected.agency}</span></div>
            <div className="do-cert-wallet-emblem"><Award aria-hidden="true" /><span>{isAdding ? "NEW" : selected.short}</span></div>
            <div className="do-cert-wallet-copy"><small>{c.holder}</small><strong>{c.member}</strong><h3>{displayLevel}</h3></div>
            <div className="do-cert-wallet-meta"><span><small>{c.certNo}</small><b>{number || "—"}</b></span><span><small>{c.issued}</small><b>{formattedDate}</b></span></div>
            <div className="do-cert-wallet-orbit do-cert-wallet-orbit-one" /><div className="do-cert-wallet-orbit do-cert-wallet-orbit-two" />
          </div>

          <div className="do-cert-path-heading"><div><span>03 / JOURNEY</span><h2>{c.path}</h2><p>{c.pathHint}</p></div><Sparkles aria-hidden="true" /></div>
          <ol className="do-cert-path">
            {certificates.map((item, index) => <li key={item.id} data-active={!isAdding && selected.id === item.id}>
              <button type="button" onClick={() => chooseCertificate(item)}>
                <span className="do-cert-path-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="do-cert-path-node" style={{ "--certificate-accent": item.accent } as CSSProperties}><Award aria-hidden="true" /></span>
                <span className="do-cert-path-copy"><small>{item.agency} · {item.date.slice(0, 4)}</small><strong>{language === "zh-CN" ? item.levelZh : item.levelEn}</strong><em>{language === "zh-CN" ? item.locationZh : item.locationEn}</em></span>
                <ChevronRight aria-hidden="true" />
              </button>
            </li>)}
            <li className="do-cert-path-future"><button type="button" onClick={beginAdd}><span className="do-cert-path-index">04</span><span className="do-cert-path-node"><Plus aria-hidden="true" /></span><span className="do-cert-path-copy"><small>NEXT CREDENTIAL</small><strong>{c.add}</strong><em>{c.newHint}</em></span><ChevronRight aria-hidden="true" /></button></li>
          </ol>
        </section>

        <aside className="do-cert-detail-panel">
          <div className="do-cert-section-heading"><div><span>04 / DETAILS</span><h2>{isAdding ? c.newTitle : c.details}</h2></div>{!isAdding && !isEditing && <button type="button" className="do-cert-edit" onClick={() => { setLevel(language === "zh-CN" ? selected.levelZh : selected.levelEn); setLocation(language === "zh-CN" ? selected.locationZh : selected.locationEn); setIsEditing(true); setSaved(false); }}><Pencil aria-hidden="true" />{c.edit}</button>}</div>
          <p className="do-cert-detail-hint">{isAdding ? c.newHint : c.detailHint}</p>
          <div className="do-cert-form">
            <label><span><Building2 aria-hidden="true" />{c.agency}</span><select value={agency} disabled={!isEditing} onChange={(event) => setAgency(event.target.value)}><option>PADI</option><option>SSI</option><option>NAUI</option><option>CMAS</option><option>AIDA</option><option>MOLCHANOVS</option></select></label>
            <label><span><Award aria-hidden="true" />{c.level}</span><input value={formLevel} disabled={!isEditing} placeholder={c.levelPlaceholder} onChange={(event) => setLevel(event.target.value)} /></label>
            <label><span><ShieldCheck aria-hidden="true" />{c.certNo}</span><input value={number} disabled={!isEditing} placeholder={c.numberPlaceholder} onChange={(event) => setNumber(event.target.value)} /></label>
            <label><span><CalendarDays aria-hidden="true" />{c.issued}</span><input type="date" value={date} disabled={!isEditing} onChange={(event) => setDate(event.target.value)} /></label>
            <label><span><MapPin aria-hidden="true" />{c.issuedAt}</span><input value={formLocation} disabled={!isEditing} placeholder={c.locationPlaceholder} onChange={(event) => setLocation(event.target.value)} /></label>
          </div>

          <div className="do-cert-visibility"><div><span>{c.visibility}</span><strong>{isPublic ? c.public : c.private}</strong></div><button type="button" aria-pressed={isPublic} disabled={!isEditing} onClick={() => setIsPublic((value) => !value)}>{isPublic ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button></div>

          <div className="do-cert-upload-grid">
            {[{ key: "front", label: c.front, value: frontFile, ref: frontInput, set: setFrontFile }, { key: "back", label: c.back, value: backFile, ref: backInput, set: setBackFile }].map((upload) => <div className="do-cert-upload" key={upload.key}>
              <div><FileImage aria-hidden="true" /><span><strong>{upload.label}</strong><small>{upload.value || c.noFile}</small></span></div>
              <input ref={upload.ref} type="file" accept="image/*,.heic" hidden onChange={(event) => upload.set(event.target.files?.[0]?.name ?? "")} />
              <button type="button" disabled={!isEditing} onClick={() => upload.ref.current?.click()}><Upload aria-hidden="true" />{c.upload}</button>
            </div>)}
          </div>
          <p className="do-cert-upload-hint">{c.uploadHint}</p>

          <div className="do-cert-privacy-note"><ShieldCheck aria-hidden="true" /><p>{c.verify}</p></div>
          {(isEditing || isAdding) && <div className="do-cert-form-actions"><button type="button" onClick={cancelEdit}><X aria-hidden="true" />{c.cancel}</button><button type="button" onClick={saveCertificate}>{saved ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}{saved ? c.saved : c.save}</button></div>}
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
