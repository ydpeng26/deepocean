import { useEffect, useRef, useState } from "react";
import { isVideoPath } from "@/lib/dives";
import { useLanguage } from "@/i18n/LanguageProvider";

type Props = {
  ownerId?: string;
  path?: string | null;
  url?: string | null;
  version?: number;
  pending?: boolean;
  error?: boolean;
  reload?: () => Promise<unknown>;
  cover?: boolean;
  videoOnly?: boolean;
  label: string;
  className?: string;
};

// A nonempty signed URL can still fail when downloaded. Do not confuse URL creation with media loading.
export function DiveMedia({
  ownerId,
  path,
  url,
  version = 0,
  pending = false,
  error = false,
  reload,
  cover = false,
  videoOnly = false,
  label,
  className = "",
}: Props) {
  const { language } = useLanguage();
  const t = (zh: string, en: string) => (language === "en" ? en : zh);
  const stamp = JSON.stringify([ownerId, path, url, version]);
  const current = useRef(stamp),
    alive = useRef(true),
    lock = useRef(false);
  current.current = stamp;
  const [failed, setFailed] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const unavailable = error || failed === stamp || ((!cover || !!path) && !url && !pending);
  function downloadFailed() {
    if (alive.current && current.current === stamp) setFailed(stamp);
  }
  async function retry() {
    if (lock.current || !reload || pending) return;
    lock.current = true;
    setBusy(true);
    try {
      await reload();
    } catch {
      if (alive.current && current.current === stamp) setFailed(stamp);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={cover && (path || videoOnly || url || error) ? { backgroundImage: "none" } : undefined}
      data-media-cover={cover || undefined}
    >
      {videoOnly && !path ? (
        <div
          className="flex h-full min-h-24 items-center justify-center bg-slate-900 px-3 text-sm text-white"
          aria-label={t("视频附件", "Video attachment")}
        >
          <i aria-hidden="true">▷&nbsp;</i>
          {t("视频附件 · 查看详情播放", "Video attachment · Open details to play")}
        </div>
      ) : unavailable ? (
        <div
          className="flex h-full min-h-24 flex-col items-center justify-center gap-2 border bg-background/90 p-3 text-center text-xs text-muted-foreground"
          role="alert"
        >
          <p>
            {t(
              "附件暂不可用，链接可能已失效或格式无法播放。",
              "Attachment unavailable. The link may have expired or the format cannot be played.",
            )}
          </p>
          {!!path && reload && (
            <button
              type="button"
              className="underline"
              disabled={busy || pending}
              onClick={() => void retry()}
            >
              {t("重新加载附件", "Reload attachment")}
            </button>
          )}
        </div>
      ) : pending && !url ? (
        <div
          className="flex h-full min-h-24 items-center justify-center text-xs text-muted-foreground"
          role="status"
        >
          {t("正在读取附件…", "Loading attachment…")}
        </div>
      ) : url ? (
        !cover && path && isVideoPath(path) ? (
          <video
            key={stamp}
            src={url}
            controls
            preload="metadata"
            onError={downloadFailed}
            className="aspect-square w-full bg-black object-contain"
            aria-label={label}
          />
        ) : (
          <img
            key={stamp}
            src={url}
            alt={label}
            loading="lazy"
            onError={downloadFailed}
            className={
              cover
                ? "absolute inset-0 h-full w-full object-cover"
                : "aspect-square w-full object-cover"
            }
          />
        )
      ) : null}
    </div>
  );
}
