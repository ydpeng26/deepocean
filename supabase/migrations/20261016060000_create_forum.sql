-- Production forum data model. All writes are owned by the authenticated user;
-- public reads are limited to other authenticated SupDiver members.

CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Diver',
  author_badge text NOT NULL DEFAULT 'DIVER',
  title text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  topic text NOT NULL DEFAULT 'stories' CHECK (topic IN ('stories', 'creatures', 'sites', 'gear', 'stays')),
  location text,
  image_path text,
  linked_dive_id uuid REFERENCES public.dives(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Diver',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_likes (
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE public.forum_bookmarks (
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE public.forum_follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE public.forum_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'other' CHECK (char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, post_id)
);

CREATE INDEX forum_posts_created_idx ON public.forum_posts (created_at DESC);
CREATE INDEX forum_posts_topic_created_idx ON public.forum_posts (topic, created_at DESC);
CREATE INDEX forum_comments_post_created_idx ON public.forum_comments (post_id, created_at);
CREATE INDEX forum_likes_post_idx ON public.forum_likes (post_id);
CREATE INDEX forum_bookmarks_user_idx ON public.forum_bookmarks (user_id, created_at DESC);
CREATE INDEX forum_follows_following_idx ON public.forum_follows (following_id);

CREATE OR REPLACE FUNCTION public.set_forum_post_author_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_record FROM public.profiles WHERE id = NEW.user_id;
  NEW.author_name := COALESCE(NULLIF(trim(profile_record.display_name), ''), 'Diver');
  NEW.author_badge := COALESCE(NULLIF(trim(profile_record.cert_level), ''), 'DIVER');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_forum_comment_author_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_name text;
BEGIN
  SELECT display_name INTO profile_name FROM public.profiles WHERE id = NEW.user_id;
  NEW.author_name := COALESCE(NULLIF(trim(profile_name), ''), 'Diver');
  RETURN NEW;
END;
$$;

CREATE TRIGGER forum_posts_set_author_snapshot
BEFORE INSERT ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.set_forum_post_author_snapshot();

CREATE TRIGGER forum_comments_set_author_snapshot
BEFORE INSERT ON public.forum_comments
FOR EACH ROW EXECUTE FUNCTION public.set_forum_comment_author_snapshot();

CREATE TRIGGER forum_posts_touch_updated_at
BEFORE UPDATE ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER forum_comments_touch_updated_at
BEFORE UPDATE ON public.forum_comments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_posts, public.forum_comments,
  public.forum_likes, public.forum_bookmarks, public.forum_follows, public.forum_blocks,
  public.forum_reports TO authenticated;
GRANT ALL ON public.forum_posts, public.forum_comments, public.forum_likes,
  public.forum_bookmarks, public.forum_follows, public.forum_blocks, public.forum_reports TO service_role;

CREATE POLICY "members read forum posts" ON public.forum_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create own forum posts" ON public.forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members update own forum posts" ON public.forum_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members delete own forum posts" ON public.forum_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "members read forum comments" ON public.forum_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create own forum comments" ON public.forum_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members update own forum comments" ON public.forum_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members delete own forum comments" ON public.forum_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "members read forum likes" ON public.forum_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create own forum likes" ON public.forum_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members delete own forum likes" ON public.forum_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "members read own bookmarks" ON public.forum_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "members create own bookmarks" ON public.forum_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members delete own bookmarks" ON public.forum_bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "members read follows" ON public.forum_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create own follows" ON public.forum_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "members delete own follows" ON public.forum_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE POLICY "members read own blocks" ON public.forum_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "members create own blocks" ON public.forum_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "members delete own blocks" ON public.forum_blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE POLICY "members read own reports" ON public.forum_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "members create own reports" ON public.forum_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('forum-media', 'forum-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "members read forum media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'forum-media');
CREATE POLICY "members insert own forum media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'forum-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "members update own forum media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'forum-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "members delete own forum media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'forum-media' AND (storage.foldername(name))[1] = auth.uid()::text);

REVOKE EXECUTE ON FUNCTION public.set_forum_post_author_snapshot() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_forum_comment_author_snapshot() FROM public, anon, authenticated;
