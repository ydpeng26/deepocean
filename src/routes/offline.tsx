import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CloudOff, Languages, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useLiveCopy } from "@/i18n/liveCopy";
import {
  deleteOfflineDive,
  emptyOfflineDive,
  listOfflineDives,
  saveOfflineDive,
  OfflineDraftConflict,
  type OfflineDive,
  type OfflineDiveFields,
} from "@/lib/offline-dives";
import { DiveCompanionsEditor } from "@/components/DiveCompanionsEditor";
import { readCompanions } from "@/lib/dive-companions";
import type { DiveType } from "@/lib/dives";

const copy = {
  "zh-CN": {
    title: "先记下这一潜",
    subtitle: "没有信号，也别让刚出水的记忆溜走。记录先保存在这台设备，联网并登录后由你确认同步。",
    offline: "无信号记录",
    localOnly: "仅保存在此设备 · 尚未同步",
    warning:
      "清除浏览器数据、更换设备或使用无痕模式，可能使未同步记录丢失。请在恢复网络后尽快登录同步。",
    back: "返回登录",
    login: "联网后登录并同步",
    drafts: "本机待同步记录",
    empty: "还没有本机记录，先从这一次下潜开始吧。",
    new: "新建记录",
    edit: "编辑",
    remove: "删除",
    removeConfirm: "确定删除这条仅保存在本机的记录吗？删除后无法恢复。",
    deleted: "本机记录已删除",
    sectionPlace: "地点与时间",
    sectionDive: "潜水信息",
    sectionStory: "深蓝记忆",
    country: "潜水国家",
    region: "地区 / 岛屿",
    site: "潜点名称",
    date: "潜水日期",
    weather: "天气",
    depth: "最大深度（米）",
    duration: "潜水时长（分钟）",
    surface: "水上温度（°C）",
    water: "水下温度（°C）",
    type: "潜水类型",
    role: "潜伴身份",
    buddy: "潜水向导 / 潜伴",
    notes: "记下刚刚看见的、想到的……",
    save: "保存到此设备",
    saving: "保存中…",
    saved: "已保存到此设备，尚未同步到账号",
    required: "请填写潜水国家、潜点名称和日期",
    invalidNumber: "请检查深度、时长和温度是否为有效数字",
    storageError: "本机存储失败，请检查浏览器存储权限与剩余空间",
    noWeather: "未填写",
    noRole: "未填写",
    instructor: "教练 / 向导",
    buddyRole: "潜伴",
    recreational: "休闲水肺",
    freediving: "自由潜",
    technical: "技术潜水",
    sunny: "晴",
    cloudy: "多云",
    overcast: "阴",
    drizzle: "小雨",
    rainy: "大雨",
    windy: "有风",
  },
  en: {
    title: "Capture this dive now",
    subtitle:
      "No signal? Keep the memories fresh. Your entry stays on this device until you sign in and confirm syncing online.",
    offline: "Offline log",
    localOnly: "On this device only · Not synced",
    warning:
      "Clearing browser data, changing devices, or using private browsing can erase unsynced entries. Sign in and sync when you are back online.",
    back: "Back to sign in",
    login: "Sign in to sync when online",
    drafts: "Entries waiting to sync",
    empty: "No local entries yet. Start with this dive.",
    new: "New entry",
    edit: "Edit",
    remove: "Delete",
    removeConfirm: "Delete this local-only entry? This cannot be undone.",
    deleted: "Local entry deleted",
    sectionPlace: "Place and time",
    sectionDive: "Dive information",
    sectionStory: "Ocean memory",
    country: "Country",
    region: "Region / island",
    site: "Dive site",
    date: "Dive date",
    weather: "Weather",
    depth: "Max depth (m)",
    duration: "Dive time (min)",
    surface: "Surface temp (°C)",
    water: "Water temp (°C)",
    type: "Dive type",
    role: "Buddy role",
    buddy: "Guide / buddy name",
    notes: "What did you see and feel just now?",
    save: "Save on this device",
    saving: "Saving…",
    saved: "Saved on this device, not yet synced to your account",
    required: "Enter the country, dive site, and date",
    invalidNumber: "Check that depth, time, and temperatures are valid numbers",
    storageError: "Local save failed. Check your browser storage permissions and available space",
    noWeather: "Not specified",
    noRole: "Not specified",
    instructor: "Instructor / guide",
    buddyRole: "Buddy",
    recreational: "Recreational scuba",
    freediving: "Freediving",
    technical: "Technical diving",
    sunny: "Sunny",
    cloudy: "Cloudy",
    overcast: "Overcast",
    drizzle: "Light rain",
    rainy: "Rainy",
    windy: "Windy",
  },
} as const;

const weatherOptions = ["晴", "多云", "阴", "小雨", "大雨", "有风"] as const;
const weatherKeys = ["sunny", "cloudy", "overcast", "drizzle", "rainy", "windy"] as const;

export const Route = createFileRoute("/offline")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { draft?: string } =>
    typeof search.draft === "string" ? { draft: search.draft } : {},
  head: () => ({
    meta: [
      { title: "无信号记录 · SupDiver" },
      { name: "description", content: "无信号时先在本机记录潜水，联网登录后同步到 SupDiver。" },
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  useLiveCopy("无信号记录 · SupDiver");
  const { draft: initialDraftId } = Route.useSearch();
  const { language, toggleLanguage } = useLanguage();
  const t = copy[language];
  const [fields, setFields] = useState<OfflineDiveFields>(emptyOfflineDive);
  const [editingId, setEditingId] = useState<string>();
  const [drafts, setDrafts] = useState<OfflineDive[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState(false);
  const working = useRef(false);
  const alive = useRef(true);
  const baseline = useRef<OfflineDive | undefined>(undefined);
  const requestId = useRef(crypto.randomUUID());
  const storageMessage = useRef(t.storageError);
  storageMessage.current = t.storageError;

  useEffect(() => {
    alive.current = true;
    let current = true;
    setLoading(true);
    listOfflineDives()
      .then((items) => {
        if (!current) return;
        setDrafts(items);
        const draft = items.find((item) => item.id === initialDraftId);
        if (draft) {
          const { id, saved_at, revision, ...savedFields } = draft;
          void saved_at;
          void revision;
          baseline.current = draft;
          setEditingId(id);
          setFields(savedFields);
        } else if (initialDraftId) {
          baseline.current = undefined;
          setEditingId(initialDraftId);
          setConflict(true);
        }
      })
      .catch(() => {
        if (current) toast.error(storageMessage.current);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      alive.current = false;
    };
  }, [initialDraftId]);

  function update<K extends keyof OfflineDiveFields>(key: K, value: OfflineDiveFields[K]) {
    if (working.current || loading) return;
    setFields((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    if (working.current || loading) return;
    baseline.current = undefined;
    requestId.current = crypto.randomUUID();
    setConflict(false);
    setEditingId(undefined);
    setFields(emptyOfflineDive());
    document.getElementById("offline-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(draft: OfflineDive) {
    if (working.current || loading) return;
    if (
      conflict &&
      !window.confirm(
        language === "zh-CN"
          ? "读取此草稿会替换当前未保存输入，确定继续吗？"
          : "Loading this draft replaces your unsaved input. Continue?",
      )
    )
      return;
    const { id, saved_at, revision, ...savedFields } = draft;
    void saved_at;
    void revision;
    baseline.current = draft;
    setConflict(false);
    setEditingId(id);
    setFields(savedFields);
    document.getElementById("offline-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function remove(id: string) {
    if (working.current || loading) return;
    if (!window.confirm(t.removeConfirm)) return;
    working.current = true;
    setSaving(true);
    try {
      await deleteOfflineDive(
        id,
        drafts.find((draft) => draft.id === id),
      );
      const items = await listOfflineDives();
      if (!alive.current) return;
      setDrafts(items);
      // Never erase an open editor's unsaved text after a list deletion.
      if (editingId === id) setConflict(true);
      toast.success(t.deleted);
    } catch (error) {
      if (alive.current) {
        if (error instanceof OfflineDraftConflict) setConflict(true);
        toast.error(error instanceof OfflineDraftConflict ? error.message : t.storageError);
      }
    } finally {
      working.current = false;
      if (alive.current) setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working.current || loading) return;
    if (!fields.country.trim() || !fields.site_name.trim() || !fields.dive_date) {
      toast.error(t.required);
      return;
    }
    const numeric = [fields.max_depth, fields.duration_min, fields.surface_temp, fields.water_temp];
    if (numeric.some((value) => value.trim() && !Number.isFinite(Number(value)))) {
      toast.error(t.invalidNumber);
      return;
    }
    working.current = true;
    setSaving(true);
    try {
      const saved = await saveOfflineDive(fields, editingId, {
        expected: baseline.current,
        requestId: requestId.current,
      });
      if (!alive.current) return;
      // Keep the saved identity even if refreshing the sidebar fails.
      baseline.current = saved;
      setEditingId(saved.id);
      let items: OfflineDive[];
      try {
        items = await listOfflineDives();
      } catch {
        items = [saved, ...drafts.filter((draft) => draft.id !== saved.id)];
      }
      if (!alive.current) return;
      setDrafts(items);
      baseline.current = undefined;
      requestId.current = crypto.randomUUID();
      setEditingId(undefined);
      setFields(emptyOfflineDive());
      setConflict(false);
      toast.success(t.saved);
    } catch (error) {
      if (alive.current) {
        if (error instanceof OfflineDraftConflict) setConflict(true);
        toast.error(error instanceof OfflineDraftConflict ? error.message : t.storageError);
      }
    } finally {
      working.current = false;
      if (alive.current) setSaving(false);
    }
  }

  async function refreshDraftList() {
    if (working.current || loading) return;
    working.current = true;
    setSaving(true);
    try {
      const items = await listOfflineDives();
      if (alive.current) setDrafts(items);
    } catch {
      if (alive.current) toast.error(t.storageError);
    } finally {
      working.current = false;
      if (alive.current) setSaving(false);
    }
  }

  function saveAsNew() {
    if (working.current || loading) return;
    baseline.current = undefined;
    requestId.current = crypto.randomUUID();
    setEditingId(undefined);
    setConflict(false);
    // Deliberate copy: retain every field, require a separate save click.
  }

  return (
    <div className="do-offline-page">
      <div className="do-offline-page-bg" aria-hidden="true" />
      <header className="do-auth-header do-offline-header">
        <Link to="/" className="do-brand" aria-label="SupDiver home">
          <span className="do-brand-mark">
            <img src="/images/supdiver-wave-mark.svg" alt="" />
          </span>
          <b>SupDiver</b>
        </Link>
        <div className="do-auth-header-actions">
          <button
            type="button"
            className="do-language"
            disabled={saving || loading}
            onClick={toggleLanguage}
            aria-label={language === "zh-CN" ? "Switch to English" : "切换到中文"}
          >
            <Languages />
            <span>{language === "zh-CN" ? "EN" : "中文"}</span>
          </button>
          <Link to="/auth" className="do-auth-back">
            <ArrowLeft />
            {t.back}
          </Link>
        </div>
      </header>

      <main className="do-offline-content">
        <div className="do-offline-heading">
          <span className="do-offline-kicker">
            <CloudOff size={16} /> {t.offline}
          </span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="do-offline-notice" role="status">
          <strong>{t.localOnly}</strong>
          <p>{t.warning}</p>
        </div>

        <div className="do-offline-layout">
          <form
            id="offline-form"
            onSubmit={save}
            className="do-offline-form"
            aria-busy={saving || loading}
          >
            {loading && (
              <p role="status">
                {language === "zh-CN" ? "正在读取本机草稿…" : "Loading local drafts…"}
              </p>
            )}
            {conflict && (
              <div role="alert" className="mb-6 space-y-3">
                <p>
                  {language === "zh-CN"
                    ? "草稿已在其他页面修改、删除或同步。当前输入仍保留，不会覆盖。可重新读取列表后选择最新草稿，或将当前输入另存为新草稿。"
                    : "This draft changed or was removed elsewhere. Your input is retained and will not overwrite it. Refresh the list to open the latest draft, or save your input as a new draft."}
                </p>
                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={() => void refreshDraftList()}
                >
                  {language === "zh-CN" ? "重新读取列表" : "Refresh draft list"}
                </button>
                {" · "}
                <button type="button" disabled={saving || loading} onClick={saveAsNew}>
                  {language === "zh-CN" ? "将当前输入另存为新草稿" : "Keep input as a new draft"}
                </button>
              </div>
            )}
            <fieldset disabled={saving || loading} className="m-0 min-w-0 border-0 p-0">
              <section>
                <h2>{t.sectionPlace}</h2>
                <div className="do-offline-fields">
                  <label>
                    {t.country}
                    <input
                      value={fields.country}
                      onChange={(e) => update("country", e.target.value)}
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    {t.region}
                    <input
                      value={fields.region}
                      onChange={(e) => update("region", e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {t.site}
                    <input
                      value={fields.site_name}
                      onChange={(e) => update("site_name", e.target.value)}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label>
                    {t.date}
                    <input
                      type="date"
                      value={fields.dive_date}
                      onChange={(e) => update("dive_date", e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {language === "zh-CN" ? "入水时间（选填，潜点当地时间）" : "Entry time (optional, local time at dive site)"}
                    <input type="time" step={60} value={fields.entry_time ?? ""}
                      onChange={(e) => update("entry_time", e.target.value)} />
                  </label>
                  <label>
                    {language === "zh-CN" ? "气体类型（选填）" : "Gas type (optional)"}
                    <input list="offline-gas-options" maxLength={80} value={fields.gas_type ?? ""}
                      placeholder={language === "zh-CN" ? "选择或填写气体／配比" : "Choose or enter gas / mix"}
                      onChange={(e) => update("gas_type", e.target.value)} />
                    <datalist id="offline-gas-options">
                      {["Air", "Nitrox", "Trimix", "Oxygen"].map(gas => <option key={gas} value={gas} />)}
                    </datalist>
                  </label>
                  <label>
                    {t.weather}
                    <select
                      value={fields.weather}
                      onChange={(e) => update("weather", e.target.value)}
                    >
                      <option value="">{t.noWeather}</option>
                      {weatherOptions.map((value, index) => (
                        <option value={value} key={value}>
                          {t[weatherKeys[index]]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section>
                <h2>{t.sectionDive}</h2>
                <div className="do-offline-fields">
                  <label>
                    {t.depth}
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="999"
                      step="0.1"
                      value={fields.max_depth}
                      onChange={(e) => update("max_depth", e.target.value)}
                    />
                  </label>
                  <label>
                    {t.duration}
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="9999"
                      step="1"
                      value={fields.duration_min}
                      onChange={(e) => update("duration_min", e.target.value)}
                    />
                  </label>
                  <label>
                    {t.surface}
                    <input
                      type="number"
                      inputMode="decimal"
                      min="-20"
                      max="60"
                      step="0.1"
                      value={fields.surface_temp}
                      onChange={(e) => update("surface_temp", e.target.value)}
                    />
                  </label>
                  <label>
                    {t.water}
                    <input
                      type="number"
                      inputMode="decimal"
                      min="-20"
                      max="60"
                      step="0.1"
                      value={fields.water_temp}
                      onChange={(e) => update("water_temp", e.target.value)}
                    />
                  </label>
                  <label>
                    {t.type}
                    <select
                      value={fields.dive_type}
                      onChange={(e) => update("dive_type", e.target.value as DiveType)}
                    >
                      <option value="recreational">{t.recreational}</option>
                      <option value="freediving">{t.freediving}</option>
                      <option value="technical">{t.technical}</option>
                    </select>
                  </label>
                  <DiveCompanionsEditor value={readCompanions(fields)} onChange={people => update("companions", people)} english={language === "en"} />
                </div>
              </section>
              <section>
                <h2>{t.sectionStory}</h2>
                <textarea
                  aria-label={t.sectionStory}
                  value={fields.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  maxLength={2000}
                  rows={6}
                  placeholder={t.notes}
                />
              </section>
              <button
                type="submit"
                disabled={saving || loading || conflict}
                className="do-offline-save"
              >
                {saving ? t.saving : t.save}
                <ArrowRight size={18} />
              </button>
            </fieldset>
          </form>

          <aside className="do-offline-sidebar">
            <div className="do-offline-sidebar-top">
              <h2>
                {t.drafts}
                <span>{drafts.length}</span>
              </h2>
              <button type="button" disabled={saving || loading} onClick={startNew}>
                <Plus size={16} />
                {t.new}
              </button>
            </div>
            {drafts.length === 0 ? (
              <p className="do-offline-empty">{t.empty}</p>
            ) : (
              <ul className="do-offline-drafts">
                {drafts.map((draft) => (
                  <li key={draft.id}>
                    <strong>{draft.site_name}</strong>
                    <span>
                      {[draft.country, draft.region, draft.dive_date].filter(Boolean).join(" · ")}
                    </span>
                    <div>
                      <button
                        type="button"
                        disabled={saving || loading}
                        onClick={() => startEdit(draft)}
                      >
                        <Pencil size={14} />
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        disabled={saving || loading}
                        onClick={() => remove(draft.id)}
                      >
                        <Trash2 size={14} />
                        {t.remove}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/offline-sync" className="do-offline-login">
              {language === "zh-CN" ? "查看草稿与同步" : "Review drafts & sync"}
              <ArrowRight size={17} />
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
