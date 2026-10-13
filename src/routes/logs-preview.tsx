import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Clock3, Droplets, Languages, MapPin, Plus, Search, SlidersHorizontal, Thermometer, Waves } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/logs-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "潜水日志设计预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: DiveLogsPreview,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", profile: "个人资料", eyebrow: "MY DIVE STORIES",
    title: "潜水日志", intro: "按时间重温每一次下潜，也重新遇见当时的海洋与自己。", add: "记录一次下潜",
    search: "搜索潜点或国家", all: "全部", indonesia: "印度尼西亚", philippines: "菲律宾", malaysia: "马来西亚",
    entries: "篇潜水记录", countries: "个国家 / 地区", underwater: "水下时光", year: "2026 年",
    filter: "筛选日志", result: "当前显示", depth: "最大深度", duration: "潜水时长", temperature: "水温",
    guide: "潜水向导", story: "深蓝记忆", view: "查看潜水详情", noResult: "没有找到符合条件的潜水日志。",
    preview: "设计预览 · 以下为示例日志，正式页面将显示你的个人记录",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", profile: "Profile", eyebrow: "MY DIVE STORIES",
    title: "Dive Logs", intro: "Revisit every descent in time, and meet the ocean—and yourself—again.", add: "Log a dive",
    search: "Search site or country", all: "All", indonesia: "Indonesia", philippines: "Philippines", malaysia: "Malaysia",
    entries: "dive logs", countries: "countries / regions", underwater: "underwater", year: "2026",
    filter: "Filter logs", result: "Showing", depth: "Max depth", duration: "Dive time", temperature: "Water",
    guide: "Dive guide", story: "Ocean memory", view: "View dive details", noResult: "No dive logs match these filters.",
    preview: "Design preview · Sample logs only; your own records appear after sign-in",
  },
} as const;

const logs = [
  { id: "crystal-bay", date: "2026-08-30", day: "30", monthZh: "8月", monthEn: "AUG", site: "Crystal Bay", region: "Nusa Penida", country: "Indonesia", flag: "🇮🇩", depth: 28, duration: 48, water: 21, guide: "Raiyan", image: "/images/user-fish-hero-preview.jpg", noteZh: "第一次到 Crystal Bay，冰冷的水流里遇见了一只缓慢游过的 Mola mola。", noteEn: "My first Crystal Bay dive brought cold currents—and a slow, dreamlike Mola mola." },
  { id: "moalboal", date: "2026-08-18", day: "18", monthZh: "8月", monthEn: "AUG", site: "Moalboal", region: "Cebu", country: "Philippines", flag: "🇵🇭", depth: 18, duration: 52, water: 27, guide: "Alvin", image: "/images/user-cave-photo-hero-preview.jpg", noteZh: "沙丁鱼群在头顶聚散，阳光穿过鱼群落下来，像海里的一场雨。", noteEn: "The sardine school shifted overhead while sunlight fell through it like underwater rain." },
  { id: "sipadan", date: "2026-07-26", day: "26", monthZh: "7月", monthEn: "JUL", site: "Barracuda Point", region: "Sipadan", country: "Malaysia", flag: "🇲🇾", depth: 24, duration: 46, water: 28, guide: "Kamil", image: "/images/supdiver-six-orange-fish-hero.png", noteZh: "海龟从身边经过，远处的梭鱼群像银色风暴缓慢旋转。", noteEn: "A turtle passed close by while a silver barracuda storm turned in the distance." },
  { id: "batu-bolong", date: "2026-06-11", day: "11", monthZh: "6月", monthEn: "JUN", site: "Batu Bolong", region: "Komodo", country: "Indonesia", flag: "🇮🇩", depth: 26, duration: 51, water: 26, guide: "Made", image: "/images/deepocean-hero.png", noteZh: "顺着礁石下潜，珊瑚、鱼群和水流一起构成了不停变化的风景。", noteEn: "Coral, fish and current kept reshaping the view as we followed the reef downward." },
];

function DiveLogsPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const filtered = useMemo(() => logs.filter((log) => {
    const matchesCountry = country === "all" || log.country === country;
    const search = query.trim().toLowerCase();
    return matchesCountry && (!search || `${log.site} ${log.region} ${log.country}`.toLowerCase().includes(search));
  }), [country, query]);
  const totalMinutes = logs.reduce((sum, log) => sum + log.duration, 0);

  return <div className="do-logs-page">
    <header className="do-passport-header do-logs-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}>
        <Link to="/passport-preview">{c.passport}</Link><a href="#dive-logs" aria-current="page">{c.logs}</a><Link to="/profile-preview">{c.profile}</Link>
      </nav>
      <div className="do-passport-header-actions"><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><span className="do-passport-account"><Avatar><AvatarFallback>潜</AvatarFallback></Avatar><span>preview-visitor</span></span></div>
    </header>

    <main id="dive-logs" className="do-logs-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <section className="do-logs-intro">
        <div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div>
        <Link to="/new-dive-preview" className="do-logs-add"><Plus aria-hidden="true" />{c.add}</Link>
      </section>

      <section className="do-logs-overview" aria-label={language === "zh-CN" ? "日志概览" : "Log overview"}>
        <div><strong>{logs.length}</strong><span>{c.entries}</span></div><div><strong>3</strong><span>{c.countries}</span></div><div><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><span>{c.underwater}</span></div><div><strong>{c.year}</strong><span>SUPDIVER / LOGBOOK</span></div>
      </section>

      <div className="do-logs-layout">
        <aside className="do-logs-filter-panel">
          <div className="do-logs-filter-title"><SlidersHorizontal aria-hidden="true" /><span>{c.filter}</span></div>
          <label className="do-logs-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} /></label>
          <div className="do-logs-country-filters">
            {[["all", c.all], ["Indonesia", `🇮🇩 ${c.indonesia}`], ["Philippines", `🇵🇭 ${c.philippines}`], ["Malaysia", `🇲🇾 ${c.malaysia}`]].map(([value, label]) => <button key={value} type="button" data-active={country === value} onClick={() => setCountry(value)}>{label}</button>)}
          </div>
          <div className="do-logs-filter-result"><span>{c.result}</span><strong>{filtered.length}</strong><small>{c.entries}</small></div>
          <div className="do-logs-watermark"><Waves aria-hidden="true" /><span>YOUR OCEAN<br />YOUR STORY</span></div>
        </aside>

        <section className="do-logs-list" aria-live="polite">
          <div className="do-logs-year"><span>{c.year}</span><i /></div>
          {filtered.length ? filtered.map((log, index) => <article id={`log-${log.id}`} className="do-log-entry" key={log.id}>
            <div className="do-log-date"><strong>{log.day}</strong><span>{language === "zh-CN" ? log.monthZh : log.monthEn}</span><small>{log.date.slice(0, 4)}</small></div>
            <div className="do-log-photo" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,8,22,.03), rgba(0,10,27,.34)), url('${log.image}')` }}><span>#{String(logs.length - index).padStart(3, "0")}</span></div>
            <div className="do-log-content">
              <div className="do-log-place"><span><MapPin aria-hidden="true" />{log.flag} {log.country} · {log.region}</span><h2>{log.site}</h2></div>
              <div className="do-log-metrics"><span><Droplets aria-hidden="true" /><b>{log.depth}m</b><small>{c.depth}</small></span><span><Clock3 aria-hidden="true" /><b>{log.duration} min</b><small>{c.duration}</small></span><span><Thermometer aria-hidden="true" /><b>{log.water}°C</b><small>{c.temperature}</small></span></div>
              <div className="do-log-note"><small>{c.story}</small><p>{language === "zh-CN" ? log.noteZh : log.noteEn}</p></div>
              <div className="do-log-footer"><span>{c.guide} · {log.guide}</span><a href={`#log-${log.id}`}>{c.view}<ChevronRight aria-hidden="true" /></a></div>
            </div>
          </article>) : <div className="do-logs-empty"><Search aria-hidden="true" /><p>{c.noResult}</p></div>}
        </section>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>YOUR OCEAN. YOUR STORY.</small></footer>
  </div>;
}
