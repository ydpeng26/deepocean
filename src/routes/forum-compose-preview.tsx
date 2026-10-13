import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  CloudOff,
  Compass,
  Eye,
  ImagePlus,
  Italic,
  Languages,
  Link2,
  List,
  MapPin,
  MessageCircle,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Waves,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/i18n/LanguageProvider";

type EditorMode = "create" | "edit";
type Topic = "stories" | "creatures" | "sites" | "stays" | "gear";

export const Route = createFileRoute("/forum-compose-preview")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "edit" ? "edit" as const : "create" as const,
  }),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "帖子发布与编辑预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ForumComposePreview,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", forum: "深蓝论坛", profile: "个人资料", offline: "离线草稿与同步",
    preview: "设计预览 · 发布与保存操作仅在当前预览中演示", back: "返回深蓝论坛", newPost: "发布一段深蓝故事", editPost: "编辑你的深蓝故事",
    newIntro: "将刚刚发生的相遇、一次难忘的下潜，分享给同样热爱海洋的人", editIntro: "重新整理这段记忆，保存后将更新原有帖子内容",
    story: "故事内容", category: "选择内容分类", title: "标题", titlePlaceholder: "为这段海洋故事写一个标题", body: "正文", bodyPlaceholder: "从出水后的第一个念头开始写……",
    photos: "照片", photosHint: "添加最能代表这段故事的照片，第一张将作为封面", upload: "选择照片", uploadHint: "支持 JPG、PNG，预览版最多展示 6 张", cover: "封面",
    diveContext: "潜水信息", diveContextHint: "可选信息，让其他潜水员更了解这次经历", location: "潜点", selectLocation: "选择潜点", log: "关联潜水日志", selectLog: "选择一条潜水日志", noLog: "不关联日志",
    crystal: "Crystal Bay · Nusa Penida", batu: "Batu Bolong · Komodo", moalboal: "Moalboal · Cebu", log001: "#001 · Crystal Bay · 2026年8月30日", log018: "#018 · Batu Bolong · 2026年10月10日",
    settings: "发布设置", comments: "允许回应", commentsHint: "其他潜水员可以在帖子下交流", original: "原创内容", originalHint: "确认文字与照片由你创作或获得授权",
    draft: "保存草稿", publish: "发布帖子", update: "保存修改", saved: "草稿已保存", published: "帖子已发布到预览", updated: "帖子修改已保存",
    live: "帖子预览", emptyTitle: "你的故事标题将显示在这里", emptyBody: "写下正文后，这里会出现内容摘要。", featured: "OCEAN STORY", locationEmpty: "尚未选择潜点", words: "字", author: "ydpeng7", badge: "AOW",
    stories: "深蓝故事", creatures: "海洋生物", sites: "潜点见闻", stays: "酒店推荐", gear: "装备经验", footer: "YOUR OCEAN. YOUR STORY.",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", forum: "Deep Blue Forum", profile: "Profile", offline: "Offline drafts & sync",
    preview: "Design preview · Publish and save actions are demonstrated locally", back: "Back to the forum", newPost: "Publish an ocean story", editPost: "Edit your ocean story",
    newIntro: "Share a fresh encounter or an unforgettable dive with people who love the ocean", editIntro: "Refine this memory and save it back to the original post",
    story: "Story", category: "Choose a category", title: "Title", titlePlaceholder: "Give this ocean story a title", body: "Story", bodyPlaceholder: "Start with the first thought you had at the surface…",
    photos: "Photos", photosHint: "Add the images that best tell the story. The first becomes the cover.", upload: "Choose photos", uploadHint: "JPG or PNG · up to 6 images in this preview", cover: "Cover",
    diveContext: "Dive context", diveContextHint: "Optional details that help other divers understand the experience", location: "Dive site", selectLocation: "Choose a dive site", log: "Linked dive log", selectLog: "Choose a dive log", noLog: "No linked log",
    crystal: "Crystal Bay · Nusa Penida", batu: "Batu Bolong · Komodo", moalboal: "Moalboal · Cebu", log001: "#001 · Crystal Bay · Aug 30, 2026", log018: "#018 · Batu Bolong · Oct 10, 2026",
    settings: "Publish settings", comments: "Allow responses", commentsHint: "Other divers can join the conversation", original: "Original content", originalHint: "You created or have permission to share the words and photos",
    draft: "Save draft", publish: "Publish post", update: "Save changes", saved: "Draft saved", published: "Post published to preview", updated: "Post changes saved",
    live: "Live preview", emptyTitle: "Your story title will appear here", emptyBody: "Start writing to see an excerpt here.", featured: "OCEAN STORY", locationEmpty: "No dive site selected", words: "characters", author: "ydpeng7", badge: "AOW",
    stories: "Ocean story", creatures: "Marine life", sites: "Dive site", stays: "Dive stay", gear: "Gear notes", footer: "YOUR OCEAN. YOUR STORY.",
  },
} as const;

const editContent = {
  "zh-CN": {
    title: "在冷水里遇见一只慢吞吞的 Mola mola",
    body: "第一次来到 Crystal Bay，这里的水温冷得超过想象。穿着 5mm 的湿衣依然冻得发抖，但在不到 30 米的位置，我们遇见了一只 Mola mola。\n\n它从深蓝里慢慢出现，没有靠得很近，只是在我们的视线里停留了一会儿，又安静地沉回更深的水里。",
  },
  en: {
    title: "A slow Mola mola in the cold blue",
    body: "My first Crystal Bay dive was colder than I imagined. Even in a 5mm wetsuit I was shivering, but above 30 metres, we met a Mola mola.\n\nIt emerged slowly from the blue, stayed just long enough to be remembered, then slipped quietly back into deeper water.",
  },
} as const;

function ForumComposePreview() {
  const { mode } = Route.useSearch();
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const editing = mode === "edit";
  const [topic, setTopic] = useState<Topic>(editing ? "creatures" : "stories");
  const [title, setTitle] = useState(editing ? editContent[language].title : "");
  const [body, setBody] = useState(editing ? editContent[language].body : "");
  const [location, setLocation] = useState(editing ? "crystal" : "");
  const [log, setLog] = useState(editing ? "log001" : "");
  const [comments, setComments] = useState(true);
  const [original, setOriginal] = useState(true);
  const [photos, setPhotos] = useState<string[]>(editing ? ["/images/user-fish-hero-preview.jpg"] : []);
  const [status, setStatus] = useState<"" | "draft" | "published">("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ([
    ["stories", c.stories, Sparkles],
    ["creatures", c.creatures, Waves],
    ["sites", c.sites, MapPin],
    ["stays", c.stays, Compass],
    ["gear", c.gear, List],
  ] as const), [c]);

  const locationLabel = location === "crystal" ? c.crystal : location === "batu" ? c.batu : location === "moalboal" ? c.moalboal : c.locationEmpty;
  const topicLabel = categories.find(([value]) => value === topic)?.[1] ?? c.stories;
  const excerpt = body.trim().replace(/\s+/g, " ").slice(0, 120);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).slice(0, Math.max(0, 6 - photos.length)).map((file) => URL.createObjectURL(file));
    setPhotos((items) => [...items, ...next].slice(0, 6));
  }

  function finish(kind: "draft" | "published") {
    setStatus(kind);
    window.setTimeout(() => setStatus(""), 2400);
  }

  return <div className="do-forum-page do-forum-editor-page">
    <header className="do-passport-header do-forum-header do-forum-editor-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview">{c.logs}</Link><Link to="/forum-preview" aria-current="page">{c.forum}</Link><Link to="/profile-preview">{c.profile}</Link></nav>
      <div className="do-passport-header-actions"><Link to="/offline-sync" className="do-passport-sync-link"><CloudOff aria-hidden="true" /><span>{c.offline}</span></Link><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button></div>
    </header>

    <main className="do-forum-editor-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <div className="do-forum-editor-topline"><Link to="/forum-preview"><ArrowLeft />{c.back}</Link><div><span>{editing ? "EDIT OCEAN STORY" : "NEW OCEAN STORY"}</span><strong>{editing ? "02" : "01"}</strong></div></div>
      <section className="do-forum-editor-intro"><div><h1>{editing ? c.editPost : c.newPost}</h1><p>{editing ? c.editIntro : c.newIntro}</p></div></section>

      <div className="do-forum-editor-layout">
        <section className="do-forum-editor-form">
          <article className="do-forum-editor-section">
            <header><div><span>01</span><div><h2>{c.story}</h2><p>{c.category}</p></div></div><Sparkles /></header>
            <div className="do-forum-editor-categories">{categories.map(([value, label, Icon]) => <button type="button" key={value} data-active={topic === value} onClick={() => setTopic(value)}><Icon />{label}</button>)}</div>
            <label className="do-forum-editor-field"><span>{c.title}</span><input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} placeholder={c.titlePlaceholder} /><small>{title.length}/60</small></label>
            <div className="do-forum-editor-story-field"><div className="do-forum-editor-toolbar"><button type="button" aria-label="Bold"><Bold /></button><button type="button" aria-label="Italic"><Italic /></button><button type="button" aria-label="Link"><Link2 /></button><button type="button" aria-label="List"><List /></button><span>{body.length} {c.words}</span></div><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={c.bodyPlaceholder} aria-label={c.body} /></div>
          </article>

          <article className="do-forum-editor-section">
            <header><div><span>02</span><div><h2>{c.photos}</h2><p>{c.photosHint}</p></div></div><ImagePlus /></header>
            <div className="do-forum-editor-photos">
              {photos.map((photo, index) => <div key={photo} className="do-forum-editor-photo"><img src={photo} alt="" />{index === 0 && <span>{c.cover}</span>}<button type="button" aria-label={language === "zh-CN" ? "删除照片" : "Remove photo"} onClick={() => setPhotos((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X /></button></div>)}
              {photos.length < 6 && <button type="button" className="do-forum-editor-upload" onClick={() => fileInput.current?.click()}><Upload /><strong>{c.upload}</strong><small>{c.uploadHint}</small></button>}
              <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png" multiple onChange={(event) => addPhotos(event.target.files)} />
            </div>
          </article>

          <article className="do-forum-editor-section">
            <header><div><span>03</span><div><h2>{c.diveContext}</h2><p>{c.diveContextHint}</p></div></div><Compass /></header>
            <div className="do-forum-editor-context">
              <label><span><MapPin />{c.location}</span><div><select value={location} onChange={(event) => setLocation(event.target.value)}><option value="">{c.selectLocation}</option><option value="crystal">{c.crystal}</option><option value="batu">{c.batu}</option><option value="moalboal">{c.moalboal}</option></select><ChevronDown /></div></label>
              <label><span><Waves />{c.log}</span><div><select value={log} onChange={(event) => setLog(event.target.value)}><option value="">{c.noLog}</option><option value="log001">{c.log001}</option><option value="log018">{c.log018}</option></select><ChevronDown /></div></label>
            </div>
            {log && <div className="do-forum-editor-linked-log"><div><Waves /><span>LINKED DIVE</span></div><strong>{log === "log001" ? c.log001 : c.log018}</strong><small>28m · 48min · 21°C · Raiyan</small></div>}
          </article>
        </section>

        <aside className="do-forum-editor-side">
          <section className="do-forum-editor-preview">
            <header><div><span>LIVE PREVIEW</span><h2>{c.live}</h2></div><Eye /></header>
            <div className="do-forum-editor-preview-author"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt="ydpeng7" /><AvatarFallback>Y</AvatarFallback></Avatar><div><strong>{c.author}</strong><span>{c.badge} · {topicLabel}</span></div></div>
            <div className="do-forum-editor-preview-cover" style={photos[0] ? { backgroundImage: `linear-gradient(180deg, rgba(1,15,31,.03), rgba(1,15,31,.54)), url('${photos[0]}')` } : undefined}><span><MapPin />{locationLabel}</span>{!photos[0] && <ImagePlus />}</div>
            <div className="do-forum-editor-preview-copy"><h3>{title || c.emptyTitle}</h3><p>{excerpt || c.emptyBody}</p></div>
            <footer><span><MessageCircle />{comments ? (language === "zh-CN" ? "开放回应" : "Responses open") : (language === "zh-CN" ? "已关闭回应" : "Responses closed")}</span><em>{topicLabel}</em></footer>
          </section>

          <section className="do-forum-editor-settings">
            <div className="do-forum-editor-settings-title"><span>04 / PUBLISH</span><h2>{c.settings}</h2></div>
            <label><span><MessageCircle /><span><strong>{c.comments}</strong><small>{c.commentsHint}</small></span></span><input type="checkbox" checked={comments} onChange={(event) => setComments(event.target.checked)} /><i /></label>
            <label><span><Check /><span><strong>{c.original}</strong><small>{c.originalHint}</small></span></span><input type="checkbox" checked={original} onChange={(event) => setOriginal(event.target.checked)} /><i /></label>
            <div className="do-forum-editor-actions"><button type="button" onClick={() => finish("draft")}><Save />{c.draft}</button><button type="button" disabled={!title.trim() || !body.trim() || !original} onClick={() => finish("published")}><Send />{editing ? c.update : c.publish}</button></div>
          </section>

          {editing && (confirmDelete ? <div className="do-forum-editor-delete-confirm"><p>{language === "zh-CN" ? "确定删除这篇帖子吗？" : "Delete this post?"}</p><div><button type="button" onClick={() => setConfirmDelete(false)}>{language === "zh-CN" ? "取消" : "Cancel"}</button><Link to="/forum-preview"><Trash2 />{language === "zh-CN" ? "确认删除" : "Delete"}</Link></div></div> : <button type="button" className="do-forum-editor-delete" onClick={() => setConfirmDelete(true)}><Trash2 />{language === "zh-CN" ? "删除这篇帖子" : "Delete this post"}</button>)}
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>{c.footer}</small></footer>
    {status && <div className="do-forum-action-notice" role="status"><Check />{status === "draft" ? c.saved : editing ? c.updated : c.published}</div>}
  </div>;
}
