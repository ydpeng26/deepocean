import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { DIVE_TYPE_LABELS, formatDate, listDives } from "@/lib/dives";

export const Route = createFileRoute("/_authenticated/dives/")({
  head: () => ({
    meta: [
      { title: "我的潜水日志 · 深蓝" },
      { name: "description", content: "查看你记录的全部潜水：潜点、日期、水温与潜伴。" },
      { property: "og:title", content: "我的潜水日志 · 深蓝" },
      { property: "og:description", content: "查看你记录的全部潜水：潜点、日期、水温与潜伴。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiveList,
});

function DiveList() {
  const { data: dives = [], isPending } = useQuery({ queryKey: ["dives"], queryFn: listDives });

  const total = dives.length;
  const maxDepth = dives.reduce((m, d) => Math.max(m, Number(d.max_depth ?? 0)), 0);
  const totalMin = dives.reduce((m, d) => m + Number(d.duration_min ?? 0), 0);

  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-primary">潜水日志</h1>
          <p className="mt-2 text-sm text-muted-foreground">按日期倒序排列</p>
        </div>
        <Button asChild className="rounded-none">
          <Link to="/dives/new">
            <Plus className="mr-1 h-4 w-4" />
            新增记录
          </Link>
        </Button>
      </div>

      <dl className="mt-10 grid grid-cols-3 gap-px border border-border bg-border">
        {[
          { label: "总潜水次数", value: total },
          { label: "最大深度 m", value: maxDepth || "—" },
          { label: "累计时长 分钟", value: totalMin || "—" },
        ].map((s) => (
          <div key={s.label} className="bg-background px-4 py-6">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-2xl font-normal text-primary">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12">
        {isPending ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : dives.length === 0 ? (
          <div className="border border-dashed border-border px-6 py-20 text-center">
            <p className="text-sm text-muted-foreground">还没有记录，从你最近一次下潜开始吧。</p>
            <Button asChild variant="outline" className="mt-6 rounded-none">
              <Link to="/dives/new">记录第一次潜水</Link>
            </Button>
          </div>
        ) : (
          <ul className="border-t border-border">
            {dives.map((d) => (
              <li key={d.id} className="border-b border-border">
                <Link
                  to="/dives/$id"
                  params={{ id: d.id }}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-5 transition-colors hover:bg-accent/60"
                >
                  <div className="min-w-0">
                    <p className="text-base text-foreground">{d.site_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.country} · {DIVE_TYPE_LABELS[d.dive_type]}
                      {d.water_temp != null && ` · 水下 ${d.water_temp}°C`}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDate(d.dive_date)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
