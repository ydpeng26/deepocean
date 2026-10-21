import { createFileRoute } from "@tanstack/react-router";
import { OfflineSyncWorkspace } from "@/components/OfflineSyncWorkspace";

export const Route = createFileRoute("/offline-sync")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "离线草稿与同步 · SupDiver" },
      { name: "description", content: "在无信号环境记录潜水，并在联网登录后同步到个人账号。" },
    ],
  }),
  component: OfflineSyncWorkspace,
});
