import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageProvider";
import { publicCertificates } from "@/lib/certificates";
export function PublicCertificateSummary({ userId }: { userId: string }) {
  const { language } = useLanguage();
  const en = language === "en";
  const query = useQuery({
    queryKey: ["public-certificates", userId],
    queryFn: () => publicCertificates(userId),
  });
  if (query.isPending)
    return <p role="status">{en ? "Loading certification summaries…" : "正在读取公开证书摘要…"}</p>;
  if (query.isError)
    return (
      <button type="button" onClick={() => void query.refetch()}>
        {en ? "Could not load certifications. Retry" : "证书摘要读取失败，点击重试"}
      </button>
    );
  if (!query.data?.length) return null;
  return (
    <section
      className="mt-8 border border-border p-5"
      aria-label={en ? "Public certifications" : "公开证书摘要"}
    >
      <h2 className="text-xl">{en ? "Certification summaries" : "证书摘要"}</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        {en
          ? "Self-reported. Numbers and photos remain private."
          : "持证人自行登记；编号和照片不公开，不代表机构核验。"}
      </p>
      <ul className="mt-4 space-y-4">
        {query.data.map((item) => (
          <li key={item.id}>
            <strong>{item.level}</strong>
            <p>{[item.agency, item.issued_on, item.issued_at].filter(Boolean).join(" · ")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
