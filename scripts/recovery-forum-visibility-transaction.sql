-- RECOVERY ONLY. Never commit fixture data: all effects roll back in this call.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN ('a2818d1a-f04b-4f09-8bc7-d5db1cf12321', 'b2818d1a-f04b-4f09-8bc7-d5db1cf12321'))
    OR EXISTS (SELECT 1 FROM public.forum_posts WHERE id IN ('c2818d1a-f04b-4f09-8bc7-d5db1cf12321', 'd2818d1a-f04b-4f09-8bc7-d5db1cf12321'))
    THEN RAISE EXCEPTION 'Fixture collision'; END IF;
END $$;
-- No password, email, login, session or persisted account is created.
INSERT INTO auth.users(id, raw_user_meta_data) VALUES
  ('a2818d1a-f04b-4f09-8bc7-d5db1cf12321', '{"display_name":"Visibility transaction A"}'),
  ('b2818d1a-f04b-4f09-8bc7-d5db1cf12321', '{"display_name":"Visibility transaction B"}');
INSERT INTO public.forum_posts(id,user_id,body,visibility,image_path) VALUES
  ('c2818d1a-f04b-4f09-8bc7-d5db1cf12321','a2818d1a-f04b-4f09-8bc7-d5db1cf12321','Synthetic public','public','a2818d1a-f04b-4f09-8bc7-d5db1cf12321/visibility-public'),
  ('d2818d1a-f04b-4f09-8bc7-d5db1cf12321','a2818d1a-f04b-4f09-8bc7-d5db1cf12321','Synthetic private','private','a2818d1a-f04b-4f09-8bc7-d5db1cf12321/visibility-private');
-- Seed historic interactions to verify they cannot leak once a post is private.
INSERT INTO public.forum_comments(post_id,user_id,body) SELECT p, 'b2818d1a-f04b-4f09-8bc7-d5db1cf12321'::uuid,'Synthetic response' FROM unnest(ARRAY['c2818d1a-f04b-4f09-8bc7-d5db1cf12321'::uuid,'d2818d1a-f04b-4f09-8bc7-d5db1cf12321'::uuid]) p;
INSERT INTO public.forum_likes(post_id,user_id) SELECT p,u FROM unnest(ARRAY['c2818d1a-f04b-4f09-8bc7-d5db1cf12321'::uuid,'d2818d1a-f04b-4f09-8bc7-d5db1cf12321'::uuid]) p CROSS JOIN unnest(ARRAY['a2818d1a-f04b-4f09-8bc7-d5db1cf12321'::uuid,'b2818d1a-f04b-4f09-8bc7-d5db1cf12321'::uuid]) u;
INSERT INTO public.forum_bookmarks(post_id,user_id) SELECT post_id,user_id FROM public.forum_likes WHERE post_id IN ('c2818d1a-f04b-4f09-8bc7-d5db1cf12321','d2818d1a-f04b-4f09-8bc7-d5db1cf12321');
INSERT INTO public.forum_follows(follower_id,following_id) VALUES ('b2818d1a-f04b-4f09-8bc7-d5db1cf12321','a2818d1a-f04b-4f09-8bc7-d5db1cf12321');
-- Metadata only; no actual Storage file is uploaded.
INSERT INTO storage.objects(bucket_id,name) VALUES
  ('forum-media','a2818d1a-f04b-4f09-8bc7-d5db1cf12321/visibility-public'),
  ('forum-media','a2818d1a-f04b-4f09-8bc7-d5db1cf12321/visibility-private');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DO $$ DECLARE s record; BEGIN
  IF (SELECT count(*) FROM public.forum_posts WHERE user_id=auth.uid()) <> 2 THEN RAISE EXCEPTION 'Owner visibility'; END IF;
  SELECT * INTO s FROM public.get_my_community_stats();
  IF s.likes_received <> 1 OR s.saves_received <> 1 OR s.followers <> 1 THEN RAISE EXCEPTION 'Own stats aggregate or self exclusion'; END IF;
  IF (SELECT count(*) FROM public.forum_bookmarks WHERE post_id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321') <> 1 THEN RAISE EXCEPTION 'Bookmark identities exposed'; END IF;
  INSERT INTO public.forum_posts(id,user_id,body,visibility) VALUES ('e2818d1a-f04b-4f09-8bc7-d5db1cf12321',auth.uid(),'Synthetic owner create','private');
  IF NOT EXISTS (SELECT 1 FROM public.forum_posts WHERE id='e2818d1a-f04b-4f09-8bc7-d5db1cf12321') THEN RAISE EXCEPTION 'Private create'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','b2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DO $$ DECLARE rejected boolean; s record; BEGIN
  IF (SELECT count(*) FROM public.forum_posts WHERE user_id='a2818d1a-f04b-4f09-8bc7-d5db1cf12321') <> 1 THEN RAISE EXCEPTION 'Private posts exposed'; END IF;
  IF (SELECT count(*) FROM public.forum_comments WHERE post_id='d2818d1a-f04b-4f09-8bc7-d5db1cf12321') <> 0 THEN RAISE EXCEPTION 'Private comments exposed'; END IF;
  IF (SELECT count(*) FROM public.forum_likes WHERE post_id='d2818d1a-f04b-4f09-8bc7-d5db1cf12321') <> 0 THEN RAISE EXCEPTION 'Private likes exposed'; END IF;
  IF (SELECT count(*) FROM public.forum_bookmarks WHERE post_id='d2818d1a-f04b-4f09-8bc7-d5db1cf12321') <> 0 THEN RAISE EXCEPTION 'Private saved row exposed'; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='forum-media' AND name='a2818d1a-f04b-4f09-8bc7-d5db1cf12321/visibility-private') THEN RAISE EXCEPTION 'Private image exposed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='forum-media' AND name='a2818d1a-f04b-4f09-8bc7-d5db1cf12321/visibility-public') THEN RAISE EXCEPTION 'Public image unavailable'; END IF;
  rejected := false; BEGIN INSERT INTO public.forum_comments(post_id,user_id,body) VALUES ('d2818d1a-f04b-4f09-8bc7-d5db1cf12321',auth.uid(),'Rejected'); EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Private comment write allowed'; END IF;
  -- Remove the seeded duplicate in a rolled-back subtransaction before insertion checks.
  rejected := false; BEGIN INSERT INTO public.forum_likes(post_id,user_id) VALUES ('e2818d1a-f04b-4f09-8bc7-d5db1cf12321',auth.uid()); EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Private like write allowed'; END IF;
  rejected := false; BEGIN INSERT INTO public.forum_bookmarks(post_id,user_id) VALUES ('e2818d1a-f04b-4f09-8bc7-d5db1cf12321',auth.uid()); EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Private bookmark write allowed'; END IF;
  UPDATE public.forum_posts SET visibility='public' WHERE id='d2818d1a-f04b-4f09-8bc7-d5db1cf12321';
  IF FOUND THEN RAISE EXCEPTION 'Other author update allowed'; END IF;
  SELECT * INTO s FROM public.get_my_community_stats();
  IF s.likes_received <> 0 OR s.saves_received <> 0 OR s.followers <> 0 THEN RAISE EXCEPTION 'Stats account isolation'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','a2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
UPDATE public.forum_posts SET visibility='private' WHERE id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321';
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_my_community_stats();
  IF s.likes_received <> 0 OR s.saves_received <> 0 OR s.followers <> 1 THEN RAISE EXCEPTION 'Private transition stats'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','b2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.forum_posts WHERE id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321')
    OR EXISTS (SELECT 1 FROM public.forum_bookmarks WHERE post_id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321')
    OR EXISTS (SELECT 1 FROM public.forum_comments WHERE post_id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321')
    OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='forum-media' AND name='a2818d1a-f04b-4f09-8bc7-d5db1cf12321/visibility-public')
  THEN RAISE EXCEPTION 'Private transition leak'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','a2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
UPDATE public.forum_posts SET visibility='public' WHERE id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321';
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_my_community_stats();
  IF s.likes_received <> 1 OR s.saves_received <> 1 THEN RAISE EXCEPTION 'Republish statistics not restored'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','b2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.forum_bookmarks WHERE post_id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321') THEN RAISE EXCEPTION 'Retained bookmark not restored'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN PERFORM * FROM public.get_my_community_stats(); EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Anon stats allowed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DELETE FROM public.forum_likes WHERE post_id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321' AND user_id=auth.uid();
DELETE FROM public.forum_bookmarks WHERE post_id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321' AND user_id=auth.uid();
DELETE FROM public.forum_follows WHERE following_id='a2818d1a-f04b-4f09-8bc7-d5db1cf12321' AND follower_id=auth.uid();
SELECT set_config('request.jwt.claim.sub','a2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_my_community_stats();
  IF s.likes_received <> 0 OR s.saves_received <> 0 OR s.followers <> 0 THEN RAISE EXCEPTION 'Remove interactions not reflected'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','b2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
INSERT INTO public.forum_likes(post_id,user_id) VALUES ('c2818d1a-f04b-4f09-8bc7-d5db1cf12321',auth.uid());
INSERT INTO public.forum_bookmarks(post_id,user_id) VALUES ('c2818d1a-f04b-4f09-8bc7-d5db1cf12321',auth.uid());
SELECT set_config('request.jwt.claim.sub','a2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DELETE FROM public.forum_posts WHERE id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321';
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_my_community_stats();
  IF s.likes_received <> 0 OR s.saves_received <> 0 THEN RAISE EXCEPTION 'Delete post stats'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','b2818d1a-f04b-4f09-8bc7-d5db1cf12321',true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.forum_bookmarks WHERE post_id='c2818d1a-f04b-4f09-8bc7-d5db1cf12321') THEN RAISE EXCEPTION 'Deleted post bookmark retained'; END IF;
END $$;
RESET ROLE;
SELECT true AS owner_private_and_public_access, true AS other_member_private_read_write_denied,
  true AS storage_metadata_visibility, true AS save_identities_private,
  true AS real_stats_self_exclusion_and_account_isolation, true AS private_republish_saved_stats_linkage,
  true AS unlike_unsave_unfollow_and_post_delete_linkage;
ROLLBACK;
