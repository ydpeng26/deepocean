import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudOff,
  HardDrive,
  Languages,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  listOfflineDives,
  syncOfflineDives,
  OfflineSyncBusy,
  type OfflineDive,
} from "@/lib/offline-dives";

export function OfflineSyncWorkspace() {
  const { language, toggleLanguage } = useLanguage();
  const zh = language === "zh-CN";
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [account, setAccount] = useState<User | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [drafts, setDrafts] = useState<OfflineDive[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const working = useRef(false);
  const alive = useRef(true);
  const currentOwner = useRef<string | null>(null);
  const generation = useRef(0);
  const currentZh = useRef(zh);
  currentZh.current = zh;
  const reload = useCallback(async (isCurrent: () => boolean = () => true) => {
    const epoch = generation.current;
    const valid = () => alive.current && epoch === generation.current && isCurrent();
    try {
      const items = await listOfflineDives();
      if (!valid()) return;
      setDrafts(items);
      setSelected((ids) => ids.filter((id) => items.some((item) => item.id === id)));
      setStorageError(false);
    } catch {
      if (valid()) setStorageError(true);
    } finally {
      if (valid()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    const network = () => setOnline(navigator.onLine);
    const refresh = () => {
      if (!working.current) void reload();
    };
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("focus", refresh);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive.current) return;
      const nextOwner = session?.user.id ?? null;
      if (nextOwner !== currentOwner.current) {
        currentOwner.current = nextOwner;
        generation.current += 1;
        setSelected([]);
        setProgress(0);
        setFailures([]);
        setMessage(
          working.current
            ? currentZh.current
              ? "账号已变化，旧同步任务正在停止。部分记录可能已上传，请重新核对云端与本机草稿。"
              : "Account changed; stopping the previous sync. Some entries may already be uploaded. Review cloud records and local drafts."
            : "",
        );
        setLoading(true);
        void reload();
      }
      setAccount(session?.user ?? null);
      setCheckingAccount(false);
    });
    return () => {
      alive.current = false;
      generation.current += 1;
      data.subscription.unsubscribe();
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);

  const active = drafts.find((draft) => draft.id === activeId) ?? drafts[0];
  const accountName = account?.email ?? account?.id;
  const bytes = new Blob([JSON.stringify(drafts)]).size;
  function toggle(id: string) {
    if (working.current) return;
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
    setMessage("");
  }
  async function sync() {
    if (working.current || !online || !account || !selected.length || storageError) return;
    const expectedUserId = account.id;
    const epoch = generation.current;
    const isCurrent = () =>
      alive.current && generation.current === epoch && currentOwner.current === expectedUserId;
    if (
      !window.confirm(
        zh
          ? `将所选 ${selected.length} 条本机草稿同步到 ${accountName}？请确认这是你的账号。`
          : `Sync ${selected.length} selected local drafts to ${accountName}? Confirm this is your account.`,
      )
    )
      return;
    if (!isCurrent()) return;
    working.current = true;
    setBusy(true);
    setProgress(0);
    setMessage("");
    setFailures([]);
    try {
      const result = await syncOfflineDives(
        (done) => {
          if (isCurrent()) setProgress(done);
        },
        {
          selectedIds: selected,
          expectedUserId,
          isCurrent,
        },
      );
      if (!isCurrent()) return;
      await reload(isCurrent);
      if (!isCurrent()) return;
      await queryClient.invalidateQueries({ queryKey: ["dives"] });
      if (!isCurrent()) return;
      setFailures(result.failures);
      setMessage(
        result.failures.length
          ? zh
            ? `已同步 ${result.synced} 条，${result.failures.length} 条仍保留在本机，请核对后重试。`
            : `Synced ${result.synced}; ${result.failures.length} remain locally. Review and retry.`
          : zh
            ? `同步完成：${result.synced} 条记录已保存到账号。`
            : `Sync complete: ${result.synced} entries saved to your account.`,
      );
    } catch (error) {
      if (!isCurrent()) return;
      setMessage(
        error instanceof OfflineSyncBusy
          ? zh
            ? "另一个页面正在同步。请等待完成后，刷新列表并重新核对草稿。"
            : "Another tab is syncing. Wait for it to finish, then refresh and review your drafts."
          : zh
            ? "同步未完成，请检查网络与登录账号后重试；未确认完成的草稿仍保留在本机。"
            : "Sync did not complete. Check your network and account, then retry. Unconfirmed drafts remain locally.",
      );
      await reload(isCurrent);
    } finally {
      working.current = false;
      if (alive.current) {
        setBusy(false);
        if (!isCurrent()) void reload();
      }
    }
  }

  return (
    <div className="do-sync-page do-sync-live">
      <header className="do-passport-header do-sync-header">
        <Link to="/" className="do-brand" aria-label="SupDiver">
          <span className="do-brand-mark">
            <img src="/images/supdiver-wave-mark.svg" alt="" />
          </span>
          <b>SupDiver</b>
        </Link>
        <div className="do-sync-header-status" data-online={online}>
          {online ? <Wifi /> : <WifiOff />}
          <span>
            <strong>
              {online ? (zh ? "网络可用" : "Network available") : zh ? "当前无信号" : "Offline"}
            </strong>
            <small>{zh ? "以实际同步结果为准" : "Sync results confirm connectivity"}</small>
          </span>
        </div>
        <div className="do-passport-header-actions">
          <button type="button" className="do-passport-language" onClick={toggleLanguage}>
            <Languages />
            {zh ? "EN" : "中文"}
          </button>
          <Link to={account ? "/dives" : "/auth"} className="do-sync-back">
            <ArrowLeft />
            {account
              ? zh
                ? "返回海洋护照"
                : "Back to passport"
              : zh
                ? "返回登录"
                : "Back to sign in"}
          </Link>
        </div>
      </header>
      <main className="do-sync-main">
        <section className="do-sync-intro">
          <div>
            <span>OFFLINE DRAFTS</span>
            <h1>{zh ? "离线草稿与同步" : "Offline drafts & sync"}</h1>
            <p>
              {zh
                ? "先在这台设备记录，联网后核对账号，再由你确认同步。"
                : "Capture locally, then check your account and confirm syncing online."}
            </p>
          </div>
        </section>
        <div className="do-sync-layout">
          <aside className="do-sync-vault">
            <div className="do-sync-kicker">
              <span>01 / LOCAL VAULT</span>
              <HardDrive />
            </div>
            <div className="do-sync-vault-count">
              <CloudOff />
              <strong>
                {loading || storageError ? "—" : String(drafts.length).padStart(2, "0")}
              </strong>
              <small>{zh ? "待同步草稿" : "Pending drafts"}</small>
            </div>
            <h2>{zh ? "本机草稿舱" : "Local draft vault"}</h2>
            <p>
              {zh
                ? "来自当前浏览器的真实草稿，不会自动上传。当前离线记录仅支持文字与潜水信息，不包含照片。"
                : "Real drafts from this browser, never uploaded automatically. Offline entries currently store text and dive details, not photos."}
            </p>
            <dl className="do-sync-vault-stats">
              <div>
                <dt>{zh ? "草稿数据" : "Draft data"}</dt>
                <dd>{loading || storageError ? "—" : `${(bytes / 1024).toFixed(1)} KB`}</dd>
              </div>
            </dl>
            <Link to="/offline" className="do-sync-new">
              <Plus />
              {zh ? "新建离线记录" : "New offline entry"}
            </Link>
            <div className="do-sync-safety">
              <ShieldCheck />
              <div>
                <strong>{zh ? "本机保存说明" : "Local storage notice"}</strong>
                <p>
                  {zh
                    ? "清除浏览器数据、更换设备或使用无痕模式，可能丢失未同步草稿。请仅同步你自己的记录。"
                    : "Clearing browser data, changing devices or private browsing may erase unsynced drafts. Only sync your own entries."}
                </p>
              </div>
            </div>
          </aside>
          <section className="do-sync-drafts-panel" aria-busy={loading}>
            <div className="do-sync-section-heading">
              <div>
                <span>02 / DRAFTS</span>
                <h2>{zh ? "待同步记录" : "Waiting to sync"}</h2>
              </div>
              <button
                type="button"
                disabled={busy || loading || storageError || !drafts.length}
                onClick={() =>
                  setSelected(
                    selected.length === drafts.length ? [] : drafts.map((draft) => draft.id),
                  )
                }
              >
                <Check />
                {zh ? "全选 / 取消全选" : "Select / deselect all"}
              </button>
            </div>
            {loading ? (
              <p role="status">{zh ? "正在读取本机草稿…" : "Loading local drafts…"}</p>
            ) : storageError ? (
              <div role="alert">
                <p>
                  {zh
                    ? "无法读取本机存储，请检查浏览器存储权限。尚未同步任何草稿。"
                    : "Cannot read local storage. Check browser permissions. No drafts have been synced."}
                </p>
                <button type="button" onClick={() => void reload()}>
                  {zh ? "重新读取" : "Retry"}
                </button>
              </div>
            ) : !drafts.length ? (
              <p className="do-sync-choose">
                {zh
                  ? "暂无待同步草稿，可先新建离线记录。"
                  : "No pending drafts. Create an offline entry to begin."}
              </p>
            ) : (
              <>
                <div className="do-sync-draft-list">
                  {drafts.map((draft, index) => (
                    <article key={draft.id} data-active={active?.id === draft.id}>
                      <button
                        type="button"
                        className="do-sync-draft-select"
                        aria-label={`${zh ? "选择草稿" : "Select draft"} ${draft.site_name}`}
                        aria-pressed={selected.includes(draft.id)}
                        disabled={busy}
                        onClick={() => toggle(draft.id)}
                      >
                        {selected.includes(draft.id) && <Check />}
                      </button>
                      <button
                        type="button"
                        className="do-sync-draft-body"
                        onClick={() => setActiveId(draft.id)}
                      >
                        <span className="do-sync-draft-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="do-sync-draft-copy">
                          <small>
                            {draft.dive_date} · {zh ? "本机草稿" : "Local draft"}
                          </small>
                          <strong>{draft.site_name}</strong>
                          <em>
                            <MapPin />
                            {[draft.country, draft.region].filter(Boolean).join(" · ")}
                          </em>
                        </span>
                      </button>
                    </article>
                  ))}
                </div>
                {active && (
                  <section className="do-sync-draft-detail">
                    <div className="do-sync-detail-photo">
                      <span>{zh ? "草稿概览" : "Draft overview"}</span>
                      <strong>{active.site_name}</strong>
                      <small>
                        {active.dive_date} · {active.country}
                      </small>
                    </div>
                    <div className="do-sync-detail-memory">
                      <div>
                        <span>
                          <small>{zh ? "深蓝记忆" : "Ocean memory"}</small>
                          <p>{active.notes || (zh ? "未填写笔记" : "No notes")}</p>
                        </span>
                      </div>
                      <Link to="/offline" search={{ draft: active.id }}>
                        <Pencil />
                        {zh ? "继续编辑" : "Edit draft"}
                      </Link>
                    </div>
                  </section>
                )}
              </>
            )}
          </section>
          <aside className="do-sync-centre">
            <div className="do-sync-section-heading">
              <div>
                <span>03 / SYNC</span>
                <h2>{zh ? "同步中心" : "Sync centre"}</h2>
              </div>
              <RefreshCw />
            </div>
            <div className="do-sync-account">
              <UserRound />
              <div>
                <small>{zh ? "同步账号" : "Sync account"}</small>
                <strong>
                  {checkingAccount
                    ? zh
                      ? "正在核对登录状态…"
                      : "Checking session…"
                    : accountName || (zh ? "尚未登录" : "Not signed in")}
                </strong>
                <span>
                  {account
                    ? zh
                      ? "同步前会再次验证并请你确认"
                      : "Rechecked before you confirm syncing"
                    : zh
                      ? "登录后才可上传"
                      : "Sign in before uploading"}
                </span>
              </div>
            </div>
            {!account && !checkingAccount && (
              <Link to="/auth" search={{ next: "/offline-sync" }} className="do-sync-new">
                {zh ? "登录后返回同步" : "Sign in and return"}
                <ArrowRight />
              </Link>
            )}
            <div className="do-sync-queue">
              <div>
                <small>{zh ? "本次选择" : "Selected"}</small>
                <strong>
                  {selected.length} {zh ? "条草稿" : "drafts"}
                </strong>
                <span>
                  {busy
                    ? `${progress}/${selected.length}`
                    : zh
                      ? "仅同步所选记录"
                      : "Only selected drafts will sync"}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="do-sync-button"
              disabled={
                !online ||
                !account ||
                checkingAccount ||
                !selected.length ||
                loading ||
                storageError ||
                busy
              }
              onClick={() => void sync()}
            >
              <RefreshCw className={busy ? "do-sync-spinning" : undefined} />
              {busy
                ? zh
                  ? "正在同步…"
                  : "Syncing…"
                : zh
                  ? "同步到我的账号"
                  : "Sync to my account"}
              <ArrowRight />
            </button>
            {message && (
              <p className="do-sync-done-hint" role="status">
                {message}
              </p>
            )}
            {!!failures.length && (
              <ul role="alert">
                {failures.map((failure, index) => (
                  <li key={index}>{failure}</li>
                ))}
              </ul>
            )}
            <div className="do-sync-privacy">
              <LockKeyhole />
              <p>
                {zh
                  ? "成功同步后才移除对应本机草稿；失败或内容冲突时保留草稿，不覆盖云端内容。"
                  : "Local drafts are removed only after confirmed sync. Failures and conflicts retain drafts without overwriting cloud records."}
              </p>
            </div>
          </aside>
        </div>
      </main>
      <footer className="do-passport-footer">
        <span>SupDiver</span>
        <small>YOUR OCEAN. YOUR STORY.</small>
      </footer>
    </div>
  );
}
