import { useAuthStorageStatus } from "@/hooks/useAuthStorageStatus";
import { useLanguage } from "@/i18n/LanguageProvider";
import { authStorageState } from "@/lib/tab-auth-storage";

export function AuthStorageNotice() {
  const status = useAuthStorageStatus();
  const { language } = useLanguage();
  if (status !== "blocked") return null;
  return (
    <aside
      role="alert"
      className="relative z-50 border-b border-amber-400/50 bg-slate-950 p-4 text-center text-sm text-amber-100"
    >
      <p>
        {language === "en"
          ? "Browser session storage is unavailable. Sign-in is paused. Allow site storage and check available space, then retry. Existing local drafts have not been cleared."
          : "浏览器会话存储不可用，已暂停登录。请允许此网站使用存储并确认可用空间后重试。现有本机草稿未被清除。"}
      </p>
      <button
        type="button"
        className="mt-2 rounded border px-3 py-1"
        onClick={() => authStorageState.retry()}
      >
        {language === "en" ? "Check storage again" : "重新检查存储"}
      </button>
    </aside>
  );
}
