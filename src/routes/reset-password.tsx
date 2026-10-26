import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isRecoveryTestProject, passwordRecoveryEnabled } from "@/lib/password-recovery";
import { useLanguage } from "@/i18n/LanguageProvider";
import { updateBoundRecoveryPassword, type RecoveryBinding } from "@/lib/bound-password-reset";
import { recoveryInput, type RecoveryInput } from "@/lib/password-recovery-flow";
import { createBrowserRecovery } from "@/lib/password-recovery-session";

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
  const verification = useRef<Promise<RecoveryBinding> | null>(null);
  const flow = useRef<ReturnType<typeof createBrowserRecovery> | null>(null);
  const input = useRef<RecoveryInput | null>(null);
  if (!input.current && typeof window !== "undefined")
    input.current = recoveryInput(window.location.search, window.location.hash);
  const binding = useRef<RecoveryBinding | null>(null);
  const mounted = useRef(false);
  const cancelled = useRef(false);
  const expectedLogout = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const invalidate = () => {
      cancelled.current = true;
      binding.current = null;
      if (!mounted.current) return;
      setState("invalid");
      setPassword("");
      setConfirm("");
      setError("");
    };
    if (!verification.current) {
      try {
        window.history.replaceState(null, "", window.location.pathname);
        if (!passwordRecoveryEnabled) throw new Error("Password recovery unavailable");
        flow.current = createBrowserRecovery(
          () => mounted.current && !cancelled.current,
          invalidate,
          () => expectedLogout.current,
        );
        verification.current = flow.current.run(input.current ?? { kind: "invalid" });
      } catch {
        verification.current = Promise.reject(new Error("Password recovery unavailable"));
      }
    }
    const timer = window.setTimeout(() => {
      if (active) {
        invalidate();
        flow.current?.cancel();
      }
    }, 10_000);
    void verification.current
      .then(async (verified) => {
        if (!active) return;
        if (cancelled.current) return invalidate();
        binding.current = verified;
        try {
          const current = await supabase.auth.getSession();
          const server = await supabase.auth.getUser(verified.accessToken);
          if (!active) return;
          if (
            cancelled.current ||
            binding.current !== verified ||
            current.error ||
            server.error ||
            current.data.session?.user.id !== verified.userId ||
            server.data.user?.id !== verified.userId
          )
            return invalidate();
          setState("ready");
        } catch {
          if (active) invalidate();
        }
      })
      .catch(() => {
        if (active) invalidate();
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      mounted.current = false;
      window.clearTimeout(timer);
      // React effect replay shares one verification; genuine unmount cancels it.
      queueMicrotask(() => {
        if (!mounted.current) {
          cancelled.current = true;
          binding.current = null;
          flow.current?.cancel();
        }
      });
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const verified = binding.current;
    const isCurrent = () => mounted.current && !cancelled.current && binding.current === verified;
    if (state !== "ready" || submitting.current || !verified || !isCurrent()) return;
    if (password.length < 8 || password.length > 12 || password !== confirm) {
      setError(
        zh
          ? "密码须为 8–12 个字符，两次输入必须一致。"
          : "Use 8–12 characters and matching passwords.",
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const current = await supabase.auth.getSession();
      const server = await supabase.auth.getUser(verified.accessToken);
      if (!isCurrent()) return;
      if (
        current.error ||
        server.error ||
        current.data.session?.user.id !== verified.userId ||
        server.data.user?.id !== verified.userId
      ) {
        cancelled.current = true;
        binding.current = null;
        setPassword("");
        setConfirm("");
        setState("invalid");
        return;
      }
      await updateBoundRecoveryPassword(verified, password, isCurrent);
      if (!isCurrent()) return;
      const afterUpdate = await supabase.auth.getSession();
      if (!isCurrent()) return;
      if (afterUpdate.error || afterUpdate.data.session?.user.id !== verified.userId) {
        cancelled.current = true;
        binding.current = null;
        setPassword("");
        setConfirm("");
        setState("invalid");
        return;
      }
      setPassword("");
      setConfirm("");
      expectedLogout.current = true;
      await supabase.auth.signOut({ scope: "local" });
      if (!isCurrent()) return;
      binding.current = null;
      setState("done");
    } catch {
      if (!isCurrent()) return;
      setError(
        zh
          ? "更新失败，链接可能已过期或密码不符合要求，请重新申请。"
          : "Update failed. Request a new link or try a stronger password.",
      );
    } finally {
      submitting.current = false;
      expectedLogout.current = false;
      if (mounted.current) setBusy(false);
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
                ? "链接无效、已过期或账号已变化，请重新申请找回密码邮件。"
                : "Invalid or expired link, or the account changed. Request a new password reset email."}
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
                maxLength={12}
                aria-describedby="reset-password-requirements"
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p id="reset-password-requirements" className="do-auth-password-requirements">
                {zh
                  ? "密码要求：8–12 个字符，不强制字母、数字或特殊符号组合。建议混合字母和数字，且不要与其他网站重复使用。"
                  : "Password requirements: 8–12 characters. No required combination of letters, digits or symbols. Use letters and digits, and avoid reusing passwords on other websites."}
              </p>
              <label htmlFor="confirm-password">{zh ? "确认新密码" : "Confirm password"}</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={12}
                aria-describedby="reset-password-requirements"
                disabled={busy}
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
