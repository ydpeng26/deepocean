import { createFileRoute, Link } from "@tanstack/react-router";
import { NotebookPen, Images, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "../../public/logo.png";

function WhaleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M118 46c-6 16-28 24-52 24-34 0-58-18-58-42 0-24 30-38 60-38 30 0 54 16 60 40" />
      <path d="M116 28c12-8 22-6 26 4-2 14-12 22-26 18" />
      <path d="M38 32c-2 8-2 16 0 24" />
      <path d="M50 34c-2 8-4 16 0 22" />
      <path d="M62 34c-2 8-2 14 0 20" />
      <path d="M74 32c-2 6-2 12 0 18" />
      <path d="M18 44c-10 8-8 18 2 22" />
      <path d="M108 48c4 8 12 12 22 10" />
      <path d="M96 20c-2-6-8-10-14-10" />
      <path d="M92 18c4-2 8-2 12 0" />
      <circle cx="40" cy="28" r="3" fill="currentColor" />
      <path d="M78 60c12 4 28 2 40-6" />
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
      <ellipse cx="50" cy="54" rx="28" ry="22" />
      <path d="M34 40c-2-4-2-8 0-12" />
      <path d="M42 38c-2-4-2-8 0-12" />
      <path d="M50 36c0-6 0-10 0-14" />
      <path d="M58 38c2-4 2-8 0-12" />
      <path d="M66 40c2-4 2-8 0-12" />
      <path d="M30 48c-4-2-6-6-4-10" />
      <path d="M70 48c4-2 6-6 4-10" />
      <path d="M50 36v36" />
      <path d="M34 48c8 6 24 6 32 0" />
      <path d="M24 58l-16 12" />
      <path d="M76 58l16 12" />
      <path d="M24 52l-18-8" />
      <path d="M76 52l18-8" />
      <path d="M50 32v-16" />
      <circle cx="50" cy="16" r="9" />
      <circle cx="46" cy="14" r="1.5" fill="currentColor" />
      <path d="M42 20c-8 2-12 10-12 18" />
      <path d="M58 20c8 2 12 10 12 18" />
      <path d="M44 80c-2 6-6 10-10 10" />
      <path d="M56 80c2 6 6 10 10 10" />
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
      <path d="M40 12c-24 0-38 14-38 32h76c0-18-14-32-38-32z" />
      <path d="M10 32c6-10 18-16 30-16" />
      <path d="M70 32c-6-10-18-16-30-16" />
      <path d="M20 20c8-8 22-8 30 0" />
      <path d="M24 40c-3 16-6 34-10 54" />
      <path d="M40 40c-1 18-2 38-4 58" />
      <path d="M56 40c3 16 6 34 10 54" />
      <path d="M32 48c-2 14-5 28-8 40" />
      <path d="M48 48c2 14 5 28 8 40" />
      <path d="M22 28c2 2 6 2 8 0" />
      <path d="M38 26c2 2 6 2 8 0" />
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
      <path d="M76 30c-6 18-28 24-50 24-12 0-22-8-22-20 0-12 12-22 28-22 24 0 42 10 50 26z" />
      <path d="M76 30l20-14v36l-20-14" />
      <path d="M26 24c-6 0-12 6-12 14" />
      <path d="M26 30c8 4 16 4 24 0" />
      <path d="M30 36c6 4 14 4 20 0" />
      <path d="M56 22c-2 6-2 12 0 18" />
      <path d="M64 24c-2 6-2 12 0 18" />
      <path d="M72 26c-2 6-2 12 0 18" />
      <path d="M42 18c-2 8-2 16 0 24" />
      <path d="M84 22c4-4 8-2 10 2" />
      <path d="M84 38c4 4 8 2 10-2" />
      <circle cx="22" cy="28" r="2" fill="currentColor" />
      <path d="M8 34c-2 8 4 12 12 10" />
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
      <path d="M40 74c-12-10-20-8-24 4" />
      <path d="M40 66c12-10 20-8 24 4" />
      <path d="M40 56c-16-14-30-12-34 4" />
      <path d="M40 56c16-14 30-12 34 4" />
      <path d="M40 88c-10 6-20 6-28 0" />
      <path d="M40 88c10 6 20 6 28 0" />
      <path d="M28 62c-4-8-10-6-14 2" />
      <path d="M52 62c4-8 10-6 14 2" />
      <path d="M40 48c-8-12-18-10-22 0" />
      <path d="M40 48c8-12 18-10 22 0" />
      <circle cx="14" cy="60" r="2" fill="currentColor" />
      <circle cx="66" cy="60" r="2" fill="currentColor" />
      <circle cx="20" cy="50" r="2" fill="currentColor" />
      <circle cx="60" cy="50" r="2" fill="currentColor" />
      <circle cx="40" cy="40" r="2" fill="currentColor" />
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
      <circle cx="30" cy="105" r="10" />
      <path d="M26 101c2-2 6-2 8 0" />
      <circle cx="20" cy="80" r="6" />
      <path d="M17 77c2-1 4-1 6 0" />
      <circle cx="42" cy="60" r="7" />
      <path d="M39 57c2-1 4-1 6 0" />
      <circle cx="28" cy="38" r="5" />
      <path d="M25 35c2-1 4-1 6 0" />
      <circle cx="36" cy="18" r="4" />
      <path d="M34 16c1-1 3-1 4 0" />
      <circle cx="14" cy="20" r="3" />
      <circle cx="48" cy="28" r="2" />
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-sm font-medium tracking-widest text-primary">
          <img src={logo} alt="深蓝" className="h-6 w-6" />
          深蓝 DIVE LOG
        </span>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary">
          登录
        </Link>
      </header>

      <main className="relative mx-auto max-w-5xl px-6">
        <section className="relative border-t border-border py-24">
          <h1 className="max-w-2xl text-4xl font-normal leading-tight tracking-tight text-primary sm:text-5xl">
            记录每一次下潜，
            <br />
            珍藏每一次深蓝
          </h1>
          <p className="mt-4 max-w-xl text-sm font-normal italic leading-relaxed text-primary/70">
            Log every dive. Cherish every deep blue.
          </p>
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

      {/* 左侧装饰：鲸、水母、气泡 */}
      <div className="pointer-events-none absolute left-6 top-32 hidden flex-col items-center gap-10 text-primary/[0.15] lg:flex">
        <WhaleIcon className="h-28 w-40" />
        <JellyfishIcon className="h-28 w-20" />
        <BubbleGroup className="h-32 w-14" />
      </div>

      {/* 右侧装饰：海龟、鱼、珊瑚 */}
      <div className="pointer-events-none absolute right-6 top-44 hidden flex-col items-center gap-12 text-primary/[0.15] lg:flex">
        <TurtleIcon className="h-28 w-28" />
        <FishIcon className="h-20 w-32" />
        <CoralIcon className="h-28 w-20" />
      </div>
    </div>
  );
}

