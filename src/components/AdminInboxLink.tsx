import { Link, useRouteContext } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useFeedbackAdmin } from "@/hooks/useFeedbackAdmin";
import { useLanguage } from "@/i18n/LanguageProvider";

export function AdminInboxLink({ showLabel = false }: { showLabel?: boolean }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const admin = useFeedbackAdmin(user.id);
  const { language } = useLanguage();
  if (admin.data !== true || admin.isError) return null;
  const label = language === "en" ? "User feedback" : "用户反馈";
  return (
    <Link
      to="/admin-inbox"
      className={
        showLabel
          ? "inline-flex min-h-11 items-center gap-2 text-sky-400 underline"
          : "do-passport-logout"
      }
      aria-label={label}
      title={label}
    >
      <Inbox aria-hidden="true" />
      {showLabel && <span>{label}</span>}
    </Link>
  );
}
