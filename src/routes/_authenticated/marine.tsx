import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Fish, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useProfile } from "@/hooks/useProfile";
import { useModalFocus } from "@/hooks/useModalFocus";
import { useLiveCopy } from "@/i18n/liveCopy";
import {
  addSuggestion,
  deleteEncounter,
  listEncounters,
  listSuggestions,
  saveEncounter,
  shareEncounterToForum,
  EncounterConflictError,
  type Encounter,
} from "@/lib/marine";

export const Route = createFileRoute("/_authenticated/marine")({
  head: () => ({ meta: [{ title: "我的海洋生物展览墙 · SupDiver" }] }),
  component: MarineWall,
});
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function MarineWall() {
  const t = useLiveCopy("我的海洋生物展览墙 · SupDiver");
  const { profile } = useProfile();
  const client = useQueryClient();
  const [help, setHelp] = useState(false);
  const [editor, setEditor] = useState(false);
  const [editing, setEditing] = useState<Encounter | undefined>();
  const [conflict, setConflict] = useState(false);
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState("");
  const [needsHelp, setNeedsHelp] = useState(false);
  const [reply, setReply] = useState("");
  const replyDrafts = useRef<Record<string, { body: string; requestId: string }>>({});
  const currentOwner = useRef(profile?.id);
  currentOwner.current = profile?.id;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false),
    alive = useRef(true),
    requestId = useRef<string>(crypto.randomUUID());
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [sharedPost, setSharedPost] = useState<{ encounterId: string; postId: string } | null>(
    null,
  );
  const query = useQuery({ queryKey: ["marine", help], queryFn: () => listEncounters(help) });
  const suggestions = useQuery({
    queryKey: ["marine-suggestions", selected?.id],
    queryFn: () => listSuggestions(selected!.id),
    enabled: Boolean(selected),
  });
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const dialogRef = useRef<HTMLElement>(null);
  useModalFocus(
    dialogRef,
    editor || !!selected,
    () => {
      setEditor(false);
      setSelected(null);
    },
    () => !lock.current && !busy,
    editor ? "editor" : selected?.id,
  );
  const refresh = () =>
    alive.current ? client.invalidateQueries({ queryKey: ["marine"] }) : Promise.resolve();
  const isCurrentOwner = (owner: string) => alive.current && currentOwner.current === owner;
  function beginAction() {
    if (lock.current || !profile) return null;
    lock.current = true;
    setBusy(true);
    return profile.id;
  }
  function finishAction() {
    lock.current = false;
    if (alive.current) setBusy(false);
  }
  function openEditor(item?: Encounter) {
    if (lock.current) return;
    setConflict(false);
    requestId.current = item?.id ?? crypto.randomUUID();
    setEditing(item);
    setFile(null);
    setName(item?.species_name ?? "");
    setDate(item?.encountered_on ?? today());
    setLocation(item?.location ?? "");
    setNeedsHelp(item?.needs_help ?? false);
    setSelected(null);
    setEditor(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || conflict || !profile) return;
    if ((!name.trim() && !needsHelp) || !location.trim() || !date) {
      toast.error(t("请填写生物名称、相遇时间和地点；不认识时可勾选寻求帮助"));
      return;
    }
    lock.current = true;
    setBusy(true);
    const snapshot = {
      file,
      species_name: name,
      encountered_on: date,
      location,
      needs_help: needsHelp,
    };
    try {
      await saveEncounter(snapshot, editing, requestId.current, profile.id);
      if (!alive.current) return;
      await refresh();
      if (!alive.current) return;
      setEditor(false);
      setFile(null);
      toast.success(t("海洋相遇已保存"));
    } catch (error) {
      if (alive.current && error instanceof EncounterConflictError) setConflict(true);
      if (alive.current)
        toast.error(
          (error instanceof Error ? t(error.message) + "; " : "") +
            t("保存未确认，内容与照片已保留，请重试"),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <AppShell>
      <div className="do-marine-wall">
        <Link to="/dives" className="do-marine-back">
          {t("← 返回海洋护照")}
        </Link>
        <header className="do-marine-heading">
          <div>
            <span>OCEAN ENCOUNTERS</span>
            <h1>{t("海洋生物展览墙")}</h1>
            <p>{t("收藏每一次与海洋生命相遇的瞬间。")}</p>
          </div>
          <button disabled={busy} onClick={() => openEditor()}>
            <Plus size={17} />
            {t("记录一次相遇")}
          </button>
        </header>
        <div className="do-marine-tabs">
          <button
            type="button"
            disabled={busy || query.isFetching}
            onClick={() => {
              if (!lock.current) void query.refetch();
            }}
          >
            {t("重新加载相遇记录")}
          </button>
          <button disabled={busy} aria-pressed={!help} onClick={() => setHelp(false)}>
            {t("我的展览墙")}
          </button>
          <button disabled={busy} aria-pressed={help} onClick={() => setHelp(true)}>
            {t("帮助识别")}
          </button>
        </div>
        <p className="do-marine-hint">
          {help
            ? t("看看其他潜水员遇见了谁，分享你的识别建议。")
            : t("个人记录仅自己可见；开启识别求助的记录会向已登录的潜水员展示。")}
        </p>
        {query.isPending ? (
          <p role="status">{t("正在载入海洋相遇…")}</p>
        ) : query.isError ? (
          <div className="do-marine-empty">
            <p>{t("暂时无法载入展览墙")}</p>
            <button onClick={() => query.refetch()}>{t("重新加载")}</button>
          </div>
        ) : !query.data?.length ? (
          <div className="do-marine-empty">
            <Fish size={44} />
            <h2>{help ? t("暂时没有待识别的相遇") : t("你的海洋相遇，值得被收藏")}</h2>
            <p>
              {help
                ? t("遇到不认识的生物时，可以上传照片并寻求帮助。")
                : t("上传第一张照片，记录生物名称、相遇时间和地点。")}
            </p>
            <button onClick={() => openEditor()}>
              <Camera size={17} />
              {t("上传照片")}
            </button>
          </div>
        ) : (
          <div className="do-marine-grid">
            {query.data.map((item) => (
              <button
                className="do-marine-card"
                disabled={busy}
                key={item.id}
                onClick={() => {
                  if (lock.current || !profile) return;
                  setSelected(item);
                  const key = `${profile.id}:${item.id}`;
                  replyDrafts.current[key] ??= { body: "", requestId: crypto.randomUUID() };
                  setReply(replyDrafts.current[key].body);
                }}
              >
                <div>
                  <img src={item.imageUrl} alt={item.species_name} loading="lazy" />
                  {item.needs_help && <span>{t("寻求识别帮助")}</span>}
                </div>
                <h2>{item.species_name}</h2>
                <p>
                  <MapPin size={13} />
                  {item.location}
                </p>
                <small>
                  {item.encountered_on}
                  {help ? ` · ${item.author_name}` : ""}
                </small>
              </button>
            ))}
          </div>
        )}
        {editor && (
          <div className="do-marine-overlay">
            <section
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="marine-editor-title"
              className="do-marine-dialog"
            >
              <button
                className="do-marine-close"
                disabled={busy}
                aria-label={t("关闭")}
                onClick={() => setEditor(false)}
              >
                <X />
              </button>
              <h2 id="marine-editor-title">
                {editing ? t("编辑海洋相遇") : t("记录一次海洋相遇")}
              </h2>
              <form onSubmit={save}>
                {conflict && (
                  <p role="alert">
                    {t(
                      "相遇记录已在其他页面修改或删除。当前输入与照片已保留，请复制需要的内容后关闭编辑框，重新加载并打开最新记录。",
                    )}
                  </p>
                )}
                <fieldset disabled={busy} className="do-marine-save-fields">
                  {(preview || editing?.imageUrl) && (
                    <img
                      className="do-marine-preview"
                      src={preview ?? editing?.imageUrl}
                      alt={t("相遇照片预览")}
                    />
                  )}
                  <div className="do-marine-photo-upload">
                    <span>{t("相遇照片")}</span>
                    <input
                      ref={photoInput}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const chosen = event.target.files?.[0];
                        if (chosen && !lock.current) setFile(chosen);
                        event.target.value = "";
                      }}
                    />
                    <button type="button" onClick={() => photoInput.current?.click()}>
                      <Camera size={18} />
                      {file || editing ? t("更换照片") : t("上传照片")}
                    </button>
                    <small>
                      {file
                        ? file.name
                        : editing
                          ? t("已保存相遇照片，可点击按钮更换")
                          : t("尚未上传照片")}
                    </small>
                    <small>{t("请选择自己拍摄或获授权的照片，原图不超过 20MB。")}</small>
                  </div>
                  <label>
                    {t("生物名称")}
                    <input
                      data-modal-initial-focus
                      value={name}
                      maxLength={120}
                      placeholder={
                        needsHelp ? t("不确定可留空，将保存为待识别") : t("例如：绿海龟")
                      }
                      required={!needsHelp}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label>
                    {t("相遇时间")}
                    <input
                      type="date"
                      required
                      max={today()}
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </label>
                  <label>
                    {t("相遇地点")}
                    <input
                      required
                      value={location}
                      maxLength={200}
                      placeholder={t("例如：Indonesia · Komodo · Batu Bolong")}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </label>
                  <label className="do-marine-check">
                    <input
                      type="checkbox"
                      checked={needsHelp}
                      onChange={(event) => setNeedsHelp(event.target.checked)}
                    />
                    {t("寻求其他潜水员帮助识别")}
                  </label>
                  <p className="do-marine-hint">
                    {needsHelp
                      ? t(
                          "此照片、生物名称、相遇时间、地点和你的显示名称将向已登录用户展示。请避免公开敏感物种的精确位置；你可以随时编辑并关闭求助。",
                        )
                      : t("此条相遇只会显示在你自己的展览墙。")}
                  </p>
                  <button type="submit" disabled={busy || conflict || !profile}>
                    {busy ? t("正在保存…") : t("保存相遇")}
                  </button>
                </fieldset>
              </form>
            </section>
          </div>
        )}
        {selected && (
          <div className="do-marine-overlay">
            <section
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="marine-detail-title"
              className="do-marine-dialog"
            >
              <button
                className="do-marine-close"
                disabled={busy}
                aria-label={t("关闭")}
                onClick={() => {
                  if (!lock.current) setSelected(null);
                }}
              >
                <X />
              </button>
              <img
                className="do-marine-preview"
                src={selected.imageUrl}
                alt={selected.species_name}
              />
              <h2 id="marine-detail-title">{selected.species_name}</h2>
              <p>
                {selected.location} · {selected.encountered_on}
              </p>
              <p className="do-marine-hint">
                {t("记录者：")}
                {selected.author_name}
                {selected.needs_help ? t(" · 正在寻求识别帮助") : ""}
              </p>
              {selected.user_id === profile?.id && (
                <div className="do-marine-owner-actions">
                  <button disabled={busy} onClick={() => openEditor(selected)}>
                    {t("编辑名称与记录 / 关闭求助")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (lock.current) return;
                      if (!confirm(t("删除这次海洋相遇和相关留言？"))) return;
                      const owner = beginAction();
                      if (!owner) return;
                      try {
                        await deleteEncounter(selected);
                        if (!isCurrentOwner(owner)) return;
                        setSelected(null);
                        await refresh();
                      } catch (error) {
                        if (isCurrentOwner(owner))
                          toast.error(
                            error instanceof EncounterConflictError
                              ? error.message
                              : t("删除失败，请重试"),
                          );
                      } finally {
                        finishAction();
                      }
                    }}
                  >
                    {t("删除记录")}
                  </button>
                </div>
              )}
              {selected.user_id === profile?.id && (
                <div className="do-marine-share">
                  <p className="do-marine-hint">
                    {t(
                      "可将这张照片、生物名称、相遇时间和地点转发至深蓝论坛「生物百科」，请潜水员一起交流识别。论坛帖子独立保留，关闭展览墙求助或删除相遇不会删除已转发的帖子。",
                    )}
                  </p>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (lock.current) return;
                      if (
                        !confirm(
                          t(
                            "将此照片、生物名称、相遇时间和地点发布至深蓝论坛「生物百科」？论坛成员将能查看和评论。",
                          ),
                        )
                      )
                        return;
                      const owner = beginAction();
                      if (!owner) return;
                      try {
                        const postId = await shareEncounterToForum(selected, owner);
                        if (!isCurrentOwner(owner)) return;
                        setSharedPost({ encounterId: selected.id, postId });
                        await client.invalidateQueries({ queryKey: ["forum-posts"] });
                        if (isCurrentOwner(owner)) toast.success(t("已转发至深蓝论坛 · 生物百科"));
                      } catch (error) {
                        if (isCurrentOwner(owner))
                          toast.error(
                            error instanceof Error ? t(error.message) : t("转发失败，请重试"),
                          );
                      } finally {
                        finishAction();
                      }
                    }}
                  >
                    {busy ? t("处理中…") : t("转发至深蓝论坛")}
                  </button>
                  {sharedPost?.encounterId === selected.id && (
                    <a href={`/forum#post-${sharedPost.postId}`} className="do-marine-back">
                      {t("查看论坛帖子 →")}
                    </a>
                  )}
                </div>
              )}
              <h3>{t("识别建议")}</h3>
              <p className="do-marine-hint">{t("建议仅供参考，请结合可信资料核实生物种类。")}</p>
              {suggestions.isPending ? (
                <p>{t("正在载入建议…")}</p>
              ) : suggestions.isError ? (
                <button onClick={() => suggestions.refetch()}>{t("建议加载失败，点击重试")}</button>
              ) : suggestions.data?.length ? (
                suggestions.data.map((item) => (
                  <article className="do-marine-suggestion" key={item.id}>
                    <strong>{item.author_name}</strong>
                    <p>{item.body}</p>
                  </article>
                ))
              ) : (
                <p className="do-marine-hint">{t("还没有识别建议。")}</p>
              )}
              {selected.needs_help && (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!reply.trim()) return;
                    const owner = beginAction();
                    if (!owner) return;
                    const key = `${owner}:${selected.id}`;
                    const snapshot = replyDrafts.current[key] ?? {
                      body: reply,
                      requestId: crypto.randomUUID(),
                    };
                    replyDrafts.current[key] = snapshot;
                    try {
                      await addSuggestion(selected.id, snapshot.body, snapshot.requestId, owner);
                      if (!isCurrentOwner(owner)) return;
                      await client.invalidateQueries({
                        queryKey: ["marine-suggestions", selected.id],
                      });
                      if (!isCurrentOwner(owner)) return;
                      if (replyDrafts.current[key] === snapshot) {
                        replyDrafts.current[key] = { body: "", requestId: crypto.randomUUID() };
                        setReply("");
                      }
                      toast.success(t("识别建议已发送"));
                    } catch {
                      if (isCurrentOwner(owner))
                        toast.error(t("发送未确认，建议已保留，请重试或重新载入核对"));
                    } finally {
                      finishAction();
                    }
                  }}
                >
                  <label>
                    {t("提供识别建议")}
                    <textarea
                      required
                      disabled={busy}
                      value={reply}
                      maxLength={1000}
                      placeholder={t("你认为是什么生物？可以补充识别特征与依据。")}
                      onChange={(event) => {
                        if (lock.current || !profile) return;
                        const key = `${profile.id}:${selected.id}`;
                        const previous = replyDrafts.current[key];
                        replyDrafts.current[key] = {
                          body: event.target.value,
                          requestId: previous?.requestId ?? crypto.randomUUID(),
                        };
                        setReply(event.target.value);
                      }}
                    />
                  </label>
                  <button disabled={busy || !reply.trim()} type="submit">
                    {busy ? t("发送中…") : t("发送建议")}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
