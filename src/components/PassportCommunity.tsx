import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronRight, Users } from "lucide-react";
import { ScubaTankIcon } from "@/components/ScubaTankIcon";
import { getMyCommunityStats, listForumPosts } from "@/lib/forum";
import { useLanguage } from "@/i18n/LanguageProvider";

export function PassportCommunityStats({
  ownerId,
  preview = false,
}: {
  ownerId?: string;
  preview?: boolean;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const query = useQuery({
    queryKey: ["community-stats", ownerId],
    queryFn: () => getMyCommunityStats(ownerId!),
    enabled: !preview && !!ownerId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 45_000,
  });
  const stats = !query.isError && query.data;
  return (
    <>
      <div className="do-passport-community-stats" aria-label={en ? "Community stats" : "社区数据"}>
        <span>
          <ScubaTankIcon />
          <strong>{preview ? "1,286" : stats ? stats.likesReceived : "—"}</strong>
          <small>{en ? "Likes" : "被喜欢"}</small>
        </span>
        <span>
          <Bookmark aria-hidden="true" />
          <strong>{preview ? "318" : stats ? stats.savesReceived : "—"}</strong>
          <small>{en ? "Saves" : "被收藏"}</small>
        </span>
        <span>
          <Users aria-hidden="true" />
          <strong>{preview ? "246" : stats ? stats.followers : "—"}</strong>
          <small>{en ? "Followers" : "粉丝"}</small>
        </span>
      </div>
      {!preview && query.isError && (
        <p role="alert">
          {en ? "Community stats unavailable." : "社区统计暂时无法读取。"}{" "}
          <button onClick={() => void query.refetch()}>{en ? "Retry" : "重试"}</button>
        </p>
      )}
    </>
  );
}

export function PassportSavedPosts({ ownerId }: { ownerId?: string }) {
  const { language } = useLanguage();
  const en = language === "en";
  const query = useQuery({
    queryKey: ["forum-posts", ownerId],
    queryFn: () => listForumPosts(ownerId!),
    enabled: !!ownerId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 45_000,
  });
  const saved = query.isError ? [] : (query.data ?? []).filter((post) => post.saved);
  return (
    <section className="do-passport-saved-panel" aria-labelledby="passport-saved-title">
      <div className="do-passport-panel-heading">
        <span>05 / {en ? "My saved posts" : "我的收藏"}</span>
        <Bookmark aria-hidden="true" />
      </div>
      <div className="do-passport-saved-heading">
        <div>
          <h2 id="passport-saved-title">{en ? "My saved posts" : "我的收藏"}</h2>
          <p>
            {en
              ? "Only stories you can currently access are shown."
              : "仅展示你当前有权查看的帖子。"}
          </p>
          <Link to="/saved" className="do-passport-saved-link">
            {en ? "View all saved stories" : "查看全部收藏"}
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
        <strong>{query.isPending || query.isError ? "—" : saved.length}</strong>
      </div>
      {query.isError ? (
        <div role="alert">
          <p>{en ? "Saved posts unavailable." : "暂时无法读取收藏。"}</p>
          <button onClick={() => void query.refetch()}>{en ? "Retry" : "重试"}</button>
        </div>
      ) : query.isPending ? (
        <p>{en ? "Loading…" : "正在读取…"}</p>
      ) : saved.length ? (
        <div className="do-passport-saved-grid">
          {saved.slice(0, 2).map((post) => (
            <article key={post.id}>
              <Link to="/saved" hash={`post-${post.id}`}>
                <div
                  style={{
                    backgroundImage: post.imageUrl
                      ? `linear-gradient(0deg, rgba(1,20,38,.48), transparent), url('${post.imageUrl}')`
                      : undefined,
                  }}
                >
                  <span>{post.location}</span>
                </div>
                <h3>{post.title || post.body.slice(0, 40)}</h3>
                <small>
                  {post.author} · {post.likes} {en ? "likes" : "被喜欢"}
                </small>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="do-passport-saved-empty">
          <Bookmark aria-hidden="true" />
          <p>{en ? "No accessible saved posts yet." : "暂无可查看的收藏。"}</p>
          <Link to="/forum">
            {en ? "Explore the forum" : "去深蓝论坛看看"}
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
