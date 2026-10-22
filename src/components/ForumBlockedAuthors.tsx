import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listBlockedForumAuthors, unblockForumAuthor } from "@/lib/forum";

export function ForumBlockedAuthors({
  ownerId,
  language,
}: {
  ownerId: string;
  language: "zh-CN" | "en";
}) {
  const client = useQueryClient(),
    lock = useRef(false),
    alive = useRef(true);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = (zh: string, en: string) => (language === "en" ? en : zh);
  const key = ["forum-blocks", ownerId];
  const [authorWindow, setAuthorWindow] = useState({ owner: "", size: 50 });
  const windowSize = authorWindow.owner === ownerId ? authorWindow.size : 50;
  const query = useQuery({
    queryKey: key,
    queryFn: () => listBlockedForumAuthors(ownerId),
    enabled: open && !!ownerId,
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function unblock(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await unblockForumAuthor(id, ownerId);
      if (!alive.current) return;
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ["forum-posts"] }),
      ]);
    } catch {
      if (alive.current)
        setError(
          t(
            "解除屏蔽未确认，请重新加载列表确认后重试。",
            "Unblock not confirmed. Reload the list to check and retry.",
          ),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="do-forum-side-panel do-forum-blocks"
      aria-label={t("屏蔽管理", "Blocked divers")}
    >
      <button
        type="button"
        disabled={busy}
        aria-expanded={open}
        onClick={() => {
          if (!lock.current) setOpen((value) => !value);
        }}
      >
        {t("管理已屏蔽用户", "Manage blocked divers")}
      </button>
      {open && (
        <div>
          {error && <p role="alert">{error}</p>}
          {query.isError ? (
            <div role="alert">
              <p>{t("屏蔽名单暂时无法加载。", "The block list could not be loaded.")}</p>
            </div>
          ) : query.isPending ? (
            <p>{t("正在读取屏蔽名单…", "Loading blocked divers…")}</p>
          ) : query.data?.length ? (
            <ul>
              {query.data.slice(0, windowSize).map((author) => (
                <li key={author.id}>
                  <span>
                    {author.name}
                    <small>{author.id.slice(0, 8)}</small>
                  </span>
                  <button type="button" disabled={busy} onClick={() => void unblock(author.id)}>
                    {t("解除屏蔽", "Unblock")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("暂无已屏蔽用户。", "No blocked divers.")}</p>
          )}
          {!query.isError && (query.data?.length ?? 0) > windowSize && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setAuthorWindow({ owner: ownerId, size: windowSize + 50 })}
            >
              {t("继续查看屏蔽名单", "Show more blocked divers")} · {windowSize} /{" "}
              {query.data?.length}
            </button>
          )}
          <button
            type="button"
            disabled={busy || query.isFetching}
            onClick={() => {
              setError("");
              void query.refetch();
            }}
          >
            {t("重新加载屏蔽名单", "Reload block list")}
          </button>
        </div>
      )}
    </section>
  );
}
