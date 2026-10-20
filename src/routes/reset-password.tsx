import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isRecoveryTestProject, passwordRecoveryEnabled } from "@/lib/password-recovery";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "重设密码 · SupDiver" }, { name: "referrer", content: "no-referrer" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { language } = useLanguage();
  const zh = language === "zh-CN";
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!passwordRecoveryEnabled) {
      setState("invalid");
      return;
    }
    // Never unlock a password form merely because another account is signed in.
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token_hash");
    const code = params.get("code");
    const implicit = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = implicit.get("access_token");
    const refreshToken = implicit.get("refresh_token");
    const isRecovery = implicit.get("type") === "recovery";
    window.history.replaceState(null, "", window.location.pathname);
    const verify = async () => {
      try {
        if (token) {
          const result = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
          setState(result.error || !result.data.session ? "invalid" : "ready");
        } else if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          setState(result.error || !result.data.session ? "invalid" : "ready");
        } else if (isRecovery && accessToken && refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          setState(result.error || !result.data.session ? "invalid" : "ready");
        } else setState("invalid");
      } catch {
        setState("invalid");
      }
    };
    void verify();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state !== "ready" || submitting.current) return;
    if (password.length < 8 || password !== confirm) {
      setError(
        zh
          ? "密码至少 8 位，两次输入必须一致。"
          : "Use at least 8 characters and matching passwords.",
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword("");
      setConfirm("");
      await supabase.auth.signOut({ scope: "local" });
      setState("done");
    } catch {
      setError(
        zh
          ? "更新失败，链接可能已过期或密码不符合要求，请重新申请。"
          : "Update failed. Request a new link or try a stronger password.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="do-auth">
      <div className="do-auth-bg" aria-hidden="true" />
      <div className="do-auth-overlay" aria-hidden="true" />
      <main className="do-auth-main">
        <section className="do-auth-panel" aria-live="polite">
          <p className="do-auth-kicker">
            {isRecoveryTestProject ? "SUPDIVER · RECOVERY TEST" : "SUPDIVER"}
          </p>
          <h1>{zh ? "设置新密码" : "Set a new password"}</h1>
          {state === "checking" && <p>{zh ? "正在验证链接…" : "Checking link…"}</p>}
          {state === "invalid" && (
            <p role="alert">
              {zh
                ? "链接无效或已过期，请重新申请找回密码邮件。"
                : "Invalid or expired link. Request a new password reset email."}
            </p>
          )}
          {state === "done" && (
            <p role="status">
              {zh
                ? "密码已更新，请用新密码重新登录。"
                : "Password updated. Sign in with your new password."}
            </p>
          )}
          {state === "ready" && (
            <form className="do-auth-form" onSubmit={submit}>
              <p>
                {isRecoveryTestProject
                  ? zh
                    ? "仅修改恢复测试站的密码，不影响正式网站。"
                    : "Changes only the recovery test account, not production."
                  : zh
                    ? "为你的 SupDiver 账号设置新密码，完成后请重新登录。"
                    : "Set a new password for your SupDiver account, then sign in again."}
              </p>
              <label htmlFor="new-password">{zh ? "新密码" : "New password"}</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="confirm-password">{zh ? "确认新密码" : "Confirm password"}</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error && <p role="alert">{error}</p>}
              <button className="do-auth-submit" disabled={busy}>
                {busy ? (zh ? "保存中…" : "Saving…") : zh ? "保存新密码" : "Save password"}
              </button>
            </form>
          )}
          <Link to="/auth">{zh ? "返回登录" : "Back to sign in"}</Link>
        </section>
      </main>
    </div>
  );
}
