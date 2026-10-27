import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Download, Share2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { memberSessionGate } from "@/lib/authenticated-session";
import { requireDiveOwner, type Dive } from "@/lib/dives";
import {
  cardPhotoPaths,
  loadCardDive,
  loadCardPhoto,
  loadCardSignature,
} from "@/lib/share-card-data";
import { cardText, defaultCardOptions, renderShareCard, type CardOptions } from "@/lib/share-card";

export const Route = createFileRoute("/_authenticated/share-card")({
  validateSearch: (search: Record<string, unknown>): { dive?: string } => ({
    dive: typeof search.dive === "string" ? search.dive : undefined,
  }),
  head: () => ({
    meta: [{ title: "分享纪念卡 · SupDiver" }, { name: "robots", content: "noindex" }],
  }),
  component: ShareCardPage,
});

function ShareCardPage() {
  const { user } = Route.useRouteContext();
  const { dive: id } = Route.useSearch();
  const { language } = useLanguage();
  // Changing record/account remounts all private state and revokes its object URLs.
  return (
    <CardEditor key={`${user.id}:${id ?? ""}`} id={id} owner={user.id} en={language === "en"} />
  );
}

function CardEditor({ id, owner, en }: { id?: string; owner: string; en: boolean }) {
  const [dive, setDive] = useState<Dive | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [options, setOptions] = useState<CardOptions>({ ...defaultCardOptions });
  const [path, setPath] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [artifact, setArtifact] = useState<{
    file: File;
    url: string;
    stamp: string;
    epoch: number;
  } | null>(null);
  const alive = useRef(true),
    lock = useRef(false),
    urlRef = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const stamp = JSON.stringify({ id, owner, options, path, note, en });
  const stampRef = useRef(stamp);
  stampRef.current = stamp;
  const text = (zh: string, english: string) => (en ? english : zh);
  const clear = () => {
    controller.current?.abort();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setArtifact(null);
    setMessage("");
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoadError(false);
    setDive(null);
    void loadCardDive(id, owner).then(
      (value) => {
        if (!active) return;
        setDive(value);
        setPath(cardPhotoPaths(value)[0] ?? "");
        setNote(cardText(value.notes));
      },
      () => {
        if (active) setLoadError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [id, owner, attempt]);
  useEffect(() => {
    clear();
  }, [en]); // Export cannot retain another language's preview.

  async function generate() {
    if (lock.current || !id || !dive) return;
    lock.current = true;
    clear();
    setBusy(true);
    const startedStamp = stamp,
      epoch = memberSessionGate.getSnapshot().epoch;
    const abort = new AbortController();
    controller.current = abort;
    const deadline = setTimeout(() => abort.abort(), 30000);
    try {
      await requireDiveOwner(owner);
      const source = path
        ? await loadCardPhoto(id, owner, path, abort.signal)
        : { dive: await loadCardDive(id, owner, abort.signal), photo: null };
      const signature = options.signature ? await loadCardSignature(owner, abort.signal) : "";
      const file = await renderShareCard(
        source.photo,
        source.dive,
        options,
        note,
        signature,
        en,
        abort.signal,
      );
      await requireDiveOwner(owner);
      const session = memberSessionGate.getSnapshot();
      if (
        !alive.current ||
        abort.signal.aborted ||
        stampRef.current !== startedStamp ||
        session.status !== "ready" ||
        session.ownerId !== owner ||
        session.epoch !== epoch
      )
        return;
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      setArtifact({ file, url, stamp: startedStamp, epoch });
    } catch {
      if (alive.current && stampRef.current === startedStamp)
        setMessage(
          text(
            "纪念卡生成失败，请检查网络或重新选择照片后重试。",
            "Couldn't create the card. Check your connection or select another photo and retry.",
          ),
        );
    } finally {
      clearTimeout(deadline);
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function verifiedArtifact() {
    const session = memberSessionGate.getSnapshot();
    if (
      !artifact ||
      artifact.stamp !== stamp ||
      session.status !== "ready" ||
      session.ownerId !== owner ||
      session.epoch !== artifact.epoch
    ) {
      clear();
      setMessage(text("预览已失效，请重新生成。", "Preview expired. Please generate it again."));
      return null;
    }
    return artifact;
  }
  function download() {
    if (lock.current) return;
    const current = verifiedArtifact();
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = current.file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setMessage(
      text(
        "已请求保存图片，请查看浏览器下载或保存提示。",
        "Image save requested. Check your browser's download or save prompt.",
      ),
    );
  }
  async function share() {
    if (lock.current) return;
    const current = verifiedArtifact();
    if (!current) return;
    if (!navigator.canShare?.({ files: [current.file] }) || !navigator.share) {
      setMessage(
        text(
          "此浏览器不支持图片分享，请先保存图片再分享。",
          "Image sharing isn't supported here. Save the image and share it from your device.",
        ),
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      // Invoke directly in the click activation; only the reviewed file leaves this page.
      await navigator.share({ files: [current.file], title: "SupDiver" });
      if (alive.current)
        setMessage(
          text(
            "已交给系统分享，请以系统或目标应用的结果为准。",
            "Passed to system sharing. Check the target app for delivery.",
          ),
        );
    } catch (error) {
      if (alive.current)
        setMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? text("已取消分享，图片仍可保存。", "Sharing cancelled. You can still save the image.")
            : text(
                "未能打开分享，请先保存图片再分享。",
                "Couldn't open sharing. Save the image to share it instead.",
              ),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const change = (next: CardOptions) => {
    clear();
    setOptions(next);
  };
  const ready = artifact?.stamp === stamp ? artifact : null;
  return (
    <main className="do-card-editor-page do-real-card">
      <div className="do-card-editor-main">
        <aside className="do-card-editor-controls">
          {id ? (
            <Link to="/dives/$id" params={{ id }} className="do-card-editor-back">
              <ArrowLeft />
              {text("返回潜水详情", "Back to dive")}
            </Link>
          ) : (
            <Link to="/dives/logs">{text("选择潜水日志", "Choose a dive log")}</Link>
          )}
          <div className="do-card-editor-intro">
            <span>SHARE YOUR OCEAN</span>
            <h1>{text("制作纪念卡", "Create a keepsake")}</h1>
            <p>{text("把这一潜，带回海面之上", "Bring this dive back to the surface")}</p>
          </div>
          {!id ? (
            <p>
              {text(
                "请先打开一篇潜水日志，点击“制作纪念卡”。",
                "Open a dive log and choose Create a keepsake.",
              )}
            </p>
          ) : loadError ? (
            <div role="alert">
              <p>
                {text(
                  "无法读取这篇日志，可能已删除或无权访问。",
                  "This dive couldn't be loaded. It may be deleted or inaccessible.",
                )}
              </p>
              <button type="button" onClick={() => setAttempt((x) => x + 1)}>
                {text("重试", "Retry")}
              </button>
            </div>
          ) : !dive ? (
            <p role="status">{text("正在读取日志…", "Loading dive…")}</p>
          ) : (
            <>
              <fieldset disabled={busy}>
                <legend className="sr-only">{text("纪念卡选项", "Card options")}</legend>
                <section className="do-card-control-section">
                  <div className="do-card-control-title">
                    <Camera />
                    <h2>{text("选择日志照片", "Choose a dive photo")}</h2>
                  </div>
                  <select
                    aria-label={text("选择日志照片", "Choose a dive photo")}
                    value={path}
                    onChange={(e) => {
                      clear();
                      setPath(e.target.value);
                    }}
                  >
                    <option value="">
                      {text("纯色海洋背景（不使用照片）", "Ocean background (no photo)")}
                    </option>
                    {cardPhotoPaths(dive).map((p, i) => (
                      <option key={p} value={p}>
                        {text("日志照片", "Dive photo")} {i + 1}
                      </option>
                    ))}
                  </select>
                  <p className="do-card-hint">
                    {text(
                      "仅使用该日志内的 JPG、PNG、WebP 照片；视频不参与生成。",
                      "Only JPG, PNG and WebP photos from this dive are used; videos are excluded.",
                    )}
                  </p>
                </section>
                <section className="do-card-control-section">
                  <h2>{text("照片位置", "Photo position")}</h2>
                  <div className="do-card-position-options">
                    {(["left", "center", "right"] as const).map((p, i) => (
                      <button
                        key={p}
                        type="button"
                        disabled={!path}
                        aria-pressed={options.position === p}
                        data-active={options.position === p}
                        onClick={() => change({ ...options, position: p })}
                      >
                        {(en ? ["Left", "Center", "Right"] : ["偏左", "居中", "偏右"])[i]}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="do-card-control-section">
                  <h2>{text("展示内容", "Visible details")}</h2>
                  <div className="do-card-display-options">
                    {(["location", "date", "data", "note", "signature"] as const).map((key, i) => (
                      <label key={key}>
                        <span>
                          {
                            (en
                              ? [
                                  "Location & site",
                                  "Date",
                                  "Dive data",
                                  "Story excerpt",
                                  "Diver name",
                                ]
                              : ["地点与潜点名称", "日期", "潜水数据", "随笔摘录", "用户署名"])[i]
                          }
                        </span>
                        <input
                          type="checkbox"
                          checked={options[key]}
                          onChange={() => change({ ...options, [key]: !options[key] })}
                        />
                        <i />
                      </label>
                    ))}
                  </div>
                  {options.note && (
                    <label className="do-card-note-label">
                      {text(
                        "摘录（仅用于图片，不修改日志）",
                        "Excerpt (image only; does not edit your log)",
                      )}
                      <textarea
                        maxLength={160}
                        value={note}
                        onChange={(e) => {
                          clear();
                          setNote(e.target.value);
                        }}
                        rows={4}
                      />
                    </label>
                  )}
                </section>
                <button type="button" className="do-card-generate" onClick={() => void generate()}>
                  {busy
                    ? text("处理中…", "Working…")
                    : text("生成 / 更新预览", "Generate / update preview")}
                </button>
              </fieldset>
              <p className="do-card-hint">
                {text(
                  "图片在当前浏览器生成，不会发布日志。请确认照片和文字没有不想公开的信息，再保存或分享。下载后的图片不会随日志删除。",
                  "Generated in this browser, without publishing your log. Review the photo and text for private information before saving or sharing. Downloaded images aren't removed when a log is deleted.",
                )}
              </p>
            </>
          )}
        </aside>
        <section className="do-card-stage" aria-label={text("纪念卡预览", "Card preview")}>
          {ready ? (
            <img
              className="do-card-output"
              src={ready.url}
              alt={text(
                "纪念卡成品预览，保存与分享使用此图片",
                "Final keepsake preview; this exact image is saved and shared",
              )}
            />
          ) : (
            <div className="do-card-empty">
              <Camera />
              <p>
                {busy
                  ? text("正在生成纪念卡…", "Creating your keepsake…")
                  : text("选择内容并生成预览", "Choose your details and generate a preview")}
              </p>
              <small>1080 × 1350 · PNG · 4:5</small>
            </div>
          )}
          <div className="do-card-stage-actions">
            <button type="button" disabled={!ready || busy} onClick={download}>
              <Download />
              {text("保存图片", "Save image")}
            </button>
            <button type="button" disabled={!ready || busy} onClick={() => void share()}>
              <Share2 />
              {text("分享图片", "Share image")}
            </button>
          </div>
          <p role="status" aria-live="polite" className="do-card-message">
            {message}
          </p>
        </section>
      </div>
    </main>
  );
}
