import { createFileRoute } from "@tanstack/react-router";
import { ForumPage } from "@/routes/forum-preview";

export const Route = createFileRoute("/_authenticated/saved")({
  ssr: false,
  head: () => ({ meta: [{ title: "我的收藏 · SupDiver" }] }),
  component: () => <ForumPage savedOnly />,
});
