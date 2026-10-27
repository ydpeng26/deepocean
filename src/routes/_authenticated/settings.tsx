import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageProvider";
import { accountDeletion, type AccountDeletionState } from "@/lib/account-management";
import { mountAccountRequestPage } from "@/lib/account-request-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "账号设置 · SupDiver" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountSettings,
});

function AccountSettings() {
  const { user } = Route.useRouteContext();
  const { language, toggleLanguage } = useLanguage();
  const t = (zh: string, en: string) => (language === "zh-CN" ? zh : en);
  const navigate = useNavigate(),
    cache = useQueryClient();
  const [identity, setIdentity] = useState<{ email: string; providers: string[] } | null>(null);
  const [loadError, setLoadError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [opened, setOpened] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [understood, setUnderstood] = useState(false);
  const [deletion, setDeletion] = useState<AccountDeletionState | null>(null);
  const request = useRef<string>(crypto.randomUUID()),
    lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const cancel = mountAccountRequestPage();
    return () => {
      alive.current = false;
      cancel();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setIdentity(null);
    setLoadError(false);
    void supabase.auth
      .getUser()
      .then(async (result) => {
        const current = await supabase.auth.getSession();
        if (!active) return;
        if (
          result.error ||
          !result.data.user ||
          result.data.user.id !== user.id ||
          current.error ||
          current.data.session?.user.id !== user.id
        )
          throw Error("account");
        setIdentity({
          email: result.data.user.email ?? "",
          providers: Array.from(
            new Set((result.data.user.identities ?? []).map((item) => item.provider)),
          ),
        });
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    void accountDeletion("status", request.current, user.id)
      .then((result) => {
        if (!active) return;
        request.current = result.id;
        setDeletion(result);
        if (result.code === "pending") setOpened(true);
      })
      .catch(() => {
        if (active) setDeletion(null);
      });
    return () => {
      active = false;
    };
  }, [user.id, attempt]);
  const begin = () => {
    if (lock.current || !alive.current) return false;
    lock.current = true;
    setBusy(true);
    setMessage("");
    return true;
  };
  const finish = () => {
    lock.current = false;
    if (alive.current) setBusy(false);
  };
  async function resetPassword() {
    if (!identity?.email || !begin()) return;
    try {
      const current = await supabase.auth.getSession();
      if (current.error || current.data.session?.user.id !== user.id) throw Error("account");
      const result = await supabase.auth.resetPasswordForEmail(identity.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      const after = await supabase.auth.getSession();
      if (result.error || after.error || after.data.session?.user.id !== user.id)
        throw Error("request");
      if (alive.current) setMessage("mail");
    } catch {
      if (alive.current) setMessage("error");
    } finally {
      finish();
    }
  }
  async function signOut(reauth = false) {
    if (!begin()) return;
    try {
      const current = await supabase.auth.getSession();
      if (current.error || current.data.session?.user.id !== user.id) throw Error("account");
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      cache.clear();
      await navigate({ to: "/auth", search: reauth ? { next: "/settings" } : {}, replace: true });
    } catch {
      if (alive.current) setMessage("error");
    } finally {
      finish();
    }
  }
  async function removeAccount() {
    if (!deletion || !identity || !understood || confirmation !== "DELETE MY ACCOUNT" || !begin())
      return;
    try {
      const result = await accountDeletion("delete", request.current, user.id);
      if (!alive.current) return;
      setDeletion(result);
      request.current = result.id;
      if (result.code === "completed") {
        // Server receipt is verified before local signout. Never clear drafts of
        // other accounts or claim that local offline drafts/backups were erased.
        cache.clear();
        await supabase.auth.signOut({ scope: "local" });
        window.location.replace("/auth");
      } else setMessage(result.code === "reauth" ? "reauth" : "pending");
    } catch {
      if (alive.current) setMessage("uncertain");
    } finally {
      finish();
    }
  }
  const pending = deletion?.code === "pending";
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <Link to="/profile" className="text-sky-400 underline">
        {t("返回个人资料", "Back to profile")}
      </Link>
      <header>
        <p className="text-xs tracking-widest text-sky-400">ACCOUNT SETTINGS</p>
        <h1 className="mt-3 text-3xl">{t("账号设置", "Account settings")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            "管理登录信息与账号操作。个人资料在资料页编辑。",
            "Manage sign-in details and account actions. Edit your profile on the profile page.",
          )}
        </p>
      </header>
      {!identity ? (
        <section role={loadError ? "alert" : "status"} className="border p-5">
          <p>
            {loadError
              ? t("无法核对账号信息，请重试。", "Unable to verify your account. Please retry.")
              : t("正在核对账号信息…", "Verifying account…")}
          </p>
          {loadError && (
            <Button onClick={() => setAttempt((v) => v + 1)}>{t("重新加载", "Reload")}</Button>
          )}
        </section>
      ) : (
        <>
          <section className="space-y-4 border border-border p-6">
            <h2 className="text-xl">{t("登录与安全", "Sign-in & security")}</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">
                  {t("登录邮箱（不公开）", "Sign-in email (private)")}
                </dt>
                <dd className="break-all">
                  {identity.email || t("此账号未返回邮箱", "No email returned for this account")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("登录方式", "Sign-in methods")}</dt>
                <dd>
                  {identity.providers
                    .map((provider) =>
                      provider === "email"
                        ? t("邮箱", "Email")
                        : provider === "google"
                          ? "Google"
                          : provider,
                    )
                    .join(" · ") || t("暂未返回", "Not returned")}
                </dd>
              </div>
            </dl>
            <Button
              variant="outline"
              disabled={busy || pending || !identity.email}
              onClick={() => void resetPassword()}
            >
              {t("发送密码重设邮件", "Send password reset email")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t(
                "通过邮件进入密码重设页；此处不直接修改邮箱或解除登录方式。新密码为 6–12 个字符，不强制特殊符号。",
                "Use the email link to reset your password. Email changes and unlinking sign-in methods are not offered here. New passwords use 6–12 characters; symbols are optional.",
              )}
            </p>
          </section>
          <section className="space-y-4 border border-border p-6">
            <h2 className="text-xl">{t("偏好与数据", "Preferences & data")}</h2>
            <Button disabled={busy} variant="outline" onClick={toggleLanguage}>
              {t("切换为 English", "切换为中文")}
            </Button>
            <div>
              <Link to="/offline-sync" className="text-sky-400 underline">
                {t("查看本机离线草稿与同步", "View local offline drafts & sync")}
              </Link>
            </div>
            <div>
              <Link to="/feedback" className="text-sky-400 underline">
                {t("联系我们", "Contact us")}
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "离线草稿仅保存在对应设备，请在注销前检查并处理。",
                "Offline drafts belong to each device. Review them before deleting your account.",
              )}
            </p>
          </section>
          <section className="space-y-4 border border-border p-6">
            <h2 className="text-xl">{t("退出当前设备", "Sign out of this device")}</h2>
            <Button variant="outline" disabled={busy || pending} onClick={() => void signOut()}>
              {t("退出登录", "Sign out")}
            </Button>
          </section>
          <section className="space-y-4 border border-red-400/40 p-6">
            <h2 className="text-xl text-red-300">
              {t("永久注销账号", "Permanently delete account")}
            </h2>
            <p className="text-sm">
              {t(
                "开始后不可撤销。请先保存需要的内容。",
                "This cannot be undone once started. Save anything you need first.",
              )}
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                {t(
                  "删除登录身份、个人资料、潜水日志、装备、证书、海洋生物记录和上传图片。",
                  "Delete sign-in identity, profile, dive logs, equipment, certificates, ocean encounters and uploaded images.",
                )}
              </li>
              <li>
                {t(
                  "公开帖子和评论保留正文，作者显示为“已注销用户”，移除作者关联与图片；私密帖子删除，不会转为公开。",
                  "Keep public post/comment text under “Deleted account”, removing author links and images. Private posts are deleted, never made public.",
                )}
              </li>
              <li>
                {t(
                  "正文中的个人信息不会自动识别；请在注销前自行删除不希望保留的内容。",
                  "Personal details inside text are not automatically detected. Remove any content you do not want retained before deletion.",
                )}
              </li>
              <li>
                {t(
                  "本机离线草稿需在各设备自行处理；历史备份按已有保留策略到期清理，不会立即逐份删除。",
                  "Manage offline drafts on each device. Historical backups follow their existing retention schedule, not immediate individual erasure.",
                )}
              </li>
            </ul>
            {!deletion && (
              <div role="alert">
                <p>
                  {t(
                    "注销服务暂不可用，暂未执行注销。请重试或联系我们。",
                    "Deletion service unavailable. No deletion has been started. Retry or contact us.",
                  )}
                </p>
                <Button disabled={busy} variant="outline" onClick={() => setAttempt((v) => v + 1)}>
                  {t("重新检查", "Check again")}
                </Button>
              </div>
            )}
            {deletion && !opened && (
              <Button variant="destructive" disabled={busy} onClick={() => setOpened(true)}>
                {t("申请永久注销", "Delete my account")}
              </Button>
            )}
            {opened && (
              <fieldset disabled={busy} className="space-y-4 border-0 p-0">
                <legend className="sr-only">{t("注销二次确认", "Confirm account deletion")}</legend>
                {pending && (
                  <p role="status">
                    {t(
                      "注销清理尚未完成，账号数据访问已锁定。请继续处理或联系我们，不要重复注册。",
                      "Deletion is pending and account data access is locked. Continue or contact us; do not register again yet.",
                    )}
                  </p>
                )}
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                  />
                  <span>
                    {t(
                      "我已理解上述后果，并同意公开帖子和评论匿名保留。",
                      "I understand the consequences and agree to anonymous retention of public posts and comments.",
                    )}
                  </span>
                </label>
                <label className="block text-sm">
                  {t("输入 DELETE MY ACCOUNT 确认", "Type DELETE MY ACCOUNT to confirm")}
                  <Input
                    className="mt-2"
                    autoComplete="off"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    disabled={
                      !deletion || !understood || confirmation !== "DELETE MY ACCOUNT" || busy
                    }
                    onClick={() => void removeAccount()}
                  >
                    {busy
                      ? t("处理中，请勿关闭页面…", "Processing. Keep this page open…")
                      : pending
                        ? t("继续注销清理", "Continue deletion")
                        : t("确认永久注销", "Confirm permanent deletion")}
                  </Button>
                  {!pending && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOpened(false);
                        setConfirmation("");
                        setUnderstood(false);
                      }}
                    >
                      {t("取消", "Cancel")}
                    </Button>
                  )}
                </div>
              </fieldset>
            )}
          </section>
        </>
      )}
      {message && (
        <div role="status" className="space-y-3 border p-5">
          <p>
            {message === "mail"
              ? t(
                  "若邮箱可接收邮件，你会收到密码重设链接，请检查收件箱和垃圾邮件。",
                  "Check your inbox and spam folder for the password reset link.",
                )
              : message === "reauth"
                ? t(
                    "为保护账号，请先重新登录，再回来确认注销。注销尚未开始。",
                    "Please sign in again before confirming deletion. Deletion has not started.",
                  )
                : message === "pending"
                  ? t(
                      "清理尚未完成，可点击“继续注销清理”；失败时不会显示注销成功。",
                      "Cleanup is not complete. Continue deletion; failure is never reported as success.",
                    )
                  : message === "uncertain"
                    ? t(
                        "无法确认注销结果，请勿重复注册。可重试查询状态或联系我们。",
                        "Deletion outcome could not be confirmed. Do not register again. Check status or contact us.",
                      )
                    : t(
                        "操作未确认成功，请检查网络后重试。",
                        "Success was not confirmed. Check your connection and retry.",
                      )}
          </p>
          {message === "reauth" && (
            <Button disabled={busy} onClick={() => void signOut(true)}>
              {t("退出并重新登录", "Sign out and sign in again")}
            </Button>
          )}
          {message === "uncertain" && (
            <Button disabled={busy} onClick={() => setAttempt((v) => v + 1)}>
              {t("查询状态", "Check status")}
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
