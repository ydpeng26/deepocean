import { createFileRoute } from "@tanstack/react-router";
import { CertificateVault } from "@/components/CertificateVault";
export const Route = createFileRoute("/_authenticated/certificates")({
  ssr: false,
  head: () => ({
    meta: [{ title: "我的证书档案 · SupDiver" }, { name: "robots", content: "noindex" }],
  }),
  component: CertificateVault,
});
