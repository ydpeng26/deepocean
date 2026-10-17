import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, CalendarDays, Waves } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicProfile, signedAvatarUrl } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/divers/$id")({
  head: () => ({ meta: [{ title: "潜水员主页 · SupDiver" }, { name: "description", content: "查看 SupDiver 潜水员的公开资料。" }] }),
  component: PublicDiverPage,
});

function PublicDiverPage() {
  const { id } = Route.useParams();
  const { data: profile, isPending, isError } = useQuery({ queryKey: ["public-profile", id], queryFn: () => getPublicProfile(id) });
  const { data: avatarUrl } = useQuery({ queryKey: ["public-avatar", profile?.avatar_url], queryFn: () => signedAvatarUrl(profile?.avatar_url ?? null), enabled: Boolean(profile?.avatar_url), staleTime: 55 * 60 * 1000 });
  if (isPending) return <AppShell><p className="text-sm text-muted-foreground">正在载入潜水员资料…</p></AppShell>;
  if (isError || !profile) return <AppShell><p className="text-sm text-muted-foreground">找不到这位潜水员的公开资料。</p></AppShell>;
  const name = profile.display_name?.trim() || "潜水员";
  return <AppShell>
    <Link to="/forum" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" />返回深蓝论坛</Link>
    <section className="mt-6 overflow-hidden border border-border">
      <div className="h-44 bg-[linear-gradient(120deg,#001c3f,#006aa0,#07162f)]" />
      <div className="px-6 pb-8 sm:px-10">
        <Avatar className="-mt-20 h-40 w-40 border-4 border-background shadow-2xl"><AvatarImage src={avatarUrl ?? undefined} alt={name} className="h-full w-full object-cover" /><AvatarFallback className="text-5xl">{name[0]}</AvatarFallback></Avatar>
        <h1 className="mt-5 text-3xl text-primary">{name}</h1>
        <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{profile.bio?.trim() || "这位潜水员还没有填写个人简介。"}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="border border-border p-4"><Award className="h-5 w-5 text-sky-500" /><small className="mt-3 block text-muted-foreground">最高潜水证书</small><strong className="mt-1 block">{profile.cert_level || "暂未填写"}</strong></div>
          <div className="border border-border p-4"><Waves className="h-5 w-5 text-sky-500" /><small className="mt-3 block text-muted-foreground">累计潜水瓶数</small><strong className="mt-1 block">{profile.tank_count ?? 0}</strong></div>
          <div className="border border-border p-4"><CalendarDays className="h-5 w-5 text-sky-500" /><small className="mt-3 block text-muted-foreground">加入 SupDiver</small><strong className="mt-1 block">{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(profile.created_at))}</strong></div>
        </div>
      </div>
    </section>
  </AppShell>;
}
