import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CloudOff, Languages } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageProvider";
import { passwordRecoveryEnabled } from "@/lib/password-recovery";

const authCopy = {
  "zh-CN": {
    back: "返回首页",
    signin: "登录",
    signup: "注册",
    welcome: "欢迎回来",
    create: "从这里开始",
    signinIntro: "继续记录你的下潜，重温属于你的海洋人生",
    signupIntro: "创建账号，让每一次与大海的相遇都有迹可循",
    email: "邮箱",
    emailPlaceholder: "请输入邮箱地址",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    passwordNewPlaceholder: "设置至少 6 位密码",
    processing: "处理中…",
    continueGoogle: "使用 Google 继续",
    or: "或者",
    emailError: "请填写邮箱，密码至少 6 位",
    verifyEmail: "请查收邮箱完成验证后再登录",
    resendConfirmation: "重新发送确认邮件",
    resending: "正在重新发送…",
    resendSent: "确认邮件已重新发送，请检查收件箱和垃圾邮件",
    genericError: "操作失败，请重试",
    googleError: "Google 登录失败，请重试",
    offline: "无信号模式",
  },
  en: {
    back: "Back to home",
    signin: "Sign in",
    signup: "Sign up",
    welcome: "Welcome back",
    create: "Begin here",
    signinIntro: "Pick up your dive log and relive your ocean life",
    signupIntro: "Create an account to remember every encounter with the sea",
    email: "Email",
    emailPlaceholder: "Enter your email address",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    passwordNewPlaceholder: "Set a password of at least 6 characters",
    processing: "Working…",
    continueGoogle: "Continue with Google",
    or: "or",
    emailError: "Enter an email and a password of at least 6 characters",
    verifyEmail: "Check your email to confirm your account, then sign in",
    resendConfirmation: "Resend confirmation email",
    resending: "Resending…",
    resendSent: "Confirmation email resent. Check your inbox and spam folder",
    genericError: "Something went wrong. Please try again",
    googleError: "Google sign-in failed. Please try again",
    offline: "Offline mode",
  },
} as const;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "登录 · SupDiver" },
      { name: "description", content: "登录或注册 SupDiver，开始记录你的潜水日志。" },
      { property: "og:title", content: "登录 · SupDiver" },
      { property: "og:description", content: "登录或注册 SupDiver，开始记录你的潜水日志。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" && search.next.startsWith("/") && !search.next.startsWith("//")
      ? { next: search.next }
      : {},
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { language, toggleLanguage } = useLanguage();
  const copy = authCopy[language];
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const submittingRef = useRef(false);
  const signinTab = useRef<HTMLButtonElement>(null);
  const signupTab = useRef<HTMLButtonElement>(null);
  function selectMode(value: "signin" | "signup") {
    if (submittingRef.current || loading || resetBusy || resendLoading) return;
    setMode(value);
    if (value !== mode) setAwaitingConfirmation(false);
    (value === "signin" ? signinTab : signupTab).current?.focus();
  }
  function tabKey(event: React.KeyboardEvent) {
    if (event.isDefaultPrevented() || event.nativeEvent.isComposing) return;
    const target =
      event.key === "Home"
        ? "signin"
        : event.key === "End"
          ? "signup"
          : event.key === "ArrowLeft" || event.key === "ArrowRight"
            ? mode === "signin"
              ? "signup"
              : "signin"
            : null;
    if (target) {
      event.preventDefault();
      selectMode(target);
    }
  }

  const publicSiteUrl = (
    (import.meta.env.VITE_SITE_URL as string | undefined) ||
    (import.meta.env.PROD ? "https://www.supdiver.com" : window.location.origin)
  ).replace(/\/$/, "");

  function getPostLoginUrl() {
    return `${publicSiteUrl}${next ?? "/dives"}`;
  }

  function getEmailConfirmationUrl() {
    const confirmationUrl = new URL("/auth-confirmed", publicSiteUrl);
    if (next) confirmationUrl.searchParams.set("next", next);
    return confirmationUrl.toString();
  }

  function goNext() {
    if (next) window.location.href = next;
    else navigate({ to: "/dives" });
  }

  useEffect(() => {
    toast.dismiss();
  }, [mode]);

  useEffect(() => {
    if (!navigator.onLine) return;
    // Visiting the login page always starts a fresh login flow. This also
    // prevents a previously opened tab from silently forwarding the user.
    void supabase.auth.signOut({ scope: "local" });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    toast.dismiss();
    if (!email.trim() || password.length < 6) {
      toast.error(copy.emailError, { id: "auth-status" });
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: getEmailConfirmationUrl() },
        });
        if (error) throw error;
        setAwaitingConfirmation(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) goNext();
      else if (mode === "signin") toast.info(copy.verifyEmail, { id: "auth-status" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.genericError, { id: "auth-status" });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email.trim() || resendLoading) return;
    toast.dismiss();
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: getEmailConfirmationUrl() },
      });
      if (error) throw error;
      toast.success(copy.resendSent, { id: "auth-status" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.genericError, { id: "auth-status" });
    } finally {
      setResendLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: getPostLoginUrl(),
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.googleError, { id: "auth-status" });
      setLoading(false);
    }
  }

  async function requestReset() {
    if (resetBusy || !passwordRecoveryEnabled) return;
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(language === "zh-CN" ? "请先填写有效邮箱。" : "Enter a valid email first.");
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(
        language === "zh-CN"
          ? "如果该邮箱已注册，你将收到找回密码邮件，请检查收件箱和垃圾邮件。"
          : "If this email is registered, a reset email will arrive. Check your inbox and spam.",
      );
    } catch {
      toast.error(
        language === "zh-CN"
          ? "暂时无法发送，请稍后重试。"
          : "Unable to send right now. Try again later.",
      );
    } finally {
      setResetBusy(false);
    }
  }

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
        <div className="do-auth-header-actions">
          <Link to="/offline-sync" className="do-auth-offline">
            <CloudOff />
            <span>{copy.offline}</span>
          </Link>
          <button
            type="button"
            className="do-language"
            onClick={toggleLanguage}
            aria-label={language === "zh-CN" ? "Switch to English" : "切换到中文"}
          >
            <Languages />
            <span>{language === "zh-CN" ? "EN" : "中文"}</span>
          </button>
          <Link to="/" className="do-auth-back">
            <ArrowLeft />
            {copy.back}
          </Link>
        </div>
      </header>

      <main className="do-auth-main">
        <section
          className="do-auth-panel"
          aria-label={mode === "signin" ? copy.signin : copy.signup}
        >
          <div
            className="do-auth-tabs"
            role="tablist"
            aria-label={language === "zh-CN" ? "账号操作" : "Account action"}
          >
            <button
              ref={signinTab}
              id="auth-signin-tab"
              aria-controls="auth-panel"
              tabIndex={mode === "signin" ? 0 : -1}
              disabled={loading || resetBusy || resendLoading}
              onKeyDown={tabKey}
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              onClick={() => selectMode("signin")}
            >
              {copy.signin}
            </button>
            <button
              ref={signupTab}
              id="auth-signup-tab"
              aria-controls="auth-panel"
              tabIndex={mode === "signup" ? 0 : -1}
              disabled={loading || resetBusy || resendLoading}
              onKeyDown={tabKey}
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => selectMode("signup")}
            >
              {copy.signup}
            </button>
          </div>
          <div className="do-auth-intro">
            <p className="do-auth-kicker">SUPDIVER</p>
            <h1>{mode === "signin" ? copy.welcome : copy.create}</h1>
            <p>{mode === "signin" ? copy.signinIntro : copy.signupIntro}</p>
          </div>

          <form
            id="auth-panel"
            role="tabpanel"
            aria-labelledby={`auth-${mode}-tab`}
            onSubmit={handleSubmit}
            className="do-auth-form"
          >
            <label htmlFor="email">{copy.email}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPlaceholder}
              maxLength={255}
              required
            />
            <label htmlFor="password">{copy.password}</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signin" ? copy.passwordPlaceholder : copy.passwordNewPlaceholder
              }
              maxLength={72}
              minLength={6}
              required
            />
            <button type="submit" disabled={loading} className="do-auth-submit">
              {loading ? copy.processing : mode === "signin" ? copy.signin : copy.signup}
              <ArrowRight />
            </button>
          </form>
          {mode === "signin" && passwordRecoveryEnabled && (
            <button
              type="button"
              className="do-auth-forgot"
              onClick={requestReset}
              disabled={resetBusy}
            >
              {language === "zh-CN"
                ? resetBusy
                  ? "发送中…"
                  : "忘记密码？"
                : resetBusy
                  ? "Sending…"
                  : "Forgot password?"}
            </button>
          )}

          {mode === "signup" && awaitingConfirmation ? (
            <div className="do-auth-confirmation" role="status">
              <span>{copy.verifyEmail}</span>
              <button type="button" onClick={handleResendConfirmation} disabled={resendLoading}>
                {resendLoading ? copy.resending : copy.resendConfirmation}
              </button>
            </div>
          ) : null}

          <div className="do-auth-divider">
            <span />
            {copy.or}
            <span />
          </div>
          <button
            type="button"
            className="do-auth-google"
            onClick={handleGoogle}
            disabled={loading}
          >
            <span className="do-google-mark" aria-hidden="true">
              G
            </span>
            {copy.continueGoogle}
          </button>
        </section>
      </main>
    </div>
  );
}
