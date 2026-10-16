import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Bookmark,
  BedDouble,
  Check,
  ChevronRight,
  CloudOff,
  Compass,
  Fish,
  Flame,
  ImagePlus,
  Languages,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Waves,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ForumPostMenu } from "@/components/ForumPostMenu";
import { ScubaTankIcon } from "@/components/ScubaTankIcon";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/forum-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "深蓝论坛预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <ForumPage preview />,
});

type Post = {
  id: string;
  author: string;
  badge: string;
  avatar: string;
  image: string;
  location: string;
  date: string;
  titleZh: string;
  titleEn: string;
  textZh: string;
  textEn: string;
  topic: "stories" | "creatures" | "sites" | "gear" | "stays";
  likes: number;
  comments: number;
  ratio: "wide" | "portrait" | "standard";
};

const posts: Post[] = [
  { id: "mola", author: "ydpeng7", badge: "AOW", avatar: "/images/user-fish-hero-preview.jpg", image: "/images/user-fish-hero-preview.jpg", location: "Crystal Bay · Nusa Penida", date: "2026.08.30", titleZh: "在冷水里遇见一只慢吞吞的 Mola mola", titleEn: "A slow Mola mola in the cold blue", textZh: "第一次来到 Crystal Bay，冷得发抖，却在不到 30 米的位置遇见了它。那一刻，所有寒冷都值得了。", textEn: "My first Crystal Bay dive was freezing, but a Mola mola appeared above 30 metres. Every shiver was worth it.", topic: "creatures", likes: 286, comments: 42, ratio: "wide" },
  { id: "sardines", author: "lanhai_02", badge: "RESCUE", avatar: "/images/user-cave-photo-hero-preview.jpg", image: "/images/user-cave-photo-hero-preview.jpg", location: "Moalboal · Cebu", date: "2026.10.08", titleZh: "沙丁鱼群遮住阳光的十秒钟", titleEn: "Ten seconds beneath a sardine sky", textZh: "鱼群突然转向，阳光从缝隙里落下来，像一场只属于海里的雨。", textEn: "The school turned all at once and sunlight fell through the gaps like underwater rain.", topic: "stories", likes: 194, comments: 28, ratio: "portrait" },
  { id: "reef", author: "Raiyan", badge: "DIVEMASTER", avatar: "/images/supdiver-six-orange-fish-hero.png", image: "/images/supdiver-six-orange-fish-hero.png", location: "Tulamben · Bali", date: "2026.10.10", titleZh: "清晨第一潜，珊瑚刚刚醒来", titleEn: "The reef waking on the first dive", textZh: "没有追逐大东西，只是慢慢看着礁石上的颜色在晨光里一点点回来。", textEn: "No chase for big animals—just watching the reef colours return with the morning light.", topic: "sites", likes: 138, comments: 17, ratio: "standard" },
  { id: "gear", author: "bubblecheck", badge: "INSTRUCTOR", avatar: "/images/supdiver-diver-equipment-v2.png", image: "/images/supdiver-diver-equipment-v2.png", location: "潜水装备 · 经验分享", date: "2026.10.11", titleZh: "出发前，我一定会再确认的五件事", titleEn: "Five checks before every departure", textZh: "从备用面镜到 BCD 充排气，这份清单已经帮我避免过好几次狼狈。", textEn: "From a spare mask to the BCD inflator, this checklist has saved more than one dive day.", topic: "gear", likes: 96, comments: 31, ratio: "standard" },
  { id: "stay", author: "islandpause", badge: "AOW", avatar: "/images/user-cave-photo-hero-preview.jpg", image: "/images/user-cave-photo-hero-preview.jpg", location: "Nusa Penida · 潜水住宿", date: "2026.10.12", titleZh: "离码头五分钟，这间潜水旅店值得再住一次", titleEn: "A dive stay worth returning to", textZh: "晾装备的空间、清晨出海的距离和夜里是否安静，都是潜水旅行里真正影响体验的小事。", textEn: "Gear-drying space, distance to the morning boat and a quiet night can shape an entire dive trip.", topic: "stays", likes: 83, comments: 19, ratio: "standard" },
  { id: "blue", author: "deepcurrent", badge: "AOW", avatar: "/images/deepocean-hero.png", image: "/images/deepocean-hero.png", location: "Batu Bolong · Komodo", date: "2026.10.12", titleZh: "顺着流，遇见一整片蓝", titleEn: "Following the current into blue", textZh: "有些潜水不需要太多语言，回想起来，只记得水流、呼吸和无限延伸的蓝。", textEn: "Some dives need few words. I only remember the current, my breathing and blue without end.", topic: "stories", likes: 221, comments: 36, ratio: "wide" },
];

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", profile: "个人资料", forum: "深蓝论坛", offline: "离线草稿与同步",
    eyebrow: "THE DEEP BLUE COMMUNITY", title: "即使不能拥抱大海的日子", titleAccent: "在这里总有人在", intro: "分享每一次下潜、每一个潜点，以及只有潜水员才懂的瞬间",
    preview: "设计预览 · 以下为示例内容，不会发布真实动态", search: "搜索潜点、海洋生物或用户", create: "发布动态", shareHint: "分享此刻的海洋…", addPhoto: "照片", addSite: "潜点", addLog: "关联日志",
    recommended: "推荐", following: "关注", latest: "最新", all: "全部", stories: "深蓝故事", creatures: "海洋生物", sites: "潜点见闻", gear: "装备经验", stays: "酒店推荐",
    explore: "探索深蓝", exploreHint: "从你感兴趣的海洋话题开始", topics: "热门话题", topicHint: "此刻大家正在聊什么", trending: "热门潜点", divers: "值得关注的潜水员", follow: "关注", followed: "已关注",
    loadMore: "继续潜入", community: "社区约定", communityHint: "尊重海洋，也尊重每一位分享者。拒绝骚扰、虚假信息和伤害海洋生物的内容。", learn: "查看社区规范",
    likes: "喜欢", comments: "回应", saved: "已收藏", save: "收藏", share: "分享", read: "阅读全文",
    composerTitle: "分享你的深蓝时刻", composerHint: "写下这一潜发生的故事，或分享一个值得记住的海洋瞬间", placeholder: "此刻，你想和其他潜水员分享什么？", cancel: "取消", publish: "发布", published: "已保存为预览草稿",
    more: "更多操作", report: "举报帖子", block: "屏蔽该用户", edit: "编辑帖子", delete: "删除帖子", confirmDelete: "确定删除这篇帖子吗？", confirm: "确认删除", editTitle: "编辑你的帖子", editHint: "修改文字内容并保存", saveChanges: "保存修改", changesSaved: "修改已保存", reported: "举报已提交，我们会尽快审核", blocked: "已屏蔽该用户的帖子", deleted: "帖子已从预览中删除",
    footer: "YOUR OCEAN. YOUR STORY.",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", profile: "Profile", forum: "Deep Blue Forum", offline: "Offline drafts & sync",
    eyebrow: "THE DEEP BLUE COMMUNITY", title: "On the days you cannot hold the ocean", titleAccent: "someone is always here", intro: "Share every descent, every site, and the moments only divers understand",
    preview: "Design preview · Sample content only; nothing here is actually published", search: "Search sites, marine life or divers", create: "Create post", shareHint: "Share an ocean moment…", addPhoto: "Photo", addSite: "Dive site", addLog: "Link log",
    recommended: "For you", following: "Following", latest: "Latest", all: "All", stories: "Ocean stories", creatures: "Marine life", sites: "Dive sites", gear: "Gear notes", stays: "Dive stays",
    explore: "Explore the blue", exploreHint: "Start with the ocean topics you care about", topics: "Trending topics", topicHint: "What divers are talking about now", trending: "Trending sites", divers: "Divers to follow", follow: "Follow", followed: "Following",
    loadMore: "Dive deeper", community: "Community promise", communityHint: "Respect the ocean and every storyteller. No harassment, misinformation or content that harms marine life.", learn: "Read community guidelines",
    likes: "likes", comments: "responses", saved: "Saved", save: "Save", share: "Share", read: "Read story",
    composerTitle: "Share your deep-blue moment", composerHint: "Tell the story of this dive or share an ocean moment worth remembering", placeholder: "What would you like to share with other divers?", cancel: "Cancel", publish: "Publish", published: "Saved as a preview draft",
    more: "More actions", report: "Report post", block: "Block this diver", edit: "Edit post", delete: "Delete post", confirmDelete: "Delete this post?", confirm: "Delete", editTitle: "Edit your post", editHint: "Update the story and save your changes", saveChanges: "Save changes", changesSaved: "Changes saved", reported: "Report submitted for review", blocked: "Posts from this diver are now hidden", deleted: "Post removed from this preview",
    footer: "YOUR OCEAN. YOUR STORY.",
  },
} as const;

export function ForumPage({ preview = false }: { preview?: boolean }) {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const { profile, avatarUrl } = useProfile(!preview);
  const currentName = profile?.display_name?.trim() || (language === "zh-CN" ? "潜水员" : "Diver");
  const currentAvatar = avatarUrl ?? "/images/user-fish-hero-preview.jpg";
  const passportHref = preview ? "/passport-preview" : "/dives";
  const logsHref = preview ? "/logs-preview" : "/dives/logs";
  const profileHref = preview ? "/profile-preview" : "/profile";
  const [feed, setFeed] = useState<"recommended" | "following" | "latest">("recommended");
  const [topic, setTopic] = useState<"all" | Post["topic"]>("all");
  const [liked, setLiked] = useState<string[]>(["mola"]);
  const [saved, setSaved] = useState<string[]>([]);
  const [followed, setFollowed] = useState<string[]>(["Raiyan"]);
  const [composer, setComposer] = useState(false);
  const [draft, setDraft] = useState("");
  const [published, setPublished] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]);
  const [blockedAuthors, setBlockedAuthors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const visiblePosts = useMemo(() => posts.filter((post) => (topic === "all" || post.topic === topic) && !hiddenPosts.includes(post.id) && !blockedAuthors.includes(post.author)), [topic, hiddenPosts, blockedAuthors]);

  function toggleList(setter: Dispatch<SetStateAction<string[]>>, value: string) {
    setter((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  }

  function publishPreview() {
    setPublished(true);
    window.setTimeout(() => { setComposer(false); setPublished(false); setDraft(""); setEditingPost(null); }, 900);
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function editPost(post: Post) {
    if (preview) {
      window.location.assign("/forum-compose-preview?mode=edit");
      return;
    }
    setDraft(language === "zh-CN" ? post.textZh : post.textEn);
    setEditingPost(post.id);
    setComposer(true);
  }

  function openComposer() {
    if (preview) {
      window.location.assign("/forum-compose-preview?mode=create");
      return;
    }
    setDraft("");
    setEditingPost(null);
    setComposer(true);
  }

  const topicOptions = [
    ["all", c.all, Waves], ["stories", c.stories, Sparkles], ["creatures", c.creatures, Fish], ["sites", c.sites, MapPin], ["stays", c.stays, BedDouble], ["gear", c.gear, Compass],
  ] as const;
  const menuLabels = { more: c.more, report: c.report, block: c.block, edit: c.edit, delete: c.delete, confirmDelete: c.confirmDelete, confirm: c.confirm, cancel: c.cancel };

  return <div className="do-forum-page">
    <header className="do-passport-header do-forum-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><a href={passportHref}>{c.passport}</a><a href={logsHref}>{c.logs}</a><a href="#forum-feed" aria-current="page">{c.forum}</a><a href={profileHref}>{c.profile}</a></nav>
      <label className="do-forum-search"><Search aria-hidden="true" /><input placeholder={c.search} /></label>
      <div className="do-passport-header-actions"><Link to="/offline-sync" className="do-passport-sync-link"><CloudOff aria-hidden="true" /><span>{c.offline}</span></Link><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button><button type="button" className="do-forum-create" onClick={openComposer}><Plus aria-hidden="true" />{c.create}</button></div>
    </header>

    <main className="do-forum-main">
      {preview && <div className="do-passport-preview-note">{c.preview}</div>}
      <section className="do-forum-hero">
        <div><span>{c.eyebrow}</span><h1>{c.title}<em>{c.titleAccent}</em></h1><p>{c.intro}</p></div>
        <div className="do-forum-hero-orbit" aria-hidden="true"><span><Users /></span><i /><b>2,846</b><small>DIVERS ONLINE</small></div>
      </section>

      <section className="do-forum-compose-strip"><Avatar><AvatarImage src={currentAvatar} alt={currentName} /><AvatarFallback>{currentName.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><button type="button" onClick={openComposer}>{c.shareHint}</button><div><button type="button" onClick={openComposer}><ImagePlus />{c.addPhoto}</button><button type="button" onClick={openComposer}><MapPin />{c.addSite}</button><button type="button" onClick={openComposer}><Waves />{c.addLog}</button></div></section>

      <div className="do-forum-layout" id="forum-feed">
        <aside className="do-forum-left">
          <section className="do-forum-explore-panel"><div className="do-forum-panel-kicker"><span>01 / EXPLORE</span><Compass /></div><h2>{c.explore}</h2><p>{c.exploreHint}</p><nav>{topicOptions.map(([value, label, Icon]) => <button key={value} type="button" data-active={topic === value} onClick={() => setTopic(value)}><Icon /><span>{label}</span><ChevronRight /></button>)}</nav></section>
          <section className="do-forum-guideline"><ShieldCheck /><div><h3>{c.community}</h3><p>{c.communityHint}</p><button type="button">{c.learn}<ChevronRight /></button></div></section>
        </aside>

        <section className="do-forum-feed">
          <div className="do-forum-feed-tabs" aria-label={c.forum}>{(["recommended", "following", "latest"] as const).map((value) => <button key={value} type="button" data-active={feed === value} onClick={() => setFeed(value)}>{c[value]}</button>)}</div>
          <div className="do-forum-posts">
            {visiblePosts.map((post, index) => <article key={post.id} className={`do-forum-post do-forum-post-${post.ratio}`} data-featured={index === 0 && topic === "all"}>
              <header><Avatar><AvatarImage src={post.avatar} alt={post.author} /><AvatarFallback>{post.author.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><div><strong>{post.author}</strong><span>{post.badge} · {post.date}</span></div><ForumPostMenu isOwn={post.author === "ydpeng7"} labels={menuLabels} onEdit={() => editPost(post)} onDelete={() => { setHiddenPosts((items) => [...items, post.id]); showNotice(c.deleted); }} onReport={() => showNotice(c.reported)} onBlock={() => { setBlockedAuthors((items) => [...items, post.author]); showNotice(c.blocked); }} /></header>
              <div className="do-forum-post-image" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,10,26,.02), rgba(0,12,31,.24)), url('${post.image}')` }}><span><MapPin />{post.location}</span>{index === 0 && topic === "all" && <em><Sparkles />FEATURED STORY</em>}</div>
              <div className="do-forum-post-body"><h2>{language === "zh-CN" ? post.titleZh : post.titleEn}</h2><p>{language === "zh-CN" ? post.textZh : post.textEn}</p><Link to="/forum-post-preview" className="do-forum-read">{c.read}<ChevronRight /></Link></div>
              <footer><div><button type="button" data-active={liked.includes(post.id)} onClick={() => toggleList(setLiked, post.id)}><ScubaTankIcon />{post.likes + (liked.includes(post.id) ? 1 : 0)} <span>{c.likes}</span></button><button type="button"><MessageCircle />{post.comments} <span>{c.comments}</span></button></div><div><button type="button" aria-label={c.share}><Share2 /><span>{c.share}</span></button><button type="button" data-active={saved.includes(post.id)} onClick={() => toggleList(setSaved, post.id)} aria-label={c.save}><Bookmark /><span>{saved.includes(post.id) ? c.saved : c.save}</span></button></div></footer>
            </article>)}
          </div>
          <button type="button" className="do-forum-load"><Waves />{c.loadMore}<ChevronRight /></button>
        </section>

        <aside className="do-forum-right">
          <section className="do-forum-side-panel"><div className="do-forum-panel-heading"><div><span>02 / TRENDING</span><h2>{c.topics}</h2><p>{c.topicHint}</p></div><Flame /></div><ol className="do-forum-topic-list"><li><span>01</span><div><strong># Mola mola 季节</strong><small>286 POSTS · NUSA PENIDA</small></div><ChevronRight /></li><li><span>02</span><div><strong># 第一次船宿</strong><small>174 POSTS · LIVEABOARD</small></div><ChevronRight /></li><li><span>03</span><div><strong># 珊瑚白化观察</strong><small>121 POSTS · OCEAN CARE</small></div><ChevronRight /></li></ol></section>
          <section className="do-forum-side-panel"><div className="do-forum-panel-heading"><div><span>03 / PLACES</span><h2>{c.trending}</h2></div><MapPin /></div><div className="do-forum-place-list"><button type="button" style={{ backgroundImage: "linear-gradient(90deg, rgba(0,15,35,.84), rgba(0,15,35,.18)), url('/images/user-fish-hero-preview.jpg')" }}><span><strong>Crystal Bay</strong><small>NUSA PENIDA · 342 STORIES</small></span><ChevronRight /></button><button type="button" style={{ backgroundImage: "linear-gradient(90deg, rgba(0,15,35,.84), rgba(0,15,35,.18)), url('/images/user-cave-photo-hero-preview.jpg')" }}><span><strong>Moalboal</strong><small>CEBU · 218 STORIES</small></span><ChevronRight /></button></div></section>
          <section className="do-forum-side-panel"><div className="do-forum-panel-heading"><div><span>04 / PEOPLE</span><h2>{c.divers}</h2></div><Users /></div><div className="do-forum-people">{[["Raiyan", "DIVEMASTER · BALI", "/images/supdiver-six-orange-fish-hero.png"], ["lanhai_02", "RESCUE · SHANGHAI", "/images/user-cave-photo-hero-preview.jpg"], ["bubblecheck", "INSTRUCTOR · CEBU", "/images/supdiver-diver-equipment-v2.png"]].map(([name, meta, image]) => <article key={name}><Avatar><AvatarImage src={image} alt={name} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar><div><strong>{name}</strong><small>{meta}</small></div><button type="button" data-followed={followed.includes(name)} onClick={() => toggleList(setFollowed, name)}>{followed.includes(name) ? c.followed : c.follow}</button></article>)}</div></section>
        </aside>
      </div>
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>{c.footer}</small></footer>

    {notice && <div className="do-forum-action-notice" role="status"><Check />{notice}</div>}
    {composer && <div className="do-forum-composer-backdrop" role="presentation"><section className="do-forum-composer" role="dialog" aria-modal="true" aria-labelledby="forum-composer-title"><header><div><span>{editingPost ? "EDIT OCEAN STORY" : "NEW OCEAN STORY"}</span><h2 id="forum-composer-title">{editingPost ? c.editTitle : c.composerTitle}</h2><p>{editingPost ? c.editHint : c.composerHint}</p></div><button type="button" onClick={() => setComposer(false)} aria-label={c.cancel}><X /></button></header><div className="do-forum-composer-author"><Avatar><AvatarImage src={currentAvatar} alt={currentName} /><AvatarFallback>{currentName.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><strong>{currentName}</strong><span>{profile?.cert_level || "DIVER"}</span></div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={c.placeholder} /><div className="do-forum-composer-tools"><button type="button"><ImagePlus />{c.addPhoto}</button><button type="button"><MapPin />{c.addSite}</button><button type="button"><Waves />{c.addLog}</button></div><footer><button type="button" onClick={() => setComposer(false)}>{c.cancel}</button><button type="button" disabled={!draft.trim()} onClick={publishPreview}>{published ? <Check /> : <Send />}{published ? (editingPost ? c.changesSaved : c.published) : (editingPost ? c.saveChanges : c.publish)}</button></footer></section></div>}
  </div>;
}
