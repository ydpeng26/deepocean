import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  addForumComment,
  deleteForumComment,
  listForumComments,
  updateForumComment,
} from "@/lib/forum";

export type ForumCommentDraft = { body: string; requestId: string };
type Props = {
  post: { id: string; title: string };
  ownerId: string;
  language: "zh-CN" | "en";
  preview?: boolean;
  draft: ForumCommentDraft;
  onDraftChange: (draft: ForumCommentDraft) => void;
  onClose: () => void;
};

export function ForumCommentsDialog({
  post,
  ownerId,
  language,
  preview = false,
  draft,
  onDraftChange,
  onClose,
}: Props) {
  const client = useQueryClient(),
    lock = useRef(false),
    alive = useRef(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [commentWindow, setCommentWindow] = useState({ key: "", size: 50 });
  const windowKey = `${ownerId}:${post.id}`;
  const windowSize = commentWindow.key === windowKey ? commentWindow.size : 50;
  const t = (zh: string, en: string) => (language === "en" ? en : zh);
  const key = ["forum-comments", ownerId, post.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => listForumComments(post.id),
    enabled: !preview && !!ownerId,
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function act(action: () => Promise<unknown>, success: () => void) {
    if (lock.current || !ownerId) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (!alive.current) return;
      success();
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ["forum-posts"] }),
      ]);
    } catch (cause) {
      if (alive.current)
        setError(
          t(
            "操作未确认，草稿已保留，请重试。",
            "Action not confirmed. Your draft is kept; please retry.",
          ) + (cause instanceof Error ? " " + cause.message : ""),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function close() {
    if (!lock.current) onClose();
  }
  return (
    <div className="do-forum-composer-backdrop">
      <section
        className="do-forum-composer do-forum-comments"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forum-comments-title"
        aria-busy={busy}
      >
        <header>
          <div>
            <span>OCEAN RESPONSES</span>
            <h2 id="forum-comments-title">{t("回应", "Responses")}</h2>
            <p>{post.title}</p>
          </div>
          <button type="button" disabled={busy} onClick={close} aria-label={t("取消", "Cancel")}>
            <X />
          </button>
        </header>
        {error && (
          <p className="do-forum-live-error" role="alert">
            {error}
          </p>
        )}
        {!preview && (
          <div className="do-forum-comment-actions">
            <button
              type="button"
              disabled={query.isFetching || busy}
              onClick={() => void query.refetch()}
            >
              {t("重新加载回应", "Reload responses")}
            </button>
          </div>
        )}
        <div className="do-forum-comment-list">
          {preview ? (
            <p>{t("还没有回应。", "No responses yet.")}</p>
          ) : query.isError ? (
            <div className="do-forum-live-error" role="alert">
              <p>
                {t("回应暂时无法加载，请重试。", "Responses could not be loaded. Please retry.")}
              </p>
            </div>
          ) : query.isPending ? (
            <p>{t("正在读取回应…", "Loading responses…")}</p>
          ) : query.data?.length ? (
            query.data.slice(0, windowSize).map((comment) => (
              <article key={comment.id}>
                <Avatar>
                  <AvatarImage src={comment.avatarUrl ?? undefined} alt={comment.author} />
                  <AvatarFallback>{comment.author[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <strong>{comment.author}</strong>
                  {editing?.id === comment.id ? (
                    <>
                      <textarea
                        aria-label={t("编辑回应内容", "Edit response text")}
                        maxLength={1000}
                        disabled={busy}
                        value={editing.body}
                        onChange={(event) => {
                          if (!lock.current)
                            setEditing({ id: comment.id, body: event.target.value });
                        }}
                      />
                      <div className="do-forum-comment-actions">
                        <button
                          type="button"
                          disabled={busy || !editing.body.trim()}
                          onClick={() => {
                            if (editing)
                              void act(
                                () =>
                                  updateForumComment(editing.id, post.id, editing.body, ownerId),
                                () => setEditing(null),
                              );
                          }}
                        >
                          {t("保存回应修改", "Save response changes")}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (!lock.current) setEditing(null);
                          }}
                        >
                          {t("取消编辑", "Cancel editing")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p>{comment.body}</p>
                  )}
                  {comment.userId === ownerId && !editing && (
                    <div className="do-forum-comment-actions">
                      {deleting === comment.id ? (
                        <>
                          <span>{t("确定删除这条回应？", "Delete this response?")}</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => deleteForumComment(comment.id, post.id, ownerId),
                                () => setDeleting(null),
                              )
                            }
                          >
                            {t("确认删除回应", "Confirm response deletion")}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!lock.current) setDeleting(null);
                            }}
                          >
                            {t("取消删除", "Cancel deletion")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!lock.current) {
                                setDeleting(null);
                                setEditing({ id: comment.id, body: comment.body });
                                setError("");
                              }
                            }}
                          >
                            {t("编辑回应", "Edit response")}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!lock.current) setDeleting(comment.id);
                            }}
                          >
                            {t("删除回应", "Delete response")}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p>{t("还没有回应。", "No responses yet.")}</p>
          )}
        </div>
        {!query.isError && (query.data?.length ?? 0) > windowSize && (
          <div className="do-forum-comment-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setCommentWindow({ key: windowKey, size: windowSize + 50 })}
            >
              {t("继续查看回应", "Show more responses")} · {windowSize} / {query.data?.length}
            </button>
          </div>
        )}
        {!preview && (
          <div className="do-forum-comment-form">
            <textarea
              aria-label={t("回应内容", "Response text")}
              value={draft.body}
              disabled={busy || !ownerId}
              onChange={(event) => {
                if (!lock.current) onDraftChange({ ...draft, body: event.target.value });
              }}
              placeholder={t("写下你的回应…", "Write a response…")}
              maxLength={1000}
            />
            <button
              type="button"
              disabled={busy || !ownerId || !draft.body.trim()}
              onClick={() =>
                void act(
                  () => addForumComment(post.id, draft.body, draft.requestId, ownerId),
                  () => onDraftChange({ body: "", requestId: crypto.randomUUID() }),
                )
              }
            >
              <Send />
              {busy ? t("正在处理…", "Processing…") : t("发送", "Send")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
