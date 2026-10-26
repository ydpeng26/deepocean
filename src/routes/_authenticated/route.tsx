import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MemberHeader } from "@/components/MemberHeader";
import { memberSessionGate } from "@/lib/authenticated-session";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAuthStorageStatus } from "@/hooks/useAuthStorageStatus";
import { authStorageAvailable, authStorageState } from "@/lib/tab-auth-storage";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!authStorageAvailable(true)) throw redirect({ to: "/auth" });
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const privateRoot = useRef<HTMLDivElement>(null);
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const { language } = useLanguage();
  const storageStatus = useAuthStorageStatus();
  const storageRevision = authStorageState.getRevision();
  const session = useSyncExternalStore(
    memberSessionGate.subscribe,
    memberSessionGate.getSnapshot,
    memberSessionGate.getSnapshot,
  );
  const [validated, setValidated] = useState<{
    ownerId: string;
    epoch: number;
    storageRevision: number;
  } | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRouteError(false);
    if (storageStatus !== "available") return;
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
            setValidated({ ownerId: session.ownerId!, epoch: session.epoch, storageRevision });
        },
        () => {
          if (active) setRouteError(true);
        },
      );
    }
    return () => {
      active = false;
    };
  }, [router, session, attempt, storageStatus, storageRevision]);
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
    const leaving = () => {
      // Hide synchronously before a browser can freeze/snapshot this document.
      // React's scheduled render alone is not a pre-snapshot privacy boundary.
      privateRoot.current?.setAttribute("hidden", "");
      memberSessionGate.suspend();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", restored);
    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("pagehide", leaving);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  if (
    storageStatus !== "available" ||
    session.status !== "ready" ||
    !session.ownerId ||
    session.ownerId !== user.id ||
    validated?.ownerId !== session.ownerId ||
    validated.epoch !== session.epoch ||
    validated.storageRevision !== storageRevision ||
    routeError
  ) {
    const failed = storageStatus === "blocked" || session.status === "error" || routeError;
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
    <div ref={privateRoot} key={`${user.id}:${session.epoch}`} data-private-member-root>
      <MemberHeader />
      <Outlet />
    </div>
  );
}
