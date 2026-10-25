import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageProvider";
import { finishGoogleOAuth } from "@/lib/google-oauth";

export const Route = createFileRoute("/oauth-callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Google 登录 · SupDiver" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: GoogleOAuthCallback,
});

function GoogleOAuthCallback() {
  const { language } = useLanguage();
  const en = language === "en";
  useEffect(() => {
    document.title = en ? "Google sign-in · SupDiver" : "Google 登录 · SupDiver";
  }, [en]);
  const [failed, setFailed] = useState(false);
  const task = useRef<Promise<string> | null>(null);
  useEffect(() => {
    let active = true;
    if (!task.current) {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const providerError =
        query.has("error") ||
        hash.has("error") ||
        !!window.location.hash ||
        query.getAll("code").length !== 1;
      const code = query.get("code") ?? "";
      // Keep a one-use authorization code in this effect only, not history,
      // referrers, UI text or telemetry. Tokens are never accepted from the URL.
      window.history.replaceState(window.history.state, "", "/oauth-callback");
      task.current = Promise.resolve().then(() => finishGoogleOAuth(code, providerError));
    }
    void task.current.then(
      (next) => {
        if (active) window.location.replace(next);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section
        className="w-full max-w-lg rounded-2xl border border-border p-8 text-center"
        aria-labelledby="google-callback-title"
      >
        <h1 id="google-callback-title" className="text-2xl">
          {failed
            ? en
              ? "Google sign-in did not complete"
              : "Google 登录未完成"
            : en
              ? "Completing Google sign-in…"
              : "正在完成 Google 登录…"}
        </h1>
        <p role={failed ? "alert" : "status"} className="mt-4 text-muted-foreground">
          {failed
            ? en
              ? "The request was cancelled, expired or could not be verified. Return to sign in and try again."
              : "请求已取消、已过期或未能通过验证，请返回登录后重试。"
            : en
              ? "Please keep this tab open while we verify your session."
              : "正在核对登录状态，请暂时保留此标签页。"}
        </p>
        {failed && (
          <Link
            to="/auth"
            className="mt-6 inline-block rounded-full border border-border px-6 py-3"
          >
            {en ? "Back to sign in" : "返回登录"}
          </Link>
        )}
      </section>
    </main>
  );
}
