import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { CERT_LEVELS, updateMyProfile, uploadAvatar } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "个人信息 · 深蓝潜水日志" },
      { name: "description", content: "维护你的用户名、头像、潜水证级别与现有瓶数。" },
      { property: "og:title", content: "个人信息 · 深蓝潜水日志" },
      { property: "og:description", content: "维护你的用户名、头像、潜水证级别与现有瓶数。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, avatarUrl, isPending } = useProfile();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [cert, setCert] = useState<string>("");
  const [tanks, setTanks] = useState("0");

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setCert(profile.cert_level ?? "");
    setTanks(String(profile.tank_count ?? 0));
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile({
        display_name: name.trim() || "潜水员",
        cert_level: cert || null,
        tank_count: Number(tanks) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("个人信息已保存");
    },
    onError: () => toast.error("保存失败，请重试"),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("头像已更新");
    },
    onError: () => toast.error("头像上传失败"),
  });

  const display = name || "潜水员";

  return (
    <AppShell>
      <h1 className="text-3xl font-normal tracking-tight text-primary">个人信息</h1>
      <p className="mt-2 text-sm text-muted-foreground">这些信息会显示在你的日志首页。</p>

      {isPending ? (
        <p className="mt-10 text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="mt-10 max-w-md space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-none">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={display} className="rounded-none" /> : null}
              <AvatarFallback className="rounded-none bg-primary/10 text-lg text-primary">
                {display.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                className="rounded-none"
                disabled={upload.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {upload.isPending ? "上传中…" : "更换头像"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">用户名</Label>
            <Input
              id="name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className="rounded-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cert">潜水证级别</Label>
            <Select value={cert} onValueChange={setCert}>
              <SelectTrigger id="cert" className="rounded-none">
                <SelectValue placeholder="选择级别" />
              </SelectTrigger>
              <SelectContent>
                {CERT_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tanks">现有瓶数</Label>
            <Input
              id="tanks"
              type="number"
              min={0}
              value={tanks}
              onChange={(e) => setTanks(e.target.value)}
              className="rounded-none"
            />
          </div>

          <Button
            className="rounded-none"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "保存中…" : "保存"}
          </Button>
        </div>
      )}
    </AppShell>
  );
}
