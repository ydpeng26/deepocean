import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const FORUM_MEDIA_BUCKET = "forum-media";

export type ForumTopic = "stories" | "creatures" | "sites" | "gear" | "stays";

export type ForumPost = {
  id: string;
  userId: string;
  author: string;
  badge: string;
  avatarUrl: string | null;
  imageUrl: string | null;
  location: string;
  date: string;
  title: string;
  body: string;
  topic: ForumTopic;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
  linkedDiveId: string | null;
};

export type ForumComment = {
  id: string;
  userId: string;
  author: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
};

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("请先登录");
  return id;
}

async function signedUrls(bucket: string, paths: Array<string | null | undefined>) {
  const unique = Array.from(new Set(paths.filter(Boolean) as string[]));
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 60 * 60);
  return new Map((data ?? []).flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
}

export async function listForumPosts(): Promise<ForumPost[]> {
  const userId = await currentUserId();
  const [{ data: rows, error }, { data: bookmarks }, { data: follows }, { data: blocks }] = await Promise.all([
    db.from("forum_posts").select("id,user_id,author_name,author_badge,title,body,topic,location,image_path,linked_dive_id,created_at,forum_likes(user_id),forum_comments(id)").order("created_at", { ascending: false }),
    db.from("forum_bookmarks").select("post_id").eq("user_id", userId),
    db.from("forum_follows").select("following_id").eq("follower_id", userId),
    db.from("forum_blocks").select("blocked_id").eq("blocker_id", userId),
  ]);
  if (error) throw error;

  const blocked = new Set((blocks ?? []).map((row: any) => row.blocked_id));
  const saved = new Set((bookmarks ?? []).map((row: any) => row.post_id));
  const following = new Set((follows ?? []).map((row: any) => row.following_id));
  const visible = (rows ?? []).filter((row: any) => !blocked.has(row.user_id));
  const imageUrls = await signedUrls(FORUM_MEDIA_BUCKET, visible.map((row: any) => row.image_path));

  return visible.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    author: row.author_name || "Diver",
    badge: row.author_badge || "DIVER",
    avatarUrl: null,
    imageUrl: imageUrls.get(row.image_path) ?? null,
    location: row.location || "",
    date: row.created_at,
    title: row.title || "",
    body: row.body,
    topic: row.topic,
    likes: row.forum_likes?.length ?? 0,
    comments: row.forum_comments?.length ?? 0,
    liked: Boolean(row.forum_likes?.some((like: any) => like.user_id === userId)),
    saved: saved.has(row.id),
    following: following.has(row.user_id),
    linkedDiveId: row.linked_dive_id ?? null,
  }));
}

export async function createForumPost(input: {
  title: string;
  body: string;
  topic: ForumTopic;
  location?: string;
  image?: File | null;
  linkedDiveId?: string | null;
}) {
  const userId = await currentUserId();
  let imagePath: string | null = null;
  if (input.image) {
    const ext = input.image.name.split(".").pop()?.toLowerCase() || "jpg";
    imagePath = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(FORUM_MEDIA_BUCKET).upload(imagePath, input.image, { cacheControl: "3600" });
    if (uploadError) throw uploadError;
  }
  const { error } = await db.from("forum_posts").insert({
    user_id: userId,
    title: input.title.trim(),
    body: input.body.trim(),
    topic: input.topic,
    location: input.location?.trim() || null,
    image_path: imagePath,
    linked_dive_id: input.linkedDiveId || null,
  });
  if (error) throw error;
}

export async function updateForumPost(id: string, input: { title: string; body: string; topic: ForumTopic; location?: string; linkedDiveId?: string | null }) {
  const { error } = await db.from("forum_posts").update({
    title: input.title.trim(), body: input.body.trim(), topic: input.topic, location: input.location?.trim() || null, linked_dive_id: input.linkedDiveId || null,
  }).eq("id", id);
  if (error) throw error;
}

export async function deleteForumPost(id: string) {
  const { error } = await db.from("forum_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleForumLike(postId: string, active: boolean) {
  const userId = await currentUserId();
  const query = active
    ? db.from("forum_likes").delete().eq("post_id", postId).eq("user_id", userId)
    : db.from("forum_likes").insert({ post_id: postId, user_id: userId });
  const { error } = await query;
  if (error) throw error;
}

export async function toggleForumBookmark(postId: string, active: boolean) {
  const userId = await currentUserId();
  const query = active
    ? db.from("forum_bookmarks").delete().eq("post_id", postId).eq("user_id", userId)
    : db.from("forum_bookmarks").insert({ post_id: postId, user_id: userId });
  const { error } = await query;
  if (error) throw error;
}

export async function toggleForumFollow(authorId: string, active: boolean) {
  const userId = await currentUserId();
  const query = active
    ? db.from("forum_follows").delete().eq("follower_id", userId).eq("following_id", authorId)
    : db.from("forum_follows").insert({ follower_id: userId, following_id: authorId });
  const { error } = await query;
  if (error) throw error;
}

export async function blockForumAuthor(authorId: string) {
  const userId = await currentUserId();
  const { error } = await db.from("forum_blocks").upsert({ blocker_id: userId, blocked_id: authorId });
  if (error) throw error;
}

export async function reportForumPost(postId: string) {
  const userId = await currentUserId();
  const { error } = await db.from("forum_reports").insert({ reporter_id: userId, post_id: postId, reason: "member_report" });
  if (error && error.code !== "23505") throw error;
}

export async function listForumComments(postId: string): Promise<ForumComment[]> {
  const { data: rows, error } = await db.from("forum_comments").select("id,user_id,author_name,body,created_at").eq("post_id", postId).order("created_at");
  if (error) throw error;
  return (rows ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    author: row.author_name || "Diver",
    avatarUrl: null,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function addForumComment(postId: string, body: string) {
  const userId = await currentUserId();
  const { error } = await db.from("forum_comments").insert({ post_id: postId, user_id: userId, body: body.trim() });
  if (error) throw error;
}
