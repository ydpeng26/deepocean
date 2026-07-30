import { createFileRoute, Link } from "@tanstack/react-router";
import { NotebookPen, Images, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "../../public/logo.png";

function WhaleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M100 45c-5 12-22 18-42 18-28 0-48-15-48-33 0-20 24-30 48-30 24 0 44 12 48 30" />
      <path d="M98 30c8-6 16-4 20 2-2 10-8 16-20 14" />
      <circle cx="28" cy="28" r="3" fill="currentColor" />
      <path d="M16 48c8 6 22 8 36 4" />
    </svg>
  );
}

function TurtleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="50" cy="52" rx="26" ry="20" />
      <path d="M50 32v-14" />
      <path d="M36 38l-14-10" />
      <path d="M64 38l14-10" />
      <path d="M34 64l-12 12" />
      <path d="M66 64l12 12" />
      <circle cx="50" cy="18" r="8" />
      <circle cx="46" cy="16" r="1.5" fill="currentColor" />
      <path d="M32 26c-6 2-10 8-10 14" />
      <path d="M68 26c6 2 10 8 10 14" />
      <path d="M42 50h16M50 44v16" />
    </svg>
  );
}

function JellyfishIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M40 12c-22 0-34 14-34 28h68c0-14-12-28-34-28z" />
      <path d="M24 40c-2 18-4 34-8 50" />
      <path d="M40 40c0 18 2 34 6 50" />
      <path d="M56 40c2 18 4 34 8 50" />
      <path d="M16 28c4-8 12-12 24-12" />
      <circle cx="40" cy="24" r="2" fill="currentColor" />
    </svg>
  );
}

function FishIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 60"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M76 30c-6 16-26 22-48 22-12 0-20-8-20-18 0-12 12-20 28-20 22 0 40 8 48 22z" />
      <path d="M76 30l16-12v34l-16-12" />
      <path d="M28 24c-4 0-8 4-8 10" />
      <path d="M24 30c6 4 12 4 18 0" />
      <circle cx="22" cy="28" r="2" fill="currentColor" />
      <path d="M8 34c-2 6 2 10 8 10" />
    </svg>
  );
}

function CoralIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M40 92V60" />
      <path d="M40 72c-10-10-18-8-22 2" />
      <path d="M40 64c10-10 18-8 22 2" />
      <path d="M40 52c-12-14-26-12-30 2" />
      <path d="M40 52c12-14 26-12 30 2" />
      <path d="M40 92c-6 4-12 4-18 0" />
      <path d="M40 92c6 4 12 4 18 0" />
      <circle cx="18" cy="54" r="2" fill="currentColor" />
      <circle cx="62" cy="54" r="2" fill="currentColor" />
    </svg>
  );
}

function BubbleGroup({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <circle cx="30" cy="105" r="8" />
      <circle cx="20" cy="80" r="5" />
      <circle cx="42" cy="60" r="6" />
      <circle cx="28" cy="38" r="4" />
      <circle cx="36" cy="18" r="3" />
    </svg>
  );
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "深蓝 · 潜水日志 | 记录每一次下潜" },
      {
        name: "description",
        content:
          "深蓝是给潜水员的极简潜水日志：记录潜水国家、潜点、日期、天气、水温、潜水类型、潜伴、照片与心得。",
      },
      { property: "og:title", content: "深蓝 · 潜水日志" },
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
          <img src={logo} alt="深蓝" className="h-6 w-6" />
          深蓝 DIVE LOG
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
          深蓝 · 潜水日志
        </footer>
      </main>
    </div>
  );
}
