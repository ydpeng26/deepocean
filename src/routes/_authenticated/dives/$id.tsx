import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DiveForm } from "@/components/DiveForm";
import { DiveMedia } from "@/components/DiveMedia";
import { Button } from "@/components/ui/button";
import {
  BUDDY_ROLE_LABELS,
  DIVE_TYPE_LABELS,
  deleteDive,
  formatDate,
  getDive,
  signedPhotoUrls,
} from "@/lib/dives";

export const Route = createFileRoute("/_authenticated/dives/$id")({
  head: () => ({
    meta: [
      { title: "潜水记录详情 · 深蓝" },
      { name: "description", content: "查看这一次下潜的潜点、天气、水温、潜伴、照片与备注。" },
      { property: "og:title", content: "潜水记录详情 · 深蓝" },
      {
        property: "og:description",
        content: "查看这一次下潜的潜点、天气、水温、潜伴、照片与备注。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiveDetail,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "潜水记录加载失败"}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">找不到这条潜水记录。</p>
    </AppShell>
  ),
});

function DiveDetail() {
  const { language } = useLanguage();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    data: dive,
    isPending,
    error,
  } = useQuery({
    queryKey: ["dive", id],
    queryFn: () => getDive(id),
  });

  const photoPaths = dive?.photo_urls ?? [];
  const mediaQuery = useQuery({
    queryKey: ["dive-photos", dive?.user_id, id, photoPaths],
    queryFn: () => signedPhotoUrls(photoPaths, dive?.user_id),
    enabled: photoPaths.length > 0,
    staleTime: 45 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 50 * 60 * 1000,
  });
  const photos = mediaQuery.isError ? [] : (mediaQuery.data ?? []);

  async function handleDelete() {
    if (!confirm("确定删除这条潜水记录吗？")) return;
    try {
      await deleteDive(id);
      await queryClient.invalidateQueries({ queryKey: ["dives"] });
      toast.success("已删除");
      navigate({ to: "/dives" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  }

  if (isPending) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </AppShell>
    );
  }

  if (error || !dive) {
    return (
      <AppShell>
        <p role="alert" className="text-sm text-muted-foreground">
          找不到这条潜水记录。
        </p>
      </AppShell>
    );
  }

  if (editing) {
    return (
      <AppShell>
        <button
          disabled={saving}
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          返回详情
        </button>
        <h1 className="mb-10 mt-4 text-3xl font-normal tracking-tight text-primary">编辑记录</h1>
        <DiveForm dive={dive} onBusyChange={setSaving} onSaved={() => setEditing(false)} />
      </AppShell>
    );
  }

  const rows: Array<[string, string]> = [
    ["潜水国家", dive.country],
    ["地区 / 岛屿", dive.region ?? "—"],
    ["潜点名称", dive.site_name],
    ["潜水日期", formatDate(dive.dive_date)],
    ["入水时间（潜点当地时间）", dive.entry_time?.slice(0, 5) ?? "未填写"],
    ["当天天气", dive.weather ?? "—"],
    ["水上温度", dive.surface_temp != null ? `${dive.surface_temp} °C` : "—"],
    ["水下温度", dive.water_temp != null ? `${dive.water_temp} °C` : "—"],
    ["最大深度", dive.max_depth != null ? `${dive.max_depth} m` : "—"],
    ["潜水时长", dive.duration_min != null ? `${dive.duration_min} 分钟` : "—"],
    ["潜水类型", DIVE_TYPE_LABELS[dive.dive_type]],
    [
      "潜伴",
      [dive.buddy_role ? BUDDY_ROLE_LABELS[dive.buddy_role] : null, dive.buddy_name]
        .filter(Boolean)
        .join(" · ") || "—",
    ],
  ];

  return (
    <AppShell>
      <Link
        to="/dives"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        返回日志
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-primary">{dive.site_name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {[dive.country, dive.region, formatDate(dive.dive_date)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-none" asChild>
            <Link to="/share-card" search={{ dive: id }}>
              <Camera className="mr-1 h-4 w-4" />
              {language === "en" ? "Create a keepsake" : "制作纪念卡"}
            </Link>
          </Button>
          <Button variant="outline" className="rounded-none" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" />
            编辑
          </Button>
          <Button variant="ghost" className="rounded-none text-destructive" onClick={handleDelete}>
            <Trash2 className="mr-1 h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      <dl className="mt-10 border-t border-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6 border-b border-border py-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {photoPaths.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            照片与视频
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photoPaths.map((path, i) => (
              <DiveMedia
                key={`${dive.user_id}:${path}:${i}`}
                ownerId={dive.user_id}
                path={path}
                url={photos[i]}
                version={mediaQuery.dataUpdatedAt}
                pending={mediaQuery.isFetching}
                error={mediaQuery.isError}
                reload={() => mediaQuery.refetch({ throwOnError: true })}
                className="aspect-square"
                label={`${dive.site_name} 附件 ${i + 1}`}
              />
            ))}
          </div>
        </section>
      )}

      {dive.notes && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            个人备注
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {dive.notes}
          </p>
        </section>
      )}
    </AppShell>
  );
}
