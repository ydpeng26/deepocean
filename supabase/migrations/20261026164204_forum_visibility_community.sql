-- Additive: existing stories retain their previous member-visible behavior.
ALTER TABLE public.forum_posts ADD COLUMN visibility text NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));
CREATE INDEX forum_posts_owner_visibility_idx ON public.forum_posts(user_id, visibility);

ALTER POLICY "members read forum posts" ON public.forum_posts
  USING (visibility = 'public' OR user_id = (SELECT auth.uid()));
CREATE POLICY "post visibility boundary" ON public.forum_posts AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR user_id = (SELECT auth.uid()));

-- Parent RLS governs direct REST queries as well as embedded counts/joins.
-- Existing ownership rules still apply; this only narrows their permissions.
CREATE POLICY "comment parent visibility" ON public.forum_comments AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id));
CREATE POLICY "like parent visibility" ON public.forum_likes AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id));
CREATE POLICY "bookmark parent visibility" ON public.forum_bookmarks AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id));
CREATE POLICY "report parent visibility" ON public.forum_reports AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = post_id));

-- The existing storage policies already query forum_posts under caller RLS.
-- Explicitly require visibility too, including the restrictive bucket boundary.
ALTER POLICY "members read forum media" ON storage.objects USING (
  bucket_id = 'forum-media' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.image_path = name
      AND p.user_id::text = (storage.foldername(name))[1] AND p.visibility = 'public')));
ALTER POLICY "photo reference privacy boundary" ON storage.objects USING (
  bucket_id NOT IN ('marine-photos', 'forum-media')
  OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
  OR (bucket_id = 'marine-photos' AND EXISTS (SELECT 1 FROM public.marine_encounters e
    WHERE e.photo_path = name AND e.needs_help AND e.user_id::text = (storage.foldername(name))[1]))
  OR (bucket_id = 'forum-media' AND EXISTS (SELECT 1 FROM public.forum_posts p
    WHERE p.image_path = name AND p.user_id::text = (storage.foldername(name))[1]
      AND p.visibility = 'public')));

-- A deliberately narrow aggregate, not a broader bookmark SELECT policy:
-- authors may see their own total, never who saved somebody else's posts.
-- Privileged access is confined to a non-exposed schema and derives its owner
-- solely from auth.uid(), not a caller-supplied user id or user_metadata.
CREATE SCHEMA IF NOT EXISTS supdiver_private;
REVOKE ALL ON SCHEMA supdiver_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA supdiver_private TO authenticated;
CREATE FUNCTION supdiver_private.my_community_stats()
RETURNS TABLE(likes_received bigint, saves_received bigint, followers bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid := auth.uid();
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.forum_likes l JOIN public.forum_posts p ON p.id = l.post_id
      WHERE p.user_id = owner_id AND p.visibility = 'public' AND l.user_id <> owner_id),
    (SELECT count(*) FROM public.forum_bookmarks b JOIN public.forum_posts p ON p.id = b.post_id
      WHERE p.user_id = owner_id AND p.visibility = 'public' AND b.user_id <> owner_id),
    (SELECT count(*) FROM public.forum_follows f WHERE f.following_id = owner_id);
END;
$$;
REVOKE ALL ON FUNCTION supdiver_private.my_community_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION supdiver_private.my_community_stats() TO authenticated;
CREATE FUNCTION public.get_my_community_stats()
RETURNS TABLE(likes_received bigint, saves_received bigint, followers bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM supdiver_private.my_community_stats();
$$;
REVOKE ALL ON FUNCTION public.get_my_community_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_community_stats() TO authenticated;
NOTIFY pgrst, 'reload schema';
