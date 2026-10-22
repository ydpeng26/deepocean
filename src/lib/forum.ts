import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const FORUM_MEDIA_BUCKET = "forum-media";

export type ForumTopic = "stories" | "creatures" | "encyclopedia" | "sites" | "gear" | "stays";

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

async function currentUserId(expectedId?: string) {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("请先登录");
  if (expectedId && id !== expectedId)
    throw new Error("账号已变化，请重新打开论坛 / Account changed; reopen the forum.");
  return id;
}

async function signedUrls(bucket: string, paths: Array<string | null | undefined>) {
  const unique = Array.from(new Set(paths.filter(Boolean) as string[]));
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 60 * 60);
  return new Map(
    (data ?? []).flatMap((item) => (item.signedUrl ? [[item.path, item.signedUrl] as const] : [])),
  );
}

export async function listForumPosts(): Promise<ForumPost[]> {
  const userId = await currentUserId();
  const [{ data: rows, error }, { data: bookmarks }, { data: follows }, { data: blocks }] =
    await Promise.all([
      db
        .from("forum_posts")
        .select(
          "id,user_id,author_name,author_badge,title,body,topic,location,image_path,linked_dive_id,created_at,forum_likes(user_id),forum_comments(id)",
        )
        .order("created_at", { ascending: false }),
      db.from("forum_bookmarks").select("post_id").eq("user_id", userId),
      db.from("forum_follows").select("following_id").eq("follower_id", userId),
      db.from("forum_blocks").select("blocked_id").eq("blocker_id", userId),
    ]);
  if (error) throw error;

  const blocked = new Set((blocks ?? []).map((row: any) => row.blocked_id));
  const saved = new Set((bookmarks ?? []).map((row: any) => row.post_id));
  const following = new Set((follows ?? []).map((row: any) => row.following_id));
  const visible = (rows ?? []).filter((row: any) => !blocked.has(row.user_id));
  const imageUrls = await signedUrls(
    FORUM_MEDIA_BUCKET,
    visible.map((row: any) => row.image_path),
  );

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
  requestId?: string;
  title: string;
  body: string;
  topic: ForumTopic;
  location?: string;
  image?: File | null;
  linkedDiveId?: string | null;
}) {
  const userId = await currentUserId();
  const id = input.requestId ?? crypto.randomUUID();
  let imagePath: string | null = null;
  if (input.image) {
    const digest = await crypto.subtle.digest("SHA-256", await input.image.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    imagePath = `${userId}/${id}-${hash}`;
  }
  const payload = {
    id,
    user_id: userId,
    title: input.title.trim(),
    body: input.body.trim(),
    topic: input.topic,
    location: input.location?.trim() || null,
    image_path: imagePath,
    linked_dive_id: input.linkedDiveId || null,
  };
  // A lost response must not turn a retry into another post (or overwrite a photo).
  async function alreadySaved() {
    const { data, error } = await db
      .from("forum_posts")
      .select("id,user_id,title,body,topic,location,image_path,linked_dive_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    if (!Object.entries(payload).every(([key, value]) => data[key] === value)) {
      throw new Error(
        "这篇动态可能已发布，请关闭编辑框并刷新确认后再编辑。 / This post may already be published. Refresh to check before editing.",
      );
    }
    return true;
  }
  if (await alreadySaved()) return;
  if (input.image && imagePath) {
    const { error } = await supabase.storage
      .from(FORUM_MEDIA_BUCKET)
      .upload(imagePath, input.image, { cacheControl: "3600" });
    // The path includes the content hash; only an identical retry can reuse it.
    if (error && String((error as { statusCode?: string }).statusCode) !== "409") throw error;
  }
  const { error } = await db.from("forum_posts").insert(payload);
  if (error && !(error.code === "23505" && (await alreadySaved()))) throw error;
}

export async function updateForumPost(
  id: string,
  input: {
    title: string;
    body: string;
    topic: ForumTopic;
    location?: string;
    linkedDiveId?: string | null;
  },
) {
  const { error } = await db
    .from("forum_posts")
    .update({
      title: input.title.trim(),
      body: input.body.trim(),
      topic: input.topic,
      location: input.location?.trim() || null,
      linked_dive_id: input.linkedDiveId || null,
    })
    .eq("id", id)
    .select("id")
    .single();
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
  const { error } = await db
    .from("forum_blocks")
    .upsert({ blocker_id: userId, blocked_id: authorId });
  if (error) throw error;
}

export async function reportForumPost(postId: string) {
  const userId = await currentUserId();
  const { error } = await db
    .from("forum_reports")
    .insert({ reporter_id: userId, post_id: postId, reason: "member_report" });
  if (error && error.code !== "23505") throw error;
}

export async function listForumComments(postId: string): Promise<ForumComment[]> {
  const { data: rows, error } = await db
    .from("forum_comments")
    .select("id,user_id,author_name,body,created_at")
    .eq("post_id", postId)
    .order("created_at");
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

function commentBody(body: string) {
  const text = body.trim();
  if (!text || Array.from(text).length > 1000)
    throw new Error("回应请填写 1–1000 字 / Use 1–1000 characters.");
  return text;
}

const commentFields = "id,user_id,post_id,author_name,body,created_at";
type CommentRow = {
  id: string;
  user_id: string;
  post_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
function savedComment(row: CommentRow): ForumComment {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.author_name || "Diver",
    avatarUrl: null,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function addForumComment(
  postId: string,
  body: string,
  requestId: string = crypto.randomUUID(),
  expectedUserId?: string,
): Promise<ForumComment> {
  const userId = await currentUserId(expectedUserId);
  const payload = { id: requestId, post_id: postId, user_id: userId, body: commentBody(body) };
  async function existing() {
    const { data, error } = await db
      .from("forum_comments")
      .select(commentFields)
      .eq("id", requestId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (!Object.entries(payload).every(([key, value]) => data[key] === value))
      throw new Error(
        "这条回应可能已发送，请刷新列表确认后再编辑 / This response may already be sent. Refresh to check before editing.",
      );
    return savedComment(data);
  }
  const prior = await existing();
  if (prior) return prior;
  await currentUserId(userId);
  const { data, error } = await db
    .from("forum_comments")
    .insert(payload)
    .select(commentFields)
    .single();
  if (error) {
    if (error.code === "23505") {
      const prior = await existing();
      if (prior) return prior;
    }
    throw error;
  }
  if (!data || data.id !== requestId || data.user_id !== userId || data.post_id !== postId)
    throw new Error("回应保存未确认 / Response save not confirmed.");
  return savedComment(data);
}

export async function updateForumComment(
  id: string,
  postId: string,
  body: string,
  expectedUserId: string,
): Promise<ForumComment> {
  const userId = await currentUserId(expectedUserId);
  const { data, error } = await db
    .from("forum_comments")
    .update({ body: commentBody(body) })
    .eq("id", id)
    .eq("post_id", postId)
    .eq("user_id", userId)
    .select(commentFields)
    .single();
  if (error) throw error;
  if (!data || data.id !== id || data.user_id !== userId || data.post_id !== postId)
    throw new Error("回应修改未确认 / Response edit not confirmed.");
  return savedComment(data);
}

export async function deleteForumComment(id: string, postId: string, expectedUserId: string) {
  const userId = await currentUserId(expectedUserId);
  const { data, error } = await db
    .from("forum_comments")
    .delete()
    .eq("id", id)
    .eq("post_id", postId)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error) throw error;
  if (data?.id !== id) throw new Error("回应删除未确认 / Response deletion not confirmed.");
}

export type BlockedForumAuthor = { id: string; name: string };
export async function listBlockedForumAuthors(
  expectedUserId: string,
): Promise<BlockedForumAuthor[]> {
  const userId = await currentUserId(expectedUserId);
  const { data: rows, error } = await db
    .from("forum_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  if (error) throw error;
  const ids = (rows ?? []).map((row: { blocked_id: string }) => row.blocked_id);
  if (!ids.length) return [];
  // Other profiles remain private; use the existing authenticated public-summary RPC.
  return Promise.all(
    ids.map(async (id: string) => {
      const { data, error: profileError } = await db.rpc("get_public_diver_profile", {
        target_user_id: id,
      });
      if (profileError) throw profileError;
      return { id, name: data?.[0]?.display_name?.trim() || "Diver" };
    }),
  );
}

export async function unblockForumAuthor(authorId: string, expectedUserId: string) {
  const userId = await currentUserId(expectedUserId);
  const { data, error } = await db
    .from("forum_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", authorId)
    .select("blocked_id")
    .single();
  if (error) throw error;
  if (data?.blocked_id !== authorId) throw new Error("解除屏蔽未确认 / Unblock not confirmed.");
}
