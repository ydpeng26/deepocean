import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  CloudOff,
  Compass,
  Fish,
  Languages,
  MapPin,
  Search,
  Sparkles,
  Waves,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScubaTankIcon } from "@/components/ScubaTankIcon";
import { useLanguage } from "@/i18n/LanguageProvider";

type SavedTopic = "stories" | "creatures" | "sites" | "stays" | "gear";
type SavedPost = {
  id: string;
  topic: SavedTopic;
  author: string;
  avatar: string;
  image: string;
  location: string;
  titleZh: string;
  titleEn: string;
  excerptZh: string;
  excerptEn: string;
  likes: number;
  savedDateZh: string;
  savedDateEn: string;
  feature?: boolean;
};

export const Route = createFileRoute("/saved-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [
    { title: "我的收藏预览 · SupDiver" },
    { name: "robots", content: "noindex" },
  ] }),
  component: SavedPreview,
});

const savedPosts: SavedPost[] = [
  { id: "mola", topic: "creatures", author: "ydpeng7", avatar: "/images/user-fish-hero-preview.jpg", image: "/images/user-fish-hero-preview.jpg", location: "Crystal Bay · Nusa Penida", titleZh: "在冷水里遇见一只慢吞吞的 Mola mola", titleEn: "A slow Mola mola in the cold blue", excerptZh: "冷得发抖的那一潜，因为一次安静的相遇变得格外清晰。", excerptEn: "A freezing dive made unforgettable by one quiet encounter.", likes: 286, savedDateZh: "收藏于 10月12日", savedDateEn: "Saved Oct 12", feature: true },
  { id: "sardines", topic: "stories", author: "lanhai_02", avatar: "/images/user-cave-photo-hero-preview.jpg", image: "/images/user-cave-photo-hero-preview.jpg", location: "Moalboal · Cebu", titleZh: "沙丁鱼群遮住阳光的十秒钟", titleEn: "Ten seconds beneath a sardine sky", excerptZh: "鱼群突然转向，阳光从缝隙里落下来，像一场海里的雨。", excerptEn: "The school turned and sunlight fell through like underwater rain.", likes: 194, savedDateZh: "收藏于 10月10日", savedDateEn: "Saved Oct 10" },
  { id: "reef", topic: "sites", author: "Raiyan", avatar: "/images/supdiver-six-orange-fish-hero.png", image: "/images/supdiver-six-orange-fish-hero.png", location: "Tulamben · Bali", titleZh: "清晨第一潜，珊瑚刚刚醒来", titleEn: "The reef waking on the first dive", excerptZh: "不追逐大东西，只看礁石的颜色在晨光里一点点回来。", excerptEn: "No chase for big animals—just the reef colours returning with dawn.", likes: 138, savedDateZh: "收藏于 10月8日", savedDateEn: "Saved Oct 8" },
  { id: "stay", topic: "stays", author: "islandpause", avatar: "/images/user-cave-photo-hero-preview.jpg", image: "/images/deepocean-hero.png", location: "Nusa Penida · Indonesia", titleZh: "离码头五分钟，这间潜水旅店值得再住一次", titleEn: "A dive stay worth returning to", excerptZh: "晾装备的空间、清晨出海的距离和安静的夜晚，组成了舒适的潜水旅行。", excerptEn: "Gear space, a short walk to the boat and quiet nights shaped the trip.", likes: 83, savedDateZh: "收藏于 10月5日", savedDateEn: "Saved Oct 5" },
  { id: "blue", topic: "stories", author: "deepcurrent", avatar: "/images/deepocean-hero.png", image: "/images/deepocean-hero.png", location: "Batu Bolong · Komodo", titleZh: "顺着流，遇见一整片蓝", titleEn: "Following the current into blue", excerptZh: "回想起来，只记得水流、呼吸和无限延伸的蓝。", excerptEn: "Only the current, my breathing and blue without end remain.", likes: 221, savedDateZh: "收藏于 9月28日", savedDateEn: "Saved Sep 28" },
  { id: "gear", topic: "gear", author: "bubblecheck", avatar: "/images/supdiver-diver-equipment-v2.png", image: "/images/supdiver-diver-equipment-v2.png", location: "潜水装备 · 经验分享", titleZh: "出发前，我一定会再确认的五件事", titleEn: "Five checks before every departure", excerptZh: "从备用面镜到 BCD 充排气，这份清单避免了好几次狼狈。", excerptEn: "From a spare mask to the BCD inflator, this checklist saves dive days.", likes: 96, savedDateZh: "收藏于 9月20日", savedDateEn: "Saved Sep 20" },
];

const copy = {
  "zh-CN": {
    passport: "海洋护照", logs: "潜水日志", forum: "深蓝论坛", profile: "个人资料", offline: "离线草稿与同步", preview: "设计预览 · 以下为示例收藏内容",
    back: "返回海洋护照", eyebrow: "YOUR SAVED OCEAN", title: "我的收藏", intro: "把那些让你停下来多看一会儿的海洋故事，留在这里慢慢重温",
    total: "收藏故事", places: "涉及潜点", topics: "内容主题", search: "搜索标题、潜点或潜水员", sort: "最近收藏", all: "全部", stories: "深蓝故事", creatures: "海洋生物", sites: "潜点见闻", stays: "酒店推荐", gear: "装备经验",
    likes: "喜欢", remove: "取消收藏", removed: "已从收藏中移除", saved: "已收藏", noResult: "没有找到符合条件的收藏", clear: "清除筛选", explore: "去深蓝论坛发现更多故事", footer: "YOUR OCEAN. YOUR STORY.",
  },
  en: {
    passport: "Ocean Passport", logs: "Dive Logs", forum: "Deep Blue Forum", profile: "Profile", offline: "Offline drafts & sync", preview: "Design preview · Sample saved stories",
    back: "Back to Ocean Passport", eyebrow: "YOUR SAVED OCEAN", title: "My saved stories", intro: "Keep the ocean stories that made you pause, then return to them whenever you need the blue",
    total: "Saved stories", places: "Dive sites", topics: "Topics", search: "Search titles, sites or divers", sort: "Recently saved", all: "All", stories: "Ocean stories", creatures: "Marine life", sites: "Dive sites", stays: "Dive stays", gear: "Gear notes",
    likes: "likes", remove: "Remove from saved", removed: "Removed from saved", saved: "Saved", noResult: "No saved stories match these filters", clear: "Clear filters", explore: "Discover more in the forum", footer: "YOUR OCEAN. YOUR STORY.",
  },
} as const;

function SavedPreview() {
  const { language, toggleLanguage } = useLanguage();
  const c = copy[language];
  const [topic, setTopic] = useState<"all" | SavedTopic>("all");
  const [query, setQuery] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const topics = [
    ["all", c.all, Waves], ["stories", c.stories, Sparkles], ["creatures", c.creatures, Fish], ["sites", c.sites, MapPin], ["stays", c.stays, Compass], ["gear", c.gear, Bookmark],
  ] as const;

  const visiblePosts = useMemo(() => savedPosts.filter((post) => {
    if (removed.includes(post.id) || (topic !== "all" && post.topic !== topic)) return false;
    const haystack = `${post.titleZh} ${post.titleEn} ${post.location} ${post.author}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [query, removed, topic]);

  function removeSaved(id: string) {
    setRemoved((items) => [...items, id]);
    setNotice(c.removed);
    window.setTimeout(() => setNotice(""), 2200);
  }

  return <div className="do-forum-page do-saved-page">
    <header className="do-passport-header do-forum-header">
      <Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link>
      <nav aria-label={language === "zh-CN" ? "主要导航" : "Main navigation"}><Link to="/passport-preview" aria-current="page">{c.passport}</Link><Link to="/logs-preview">{c.logs}</Link><Link to="/forum-preview">{c.forum}</Link><Link to="/profile-preview">{c.profile}</Link></nav>
      <div className="do-passport-header-actions"><Link to="/offline-sync" className="do-passport-sync-link"><CloudOff aria-hidden="true" /><span>{c.offline}</span></Link><button type="button" className="do-passport-language" onClick={toggleLanguage}><Languages aria-hidden="true" />{language === "zh-CN" ? "EN" : "中文"}</button></div>
    </header>

    <main className="do-saved-main">
      <div className="do-passport-preview-note">{c.preview}</div>
      <Link to="/passport-preview" className="do-saved-back"><ArrowLeft />{c.back}</Link>
      <section className="do-saved-hero">
        <div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div>
        <div className="do-saved-summary"><span><strong>12</strong>{c.total}</span><span><strong>07</strong>{c.places}</span><span><strong>05</strong>{c.topics}</span></div>
      </section>

      <section className="do-saved-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} /></label>
        <div className="do-saved-filters">{topics.map(([value, label, Icon]) => <button type="button" key={value} data-active={topic === value} onClick={() => setTopic(value)}><Icon />{label}</button>)}</div>
        <button type="button" className="do-saved-sort">{c.sort}<ChevronDown /></button>
      </section>

      {visiblePosts.length ? <section className="do-saved-grid">{visiblePosts.map((post, index) => <article key={post.id} className="do-saved-card" data-featured={post.feature && index === 0}>
        <Link to="/forum-post-preview" className="do-saved-card-image" style={{ backgroundImage: `linear-gradient(180deg, rgba(1,14,29,.03), rgba(1,14,29,.74)), url('${post.image}')` }}><span><MapPin />{post.location}</span></Link>
        <button type="button" className="do-saved-bookmark" aria-label={c.remove} onClick={() => removeSaved(post.id)}><Bookmark fill="currentColor" /></button>
        <div className="do-saved-card-body"><div className="do-saved-author"><Avatar><AvatarImage src={post.avatar} alt={post.author} /><AvatarFallback>{post.author.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><div><strong>{post.author}</strong><small>{language === "zh-CN" ? post.savedDateZh : post.savedDateEn}</small></div></div><Link to="/forum-post-preview"><h2>{language === "zh-CN" ? post.titleZh : post.titleEn}</h2><p>{language === "zh-CN" ? post.excerptZh : post.excerptEn}</p></Link><footer><span><ScubaTankIcon />{post.likes} {c.likes}</span><em><Bookmark />{c.saved}</em></footer></div>
      </article>)}</section> : <section className="do-saved-empty"><Bookmark /><h2>{c.noResult}</h2><div><button type="button" onClick={() => { setTopic("all"); setQuery(""); }}>{c.clear}</button><Link to="/forum-preview">{c.explore}</Link></div></section>}
    </main>
    <footer className="do-passport-footer"><span>SupDiver</span><small>{c.footer}</small></footer>
    {notice && <div className="do-forum-action-notice" role="status"><Check />{notice}</div>}
  </div>;
}
