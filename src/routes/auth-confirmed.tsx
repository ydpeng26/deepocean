import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageProvider";

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
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" && search.next.startsWith("/") && !search.next.startsWith("//")
      ? { next: search.next }
      : {},
  component: AuthConfirmedPage,
});

function AuthConfirmedPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { language } = useLanguage();
  const copy = confirmationCopy[language];
  const [status, setStatus] = useState<ConfirmationStatus>("checking");

  useEffect(() => {
    let active = true;
    let completed = false;

    const finish = (nextStatus: ConfirmationStatus) => {
      if (!active || completed) return;
      completed = true;
      setStatus(nextStatus);
    };

    const confirmSession = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (query.get("error") || hash.get("error")) {
        finish("error");
        return;
      }

      const tokenHash = query.get("token_hash");
            if (tokenHash) {
                      const verified = await supabase.auth.verifyOtp({
                                  token_hash: tokenHash,
                                  type: "signup",
                      });
                      if (verified.data.session) finish("success");
                      else finish("error");
                      return;
            }
      
            const current = await supabase.auth.getSession();
      if (current.data.session) {
        finish("success");
        return;
      }

      const code = query.get("code");
      if (!code) {
        if (current.error) finish("error");
        return;
      }

      const exchanged = await supabase.auth.exchangeCodeForSession(code);
      if (exchanged.data.session) finish("success");
      else if (exchanged.error) finish("error");
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish("success");
    });
    void confirmSession();
    const timeout = window.setTimeout(() => finish("error"), 10_000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const enterApp = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/dives" });
  };

  return (
    <div className="do-auth">
      <div className="do-auth-bg" aria-hidden="true" />
      <div className="do-auth-overlay" aria-hidden="true" />
      <header className="do-auth-header">
        <Link to="/" className="do-brand" aria-label="SupDiver home">
          <span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span>
          <b>SupDiver</b>
        </Link>
        <Link to="/" className="do-auth-back"><ArrowLeft />{copy.back}</Link>
      </header>

      <main className="do-auth-main do-auth-result-main">
        <section className="do-auth-panel do-auth-result" aria-live="polite">
          <div className={`do-auth-result-icon ${status}`} aria-hidden="true">
            {status === "checking" ? <LoaderCircle /> : status === "success" ? <CheckCircle2 /> : <AlertCircle />}
          </div>
          <p className="do-auth-kicker">SUPDIVER</p>
          <h1>{status === "checking" ? copy.checkingTitle : status === "success" ? copy.successTitle : copy.errorTitle}</h1>
          <p>{status === "checking" ? copy.checkingBody : status === "success" ? copy.successBody : copy.errorBody}</p>
          {status === "success" ? (
            <button type="button" className="do-auth-submit" onClick={enterApp}>{copy.enter}<ArrowRight /></button>
          ) : status === "error" ? (
            <Link to="/auth" className="do-auth-submit do-auth-result-link">{copy.login}<ArrowRight /></Link>
          ) : null}
        </section>
      </main>
    </div>
  );
}
