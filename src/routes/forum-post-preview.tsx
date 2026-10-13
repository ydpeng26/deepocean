import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CloudOff,
  Compass,
  Droplets,
  Languages,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Thermometer,
  UserRound,
  Waves,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ForumPostMenu } from "@/components/ForumPostMenu";
import { ScubaTankIcon } from "@/components/ScubaTankIcon";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/forum-post-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "论坛帖子详情预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ForumPostPreview,
});

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", forum: "深蓝论坛", profile: "个人资料", offline: "离线草稿与同步",
    preview: "设计预览 · 帖子、评论和数据均为示例内容", back: "返回深蓝论坛", topic: "海洋生物", featured: "FEATURED STORY",
    title: "在冷水里遇见一只慢吞吞的 Mola mola", location: "Crystal Bay · Nusa Penida", date: "2026年8月30日",
    lead: "第一次来到 Crystal Bay，这里的水温冷得超过想象。穿着 5mm 的湿衣依然冻得发抖，但在不到 30 米的位置，我们遇见了一只 Mola mola。",
    body1: "下潜前，Raiyan 再三提醒我们：今天的水温可能只有 21℃。负浮力入水后，蓝色很快把船底的声音收走，只剩下呼吸声和偶尔经过面镜边缘的气泡。",
    body2: "大约二十分钟后，他突然停下来，指向前方。那只 Mola mola 从深蓝里慢慢出现，动作缓慢得近乎笨拙。它没有靠得很近，只是在我们的视线里停留了一会儿，又安静地沉回更深的水里。",
    quote: "寒冷让这一潜变得漫长，但也让那次相遇显得格外清晰。", body3: "回到水面时，我的手指还在发抖。可只要想起它圆圆的身体和有些呆的表情，就觉得这趟旅程已经完全值得。",
    linked: "关联潜水日志", maxDepth: "最大深度", duration: "潜水时长", water: "水温", guide: "潜水向导", readLog: "查看完整潜水日志",
    likes: "喜欢", liked: "已喜欢", replies: "回应", share: "分享", save: "收藏", saved: "已收藏",
    author: "关于分享者", follow: "关注", followed: "已关注", authorBio: "AOW 潜水员。正在缓慢收集海岛、冷水和偶遇的大型海洋生物。",
    site: "关于这个潜点", siteText: "Crystal Bay 以清澈水域、强流和季节性的 Mola mola 邂逅闻名。冷水与复杂水流需要谨慎评估。", moreSite: "查看更多潜点故事",
    related: "继续阅读", related1: "沙丁鱼群遮住阳光的十秒钟", related2: "清晨第一潜，珊瑚刚刚醒来",
    discussion: "潜水员的回应", discussionIntro: "关于这一潜，大家还在聊什么", placeholder: "写下你的回应…", send: "发布回应", sent: "回应已加入预览",
    reply: "回复", footer: "YOUR OCEAN. YOUR STORY.", more: "更多操作", report: "举报帖子", block: "屏蔽该用户", edit: "编辑帖子", delete: "删除帖子", confirmDelete: "确定删除这篇帖子吗？", confirm: "确认删除", cancel: "取消", editPost: "编辑帖子", editPostHint: "修改标题和正文内容", titleLabel: "帖子标题", storyLabel: "正文开头", saveChanges: "保存修改", changesSaved: "修改已保存", deleted: "帖子已删除", deletedHint: "这篇帖子已从论坛预览中移除。", backForum: "返回深蓝论坛",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", forum: "Deep Blue Forum", profile: "Profile", offline: "Offline drafts & sync",
    preview: "Design preview · Posts, replies and data are sample content", back: "Back to the forum", topic: "Marine life", featured: "FEATURED STORY",
    title: "A slow Mola mola in the cold blue", location: "Crystal Bay · Nusa Penida", date: "August 30, 2026",
    lead: "My first Crystal Bay dive was colder than I imagined. Even in a 5mm wetsuit I was shivering, but above 30 metres, we met a Mola mola.",
    body1: "Before the descent, Raiyan warned us the water could be only 21°C. After our negative entry, the blue quickly swallowed the sound of the boat until only breathing and bubbles remained.",
    body2: "About twenty minutes in, he stopped and pointed ahead. The Mola mola emerged slowly from the blue, moving with an almost awkward calm. It stayed just long enough to be remembered, then slipped back into deeper water.",
    quote: "The cold made this dive feel longer, but it also made that encounter impossibly clear.", body3: "My fingers were still shaking at the surface. But remembering its round body and wonderfully blank expression made the entire journey worthwhile.",
    linked: "Linked dive log", maxDepth: "Max depth", duration: "Dive time", water: "Water", guide: "Dive guide", readLog: "View full dive log",
    likes: "likes", liked: "Liked", replies: "responses", share: "Share", save: "Save", saved: "Saved",
    author: "About the diver", follow: "Follow", followed: "Following", authorBio: "AOW diver, slowly collecting islands, cold water and encounters with large marine life.",
    site: "About this site", siteText: "Crystal Bay is known for clear water, strong currents and seasonal Mola mola encounters. Cold water and complex currents require careful planning.", moreSite: "More stories from this site",
    related: "Continue reading", related1: "Ten seconds beneath a sardine sky", related2: "The reef waking on the first dive",
    discussion: "Diver responses", discussionIntro: "What other divers are saying", placeholder: "Write a response…", send: "Post response", sent: "Response added to preview",
    reply: "Reply", footer: "YOUR OCEAN. YOUR STORY.", more: "More actions", report: "Report post", block: "Block this diver", edit: "Edit post", delete: "Delete post", confirmDelete: "Delete this post?", confirm: "Delete", cancel: "Cancel", editPost: "Edit post", editPostHint: "Update the title and opening text", titleLabel: "Post title", storyLabel: "Opening paragraph", saveChanges: "Save changes", changesSaved: "Changes saved", deleted: "Post deleted", deletedHint: "This post has been removed from the forum preview.", backForum: "Back to the forum",
  },
} as const;

function ForumPostPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [liked, setLiked] = useState(true);
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [notice, setNotice] = useState("");
  const [postTitle, setPostTitle] = useState(c.title);
  const [postLead, setPostLead] = useState(c.lead);
  const [draftTitle, setDraftTitle] = useState(c.title);
  const [draftLead, setDraftLead] = useState(c.lead);

  function submitComment() {
    if (!comment.trim()) return;
    setSent(true);
    window.setTimeout(() => { setSent(false); setComment(""); }, 1000);
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function openEditor() {
    window.location.assign("/forum-compose-preview?mode=edit");
  }

  function saveEdit() {
    setPostTitle(draftTitle.trim() || postTitle);
    setPostLead(draftLead.trim() || postLead);
    setEditing(false);
    showNotice(c.changesSaved);
  }

  const menuLabels = { more: c.more, report: c.report, block: c.block, edit: c.edit, delete: c.delete, confirmDelete: c.confirmDelete, confirm: c.confirm, cancel: c.cancel };

  return <div className="do-forum-page do-forum-detail-page">
    <header className="do-passport-header do-forum-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview">{c.passport}</Link><Link to="/logs-preview">{c.logs}</Link><Link to="/forum-preview" aria-current="page">{c.forum}</Link><Link to="/profile-preview">{c.profile}</Link></nav>
      <div className="do-passport-header-actions"><Link to="/offline-sync" className="do-passport-sync-link"><CloudOff aria-hidden="true" /><span>{c.offline}</span></Link><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button></div>
    </header>

    <main className="do-forum-detail-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <Link to="/forum-preview" className="do-forum-detail-back"><ArrowLeft />{c.back}</Link>
      <div className="do-forum-detail-layout">
        {deleted ? <section className="do-forum-detail-removed"><Check /><h1>{c.deleted}</h1><p>{c.deletedHint}</p><Link to="/forum-preview"><ArrowLeft />{c.backForum}</Link></section> : <article className="do-forum-detail-article">
          <header className="do-forum-detail-title">
            <div className="do-forum-detail-tags"><span><Sparkles />{c.featured}</span><em>{c.topic}</em></div>
            <h1>{postTitle}</h1>
            <div className="do-forum-detail-meta"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt="ydpeng7" /><AvatarFallback>Y</AvatarFallback></Avatar><div><strong>ydpeng7</strong><span>AOW · {c.date}</span></div><div><MapPin />{c.location}</div><ForumPostMenu isOwn labels={menuLabels} onEdit={openEditor} onDelete={() => setDeleted(true)} /></div>
          </header>

          <figure className="do-forum-detail-cover"><img src="/images/user-fish-hero-preview.jpg" alt={postTitle} /><figcaption><MapPin />{c.location}</figcaption></figure>

          <div className="do-forum-detail-story">
            <p className="do-forum-detail-lead">{postLead}</p>
            <p>{c.body1}</p>
            <p>{c.body2}</p>
            <blockquote><Waves /><p>{c.quote}</p></blockquote>
            <p>{c.body3}</p>
          </div>

          <section className="do-forum-detail-dive-card" aria-label={c.linked}>
            <div className="do-forum-detail-dive-heading"><div><span>LINKED DIVE · #001</span><h2>{c.linked}</h2><p>Crystal Bay · Nusa Penida · {c.date}</p></div><Waves /></div>
            <div className="do-forum-detail-dive-stats"><span><Compass /><strong>28m</strong><small>{c.maxDepth}</small></span><span><Clock3 /><strong>48min</strong><small>{c.duration}</small></span><span><Thermometer /><strong>21°C</strong><small>{c.water}</small></span><span><UserRound /><strong>Raiyan</strong><small>{c.guide}</small></span></div>
            <Link to="/dive-detail-preview">{c.readLog}<ChevronRight /></Link>
          </section>

          <footer className="do-forum-detail-actions"><div><button type="button" data-active={liked} onClick={() => setLiked((value) => !value)}><ScubaTankIcon />{liked ? 287 : 286}<span>{liked ? c.liked : c.likes}</span></button><button type="button"><MessageCircle />42<span>{c.replies}</span></button></div><div><button type="button"><Share2 />{c.share}</button><button type="button" data-active={saved} onClick={() => setSaved((value) => !value)}><Bookmark />{saved ? c.saved : c.save}</button></div></footer>
        </article>}

        <aside className="do-forum-detail-side">
          <section className="do-forum-detail-author"><span>01 / DIVER</span><div><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt="ydpeng7" /><AvatarFallback>Y</AvatarFallback></Avatar><div><h2>ydpeng7</h2><small>AOW · 18 DIVES</small></div></div><p>{c.authorBio}</p><div className="do-forum-detail-author-stats"><span><strong>1,286</strong>{c.likes}</span><span><strong>246</strong>{language === "zh-CN" ? "粉丝" : "Followers"}</span></div><button type="button" data-active={followed} onClick={() => setFollowed((value) => !value)}>{followed ? c.followed : c.follow}</button></section>
          <section className="do-forum-detail-site"><div className="do-forum-panel-heading"><div><span>02 / DIVE SITE</span><h2>{c.site}</h2></div><MapPin /></div><div className="do-forum-detail-site-photo" /><h3>Crystal Bay</h3><small>NUSA PENIDA · INDONESIA</small><p>{c.siteText}</p><button type="button">{c.moreSite}<ChevronRight /></button></section>
          <section className="do-forum-detail-related"><div className="do-forum-panel-heading"><div><span>03 / MORE STORIES</span><h2>{c.related}</h2></div><Compass /></div><Link to="/forum-post-preview"><img src="/images/user-cave-photo-hero-preview.jpg" alt="" /><span><strong>{c.related1}</strong><small>lanhai_02 · MOALBOAL</small></span></Link><Link to="/forum-post-preview"><img src="/images/supdiver-six-orange-fish-hero.png" alt="" /><span><strong>{c.related2}</strong><small>RAIYAN · TULAMBEN</small></span></Link></section>
        </aside>
      </div>

      {!deleted && <section className="do-forum-detail-discussion">
        <div className="do-forum-detail-discussion-heading"><div><span>04 / CONVERSATION</span><h2>{c.discussion}</h2><p>{c.discussionIntro}</p></div><strong>42</strong></div>
        <div className="do-forum-detail-comment-box"><Avatar><AvatarImage src="/images/user-fish-hero-preview.jpg" alt="ydpeng7" /><AvatarFallback>Y</AvatarFallback></Avatar><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={c.placeholder} /><button type="button" disabled={!comment.trim()} onClick={submitComment}>{sent ? <Droplets /> : <Send />}{sent ? c.sent : c.send}</button></div>
        <div className="do-forum-detail-comments">
          <article><Avatar><AvatarImage src="/images/user-cave-photo-hero-preview.jpg" alt="lanhai_02" /><AvatarFallback>L</AvatarFallback></Avatar><div><header><strong>lanhai_02</strong><span>RESCUE · 2H AGO</span></header><p>{language === "zh-CN" ? "Crystal Bay 的冷水真的会让人怀疑人生，但看到它的那一刻确实什么都忘了。你们当天的流大吗？" : "Crystal Bay's cold water makes you question everything, but seeing one makes it all disappear. How was the current that day?"}</p><button type="button">{c.reply}</button></div></article>
          <article><Avatar><AvatarImage src="/images/supdiver-six-orange-fish-hero.png" alt="Raiyan" /><AvatarFallback>R</AvatarFallback></Avatar><div><header><strong>Raiyan</strong><span>DIVEMASTER · 48MIN AGO</span></header><p>{language === "zh-CN" ? "那天中段的流不算强，不过温跃层非常明显。很高兴你还记得这次相遇。" : "The mid-dive current was manageable, though the thermocline was very clear. Glad this encounter stayed with you."}</p><button type="button">{c.reply}</button></div></article>
        </div>
      </section>}
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>{c.footer}</small></footer>
    {notice && <div className="do-forum-action-notice" role="status"><Check />{notice}</div>}
    {editing && <div className="do-forum-composer-backdrop" role="presentation"><section className="do-forum-composer do-forum-edit-post" role="dialog" aria-modal="true" aria-labelledby="edit-post-title"><header><div><span>EDIT OCEAN STORY</span><h2 id="edit-post-title">{c.editPost}</h2><p>{c.editPostHint}</p></div><button type="button" onClick={() => setEditing(false)} aria-label={c.cancel}><X /></button></header><label><span>{c.titleLabel}</span><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label><label><span>{c.storyLabel}</span><textarea value={draftLead} onChange={(event) => setDraftLead(event.target.value)} /></label><footer><button type="button" onClick={() => setEditing(false)}>{c.cancel}</button><button type="button" disabled={!draftTitle.trim() || !draftLead.trim()} onClick={saveEdit}><Check />{c.saveChanges}</button></footer></section></div>}
  </div>;
}
