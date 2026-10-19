import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Fish, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useProfile } from "@/hooks/useProfile";
import { addSuggestion, deleteEncounter, listEncounters, listSuggestions, saveEncounter, shareEncounterToForum, type Encounter } from "@/lib/marine";

export const Route = createFileRoute("/_authenticated/marine")({ head: () => ({ meta: [{ title: "我的海洋生物展览墙 · SupDiver" }] }), component: MarineWall });
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

function MarineWall() {
  const { profile } = useProfile();
  const client = useQueryClient();
  const [help, setHelp] = useState(false);
  const [editor, setEditor] = useState(false);
  const [editing, setEditing] = useState<Encounter | undefined>();
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState("");
  const [needsHelp, setNeedsHelp] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharedPost, setSharedPost] = useState<{ encounterId: string; postId: string } | null>(null);
  const query = useQuery({ queryKey: ["marine", help], queryFn: () => listEncounters(help) });
  const suggestions = useQuery({ queryKey: ["marine-suggestions", selected?.id], queryFn: () => listSuggestions(selected!.id), enabled: Boolean(selected) });
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!editor && !selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) { setEditor(false); setSelected(null); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [editor, selected, busy]);
  const refresh = () => client.invalidateQueries({ queryKey: ["marine"] });
  function openEditor(item?: Encounter) {
    setEditing(item); setFile(null); setName(item?.species_name ?? ""); setDate(item?.encountered_on ?? today()); setLocation(item?.location ?? ""); setNeedsHelp(item?.needs_help ?? false); setSelected(null); setEditor(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if ((!name.trim() && !needsHelp) || !location.trim() || !date) { toast.error("请填写生物名称、相遇时间和地点；不认识时可勾选寻求帮助"); return; }
    setBusy(true);
    try { await saveEncounter({ file, species_name: name, encountered_on: date, location, needs_help: needsHelp }, editing); await refresh(); setEditor(false); toast.success("海洋相遇已保存"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { setBusy(false); }
  }
  return <AppShell><div className="do-marine-wall">
    <Link to="/dives" className="do-marine-back">← 返回海洋护照</Link>
    <header className="do-marine-heading"><div><span>OCEAN ENCOUNTERS</span><h1>海洋生物展览墙</h1><p>收藏每一次与海洋生命相遇的瞬间。</p></div><button onClick={() => openEditor()}><Plus size={17} />记录一次相遇</button></header>
    <div className="do-marine-tabs"><button aria-pressed={!help} onClick={() => setHelp(false)}>我的展览墙</button><button aria-pressed={help} onClick={() => setHelp(true)}>帮助识别</button></div>
    <p className="do-marine-hint">{help ? "看看其他潜水员遇见了谁，分享你的识别建议。" : "个人记录仅自己可见；开启识别求助的记录会向已登录的潜水员展示。"}</p>
    {query.isPending ? <p role="status">正在载入海洋相遇…</p> : query.isError ? <div className="do-marine-empty"><p>暂时无法载入展览墙</p><button onClick={() => query.refetch()}>重新加载</button></div> : !query.data?.length ? <div className="do-marine-empty"><Fish size={44} /><h2>{help ? "暂时没有待识别的相遇" : "你的海洋相遇，值得被收藏"}</h2><p>{help ? "遇到不认识的生物时，可以上传照片并寻求帮助。" : "上传第一张照片，记录生物名称、相遇时间和地点。"}</p><button onClick={() => openEditor()}><Camera size={17} />上传照片</button></div> : <div className="do-marine-grid">{query.data.map(item => <button className="do-marine-card" key={item.id} onClick={() => { setSelected(item); setReply(""); }}><div><img src={item.imageUrl} alt={item.species_name} loading="lazy" />{item.needs_help && <span>寻求识别帮助</span>}</div><h2>{item.species_name}</h2><p><MapPin size={13} />{item.location}</p><small>{item.encountered_on}{help ? ` · ${item.author_name}` : ""}</small></button>)}</div>}
    {editor && <div className="do-marine-overlay"><section role="dialog" aria-modal="true" aria-labelledby="marine-editor-title" className="do-marine-dialog"><button className="do-marine-close" disabled={busy} aria-label="关闭" onClick={() => setEditor(false)}><X /></button><h2 id="marine-editor-title">{editing ? "编辑海洋相遇" : "记录一次海洋相遇"}</h2><form onSubmit={save}>
      {(preview || editing?.imageUrl) && <img className="do-marine-preview" src={preview ?? editing?.imageUrl} alt="相遇照片预览" />}
      <label>相遇照片<input type="file" accept="image/*" required={!editing} onChange={event => setFile(event.target.files?.[0] ?? null)} /><small>请选择自己拍摄或获授权的照片，原图不超过 20MB。</small></label>
      <label>生物名称<input autoFocus value={name} maxLength={120} placeholder={needsHelp ? "不确定可留空，将保存为待识别" : "例如：绿海龟"} required={!needsHelp} onChange={event => setName(event.target.value)} /></label>
      <label>相遇时间<input type="date" required max={today()} value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>相遇地点<input required value={location} maxLength={200} placeholder="例如：Indonesia · Komodo · Batu Bolong" onChange={event => setLocation(event.target.value)} /></label>
      <label className="do-marine-check"><input type="checkbox" checked={needsHelp} onChange={event => setNeedsHelp(event.target.checked)} />寻求其他潜水员帮助识别</label><p className="do-marine-hint">{needsHelp ? "此照片、生物名称、相遇时间、地点和你的显示名称将向已登录用户展示。请避免公开敏感物种的精确位置；你可以随时编辑并关闭求助。" : "此条相遇只会显示在你自己的展览墙。"}</p><button type="submit" disabled={busy}>{busy ? "正在保存…" : "保存相遇"}</button>
    </form></section></div>}
    {selected && <div className="do-marine-overlay"><section role="dialog" aria-modal="true" aria-labelledby="marine-detail-title" className="do-marine-dialog"><button className="do-marine-close" disabled={busy} aria-label="关闭" onClick={() => setSelected(null)}><X /></button><img className="do-marine-preview" src={selected.imageUrl} alt={selected.species_name} /><h2 id="marine-detail-title">{selected.species_name}</h2><p>{selected.location} · {selected.encountered_on}</p><p className="do-marine-hint">记录者：{selected.author_name}{selected.needs_help ? " · 正在寻求识别帮助" : ""}</p>
      {selected.user_id === profile?.id && <div className="do-marine-owner-actions"><button disabled={busy} onClick={() => openEditor(selected)}>编辑名称与记录 / 关闭求助</button><button disabled={busy} onClick={async () => { if (!confirm("删除这次海洋相遇和相关留言？")) return; setBusy(true); try { await deleteEncounter(selected); setSelected(null); await refresh(); } catch { toast.error("删除失败，请重试"); } finally { setBusy(false); } }}>删除记录</button></div>}
      {selected.user_id === profile?.id && <div className="do-marine-share"><p className="do-marine-hint">可将这张照片、生物名称、相遇时间和地点转发至深蓝论坛「生物百科」，请潜水员一起交流识别。论坛帖子独立保留，关闭展览墙求助或删除相遇不会删除已转发的帖子。</p><button disabled={busy} onClick={async () => { if (!confirm("将此照片、生物名称、相遇时间和地点发布至深蓝论坛「生物百科」？论坛成员将能查看和评论。")) return; setBusy(true); try { const postId = await shareEncounterToForum(selected); setSharedPost({ encounterId: selected.id, postId }); await client.invalidateQueries({ queryKey: ["forum-posts"] }); toast.success("已转发至深蓝论坛 · 生物百科"); } catch (error) { toast.error(error instanceof Error ? error.message : "转发失败，请重试"); } finally { setBusy(false); } }}>{busy ? "处理中…" : "转发至深蓝论坛"}</button>{sharedPost?.encounterId === selected.id && <a href={`/forum#post-${sharedPost.postId}`} className="do-marine-back">查看论坛帖子 →</a>}</div>}
      <h3>识别建议</h3><p className="do-marine-hint">建议仅供参考，请结合可信资料核实生物种类。</p>
      {suggestions.isPending ? <p>正在载入建议…</p> : suggestions.isError ? <button onClick={() => suggestions.refetch()}>建议加载失败，点击重试</button> : suggestions.data?.length ? suggestions.data.map(item => <article className="do-marine-suggestion" key={item.id}><strong>{item.author_name}</strong><p>{item.body}</p></article>) : <p className="do-marine-hint">还没有识别建议。</p>}
      {selected.needs_help && <form onSubmit={async event => { event.preventDefault(); if (!reply.trim()) return; setBusy(true); try { await addSuggestion(selected.id, reply); setReply(""); await client.invalidateQueries({ queryKey: ["marine-suggestions", selected.id] }); toast.success("识别建议已发送"); } catch { toast.error("发送失败，请重试"); } finally { setBusy(false); } }}><label>提供识别建议<textarea required value={reply} maxLength={1000} placeholder="你认为是什么生物？可以补充识别特征与依据。" onChange={event => setReply(event.target.value)} /></label><button disabled={busy || !reply.trim()} type="submit">{busy ? "发送中…" : "发送建议"}</button></form>}
    </section></div>}
  </div></AppShell>;
}
