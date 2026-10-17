import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BUDDY_ROLE_LABELS,
  DIVE_TYPE_LABELS,
  WEATHER_OPTIONS,
  type BuddyRole,
  type Dive,
  type DiveType,
  signedPhotoUrls,
  isVideoPath,
  uploadPhotos,
} from "@/lib/dives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePlus, Upload, X } from "lucide-react";

type Props = { dive?: Dive };

export function DiveForm({ dive }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [country, setCountry] = useState(dive?.country ?? "");
  const [region, setRegion] = useState(dive?.region ?? "");
  const [siteName, setSiteName] = useState(dive?.site_name ?? "");
  const [diveDate, setDiveDate] = useState(
    dive?.dive_date ?? new Date().toISOString().slice(0, 10),
  );
  const [weather, setWeather] = useState(dive?.weather ?? "");
  const [surfaceTemp, setSurfaceTemp] = useState(dive?.surface_temp?.toString() ?? "");
  const [waterTemp, setWaterTemp] = useState(dive?.water_temp?.toString() ?? "");
  const [maxDepth, setMaxDepth] = useState(dive?.max_depth?.toString() ?? "");
  const [duration, setDuration] = useState(dive?.duration_min?.toString() ?? "");
  const [diveType, setDiveType] = useState<DiveType>(dive?.dive_type ?? "recreational");
  const [buddyRole, setBuddyRole] = useState<BuddyRole | "">(dive?.buddy_role ?? "");
  const [buddyName, setBuddyName] = useState(dive?.buddy_name ?? "");
  const [notes, setNotes] = useState(dive?.notes ?? "");
  const [existingPaths, setExistingPaths] = useState<string[]>(dive?.photo_urls ?? []);
  const [existingThumbnailPaths, setExistingThumbnailPaths] = useState<string[]>(
    (dive?.photo_urls ?? []).map((_, index) => dive?.photo_thumbnail_urls?.[index] ?? ""),
  );
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const mediaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    signedPhotoUrls(existingPaths)
      .then((urls) => active && setExistingUrls(urls.filter(Boolean)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [existingPaths]);

  function num(value: string) {
    const n = Number(value);
    return value.trim() === "" || Number.isNaN(n) ? null : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const knownRegionCountries: Record<string, string> = {
      komodo: "Indonesia", "科莫多": "Indonesia", bali: "Indonesia", "巴厘岛": "Indonesia",
      "nusa penida": "Indonesia", "佩尼达岛": "Indonesia", moalboal: "Philippines", "墨宝": "Philippines",
      palawan: "Philippines", "巴拉望": "Philippines", sipadan: "Malaysia", "诗巴丹": "Malaysia",
      maldives: "Maldives", "马尔代夫": "Maldives", okinawa: "Japan", "冲绳": "Japan",
    };
    const resolvedCountry = country.trim() || knownRegionCountries[region.trim().toLowerCase()] || "";
    if (!resolvedCountry || !siteName.trim() || !diveDate) {
      toast.error("请填写潜水国家、潜点名称和日期");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("请先登录");

      const uploaded = newFiles.length
        ? await uploadPhotos(newFiles, userId)
        : { photoPaths: [], thumbnailPaths: [] };
      const payload = {
        user_id: userId,
        country: resolvedCountry.slice(0, 80),
        region: region.trim().slice(0, 100) || null,
        site_name: siteName.trim().slice(0, 120),
        dive_date: diveDate,
        weather: weather || null,
        surface_temp: num(surfaceTemp),
        water_temp: num(waterTemp),
        max_depth: num(maxDepth),
        duration_min: num(duration),
        dive_type: diveType,
        buddy_role: buddyRole === "" ? null : buddyRole,
        buddy_name: buddyName.trim().slice(0, 80) || null,
        photo_urls: [...existingPaths, ...uploaded.photoPaths],
        photo_thumbnail_urls: [...existingThumbnailPaths, ...uploaded.thumbnailPaths],
        notes: notes.trim().slice(0, 2000) || null,
      };

      if (dive) {
        const { data, error } = await supabase
          .from("dives")
          .update(payload)
          .eq("id", dive.id)
          .select("*")
          .single();
        if (error) throw error;
        const savedDive = data as Dive;
        queryClient.setQueryData(["dive", dive.id], savedDive);
        queryClient.setQueryData<Dive[]>(["dives"], (current) =>
          current?.map((item) => (item.id === savedDive.id ? savedDive : item)),
        );
        void queryClient.invalidateQueries({ queryKey: ["dives"], refetchType: "inactive" });
        toast.success("记录已更新");
        navigate({ to: "/dives/$id", params: { id: dive.id } });
      } else {
        const { data, error } = await supabase.from("dives").insert(payload).select("*").single();
        if (error) throw error;
        const savedDive = data as Dive;
        queryClient.setQueryData(["dive", savedDive.id], savedDive);
        queryClient.setQueryData<Dive[]>(["dives"], (current) =>
          current ? [savedDive, ...current.filter((item) => item.id !== savedDive.id)] : current,
        );
        void queryClient.invalidateQueries({ queryKey: ["dives"], refetchType: "inactive" });
        toast.success("记录已保存");
        navigate({ to: "/dives/$id", params: { id: savedDive.id } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  const field = "rounded-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <section className="space-y-6">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          地点与时间
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="country">潜水国家</Label>
            <Input id="country" list="dive-country-options" value={country} onChange={(e) => setCountry(e.target.value)} className={field} maxLength={80} placeholder="例如：Indonesia / 印度尼西亚" />
            <datalist id="dive-country-options"><option value="Indonesia" /><option value="Philippines" /><option value="Malaysia" /><option value="Thailand" /><option value="Maldives" /><option value="Japan" /><option value="Australia" /><option value="China" /></datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">地区 / 岛屿</Label>
            <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} className={field} maxLength={100} placeholder="例如：Komodo / 科莫多" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site">潜点名称</Label>
            <Input id="site" value={siteName} onChange={(e) => setSiteName(e.target.value)} className={field} maxLength={120} placeholder="例如：Apo Reef" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">潜水日期</Label>
            <Input id="date" type="date" value={diveDate} onChange={(e) => setDiveDate(e.target.value)} className={field} />
          </div>
          <div className="space-y-2">
            <Label>当天天气</Label>
            <Select value={weather} onValueChange={setWeather}>
              <SelectTrigger className={field}>
                <SelectValue placeholder="选择天气" />
              </SelectTrigger>
              <SelectContent>
                {WEATHER_OPTIONS.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-6 border-t border-border pt-10">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          水温与数据
        </h2>
        <div className="grid gap-6 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="surface">水上温度 °C</Label>
            <Input id="surface" inputMode="decimal" value={surfaceTemp} onChange={(e) => setSurfaceTemp(e.target.value)} className={field} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="water">水下温度 °C</Label>
            <Input id="water" inputMode="decimal" value={waterTemp} onChange={(e) => setWaterTemp(e.target.value)} className={field} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="depth">最大深度 m</Label>
            <Input id="depth" inputMode="decimal" value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} className={field} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">时长 分钟</Label>
            <Input id="duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} className={field} />
          </div>
        </div>
      </section>

      <section className="space-y-6 border-t border-border pt-10">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          类型与潜伴
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>潜水类型</Label>
            <Select value={diveType} onValueChange={(v) => setDiveType(v as DiveType)}>
              <SelectTrigger className={field}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DIVE_TYPE_LABELS) as DiveType[]).map((k) => (
                  <SelectItem key={k} value={k}>{DIVE_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>潜伴身份</Label>
            <Select value={buddyRole} onValueChange={(v) => setBuddyRole(v as BuddyRole)}>
              <SelectTrigger className={field}>
                <SelectValue placeholder="教练 / 同伴" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BUDDY_ROLE_LABELS) as BuddyRole[]).map((k) => (
                  <SelectItem key={k} value={k}>{BUDDY_ROLE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buddy">潜伴姓名</Label>
            <Input id="buddy" value={buddyName} onChange={(e) => setBuddyName(e.target.value)} className={field} maxLength={80} />
          </div>
        </div>
      </section>

      <section className="space-y-6 border-t border-border pt-10">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          照片与备注
        </h2>

        {existingUrls.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {existingUrls.map((url, i) => (
              <div key={url} className="relative">
                {isVideoPath(existingPaths[i] ?? "") ? <video src={url} className="h-24 w-24 object-cover" controls preload="metadata" /> : <img src={url} alt={`潜水照片 ${i + 1}`} loading="lazy" className="h-24 w-24 object-cover" />}
                <button
                  type="button"
                  aria-label="移除照片"
                  onClick={() => {
                    setExistingPaths(existingPaths.filter((_, idx) => idx !== i));
                    setExistingThumbnailPaths(
                      existingThumbnailPaths.filter((_, idx) => idx !== i),
                    );
                  }}
                  className="absolute right-1 top-1 bg-background/90 p-1 text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <Label htmlFor="photos">照片 / 视频</Label>
          <input
            ref={mediaInput}
            id="photos"
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            multiple
            hidden
            onChange={(e) => setNewFiles(Array.from(e.target.files ?? []).slice(0, 6))}
          />
          <button type="button" onClick={() => mediaInput.current?.click()} className="flex w-full items-center justify-between gap-4 border border-dashed border-sky-500/50 bg-sky-500/5 px-5 py-5 text-left transition hover:border-sky-500 hover:bg-sky-500/10">
            <span className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center bg-sky-500 text-white"><ImagePlus className="h-5 w-5" /></span><span><strong className="block text-sm text-foreground">上传照片 / 视频</strong><small className="mt-1 block text-muted-foreground">最多 6 个文件；单个视频不超过 100MB</small></span></span><Upload className="h-5 w-5 text-sky-500" />
          </button>
          {newFiles.length > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground"><p>已选择 {newFiles.length} 个文件</p>{newFiles.map((file) => <p key={`${file.name}-${file.size}`} className="truncate">• {file.name}</p>)}</div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">个人备注</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            maxLength={2000}
            className={field}
            placeholder="看到了什么？感受如何？"
          />
        </div>
      </section>

      <div className="flex gap-3 border-t border-border pt-8">
        <Button type="submit" disabled={saving} className="rounded-none px-8">
          {saving ? "保存中…" : "保存记录"}
        </Button>
        <Button type="button" variant="ghost" className="rounded-none" onClick={() => navigate({ to: "/dives" })}>
          取消
        </Button>
      </div>
    </form>
  );
}
