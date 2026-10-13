import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudOff,
  Gauge,
  HardDrive,
  Languages,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Waves,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/offline-sync-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "离线草稿与同步预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: OfflineSyncWorkspace,
});

type Draft = {
  id: string;
  site: string;
  countryZh: string;
  countryEn: string;
  date: string;
  saved: string;
  depth: string;
  duration: string;
  completeness: number;
  image: string;
  selected: boolean;
};

const initialDrafts: Draft[] = [
  { id: "crystal-bay", site: "Crystal Bay", countryZh: "印度尼西亚 · Nusa Penida", countryEn: "Nusa Penida, Indonesia", date: "2026-10-12", saved: "18:42", depth: "28m", duration: "48min", completeness: 96, image: "/images/user-fish-hero-preview.jpg", selected: true },
  { id: "manta-point", site: "Manta Point", countryZh: "印度尼西亚 · Nusa Penida", countryEn: "Nusa Penida, Indonesia", date: "2026-10-12", saved: "12:18", depth: "18m", duration: "52min", completeness: 68, image: "/images/user-cave-photo-hero-preview.jpg", selected: false },
  { id: "tulamben", site: "Tulamben Drop Off", countryZh: "印度尼西亚 · Bali", countryEn: "Bali, Indonesia", date: "2026-10-11", saved: "16:05", depth: "24m", duration: "46min", completeness: 100, image: "/images/supdiver-six-orange-fish-hero.png", selected: true },
];

const copy = {
  "zh-CN": {
    back: "返回登录", language: "EN", eyebrow: "OFFLINE DRAFTS", title: "离线草稿与同步", intro: "在没有信号的海上先记录，回到网络之后，再把这段海洋记忆安全带回你的账号",
    preview: "设计预览 · 以下为示例草稿，不会修改真实记录", online: "网络已恢复", offline: "当前无信号", onlineHint: "现在可以登录并同步", offlineHint: "草稿继续安全保存在本机",
    vault: "本机草稿舱", vaultHint: "所有内容只保存在当前设备，除非你主动确认同步", drafts: "待同步草稿", photos: "本机照片", storage: "本机占用", new: "新建离线记录",
    safety: "本机保存说明", safetyText: "清除浏览器数据、更换设备或使用无痕模式，可能导致尚未同步的草稿丢失。", flow: "同步流程", capture: "无信号时记录", review: "联网后检查", sync: "登录后同步",
    records: "待同步记录", recordsHint: "选择准备同步的草稿；信息不完整的记录可以先继续编辑", selected: "已选择", all: "全选", complete: "资料完整", incomplete: "待补充", edit: "继续编辑",
    depth: "最大深度", duration: "潜水时长", savedAt: "本机保存", details: "草稿概览", memory: "深蓝记忆", memoryText: "水温比预想得更低，但在不到 30 米的位置遇见了 Mola mola。出水以后，手还在发抖。",
    syncCenter: "同步中心", syncHint: "登录状态和同步目标会在这里确认", account: "同步账号", accountReady: "账号已确认", device: "当前设备", deviceValue: "这台 Mac · Safari", target: "同步目标", targetValue: "个人潜水日志",
    queue: "本次同步", recordsUnit: "条草稿", photosUnit: "张照片", ready: "可以开始同步", blocked: "等待网络恢复", startSync: "同步到我的账号", syncing: "正在同步", done: "同步完成", doneHint: "所选草稿已安全保存到个人潜水日志",
    privacy: "同步前会再次核对账号。草稿不会自动公开，也不会同步给其他用户。", choose: "请选择至少一条草稿", status: "本机草稿", signedIn: "ydpeng7",
  },
  en: {
    back: "Back to sign in", language: "中文", eyebrow: "OFFLINE DRAFTS", title: "Offline drafts & sync", intro: "Capture the dive at sea without a signal, then safely bring that ocean memory back to your account when the network returns",
    preview: "Design preview · Sample drafts only; your real records are unchanged", online: "Back online", offline: "No signal", onlineHint: "You can now sign in and sync", offlineHint: "Drafts remain safely on this device",
    vault: "Local draft vault", vaultHint: "Everything stays on this device unless you explicitly confirm syncing", drafts: "Drafts waiting", photos: "Local photos", storage: "Storage used", new: "New offline log",
    safety: "Local storage notice", safetyText: "Clearing browser data, changing devices, or private browsing may erase drafts that have not been synced.", flow: "Sync flow", capture: "Capture offline", review: "Review online", sync: "Sync after sign-in",
    records: "Waiting to sync", recordsHint: "Choose drafts that are ready; incomplete records can be edited first", selected: "Selected", all: "Select all", complete: "Complete", incomplete: "Needs details", edit: "Continue editing",
    depth: "Max depth", duration: "Dive time", savedAt: "Saved locally", details: "Draft overview", memory: "Ocean memory", memoryText: "The water was colder than expected, but a Mola mola appeared above 30 metres. My hands were still shaking after surfacing.",
    syncCenter: "Sync centre", syncHint: "Confirm your sign-in and destination before syncing", account: "Sync account", accountReady: "Account confirmed", device: "Current device", deviceValue: "This Mac · Safari", target: "Destination", targetValue: "Personal dive logs",
    queue: "This sync", recordsUnit: "drafts", photosUnit: "photos", ready: "Ready to sync", blocked: "Waiting for network", startSync: "Sync to my account", syncing: "Syncing", done: "Sync complete", doneHint: "Selected drafts are now safely stored in your personal dive logs",
    privacy: "Your account is verified again before syncing. Drafts are never made public or shared with others automatically.", choose: "Select at least one draft", status: "Local draft", signedIn: "ydpeng7",
  },
} as const;

export function OfflineSyncWorkspace() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [online, setOnline] = useState(true);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [activeId, setActiveId] = useState("crystal-bay");
  const [phase, setPhase] = useState<"ready" | "syncing" | "done">("ready");
  const active = useMemo(() => drafts.find((draft) => draft.id === activeId) ?? drafts[0], [activeId, drafts]);
  const selectedCount = drafts.filter((draft) => draft.selected).length;
  const selectedPhotos = selectedCount * 3;

  function toggleDraft(id: string) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, selected: !draft.selected } : draft));
    setPhase("ready");
  }
  function selectAll() {
    const allSelected = drafts.every((draft) => draft.selected);
    setDrafts((current) => current.map((draft) => ({ ...draft, selected: !allSelected })));
    setPhase("ready");
  }
  function syncDrafts() {
    if (!online || selectedCount === 0) return;
    setPhase("syncing");
    window.setTimeout(() => setPhase("done"), 650);
  }

  return <div className="do-sync-page">
    <header className="do-passport-header do-sync-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <div className="do-sync-header-status" data-online={online}>{online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}<span><strong>{online ? c.online : c.offline}</strong><small>{online ? c.onlineHint : c.offlineHint}</small></span></div>
      <div className="do-passport-header-actions"><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{c.language}</button><Link to="/auth" className="do-sync-back"><ArrowLeft aria-hidden="true" />{c.back}</Link></div>
    </header>

    <main className="do-sync-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <section className="do-sync-intro"><div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div><button type="button" className="do-sync-network-toggle" data-online={online} onClick={() => { setOnline((value) => !value); setPhase("ready"); }}>{online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}<span><strong>{online ? c.online : c.offline}</strong><small>{online ? c.onlineHint : c.offlineHint}</small></span></button></section>

      <div className="do-sync-layout">
        <aside className="do-sync-vault">
          <div className="do-sync-kicker"><span>01 / LOCAL VAULT</span><HardDrive aria-hidden="true" /></div>
          <div className="do-sync-vault-count"><CloudOff aria-hidden="true" /><strong>03</strong><small>{c.drafts}</small></div>
          <h2>{c.vault}</h2><p>{c.vaultHint}</p>
          <dl className="do-sync-vault-stats"><div><dt>{c.drafts}</dt><dd>03</dd></div><div><dt>{c.photos}</dt><dd>09</dd></div><div><dt>{c.storage}</dt><dd>126 MB</dd></div></dl>
          <Link to="/offline" className="do-sync-new"><Plus aria-hidden="true" />{c.new}</Link>
          <div className="do-sync-safety"><ShieldCheck aria-hidden="true" /><div><strong>{c.safety}</strong><p>{c.safetyText}</p></div></div>
          <div className="do-sync-flow"><span>{c.flow}</span><ol><li><i>1</i><strong>{c.capture}</strong></li><li><i>2</i><strong>{c.review}</strong></li><li><i>3</i><strong>{c.sync}</strong></li></ol></div>
        </aside>

        <section className="do-sync-drafts-panel">
          <div className="do-sync-section-heading"><div><span>02 / DRAFTS</span><h2>{c.records}</h2><p>{c.recordsHint}</p></div><button type="button" onClick={selectAll}><Check aria-hidden="true" />{c.all}</button></div>
          <div className="do-sync-draft-list">
            {drafts.map((draft, index) => <article key={draft.id} data-active={active.id === draft.id}>
              <button type="button" className="do-sync-draft-select" aria-pressed={draft.selected} onClick={() => toggleDraft(draft.id)}>{draft.selected && <Check aria-hidden="true" />}</button>
              <button type="button" className="do-sync-draft-body" onClick={() => setActiveId(draft.id)}>
                <span className="do-sync-draft-index">0{index + 1}</span><span className="do-sync-draft-photo" style={{ backgroundImage: `linear-gradient(0deg, rgba(0,18,40,.3), rgba(0,18,40,.03)), url('${draft.image}')` }} />
                <span className="do-sync-draft-copy"><small>{draft.date} · {c.status}</small><strong>{draft.site}</strong><em><MapPin aria-hidden="true" />{language === "zh-CN" ? draft.countryZh : draft.countryEn}</em></span>
                <span className="do-sync-draft-progress"><b>{draft.completeness}%</b><i><u style={{ width: `${draft.completeness}%` }} /></i><small>{draft.completeness >= 90 ? c.complete : c.incomplete}</small></span><ChevronRight aria-hidden="true" />
              </button>
            </article>)}
          </div>
          <section className="do-sync-draft-detail">
            <div className="do-sync-detail-photo" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,16,38,.72), rgba(0,16,38,.07)), url('${active.image}')` }}><span>{c.details}</span><strong>{active.site}</strong><small>{language === "zh-CN" ? active.countryZh : active.countryEn}</small></div>
            <div className="do-sync-detail-data"><span><Gauge aria-hidden="true" /><small>{c.depth}</small><strong>{active.depth}</strong></span><span><Clock3 aria-hidden="true" /><small>{c.duration}</small><strong>{active.duration}</strong></span><span><CalendarDays aria-hidden="true" /><small>{c.savedAt}</small><strong>{active.saved}</strong></span></div>
            <div className="do-sync-detail-memory"><div><Waves aria-hidden="true" /><span><small>{c.memory}</small><p>{c.memoryText}</p></span></div><Link to="/offline"><Pencil aria-hidden="true" />{c.edit}</Link></div>
          </section>
        </section>

        <aside className="do-sync-centre">
          <div className="do-sync-section-heading"><div><span>03 / SYNC</span><h2>{c.syncCenter}</h2></div><RefreshCw aria-hidden="true" /></div><p className="do-sync-centre-hint">{c.syncHint}</p>
          <div className="do-sync-account"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt={c.signedIn} /><AvatarFallback>Y</AvatarFallback></Avatar><div><small>{c.account}</small><strong>{c.signedIn}</strong><span><CheckCircle2 aria-hidden="true" />{c.accountReady}</span></div></div>
          <dl className="do-sync-destination"><div><dt><HardDrive aria-hidden="true" />{c.device}</dt><dd>{c.deviceValue}</dd></div><div><dt><UserRound aria-hidden="true" />{c.target}</dt><dd>{c.targetValue}</dd></div></dl>
          <div className="do-sync-route"><span className="do-sync-route-device"><CloudOff aria-hidden="true" /></span><i /><span className="do-sync-route-account"><UserRound aria-hidden="true" /></span></div>
          <section className="do-sync-queue" data-phase={phase}><div><small>{c.queue}</small><strong>{selectedCount} {c.recordsUnit}</strong><span>{selectedPhotos} {c.photosUnit}</span></div><div className="do-sync-queue-status">{phase === "done" ? <CheckCircle2 aria-hidden="true" /> : online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}<span>{phase === "done" ? c.done : online ? c.ready : c.blocked}</span></div></section>
          {selectedCount === 0 && <p className="do-sync-choose"><AlertCircle aria-hidden="true" />{c.choose}</p>}
          <button type="button" className="do-sync-button" disabled={!online || selectedCount === 0 || phase === "syncing"} onClick={syncDrafts}>{phase === "syncing" ? <RefreshCw className="do-sync-spinning" aria-hidden="true" /> : phase === "done" ? <Check aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}{phase === "syncing" ? c.syncing : phase === "done" ? c.done : c.startSync}<ArrowRight aria-hidden="true" /></button>
          {phase === "done" && <p className="do-sync-done-hint">{c.doneHint}</p>}
          <div className="do-sync-privacy"><LockKeyhole aria-hidden="true" /><p>{c.privacy}</p></div>
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
