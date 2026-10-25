import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { OfflineUpdateNotice } from "@/components/OfflineUpdateNotice";
import { AuthStorageNotice } from "@/components/AuthStorageNotice";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { ErrorComponent, NotFoundComponent } from "@/components/ErrorRecovery";
import { supabase } from "@/integrations/supabase/client";
import { authStorageState } from "@/lib/tab-auth-storage";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SupDiver · 潜水与海洋记忆" },
      {
        name: "description",
        content:
          "记录独属于你的海洋人生，支持无信号日志记录、证书与装备记录管理、深蓝论坛等等。SupDiver让你在每一刻都能与大海相遇。",
      },
      { property: "og:title", content: "SupDiver · 潜水与海洋记忆" },
      {
        property: "og:description",
        content:
          "记录独属于你的海洋人生，支持无信号日志记录、证书与装备记录管理、深蓝论坛等等。SupDiver让你在每一刻都能与大海相遇。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/images/supdiver-wave-mark.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const clearBlockedSessionCache = () => {
      if (authStorageState.getSnapshot() === "blocked") queryClient.clear();
    };
    const unsubscribe = authStorageState.subscribe(clearBlockedSessionCache);
    clearBlockedSessionCache();
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    let accountId: string | null | undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextAccountId = session?.user.id ?? null;
      if (nextAccountId === accountId) return;
      const previousAccountId = accountId;
      accountId = nextAccountId;
      if (previousAccountId === undefined) return;
      // Shared query keys must never carry private data into another session.
      // clear() also cancels pending queries. The authenticated layout scopes
      // local component state by user ID without remounting one-use auth flows.
      // Keep this callback synchronous: Auth calls here can deadlock the client.
      queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthStorageNotice />
      <OfflineUpdateNotice />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
