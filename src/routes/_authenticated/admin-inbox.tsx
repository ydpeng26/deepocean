import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useFeedbackAdmin } from "@/hooks/useFeedbackAdmin";
import {
  INBOX_PAGE_SIZE,
  InboxError,
  loadInbox,
  setInboxStatus,
  type InboxMessage,
  type InboxSource,
  type InboxStatus,
} from "@/lib/admin-inbox";
import "@/styles/admin-inbox.css";

export const Route = createFileRoute("/_authenticated/admin-inbox")({
  head: () => ({
    meta: [{ title: "User feedback · SupDiver" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminInbox,
});
function AdminInbox() {
  const { user } = Route.useRouteContext();
  const { language } = useLanguage();
  const en = language === "en";
  const t = (zh: string, english: string) => (en ? english : zh);
  const admin = useFeedbackAdmin(user.id);
  const [status, setStatus] = useState<InboxStatus | "all">("all");
  const [source, setSource] = useState<InboxSource | "all">("all");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ messages: InboxMessage[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    document.title = t("用户反馈 · SupDiver", "User feedback · SupDiver");
  }, [en]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    if (admin.data !== true || admin.isError) return;
    void loadInbox(user.id, { status, source, page, search })
      .then((result) => {
        if (!active) return;
        if (page > 0 && page * INBOX_PAGE_SIZE >= result.total) {
          setPage(0);
          return;
        }
        setData(result);
      })
      .catch((e) => {
        if (active) setError(e instanceof InboxError ? e.code : "load");
      });
    return () => {
      active = false;
    };
  }, [user.id, admin.data, admin.isError, status, source, page, search, revision]);
  const labels = {
    unread: t("未读", "Unread"),
    read: t("已读", "Read"),
    resolved: t("已处理", "Resolved"),
  };
  async function update(message: InboxMessage, next: InboxStatus) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      await setInboxStatus(user.id, message, next);
      if (alive.current) {
        setSaved(true);
        setRevision((v) => v + 1);
      }
    } catch (e) {
      if (alive.current) {
        setData(null);
        setError(e instanceof InboxError ? e.code : "save");
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <main className="do-admin-inbox">
      <Link to="/settings">← {t("账号设置", "Account settings")}</Link>
      <header>
        <p>SUPDIVER / ADMIN</p>
        <h1>{t("用户反馈", "User feedback")}</h1>
        <p>
          {t(
            "查看并处理联系我们收到的建议与问题。",
            "Review suggestions and issues received through Contact us.",
          )}
        </p>
      </header>
      {admin.isPending ? (
        <p role="status">{t("正在核对管理员权限…", "Checking administrator access…")}</p>
      ) : admin.isError ? (
        <div role="alert">
          <p>{t("无法核对权限，请重试。", "Unable to verify access. Please retry.")}</p>
          <button onClick={() => void admin.refetch()}>{t("重试", "Retry")}</button>
        </div>
      ) : admin.data !== true ? (
        <p role="alert">
          {t(
            "此账号没有查看用户反馈的权限。",
            "This account does not have access to user feedback.",
          )}
        </p>
      ) : (
        <>
          <form
            className="do-inbox-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setSearch(draft.trim());
              setRevision((v) => v + 1);
              setSaved(false);
            }}
          >
            <label>
              {t("状态", "Status")}
              <select
                disabled={busy}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as typeof status);
                  setPage(0);
                  setSaved(false);
                }}
              >
                <option value="all">{t("全部状态", "All statuses")}</option>
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("来源", "Source")}
              <select
                disabled={busy}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as typeof source);
                  setPage(0);
                  setSaved(false);
                }}
              >
                <option value="all">{t("全部来源", "All sources")}</option>
                <option value="member">{t("登录用户", "Members")}</option>
                <option value="guest">{t("访客", "Guests")}</option>
              </select>
            </label>
            <label className="do-inbox-search">
              {t("搜索留言", "Search messages")}
              <input
                type="search"
                maxLength={120}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
              />
            </label>
            <button disabled={busy} type="submit">
              {t("搜索 / 刷新", "Search / refresh")}
            </button>
          </form>
          {saved && <p role="status">{t("状态已保存。", "Status saved.")}</p>}
          {error ? (
            <div role="alert">
              <p>
                {error === "conflict"
                  ? t(
                      "留言状态已变化，请刷新后重试。",
                      "The message status has changed. Refresh and try again.",
                    )
                  : t(
                      "无法确认操作结果，请刷新后重试。",
                      "Unable to confirm the result. Refresh and try again.",
                    )}
              </p>
              <button
                onClick={() => {
                  setSaved(false);
                  setRevision((v) => v + 1);
                }}
              >
                {t("重新加载", "Reload")}
              </button>
            </div>
          ) : !data ? (
            <p role="status">{t("正在加载留言…", "Loading messages…")}</p>
          ) : (
            <>
              <p>
                {t("符合筛选的留言", "Matching messages")}: {data.total}
              </p>
              {data.messages.length === 0 ? (
                <p>{t("暂时没有符合条件的留言。", "No messages match these filters.")}</p>
              ) : (
                <ol className="do-inbox-list">
                  {data.messages.map((message) => (
                    <li key={message.source + ":" + message.id}>
                      <article className={message.status === "unread" ? "is-unread" : ""}>
                        <div className="do-inbox-meta">
                          <strong>{labels[message.status as InboxStatus] ?? message.status}</strong>
                          <span>
                            {message.source === "member"
                              ? t("登录用户", "Member")
                              : t("访客", "Guest")}
                          </span>
                          <span>
                            {
                              (
                                {
                                  suggestion: t("功能建议", "Suggestion"),
                                  issue: t("问题反馈", "Issue"),
                                  other: t("其他意见", "Other"),
                                } as Record<string, string>
                              )[message.category]
                            }
                          </span>
                          <time dateTime={message.created_at}>
                            {new Date(message.created_at).toLocaleString(en ? "en-GB" : "zh-CN")}
                          </time>
                        </div>
                        <details>
                          <summary>
                            {message.body.slice(0, 100)}
                            {message.body.length > 100 ? "…" : ""}
                            <span>{t("查看全文", "View message")}</span>
                          </summary>
                          <p className="do-inbox-body">{message.body}</p>
                          {message.reply_email && (
                            <p>
                              {t("联系邮箱", "Contact email")}: <span>{message.reply_email}</span>
                            </p>
                          )}
                          {message.user_id && (
                            <p className="do-inbox-user">
                              {t("用户编号", "User ID")}: {message.user_id}
                            </p>
                          )}
                          <small>
                            {t(
                              "标为已处理仅更新内部状态，不会自动发送回复。",
                              "Resolving a message only changes its internal status; no reply is sent.",
                            )}
                          </small>
                        </details>
                        <div className="do-inbox-actions">
                          {Object.entries(labels)
                            .filter(([value]) => value !== message.status)
                            .map(([value, label]) => (
                              <button
                                key={value}
                                disabled={busy}
                                onClick={() => void update(message, value as InboxStatus)}
                              >
                                {t("标为", "Mark as ")}
                                {label}
                              </button>
                            ))}
                        </div>
                      </article>
                    </li>
                  ))}
                </ol>
              )}
              <nav aria-label={t("留言分页", "Message pages")} className="do-inbox-pagination">
                <button
                  disabled={busy || page === 0}
                  onClick={() => {
                    setPage((v) => v - 1);
                    setSaved(false);
                  }}
                >
                  {t("上一页", "Previous")}
                </button>
                <span>
                  {page + 1} / {Math.max(1, Math.ceil(data.total / INBOX_PAGE_SIZE))}
                </span>
                <button
                  disabled={busy || (page + 1) * INBOX_PAGE_SIZE >= data.total}
                  onClick={() => {
                    setPage((v) => v + 1);
                    setSaved(false);
                  }}
                >
                  {t("下一页", "Next")}
                </button>
              </nav>
            </>
          )}
        </>
      )}
    </main>
  );
}
