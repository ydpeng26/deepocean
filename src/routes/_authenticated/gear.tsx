import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Footprints, Gauge, Glasses, LifeBuoy, Package, Plus, Save, Shirt, Trash2, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createGear, deleteGear, listGear, updateGear, type GearCategory, type GearInput, type GearItem } from "@/lib/gear";

export const Route = createFileRoute("/_authenticated/gear")({
  head: () => ({ meta: [{ title: "我的潜水装备 · SupDiver" }, { name: "description", content: "管理个人潜水装备、使用次数和保养日期。" }] }),
  component: GearPage,
});

const categories: Array<[GearCategory, string]> = [
  ["bcd", "浮力控制装置"], ["regulator", "调节器"], ["computer", "潜水电脑"],
  ["mask", "面镜"], ["fins", "脚蹼"], ["wetsuit", "潜水服"],
  ["camera", "水下相机"], ["other", "其他装备"],
];

const empty: GearInput = { category: "bcd", brand: "", model: "", purchased_on: null, next_service_on: null, serial_number: null, dive_count: 0, notes: null, photo_path: null };

const categoryIcons: Record<GearCategory, LucideIcon> = {
  bcd: LifeBuoy,
  regulator: Gauge,
  computer: Gauge,
  mask: Glasses,
  fins: Footprints,
  wetsuit: Shirt,
  camera: Camera,
  other: Package,
};

function GearVisual({ category, compact = false }: { category: GearCategory; compact?: boolean }) {
  const Icon = categoryIcons[category];
  const label = categories.find(([value]) => value === category)?.[1] ?? "潜水装备";
  return <span className={`grid shrink-0 place-items-center bg-gradient-to-br from-sky-500/20 to-cyan-500/5 text-sky-400 ${compact ? "h-14 w-16" : "h-44 w-full"}`} aria-label={label}><Icon className={compact ? "h-7 w-7" : "h-16 w-16"} strokeWidth={1.35} /></span>;
}

function GearPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isPending } = useQuery({ queryKey: ["gear"], queryFn: listGear });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<GearInput>(empty);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!isCreating && !selectedId && items[0]) setSelectedId(items[0].id);
  }, [isCreating, items, selectedId]);
  useEffect(() => {
    setDraft(selected ? { category: selected.category, brand: selected.brand, model: selected.model, purchased_on: selected.purchased_on, next_service_on: selected.next_service_on, serial_number: selected.serial_number, dive_count: selected.dive_count, notes: selected.notes, photo_path: selected.photo_path } : empty);
  }, [selected]);

  const save = useMutation({
    mutationFn: async () => {
      const creating = !selected;
      const item = creating ? await createGear(draft) : await updateGear(selected.id, draft);
      return { item, creating };
    },
    onSuccess: ({ item, creating }: { item: GearItem; creating: boolean }) => { queryClient.setQueryData<GearItem[]>(["gear"], (current = []) => creating ? [item, ...current] : current.map((x) => x.id === item.id ? item : x)); setIsCreating(false); setSelectedId(item.id); toast.success(creating ? "新装备已添加" : "装备资料已更新"); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteGear(id),
    onSuccess: (_, id) => { queryClient.setQueryData<GearItem[]>(["gear"], (current = []) => current.filter((x) => x.id !== id)); setSelectedId(null); toast.success("装备已删除"); },
  });
  const set = <K extends keyof GearInput>(key: K, value: GearInput[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return <AppShell>
    <Link to="/dives" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" />返回海洋护照</Link>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
      <div><span className="text-xs font-medium tracking-[.24em] text-sky-500">MY DIVE LOCKER</span><h1 className="mt-2 text-4xl font-normal tracking-tight text-primary">我的潜水装备</h1><p className="mt-3 text-sm text-muted-foreground">记录常用装备、使用次数与下一次保养日期。</p></div>
      <Button className="rounded-none" onClick={() => { setIsCreating(true); setSelectedId(null); setDraft(empty); }}><Plus className="mr-2 h-4 w-4" />新增装备</Button>
    </div>
    <div className="mt-10 grid gap-8 md:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        {isPending ? <p className="text-sm text-muted-foreground">正在载入装备…</p> : items.length ? items.map((item) => <button key={item.id} type="button" onClick={() => { setIsCreating(false); setSelectedId(item.id); }} className={`flex w-full items-center gap-3 border p-3 text-left transition ${item.id === selectedId ? "border-sky-500 bg-sky-500/10" : "border-border hover:border-sky-500/50"}`}><GearVisual category={item.category} compact /><span className="min-w-0"><small className="block text-muted-foreground">{categories.find(([value]) => value === item.category)?.[1]}</small><strong className="block truncate">{item.brand || "未填写品牌"} {item.model}</strong></span></button>) : <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">还没有登记装备。点击“新增装备”建立你的第一条装备档案。</div>}
      </aside>
      <section className="border border-border p-6 sm:p-8">
        <div className="flex items-center gap-3 border-b border-border pb-5"><Wrench className="h-5 w-5 text-sky-500" /><div><h2 className="text-xl">{selected ? "编辑装备档案" : "登记新装备"}</h2><p className="text-xs text-muted-foreground">资料只对当前账号显示。</p></div></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-4 border border-border bg-sky-500/5 p-4 sm:grid-cols-[190px_1fr]">
            <GearVisual category={draft.category} />
            <div className="flex flex-col justify-center"><strong>装备类型识别</strong><p className="mt-2 text-xs leading-6 text-muted-foreground">选择装备类型后会自动切换对应图标，不再展示与实际装备不符的固定照片。品牌和型号将用于后续产品目录匹配。</p></div>
          </div>
          <label className="space-y-2"><Label>装备类型</Label><select className="h-10 w-full border border-input bg-background px-3 text-sm" value={draft.category} onChange={(e) => set("category", e.target.value as GearCategory)}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-2"><Label>品牌</Label><Input className="rounded-none" value={draft.brand} maxLength={80} onChange={(e) => set("brand", e.target.value)} /></label>
          <label className="space-y-2"><Label>型号</Label><Input className="rounded-none" value={draft.model} maxLength={100} onChange={(e) => set("model", e.target.value)} /></label>
          <label className="space-y-2"><Label>购入日期</Label><Input className="rounded-none" type="date" value={draft.purchased_on ?? ""} onChange={(e) => set("purchased_on", e.target.value || null)} /></label>
          <label className="space-y-2"><Label>下次保养日期</Label><Input className="rounded-none" type="date" value={draft.next_service_on ?? ""} onChange={(e) => set("next_service_on", e.target.value || null)} /></label>
          <label className="space-y-2"><Label>累计使用次数</Label><Input className="rounded-none" type="number" min="0" value={draft.dive_count} onChange={(e) => set("dive_count", Math.max(0, Number(e.target.value) || 0))} /></label>
          <label className="space-y-2 sm:col-span-2"><Label>备注</Label><Textarea className="rounded-none" rows={4} value={draft.notes ?? ""} maxLength={1000} onChange={(e) => set("notes", e.target.value || null)} /></label>
        </div>
        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-6"><div>{selected && <Button type="button" variant="ghost" className="rounded-none text-destructive" onClick={() => confirm("确定删除这件装备吗？") && remove.mutate(selected.id)}><Trash2 className="mr-2 h-4 w-4" />删除装备</Button>}</div><Button disabled={save.isPending || (!draft.brand.trim() && !draft.model.trim())} className="rounded-none px-7" onClick={() => save.mutate()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "保存中…" : "保存装备"}</Button></div>
      </section>
    </div>
  </AppShell>;
}
