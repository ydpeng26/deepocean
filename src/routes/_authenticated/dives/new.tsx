import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DiveForm } from "@/components/DiveForm";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dives/new")({
  head: () => ({
    meta: [
      { title: "新增潜水记录 · 深蓝" },
      {
        name: "description",
        content: "填写潜水国家、潜点、日期、天气、水温、潜水类型、潜伴与照片。",
      },
      { property: "og:title", content: "新增潜水记录 · 深蓝" },
      {
        property: "og:description",
        content: "填写潜水国家、潜点、日期、天气、水温、潜水类型、潜伴与照片。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewDive,
});

function NewDive() {
  const [saving, setSaving] = useState(false);
  return (
    <AppShell>
      <Link
        to="/dives"
        aria-disabled={saving}
        onClick={(event) => {
          if (saving) event.preventDefault();
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        返回日志
      </Link>
      <h1 className="mb-10 mt-4 text-3xl font-normal tracking-tight text-primary">新增潜水记录</h1>
      <DiveForm onBusyChange={setSaving} />
    </AppShell>
  );
}
