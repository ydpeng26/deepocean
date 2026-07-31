import { createFileRoute, Link } from "@tanstack/react-router";
import { NotebookPen, Images, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "../../public/logo.png";

function MantaRayIcon({ className }: { className?: string }) {
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
      <path d="M70 52c-22 0-42-10-54-24 12-14 32-20 54-20s42 6 54 20c-12 14-32 24-54 24z" />
      <path d="M52 30c-10 0-18 6-22 14" />
      <path d="M88 30c10 0 18 6 22 14" />
      <path d="M70 52v28" />
      <path d="M70 64c-6 6-8 14-8 22" />
      <path d="M70 64c6 6 8 14 8 22" />
      <path d="M52 28c6-8 18-8 24 0" />
      <path d="M64 28c2-4 10-4 12 0" />
      <circle cx="58" cy="34" r="2" fill="currentColor" />
      <circle cx="82" cy="34" r="2" fill="currentColor" />
    </svg>
  );
}

function SeaTurtleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="50" cy="44" rx="26" ry="18" />
      <path d="M28 36c8 8 36 8 44 0" />
      <path d="M30 44c10 6 30 6 40 0" />
      <path d="M34 52c8 4 24 4 32 0" />
      <circle cx="50" cy="18" r="9" />
      <circle cx="46" cy="16" r="1.5" fill="currentColor" />
      <path d="M28 38c-8-4-16-2-20 6 4 6 12 8 18 6" />
      <path d="M72 38c8-4 16-2 20 6-4 6-12 8-18 6" />
      <path d="M32 52c-6 6-10 12-8 18" />
      <path d="M68 52c6 6 10 12 8 18" />
      <path d="M50 62v10" />
    </svg>
  );
}

function DiverIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="30" cy="18" r="10" />
      <ellipse cx="30" cy="16" rx="7" ry="4" />
      <path d="M37 14c4-2 8-2 10 0v-6" />
      <path d="M30 28v8" />
      <path d="M20 38h20l-2 26H22L20 38z" />
      <path d="M16 40h4v22h-4z" />
      <path d="M20 46l-10 8" />
      <path d="M40 46l10 8" />
      <path d="M24 64l-2 24" />
      <path d="M36 64l2 24" />
      <path d="M16 92h14l-2 8H14l2-8z" />
      <path d="M30 92h14l2 8H32l-2-8z" />
      <circle cx="48" cy="10" r="2" fill="currentColor" />
      <circle cx="52" cy="6" r="1.5" fill="currentColor" />
      <circle cx="44" cy="4" r="1" fill="currentColor" />
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
  {
    icon: NotebookPen,
    title: "潜水数据",
    text: "国家、潜点、日期、天气、水上与水下温度、最大深度、时长、潜水类型、潜伴。",
  },
  { icon: Images, title: "照片与随笔", text: "为每一次下潜留下照片和只属于你的随笔。" },
  { icon: ShieldCheck, title: "云端私密", text: "记录保存在云端，只有你自己能看到，换设备也不会丢。" },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-primary text-primary-foreground">
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-sm font-medium tracking-widest text-primary-foreground">
          <img src={logo} alt="深蓝" className="h-6 w-6" />
          深蓝 DIVE LOG
        </span>
        <Link
          to="/auth"
          className="text-sm text-primary-foreground/70 hover:text-primary-foreground"
        >
          登录
        </Link>
      </header>

      <main className="relative mx-auto max-w-5xl px-6">
        <section className="relative border-t border-primary-foreground/20 py-24">
          <h1 className="max-w-2xl text-4xl font-normal leading-tight tracking-tight text-background sm:text-5xl">
            记录每一次下潜，
            <br />
            珍藏每一次深蓝
          </h1>
          <p className="mt-4 max-w-xl text-sm font-normal italic leading-relaxed text-primary-foreground/70">
            Log every dive. Cherish every deep blue.
          </p>
          <div className="mt-10">
            <Button
              asChild
              size="lg"
              className="rounded-none bg-background px-8 text-primary hover:bg-background/90"
            >
              <Link to="/auth">开始记录</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-px border-t border-primary-foreground/20 bg-primary-foreground/10 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-primary-foreground/5 px-2 py-10 sm:px-6">
              <f.icon className="h-5 w-5 text-primary-foreground" />
              <h2 className="mt-4 text-sm font-medium text-primary-foreground">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">{f.text}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-primary-foreground/20 py-10 text-xs text-primary-foreground/60">
          深蓝 · 潜水日志
        </footer>
      </main>

      {/* 左侧装饰：蝠鲼 */}
      <div className="pointer-events-none absolute left-6 top-32 hidden flex-col items-center gap-10 text-primary-foreground/[0.15] lg:flex">
        <MantaRayIcon className="h-28 w-44" />
      </div>

      {/* 右侧装饰：海龟、潜水员 */}
      <div className="pointer-events-none absolute right-6 top-44 hidden flex-col items-center gap-12 text-primary-foreground/[0.15] lg:flex">
        <SeaTurtleIcon className="h-28 w-36" />
        <DiverIcon className="h-36 w-20" />
      </div>
    </div>
  );
}
