import { createFileRoute, Link } from "@tanstack/react-router";
import { Waves, NotebookPen, Images, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "潜迹 · 潜水日志 | 记录每一次下潜" },
      {
        name: "description",
        content:
          "潜迹是给潜水员的极简潜水日志：记录潜水国家、潜点、日期、天气、水温、潜水类型、潜伴、照片与心得。",
      },
      { property: "og:title", content: "潜迹 · 潜水日志" },
      {
        property: "og:description",
        content: "极简潜水日志，记录每一次下潜的潜点、水温、潜伴与照片。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: NotebookPen, title: "完整字段", text: "国家、潜点、日期、天气、水上与水下温度、潜水类型、潜伴。" },
  { icon: Images, title: "照片与心得", text: "为每一次下潜留下照片和只属于你的备注。" },
  { icon: ShieldCheck, title: "云端私密", text: "记录保存在云端，只有你自己能看到，换设备也不会丢。" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-sm font-medium tracking-widest text-primary">
          <Waves className="h-4 w-4" />
          潜迹 DIVE LOG
        </span>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary">
          登录
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="border-t border-border py-24">
          <h1 className="max-w-2xl text-4xl font-normal leading-tight tracking-tight text-primary sm:text-5xl">
            把每一次下潜，
            <br />
            留在纸一样干净的日志里。
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            为潜水员而做的潜水日志。填几个字段，就能长期保存你去过的海、见过的水温和一起下水的人。
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="rounded-none px-8">
              <Link to="/auth">开始记录</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-background px-2 py-10 sm:px-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-sm font-medium text-foreground">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-border py-10 text-xs text-muted-foreground">
          潜迹 · 潜水日志
        </footer>
      </main>
    </div>
  );
}
