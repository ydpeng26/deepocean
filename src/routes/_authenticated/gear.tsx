import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, Plus, Save, Trash2, Wrench } from "lucide-react";
import { GearIllustration } from "@/components/GearIllustration";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLiveCopy } from "@/i18n/liveCopy";
import { prepareGearPhoto, WEB_IMAGE_ACCEPT } from "@/lib/images";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  createGear,
  deleteGear,
  listGear,
  updateGear,
  validateGear,
  GearConflictError,
  uploadGearPhoto,
  signedGearPhotoUrls,
  type GearCategory,
  type GearInput,
  type GearItem,
} from "@/lib/gear";

export const Route = createFileRoute("/_authenticated/gear")({
  head: () => ({
    meta: [
      { title: "我的潜水装备 · SupDiver" },
      { name: "description", content: "管理个人潜水装备、使用次数和保养日期。" },
    ],
  }),
  component: GearPage,
});

const categories: Array<[GearCategory, string]> = [
  ["bcd", "浮力控制装置"],
  ["regulator", "调节器"],
  ["computer", "潜水电脑"],
  ["mask", "面镜"],
  ["fins", "脚蹼"],
  ["wetsuit", "潜水服"],
  ["camera", "水下相机"],
  ["other", "其他装备"],
];

const empty: GearInput = {
  category: "bcd",
  brand: "",
  model: "",
  purchased_on: null,
  next_service_on: null,
  serial_number: null,
  dive_count: 0,
  notes: null,
  photo_path: null,
};
const fields = (item: GearInput): GearInput => ({
  category: item.category,
  brand: item.brand,
  model: item.model,
  purchased_on: item.purchased_on,
  next_service_on: item.next_service_on,
  serial_number: item.serial_number,
  dive_count: item.dive_count,
  notes: item.notes,
  photo_path: item.photo_path,
});

function GearVisual({
  category,
  compact = false,
  photo,
}: {
  category: GearCategory;
  compact?: boolean;
  photo?: string | null;
}) {
  const t = useLiveCopy();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const label = categories.find(([value]) => value === category)?.[1] ?? t("潜水装备");
  return (
    <span
      className={`grid shrink-0 place-items-center bg-gradient-to-br from-sky-500/20 to-cyan-500/5 text-sky-400 ${compact ? "h-14 w-16" : "h-44 w-full"}`}
    >
      {photo && failedPhoto !== photo ? (
        <img
          src={photo}
          alt={t(label)}
          className="h-full w-full object-contain p-2"
          onError={() => setFailedPhoto(photo)}
        />
      ) : (
        <GearIllustration
          category={category}
          className={compact ? "h-10 w-10" : "h-24 w-24"}
          label={t(label)}
        />
      )}
    </span>
  );
}

function GearPage() {
  const t = useLiveCopy("我的潜水装备 · SupDiver");
  const { language } = useLanguage();
  const photoText = (zh: string, en: string) => (language === "en" ? en : zh);
  const queryClient = useQueryClient();
  const profileState = useProfile();
  const query = useQuery({ queryKey: ["gear"], queryFn: listGear });
  const { data: items = [], isPending } = query;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<GearInput>(empty);
  const [photoDraft, setPhotoDraft] = useState<
    (Awaited<ReturnType<typeof prepareGearPhoto>> & { useCutout: boolean }) | null
  >(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoFile = photoDraft
    ? photoDraft.useCutout && photoDraft.cutout
      ? photoDraft.cutout
      : photoDraft.original
    : null;
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);
  const photoPaths = Array.from(
    new Set(
      [...items.map((item) => item.photo_path), draft.photo_path].filter(
        (path): path is string => !!path,
      ),
    ),
  );
  const photoQuery = useQuery({
    queryKey: ["gear-photos", profileState.profile?.id, photoPaths],
    queryFn: () => signedGearPhotoUrls(photoPaths, profileState.profile!.id),
    enabled: !!profileState.profile?.id && photoPaths.length > 0,
    staleTime: 45 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 50 * 60 * 1000,
  });
  const savedPhoto = (path: string | null) =>
    !photoQuery.isError && path ? photoQuery.data?.get?.(path) : null;
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const revision = useRef<string | null>(null);
  const lock = useRef(false),
    alive = useRef(true),
    hydrated = useRef<string | null>(null);
  const requestId = useRef(crypto.randomUUID()),
    baseline = useRef(JSON.stringify(empty));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isCreating && !selectedId && items[0]) setSelectedId(items[0].id);
  }, [isCreating, items, selectedId]);
  useEffect(() => {
    if (!selected || hydrated.current === selected.id || lock.current) return;
    const value = fields(selected);
    hydrated.current = selected.id;
    baseline.current = JSON.stringify(value);
    revision.current = selected.updated_at;
    setConflict(false);
    setDraft(value);
    setPhotoDraft(null);
  }, [selected]);
  const discard = () =>
    (!photoDraft && JSON.stringify(draft) === baseline.current) ||
    confirm(t("放弃尚未保存的装备修改？"));
  async function choosePhoto(file?: File) {
    if (!file || lock.current || !profileState.profile) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await prepareGearPhoto(file);
      if (alive.current) setPhotoDraft({ ...result, useCutout: result.status === "removed" });
    } catch (error) {
      if (alive.current)
        toast.error(
          error instanceof Error
            ? error.message
            : photoText(
                "图片处理失败，原输入已保留。",
                "Image processing failed; your draft is kept.",
              ),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function save() {
    if (lock.current || !profileState.profile || query.isError || conflict) return;
    if (selectedId && !selected) {
      setConflict(true);
      return;
    }
    let snapshot: GearInput;
    try {
      snapshot = validateGear(draft);
    } catch (error) {
      toast.error(t((error as Error).message));
      return;
    }
    const owner = profileState.profile.id,
      id = selectedId ?? requestId.current,
      creating = !selectedId;
    lock.current = true;
    setBusy(true);
    try {
      if (photoFile)
        snapshot.photo_path = await uploadGearPhoto(photoFile, owner, requestId.current);
      const item = creating
        ? await createGear(snapshot, id, owner)
        : await updateGear(id, snapshot, owner, revision.current ?? "");
      if (!alive.current) return;
      const value = fields(item);
      hydrated.current = item.id;
      baseline.current = JSON.stringify(value);
      revision.current = item.updated_at;
      setConflict(false);
      setDraft(value);
      setPhotoDraft(null);
      queryClient.setQueryData<GearItem[]>(["gear"], (current = []) => [
        item,
        ...current.filter((row) => row.id !== item.id),
      ]);
      setIsCreating(false);
      setSelectedId(item.id);
      toast.success(creating ? t("新装备已添加") : t("装备资料已更新"));
      await queryClient.invalidateQueries({ queryKey: ["gear"] });
    } catch (error) {
      if (alive.current && error instanceof GearConflictError) setConflict(true);
      if (alive.current)
        toast.error(error instanceof Error ? t(error.message) : t("保存失败，修改已保留，请重试"));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function remove() {
    if (lock.current || !selected || !profileState.profile || !confirm(t("确定删除这件装备吗？")))
      return;
    const id = selected.id,
      owner = profileState.profile.id;
    lock.current = true;
    setBusy(true);
    try {
      await deleteGear(id, owner, revision.current ?? "");
      if (!alive.current) return;
      queryClient.setQueryData<GearItem[]>(["gear"], (current = []) =>
        current.filter((row) => row.id !== id),
      );
      setSelectedId(null);
      hydrated.current = null;
      revision.current = null;
      setConflict(false);
      setDraft(empty);
      setPhotoDraft(null);
      baseline.current = JSON.stringify(empty);
      requestId.current = crypto.randomUUID();
      toast.success(t("装备已删除"));
    } catch (error) {
      if (alive.current) {
        if (error instanceof GearConflictError) setConflict(true);
        toast.error(
          t(error instanceof GearConflictError ? error.message : "删除失败，请重新载入后重试"),
        );
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function reloadLatest() {
    if (lock.current || !confirm(t("加载最新记录将替换当前输入。请先复制需要的内容，是否继续？")))
      return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await query.refetch();
      if (!alive.current) return;
      if (result.error || !result.data) throw result.error || new Error("装备读取失败");
      const item = result.data.find((row) => row.id === selectedId);
      if (!item) {
        setConflict(true);
        return;
      }
      const value = fields(item);
      hydrated.current = item.id;
      revision.current = item.updated_at;
      baseline.current = JSON.stringify(value);
      setDraft(value);
      setPhotoDraft(null);
      setConflict(false);
    } catch {
      if (alive.current) toast.error(t("读取失败不代表没有装备；未保存的修改仍保留在当前页面。"));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const set = <K extends keyof GearInput>(key: K, value: GearInput[K]) => {
    if (!lock.current) setDraft((current) => ({ ...current, [key]: value }));
  };
  if (query.isError || profileState.isError)
    return (
      <AppShell>
        <div role="alert">
          <h1>{t("暂时无法读取装备资料")}</h1>
          <p>{t("读取失败不代表没有装备；未保存的修改仍保留在当前页面。")}</p>
          <Button
            onClick={() => {
              void query.refetch();
              void profileState.refetch();
            }}
          >
            {t("重新加载")}
          </Button>
          <Link to="/dives">{t("返回海洋护照")}</Link>
        </div>
      </AppShell>
    );
  if (isPending || profileState.isPending)
    return (
      <AppShell>
        <p role="status">{t("正在载入装备…")}</p>
      </AppShell>
    );

  return (
    <AppShell>
      <Link
        to="/dives"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        {t("返回海洋护照")}
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-medium tracking-[.24em] text-sky-500">MY DIVE LOCKER</span>
          <h1 className="mt-2 text-4xl font-normal tracking-tight text-primary">
            {t("我的潜水装备")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("记录常用装备、使用次数与下一次保养日期。")}
          </p>
        </div>
        <Button
          disabled={busy}
          className="rounded-none"
          onClick={() => {
            if (lock.current || !discard()) return;
            setIsCreating(true);
            setSelectedId(null);
            setDraft(empty);
            setPhotoDraft(null);
            hydrated.current = "new";
            revision.current = null;
            setConflict(false);
            baseline.current = JSON.stringify(empty);
            requestId.current = crypto.randomUUID();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("新增装备")}
        </Button>
      </div>
      <div className="mt-10 grid gap-8 md:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          {isPending ? (
            <p className="text-sm text-muted-foreground">{t("正在载入装备…")}</p>
          ) : items.length ? (
            items.map((item) => (
              <button
                disabled={busy}
                key={item.id}
                type="button"
                onClick={() => {
                  if (lock.current || !discard()) return;
                  setIsCreating(false);
                  setSelectedId(item.id);
                }}
                className={`flex w-full items-center gap-3 border p-3 text-left transition ${item.id === selectedId ? "border-sky-500 bg-sky-500/10" : "border-border hover:border-sky-500/50"}`}
              >
                <GearVisual category={item.category} compact photo={savedPhoto(item.photo_path)} />
                <span className="min-w-0">
                  <small className="block text-muted-foreground">
                    {t(categories.find(([value]) => value === item.category)?.[1] ?? t("潜水装备"))}
                  </small>
                  <strong className="block truncate">
                    {item.brand || t("未填写品牌")} {item.model}
                  </strong>
                </span>
              </button>
            ))
          ) : (
            <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">
              {t("还没有登记装备。点击“新增装备”建立你的第一条装备档案。")}
            </div>
          )}
        </aside>
        <section className="border border-border p-6 sm:p-8" aria-busy={busy}>
          <div className="flex items-center gap-3 border-b border-border pb-5">
            <Wrench className="h-5 w-5 text-sky-500" />
            <div>
              <h2 className="text-xl">{selectedId ? t("编辑装备档案") : t("登记新装备")}</h2>
              <p className="text-xs text-muted-foreground">{t("资料只对当前账号显示。")}</p>
            </div>
          </div>
          {(conflict || (selectedId && !selected)) && (
            <div role="alert" className="mt-5 border border-border p-4">
              <p>
                {t(
                  "装备已在其他页面修改或删除。当前输入已保留，请先复制需要的内容，再加载最新记录。",
                )}
              </p>
              <Button
                disabled={busy}
                variant="outline"
                className="mt-3"
                onClick={() => void reloadLatest()}
              >
                {t("加载最新装备记录")}
              </Button>
            </div>
          )}
          <fieldset disabled={busy} className="mt-6 grid min-w-0 gap-5 border-0 p-0 sm:grid-cols-2">
            <div className="space-y-3 sm:col-span-2">
              <Label htmlFor="gear-photo">{photoText("装备图片", "Equipment image")}</Label>
              <GearVisual
                category={draft.category}
                photo={photoPreview || savedPhoto(draft.photo_path)}
              />
              <Input
                id="gear-photo"
                type="file"
                accept={WEB_IMAGE_ACCEPT}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void choosePhoto(file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {photoText(
                  "支持 JPG、PNG、WebP，最大 10MB。浅色纯背景会在本机尝试去除，点击保存后才上传。",
                  "JPG, PNG or WebP up to 10MB. Light solid backgrounds are processed locally; upload happens only when you save.",
                )}
              </p>
              {photoDraft?.status === "removed" && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs">
                    {photoText(
                      "已尝试去除纯色背景，请检查边缘。",
                      "Solid background removed; please check the edges.",
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setPhotoDraft((current) =>
                        current ? { ...current, useCutout: !current.useCutout } : null,
                      )
                    }
                  >
                    {photoDraft.useCutout
                      ? photoText("使用原图", "Use original")
                      : photoText("使用去背景图", "Use cutout")}
                  </Button>
                </div>
              )}
              {photoDraft?.status === "not-simple" && (
                <p role="status" className="text-xs">
                  {photoText(
                    "未识别到可安全去除的浅色纯背景，已保留原图。",
                    "No safe light solid background detected. The original is kept.",
                  )}
                </p>
              )}
              {photoDraft?.status === "already-transparent" && (
                <p role="status" className="text-xs">
                  {photoText("已保留图片原有透明背景。", "Existing transparency is preserved.")}
                </p>
              )}
              {(photoDraft || draft.photo_path) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPhotoDraft(null);
                    set("photo_path", null);
                  }}
                >
                  {photoText("移除图片", "Remove image")}
                </Button>
              )}
              {photoQuery.isError && draft.photo_path && !photoDraft && (
                <p role="alert">
                  {photoText("装备图片暂时无法读取。", "Equipment image unavailable.")}
                  <button type="button" onClick={() => void photoQuery.refetch()}>
                    {photoText("重试", "Retry")}
                  </button>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gear-category">{t("装备类型")}</Label>
              <select
                id="gear-category"
                className="h-10 w-full border border-input bg-background px-3 text-sm"
                value={draft.category}
                onChange={(e) => set("category", e.target.value as GearCategory)}
              >
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gear-brand">{t("品牌")}</Label>
              <Input
                id="gear-brand"
                className="rounded-none"
                value={draft.brand}
                maxLength={80}
                onChange={(e) => set("brand", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gear-model">{t("型号")}</Label>
              <Input
                id="gear-model"
                className="rounded-none"
                value={draft.model}
                maxLength={100}
                onChange={(e) => set("model", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gear-purchased">{t("购入日期")}</Label>
              <Input
                id="gear-purchased"
                className="rounded-none"
                type="date"
                value={draft.purchased_on ?? ""}
                onChange={(e) => set("purchased_on", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gear-service">{t("下次保养日期")}</Label>
              <Input
                id="gear-service"
                className="rounded-none"
                type="date"
                value={draft.next_service_on ?? ""}
                onChange={(e) => set("next_service_on", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gear-count">{t("累计使用次数")}</Label>
              <Input
                id="gear-count"
                className="rounded-none"
                type="number"
                min="0"
                value={draft.dive_count}
                onChange={(e) => set("dive_count", Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="gear-notes">{t("备注")}</Label>
              <Textarea
                id="gear-notes"
                className="rounded-none"
                rows={4}
                value={draft.notes ?? ""}
                maxLength={1000}
                onChange={(e) => set("notes", e.target.value || null)}
              />
            </div>
          </fieldset>
          <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-6">
            <div>
              {selected && (
                <Button
                  disabled={busy || conflict}
                  type="button"
                  variant="ghost"
                  className="rounded-none text-destructive"
                  onClick={() => void remove()}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("删除装备")}
                </Button>
              )}
            </div>
            <Button
              disabled={
                busy ||
                conflict ||
                (!!selectedId && !selected) ||
                !profileState.profile ||
                (!draft.brand.trim() && !draft.model.trim())
              }
              className="rounded-none px-7"
              onClick={() => void save()}
            >
              <Save className="mr-2 h-4 w-4" />
              {busy ? t("保存中…") : t("保存装备")}
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
