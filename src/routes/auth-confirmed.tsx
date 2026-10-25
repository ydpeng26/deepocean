import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { safeAuthReturn } from "@/lib/auth-return";
import { emailConfirmationInput } from "@/lib/email-confirmation-flow";
import { createBrowserEmailConfirmation } from "@/lib/email-confirmation";

type ConfirmationStatus = "checking" | "success" | "error";

const confirmationCopy = {
  "zh-CN": {
    back: "返回首页",
    checkingTitle: "正在确认邮箱",
    checkingBody: "请稍候，我们正在完成账号验证。",
    successTitle: "邮箱验证成功",
    successBody: "你的 SupDiver 账号已经启用，现在可以开始使用。",
    errorTitle: "验证链接无效或已过期",
    errorBody: "请返回登录页面，重新发送确认邮件后再试一次。",
    enter: "进入 SupDiver",
    login: "返回登录",
  },
  en: {
    back: "Back to home",
    checkingTitle: "Confirming your email",
    checkingBody: "Please wait while we finish verifying your account.",
    successTitle: "Email confirmed",
    successBody: "Your SupDiver account is active and ready to use.",
    errorTitle: "This confirmation link is invalid or expired",
    errorBody: "Return to sign in and resend the confirmation email, then try again.",
    enter: "Enter SupDiver",
    login: "Back to sign in",
  },
} as const;

export const Route = createFileRoute("/auth-confirmed")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "邮箱验证 · SupDiver" },
      { name: "description", content: "完成 SupDiver 账号的邮箱验证。" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: safeAuthReturn(search.next),
  }),
  component: AuthConfirmedPage,
});

function AuthConfirmedPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { language } = useLanguage();
  const copy = confirmationCopy[language];
  const [status, setStatus] = useState<ConfirmationStatus>("checking");
  const [entering, setEntering] = useState(false);
  const controller = useRef<ReturnType<typeof createBrowserEmailConfirmation> | null>(null);
  const task = useRef<Promise<string> | null>(null);
  const alive = useRef(false);
  const expired = useRef(false);
  const invalid = useRef(false);
  const navigating = useRef(false);
  const destination = useRef(safeAuthReturn(next));

  useEffect(() => {
    document.title = language === "en" ? "Email confirmation · SupDiver" : "邮箱验证 · SupDiver";
  }, [language]);

  useEffect(() => {
    let active = true;
    alive.current = true;
    if (!task.current) {
      try {
        const input = emailConfirmationInput(window.location.search, window.location.hash);
        // Consume URL material once before SDK initialization. Keep only the
        // already-validated return destination in this component's ref.
        window.history.replaceState(window.history.state, "", "/auth-confirmed");
        task.current = Promise.resolve().then(() => {
          controller.current = createBrowserEmailConfirmation(
            () => alive.current && !expired.current && !invalid.current,
            () => {
              invalid.current = true;
              if (alive.current) setStatus("error");
            },
          );
          return controller.current.run(input);
        });
      } catch {
        invalid.current = true;
        task.current = Promise.reject(new Error("Email confirmation could not be prepared"));
      }
    }
    const timeout = window.setTimeout(() => {
      expired.current = true;
      controller.current?.cancel();
      if (active) setStatus("error");
    }, 10_000);
    void task.current.then(
      () => {
        window.clearTimeout(timeout);
        if (active && !expired.current && !invalid.current) setStatus("success");
      },
      () => {
        window.clearTimeout(timeout);
        if (active) setStatus("error");
      },
    );

    return () => {
      active = false;
      alive.current = false;
      window.clearTimeout(timeout);
      // React effect replay reactivates the same one-use attempt synchronously.
      // A genuine unmount cancels before any later response may be committed.
      queueMicrotask(() => {
        if (!alive.current) controller.current?.cancel();
      });
    };
  }, []);

  const enterApp = async () => {
    if (status !== "success" || navigating.current) return;
    navigating.current = true;
    setEntering(true);
    try {
      if (
        !(await controller.current?.matches()) ||
        !alive.current ||
        invalid.current ||
        expired.current
      ) {
        if (alive.current) setStatus("error");
        return;
      }
      if (destination.current) window.location.href = destination.current;
      else await navigate({ to: "/dives" });
    } catch {
      if (alive.current) setStatus("error");
    } finally {
      navigating.current = false;
      if (alive.current) setEntering(false);
    }
  };

  return (
    <div className="do-auth">
      <div className="do-auth-bg" aria-hidden="true" />
      <div className="do-auth-overlay" aria-hidden="true" />
      <header className="do-auth-header">
        <Link to="/" className="do-brand" aria-label="SupDiver home">
          <span className="do-brand-mark">
            <img src="/images/supdiver-wave-mark.svg" alt="" />
          </span>
          <b>SupDiver</b>
        </Link>
        <Link to="/" className="do-auth-back">
          <ArrowLeft />
          {copy.back}
        </Link>
      </header>

      <main className="do-auth-main do-auth-result-main">
        <section className="do-auth-panel do-auth-result" aria-live="polite">
          <div className={`do-auth-result-icon ${status}`} aria-hidden="true">
            {status === "checking" ? (
              <LoaderCircle />
            ) : status === "success" ? (
              <CheckCircle2 />
            ) : (
              <AlertCircle />
            )}
          </div>
          <p className="do-auth-kicker">SUPDIVER</p>
          <h1>
            {status === "checking"
              ? copy.checkingTitle
              : status === "success"
                ? copy.successTitle
                : copy.errorTitle}
          </h1>
          <p>
            {status === "checking"
              ? copy.checkingBody
              : status === "success"
                ? copy.successBody
                : copy.errorBody}
          </p>
          {status === "success" ? (
            <button type="button" className="do-auth-submit" onClick={enterApp} disabled={entering}>
              {copy.enter}
              <ArrowRight />
            </button>
          ) : status === "error" ? (
            <Link to="/auth" className="do-auth-submit do-auth-result-link">
              {copy.login}
              <ArrowRight />
            </Link>
          ) : null}
        </section>
      </main>
    </div>
  );
}
