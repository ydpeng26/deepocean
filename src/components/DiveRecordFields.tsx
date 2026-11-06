import type { DatePrecision, RecordMode } from "@/lib/dive-record";

export type RecordFormValue = {
  record_mode?: RecordMode; dive_count?: string; date_precision?: DatePrecision;
  dive_date: string; period_end?: string; site_names?: string; total_duration_min?: string;
};

export function DiveRecordFields({ value, onChange, english }: {
  value: RecordFormValue; onChange: (patch: Partial<RecordFormValue>) => void; english: boolean;
}) {
  const summary = value.record_mode === "summary";
  const precision = value.date_precision ?? "month";
  const c = (zh: string, en: string) => english ? en : zh;
  const inputClass = "min-h-11 w-full min-w-0 border border-input bg-background px-3 py-2 text-base";
  return <section className="space-y-4 rounded-xl border border-border p-4">
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{c("记录模式", "Recording mode")}</legend>
      <div className="flex flex-wrap gap-4">
        {(["precise", "summary"] as const).map(mode => <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-2">
          <input type="radio" name="record-mode" value={mode} checked={(summary ? "summary" : "precise") === mode}
            onChange={() => onChange({ record_mode: mode, ...(mode === "summary" && value.date_precision === "day" ? { date_precision: "month" as const } : {}) })} />
          {mode === "precise" ? c("精确记录 · 一次潜水", "Precise · one dive") : c("模糊记录 · 多次潜水经历", "Summary · multiple dives")}
        </label>)}
      </div>
    </fieldset>
    <p className="text-sm text-muted-foreground">{summary
      ? c("一篇日志记录一段经历，潜水次数单独统计。只填记得的数据；不要重复包含已录入的单次潜水。跨年经历请按年分别录入。", "One entry covers an experience; its dives count separately. Enter only what you remember. Exclude dives already logged individually. Split cross-year experiences by year.")
      : c("每篇日志对应一次潜水，按日期和入水时间排序。", "Each entry represents one dive, ordered by date and entry time.")}</p>
    {summary && <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2"><span>{c("潜水次数（必填）", "Number of dives (required)")}</span>
        <input id="summary-count" className={inputClass} type="number" min="1" max="100000" step="1" required value={value.dive_count ?? ""} onChange={e => onChange({ dive_count: e.target.value })} /></label>
      <label className="space-y-2"><span>{c("时间精度", "Date precision")}</span>
        <select id="summary-precision" className={inputClass} value={precision} onChange={e => onChange({ date_precision: e.target.value as DatePrecision })}>
          <option value="month">{c("只记得月份", "Month")}</option><option value="year">{c("只记得年份", "Year")}</option>
          <option value="range">{c("一段日期", "Date range")}</option><option value="day">{c("某一天", "One day")}</option>
        </select></label>
      <label className="space-y-2"><span>{c("潜水时间（必填）", "When (required)")}</span>
        <input id="summary-start" className={inputClass} required type={precision === "month" ? "month" : precision === "year" ? "number" : "date"}
          min={precision === "year" ? "1900" : undefined} max={precision === "year" ? "9999" : undefined}
          value={precision === "year" ? value.dive_date.slice(0, 4) : precision === "month" ? value.dive_date.slice(0, 7) : value.dive_date}
          onChange={e => onChange({ dive_date: e.target.value ? precision === "year" ? `${e.target.value}-01-01` : precision === "month" ? `${e.target.value}-01` : e.target.value : "" })} /></label>
      {precision === "range" && <label className="space-y-2"><span>{c("结束日期（必填）", "End date (required)")}</span>
        <input id="summary-end" className={inputClass} type="date" required value={value.period_end ?? ""} min={value.dive_date} onChange={e => onChange({ period_end: e.target.value })} /></label>}
      <label className="space-y-2 sm:col-span-2"><span>{c("到访潜点（选填，每行一个）", "Dive sites (optional, one per line)")}</span>
        <textarea id="summary-sites" className={inputClass} rows={3} value={value.site_names ?? ""} onChange={e => onChange({ site_names: e.target.value })} placeholder={"Monad Shoal\nGato Island"} /></label>
      <label className="space-y-2"><span>{c("已知累计水下时间（分钟，选填）", "Known total underwater time (minutes, optional)")}</span>
        <input id="summary-total-time" className={inputClass} type="number" min="0" max="2147483647" step="1" value={value.total_duration_min ?? ""} onChange={e => onChange({ total_duration_min: e.target.value })} /></label>
      <p className="self-center text-xs text-muted-foreground">{c("不知道累计时间可留空。下方填写的“最长单次时间”不会乘以潜水次数。", "Leave the total blank if unknown. The longest single dive below is never multiplied by the number of dives.")}</p>
    </div>}
  </section>;
}
