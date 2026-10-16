import { createFileRoute } from "@tanstack/react-router";
import { ForumPage } from "@/routes/forum-preview";

export const Route = createFileRoute("/_authenticated/forum")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "深蓝论坛 · SupDiver" },
      { name: "description", content: "与潜水员分享潜点、海洋生物和每一次下潜的故事。" },
    ],
  }),
  component: ForumPage,
});
