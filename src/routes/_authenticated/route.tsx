import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MemberHeader } from "@/components/MemberHeader";
import { memberSessionGate } from "@/lib/authenticated-session";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const { language } = useLanguage();
  const session = useSyncExternalStore(
    memberSessionGate.subscribe,
    memberSessionGate.getSnapshot,
    memberSessionGate.getSnapshot,
  );
  const [validated, setValidated] = useState<{ ownerId: string; epoch: number } | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRouteError(false);
    if (session.status !== "ready") return;
    if (!session.ownerId) {
      void router.navigate({ to: "/auth", replace: true }).catch(() => {
        if (active) setRouteError(true);
      });
    } else {
      // Outside the synchronous Auth callback: safe to rerun beforeLoad.
      void router.invalidate().then(
        async () => {
          await memberSessionGate.recheck();
          if (active && memberSessionGate.getSnapshot() === session)
            setValidated({ ownerId: session.ownerId!, epoch: session.epoch });
        },
        () => {
          if (active) setRouteError(true);
        },
      );
    }
    return () => {
      active = false;
    };
  }, [router, session, attempt]);
  useEffect(() => {
    const focus = () => {
      void memberSessionGate.recheck();
    };
    const visible = () => {
      if (document.visibilityState === "visible") focus();
    };
    const restored = (event: PageTransitionEvent) => {
      // A restored document must not immediately expose its old member subtree.
      void memberSessionGate.recheck(event.persisted);
    };
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  if (
    session.status !== "ready" ||
    !session.ownerId ||
    session.ownerId !== user.id ||
    validated?.ownerId !== session.ownerId ||
    validated.epoch !== session.epoch ||
    routeError
  ) {
    const failed = session.status === "error" || routeError;
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"
        aria-busy={!failed}
      >
        <p role={failed ? "alert" : "status"}>
          {language === "en"
            ? failed
              ? "Unable to verify your session. Your private pages are hidden."
              : "Checking your session…"
            : failed
              ? "暂时无法核对登录状态，已隐藏个人页面。"
              : "正在核对登录状态…"}
        </p>
        {failed && (
          <button
            type="button"
            onClick={() => {
              setAttempt((value) => value + 1);
              void memberSessionGate.recheck();
            }}
          >
            {language === "en" ? "Retry" : "重试"}
          </button>
        )}
      </main>
    );
  }
  return (
    <Fragment key={`${user.id}:${session.epoch}`}>
      <MemberHeader />
      <Outlet />
    </Fragment>
  );
}
