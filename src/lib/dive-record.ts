export type RecordMode = "precise" | "summary";
export type DatePrecision = "day" | "month" | "year" | "range";
export type DiveRecord = {
  record_mode?: RecordMode;
  dive_count?: number;
  date_precision?: DatePrecision;
  period_end?: string | null;
  site_names?: string[];
  total_duration_min?: number | null;
};

export function diveCount(dive: DiveRecord): number {
  return dive.record_mode === "summary" && Number.isInteger(dive.dive_count) && dive.dive_count! > 0 ? dive.dive_count! : 1;
}

export function diveSites(dive: DiveRecord & { site_name: string }): string[] {
  return dive.record_mode === "summary" ? dive.site_names ?? [] : [dive.site_name];
}

export function recordedMinutes(dive: DiveRecord & { duration_min: number | null }): number {
  const value = dive.record_mode === "summary" ? dive.total_duration_min : dive.duration_min;
  return value != null && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function diveNumberLabel(start: number, dive: DiveRecord): string {
  const first = String(start).padStart(3, "0");
  return diveCount(dive) > 1 ? `${first}–${String(start + diveCount(dive) - 1).padStart(3, "0")}` : first;
}

export function divePeriodLabel(dive: Pick<DiveRecord, "record_mode" | "date_precision" | "period_end"> & { dive_date: string }, english: boolean): string {
  if (dive.record_mode !== "summary") return dive.dive_date;
  const [year, month] = dive.dive_date.split("-");
  if (dive.date_precision === "year") return english ? year : `${year}年`;
  if (dive.date_precision === "month") return english ? `${year}-${month}` : `${year}年${Number(month)}月`;
  return dive.date_precision === "range" ? `${dive.dive_date} – ${dive.period_end}` : dive.dive_date;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0, 4) >= "1900"
    && value.slice(0, 4) <= "9999" && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function diveRecordFields(input: {
  record_mode?: RecordMode; dive_count?: string; date_precision?: DatePrecision;
  dive_date: string; period_end?: string; site_names?: string; total_duration_min?: string;
}, longestMinutes?: number | null): DiveRecord & { dive_date: string } {
  if (input.record_mode && !["precise", "summary"].includes(input.record_mode)) throw new Error("记录模式无效 / Invalid record mode");
  if (!validDate(input.dive_date)) throw new Error("请填写有效日期（1900年起） / Enter a valid date (1900 onward)");
  if (input.record_mode !== "summary") return {
    record_mode: "precise", dive_count: 1, date_precision: "day", dive_date: input.dive_date,
    period_end: null, site_names: [], total_duration_min: null,
  };
  const count = input.dive_count?.trim() ?? "";
  if (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 100000)
    throw new Error("潜水次数须为 1–100000 的整数 / Dive count must be an integer from 1 to 100000");
  const precision = input.date_precision ?? "month";
  if (!["day", "month", "year", "range"].includes(precision)) throw new Error("时间精度无效 / Invalid date precision");
  const [year, month] = input.dive_date.split("-");
  const start = precision === "year" ? `${year}-01-01` : precision === "month" ? `${year}-${month}-01` : input.dive_date;
  const end = precision === "year" ? `${year}-12-31` : precision === "month"
    ? `${year}-${month}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}`
    : precision === "range" ? input.period_end ?? "" : start;
  if (!validDate(end) || end < start) throw new Error("结束日期不能早于开始日期 / End date must not precede start date");
  if (end.slice(0, 4) !== year) throw new Error("跨年经历请按年分别录入，以保证年潜数准确 / Split cross-year experiences by year for accurate annual counts");
  const sites: string[] = [], seen = new Set<string>();
  for (const raw of (input.site_names ?? "").split(/\r?\n/)) {
    const name = raw.trim();
    if (!name) continue;
    if (name.length > 120) throw new Error("每个潜点名称最多120字符 / Each site name: maximum 120 characters");
    const key = name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(key)) { seen.add(key); sites.push(name); }
  }
  if (sites.length > 200) throw new Error("每篇最多200个潜点 / Maximum 200 sites per entry");
  const rawTotal = input.total_duration_min?.trim() ?? "";
  const total = rawTotal === "" ? null : Number(rawTotal);
  if (total !== null && (!/^\d+$/.test(rawTotal) || !Number.isSafeInteger(total) || total < 0 || total > 2147483647))
    throw new Error("累计时间须为非负整数分钟 / Total time must be a non-negative integer in minutes");
  if (total != null && longestMinutes != null && total < longestMinutes)
    throw new Error("累计水下时间不能少于最长单次时间 / Total time cannot be shorter than the longest dive");
  return { record_mode: "summary", dive_count: Number(count), date_precision: precision,
    dive_date: start, period_end: end, site_names: sites, total_duration_min: total };
}
