import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { watchOfflineUpdates } from "@/lib/offline-updates";

export function OfflineUpdateNotice() {
  const { language } = useLanguage();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      return watchOfflineUpdates(navigator.serviceWorker, () => setReady(true));
    }
  }, []);
  if (!ready || dismissed) return null;
  const zh = language === "zh-CN";
  return (
    <div className="border-b border-sky-500/30 bg-sky-950 px-4 py-3 text-sm text-sky-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p role="status" className="min-w-0 flex-1">
          {zh
            ? "新版本已准备好。请先保存当前输入，再关闭所有 SupDiver 标签页和应用窗口，重新打开以完成更新。未保存的输入不会自动保存。"
            : "An update is ready. Save your work, then close all SupDiver tabs and app windows and reopen the site to update. Unsaved input is not saved automatically."}
        </p>
        <button
          type="button"
          className="shrink-0 underline underline-offset-4"
          onClick={() => setDismissed(true)}
        >
          {zh ? "暂不更新" : "Later"}
        </button>
      </div>
    </div>
  );
}
