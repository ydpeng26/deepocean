import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DIVE_TYPE_LABELS,
  WEATHER_OPTIONS,
  type Dive,
  type DiveType,
  signedPhotoUrls,
  uploadPhotos,
  parseDiveNumber,
  requireDiveOwner,
  saveDive,
} from "@/lib/dives";
import { assertSupportedWebImage, WEB_IMAGE_ACCEPT } from "@/lib/images";
import { DiveMedia } from "@/components/DiveMedia";
import { newestDivesFirst, parseDiveEntryTime } from "@/lib/dive-order";
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
import { useLanguage } from "@/i18n/LanguageProvider";
import { DiveCompanionsEditor } from "@/components/DiveCompanionsEditor";
import { readCompanions, companionFields } from "@/lib/dive-companions";
import { useLiveCopy } from "@/i18n/liveCopy";

type Props = { dive?: Dive; onBusyChange?: (busy: boolean) => void; onSaved?: () => void };

export function DiveForm({ dive, onBusyChange, onSaved }: Props) {
  const t = useLiveCopy();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const alive = useRef(true);
  const owner = useRef<Promise<string> | null>(null);
  const requestId = useRef(crypto.randomUUID());
  // Keep the version paired with the mount-time form fields, not later cache refreshes.
  const editRevision = useRef(dive?.updated_at);
  useEffect(() => {
    alive.current = true;
    owner.current = requireDiveOwner(dive?.user_id);
    // Preserve the rejected promise for submit without an unhandled rejection.
    void owner.current.catch(() => undefined);
    return () => {
      alive.current = false;
    };
  }, [dive?.user_id]);
  const [country, setCountry] = useState(dive?.country ?? "");
  const [region, setRegion] = useState(dive?.region ?? "");
  const [siteName, setSiteName] = useState(dive?.site_name ?? "");
  const [diveDate, setDiveDate] = useState(
    dive?.dive_date ?? new Date().toISOString().slice(0, 10),
  );
  const [entryTime, setEntryTime] = useState(dive?.entry_time?.slice(0, 5) ?? "");
  const [weather, setWeather] = useState(dive?.weather ?? "");
  const [surfaceTemp, setSurfaceTemp] = useState(dive?.surface_temp?.toString() ?? "");
  const [waterTemp, setWaterTemp] = useState(dive?.water_temp?.toString() ?? "");
  const [maxDepth, setMaxDepth] = useState(dive?.max_depth?.toString() ?? "");
  const [duration, setDuration] = useState(dive?.duration_min?.toString() ?? "");
  const [diveType, setDiveType] = useState<DiveType>(dive?.dive_type ?? "recreational");
  const [companions, setCompanions] = useState(() => readCompanions(dive));
  const [notes, setNotes] = useState(dive?.notes ?? "");
  const [existingPaths, setExistingPaths] = useState<string[]>(dive?.photo_urls ?? []);
  const [existingThumbnailPaths, setExistingThumbnailPaths] = useState<string[]>(
    (dive?.photo_urls ?? []).map((_, index) => dive?.photo_thumbnail_urls?.[index] ?? ""),
  );
  const existingMedia = useQuery({
    queryKey: ["dive-edit-photos", dive?.user_id, existingPaths],
    queryFn: () => signedPhotoUrls(existingPaths, dive?.user_id),
    enabled: existingPaths.length > 0,
    staleTime: 45 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const existingUrls = Object.fromEntries(
    existingPaths.map((path, index) => [
      path,
      existingMedia.isError ? "" : (existingMedia.data?.[index] ?? ""),
    ]),
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const mediaInput = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    const knownRegionCountries: Record<string, string> = {
      komodo: "Indonesia",
      科莫多: "Indonesia",
      bali: "Indonesia",
      巴厘岛: "Indonesia",
      "nusa penida": "Indonesia",
      佩尼达岛: "Indonesia",
      moalboal: "Philippines",
      墨宝: "Philippines",
      palawan: "Philippines",
      巴拉望: "Philippines",
      sipadan: "Malaysia",
      诗巴丹: "Malaysia",
      maldives: "Maldives",
      马尔代夫: "Maldives",
      okinawa: "Japan",
      冲绳: "Japan",
    };
    const resolvedCountry =
      country.trim() || knownRegionCountries[region.trim().toLowerCase()] || "";
    if (!resolvedCountry || !siteName.trim() || !diveDate) {
      toast.error(t("请填写潜水国家、潜点名称和日期"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    onBusyChange?.(true);
    try {
      const numeric = {
        entry_time: parseDiveEntryTime(entryTime),
        ...companionFields(companions),
        surface_temp: parseDiveNumber(surfaceTemp, t("水上温度"), "temperature"),
        water_temp: parseDiveNumber(waterTemp, t("水下温度"), "temperature"),
        max_depth: parseDiveNumber(maxDepth, t("最大深度"), "depth"),
        duration_min: parseDiveNumber(duration, t("潜水时长"), "duration"),
      };
      if (existingPaths.length + newFiles.length > 6)
        throw new Error(t("照片和视频合计最多 6 个，请先移除部分附件"));
      const userId = await (owner.current ?? requireDiveOwner(dive?.user_id));
      await requireDiveOwner(userId);

      const uploaded = newFiles.length
        ? await uploadPhotos(newFiles, userId, requestId.current)
        : { photoPaths: [], thumbnailPaths: [] };
      if (!alive.current) return;
      const payload = {
        user_id: userId,
        country: resolvedCountry.slice(0, 80),
        region: region.trim().slice(0, 100) || null,
        site_name: siteName.trim().slice(0, 120),
        dive_date: diveDate,
        weather: weather || null,
        ...numeric,
        dive_type: diveType,
        photo_urls: [...existingPaths, ...uploaded.photoPaths],
        photo_thumbnail_urls: [...existingThumbnailPaths, ...uploaded.thumbnailPaths],
        notes: notes.trim().slice(0, 2000) || null,
      };

      const savedDive = await saveDive(
        payload,
        dive?.id ?? requestId.current,
        !!dive,
        editRevision.current,
      );
      if (!alive.current) return;
      if (dive) {
        queryClient.setQueryData(["dive", dive.id], savedDive);
        queryClient.setQueryData<Dive[]>(["dives"], (current) =>
          current && newestDivesFirst(current.map((item) => (item.id === savedDive.id ? savedDive : item))),
        );
        void queryClient.invalidateQueries({ queryKey: ["dives"], refetchType: "inactive" });
        toast.success(t("记录已更新"));
        onSaved?.();
        navigate({ to: "/dives/$id", params: { id: dive.id } });
      } else {
        queryClient.setQueryData(["dive", savedDive.id], savedDive);
        queryClient.setQueryData<Dive[]>(["dives"], (current) =>
          current ? newestDivesFirst([savedDive, ...current.filter((item) => item.id !== savedDive.id)]) : current,
        );
        void queryClient.invalidateQueries({ queryKey: ["dives"], refetchType: "inactive" });
        toast.success(t("记录已保存"));
        navigate({ to: "/dives/$id", params: { id: savedDive.id } });
      }
    } catch (err) {
      if (alive.current) toast.error(err instanceof Error ? t(err.message) : t("保存失败，请重试"));
    } finally {
      savingRef.current = false;
      if (alive.current) {
        setSaving(false);
        onBusyChange?.(false);
      }
    }
  }

  const field = "rounded-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <fieldset disabled={saving} className="min-w-0 space-y-10" aria-busy={saving}>
        <section className="space-y-6">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("地点与时间")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">{t("潜水国家")}</Label>
              <Input
                id="country"
                list="dive-country-options"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={field}
                maxLength={80}
                placeholder={t("例如：Indonesia / 印度尼西亚")}
              />
              <datalist id="dive-country-options">
                <option value="Indonesia" />
                <option value="Philippines" />
                <option value="Malaysia" />
                <option value="Thailand" />
                <option value="Maldives" />
                <option value="Japan" />
                <option value="Australia" />
                <option value="China" />
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">{t("地区 / 岛屿")}</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={field}
                maxLength={100}
                placeholder={t("例如：Komodo / 科莫多")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site">{t("潜点名称")}</Label>
              <Input
                id="site"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className={field}
                maxLength={120}
                placeholder={t("例如：Apo Reef")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t("潜水日期")}</Label>
              <Input
                id="date"
                type="date"
                value={diveDate}
                onChange={(e) => setDiveDate(e.target.value)}
                className={field}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-time">{t("入水时间（选填）")}</Label>
              <Input id="entry-time" type="time" step={60} value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)} className={field}
                aria-describedby="entry-time-help" />
              <p id="entry-time-help" className="text-xs text-muted-foreground">
                {t("填写潜点当地时间；未填时排在当天已填时间的记录之后。")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("当天天气")}</Label>
              <Select value={weather} onValueChange={setWeather}>
                <SelectTrigger className={field}>
                  <SelectValue placeholder={t("选择天气")} />
                </SelectTrigger>
                <SelectContent>
                  {WEATHER_OPTIONS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {t(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-border pt-10">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("水温与数据")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="surface">{t("水上温度 °C")}</Label>
              <Input
                id="surface"
                inputMode="decimal"
                value={surfaceTemp}
                onChange={(e) => setSurfaceTemp(e.target.value)}
                className={field}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="water">{t("水下温度 °C")}</Label>
              <Input
                id="water"
                inputMode="decimal"
                value={waterTemp}
                onChange={(e) => setWaterTemp(e.target.value)}
                className={field}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depth">{t("最大深度 m")}</Label>
              <Input
                id="depth"
                inputMode="decimal"
                value={maxDepth}
                onChange={(e) => setMaxDepth(e.target.value)}
                className={field}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">{t("时长 分钟")}</Label>
              <Input
                id="duration"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={field}
              />
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-border pt-10">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("类型与潜伴")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("潜水类型")}</Label>
              <Select value={diveType} onValueChange={(v) => setDiveType(v as DiveType)}>
                <SelectTrigger className={field}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DIVE_TYPE_LABELS) as DiveType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(DIVE_TYPE_LABELS[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DiveCompanionsEditor value={companions} onChange={setCompanions} english={language === "en"} />
          </div>
        </section>

        <section className="space-y-6 border-t border-border pt-10">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("照片与备注")}
          </h2>

          {existingPaths.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {existingPaths.map((path, i) => (
                <div key={`${path}-${i}`} className="relative">
                  <DiveMedia
                    ownerId={dive?.user_id}
                    path={path}
                    url={existingUrls[path]}
                    version={existingMedia.dataUpdatedAt}
                    pending={existingMedia.isFetching}
                    error={existingMedia.isError}
                    reload={() => existingMedia.refetch({ throwOnError: true })}
                    label={`${t("附件")} ${i + 1}`}
                    className="h-24 w-24"
                  />
                  <button
                    type="button"
                    aria-label={t("移除照片")}
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
            <Label htmlFor="photos">{t("照片 / 视频")}</Label>
            <input
              ref={mediaInput}
              id="photos"
              type="file"
              accept={`${WEB_IMAGE_ACCEPT},video/mp4,video/quicktime,video/webm`}
              multiple
              hidden
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                try {
                  for (const file of selected)
                    if (!file.type.startsWith("video/")) assertSupportedWebImage(file);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? t(error.message) : t("请选择 JPG、PNG 或 WebP 图片"),
                  );
                  e.target.value = "";
                  return;
                }
                if (existingPaths.length + selected.length > 6) {
                  toast.error(t("照片和视频合计最多 6 个，请先移除部分附件"));
                  e.target.value = "";
                  return;
                }
                setNewFiles(selected);
              }}
            />
            <button
              type="button"
              onClick={() => mediaInput.current?.click()}
              className="flex w-full items-center justify-between gap-4 border border-dashed border-sky-500/50 bg-sky-500/5 px-5 py-5 text-left transition hover:border-sky-500 hover:bg-sky-500/10"
            >
              <span className="flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center bg-sky-500 text-white">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block text-sm text-foreground">{t("上传照片 / 视频")}</strong>
                  <small className="mt-1 block text-muted-foreground">
                    {t(
                      "图片支持 JPG、PNG、WebP，HEIC/HEIF 请先转换。最多 6 个文件；单个视频不超过 100MB",
                    )}
                  </small>
                </span>
              </span>
              <Upload className="h-5 w-5 text-sky-500" />
            </button>
            {newFiles.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {t("已选择")} {newFiles.length} {t("个文件")}
                </p>
                {newFiles.map((file) => (
                  <p key={`${file.name}-${file.size}`} className="truncate">
                    • {file.name}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("个人备注")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              maxLength={2000}
              className={field}
              placeholder={t("看到了什么？感受如何？")}
            />
          </div>
        </section>

        <div className="flex gap-3 border-t border-border pt-8">
          <Button type="submit" disabled={saving} className="rounded-none px-8">
            {saving ? t("保存中…") : t("保存记录")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-none"
            onClick={() => navigate({ to: "/dives" })}
          >
            {t("取消")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
