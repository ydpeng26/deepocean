import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "../../public/logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "登录 · 深蓝潜水日志" },
      { name: "description", content: "登录或注册深蓝，开始记录你的潜水日志。" },
      { property: "og:title", content: "登录 · 深蓝潜水日志" },
      { property: "og:description", content: "登录或注册深蓝，开始记录你的潜水日志。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("请填写邮箱，密码至少 6 位");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/dives` },
        });
        if (error) throw error;
        toast.success("注册成功，正在进入日志");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/dives" });
      else toast.info("请查收邮箱完成验证后再登录");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google 登录失败，请重试");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dives" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-5xl px-6 py-6">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium tracking-widest text-primary">
          <img src={logo} alt="深蓝" className="h-5 w-5" />
          深蓝 DIVE LOG
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-24">
        <h1 className="text-2xl font-normal tracking-tight text-primary">
          {mode === "signin" ? "登录" : "注册"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin" ? "继续记录你的下潜。" : "创建账号，开始你的第一篇潜水日志。"}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-none"
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-none"
              maxLength={72}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-none">
            {loading ? "处理中…" : mode === "signin" ? "登录" : "注册"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          或
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full rounded-none" onClick={handleGoogle}>
          使用 Google 继续
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {mode === "signin" ? "还没有账号？去注册" : "已有账号？去登录"}
        </button>
      </main>
    </div>
  );
}
