import { Award } from "lucide-react";
import type { Dive } from "@/lib/dives";
import { diveStats } from "@/lib/dive-stats";

export function DiveAchievements({ dives, english, pending, error }: { dives: Dive[]; english: boolean; pending: boolean; error: boolean }) {
  const stats = diveStats(dives);
  const unavailable = pending || error;
  const metrics = [
    [english ? "Deepest dive" : "最深下潜深度", stats.maxDepth == null ? "—" : `${stats.maxDepth} m`],
    [english ? "Longest single dive" : "最长单次水下时间", stats.longestMinutes == null ? "—" : `${stats.longestMinutes} ${english ? "min" : "分钟"}`],
    [english ? "Unique dive sites" : "到访潜点数", stats.siteCount],
    [english ? `${stats.currentYear} dives` : `${stats.currentYear} 年潜数`, stats.annualCount],
  ];
  return <>
    {metrics.map(([label, value]) => <div key={label} className="do-passport-identity-row"><span>{label}</span><strong>{unavailable ? "—" : value}</strong></div>)}
    {unavailable ? <p role="status" className="mx-5 py-3 text-xs text-[#a9c8df]">{error ? (english ? "Statistics unavailable. Please reload your logs." : "统计暂时无法加载，请重新加载日志。") : (english ? "Loading statistics…" : "正在读取统计…")}</p> : <>
      <div className={`mx-5 mt-3 flex items-center gap-2 rounded-xl border p-3 ${stats.hundredUnlocked ? "border-[#80d0ff]/50 bg-[#80d0ff]/10 text-[#80d0ff]" : "border-[#84c5ee]/15 text-[#a9c8df]"}`}>
        <Award aria-hidden="true" className="h-8 w-8 shrink-0" />
        <div className="min-w-0"><h3 className="text-sm font-semibold">{english ? "100 dives badge" : "百潜成就勋章"}</h3>
          <p className="mt-1 text-xs">{stats.hundredUnlocked ? (english ? `Unlocked · ${stats.total} dives logged` : `已解锁 · 已记录 ${stats.total} 潜`) : (english ? `${stats.total} / 100 dives · ${100 - stats.total} to go` : `${stats.total} / 100 潜 · 距离解锁还差 ${100 - stats.total} 潜`)}</p>
          <progress className="mt-2 h-2 w-full accent-[#80d0ff]" value={stats.progress} max={100} aria-label={english ? "Progress toward 100 dives" : "百潜成就进度"} />
        </div>
      </div>
      <details className="mx-5 my-3"><summary className="cursor-pointer py-2 text-sm">{english ? "Dives by year" : "查看历年潜数"}</summary>
        {stats.years.length ? <dl className="grid gap-2 py-3 text-xs">{stats.years.map(([year, count]) => <div key={year} className="flex justify-between gap-2"><dt>{year}</dt><dd>{count} {english ? "dives" : "潜"}</dd></div>)}</dl> : <p className="py-2 text-sm text-[#a9c8df]">{english ? "No dive logs yet." : "尚无潜水日志。"}</p>}
      </details>
    </>}
  </>;
}
