import { createFileRoute, redirect } from "@tanstack/react-router";
import { OceanPassport } from "./_authenticated/dives/index";

export const Route = createFileRoute("/passport-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "海洋护照设计预览 · SupDiver" }, { name: "robots", content: "noindex" }] }),
  component: () => <OceanPassport preview />,
});
