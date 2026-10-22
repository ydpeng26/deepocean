-- Immutable photo-version copies. No existing rows, photos, or bucket policies change.
CREATE OR REPLACE FUNCTION public.share_marine_encounter_snapshot(target_id uuid, expected_photo_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE e public.marine_encounters; post_id uuid; picture text; unknown_species boolean;
BEGIN
  SELECT * INTO e FROM public.marine_encounters WHERE id = target_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '只能转发自己的海洋相遇'; END IF;
  SELECT id INTO post_id FROM public.forum_posts WHERE source_encounter_id = target_id AND user_id = auth.uid();
  IF post_id IS NOT NULL THEN RETURN post_id; END IF;
  IF expected_photo_path IS DISTINCT FROM e.photo_path OR e.photo_path NOT LIKE auth.uid()::text || '/%' THEN
    RAISE EXCEPTION '相遇照片已变化，请重新载入后转发';
  END IF;
  picture := auth.uid()::text || '/encounter-' || target_id::text || '-' || encode(sha256(convert_to(e.photo_path, 'UTF8')), 'hex') || '.jpg';
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'marine-photos' AND name = e.photo_path)
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'forum-media' AND name = picture) THEN
    RAISE EXCEPTION '转发图片尚未准备完成，请重试';
  END IF;
  unknown_species := e.needs_help AND (btrim(e.species_name) = '' OR e.species_name = '待识别');
  INSERT INTO public.forum_posts(user_id, title, body, topic, location, image_path, source_encounter_id)
  VALUES (auth.uid(), CASE WHEN unknown_species THEN '请帮我识别这位海洋朋友' ELSE '我的海洋相遇：' || e.species_name END,
    '生物名称：' || e.species_name || E'\n相遇时间：' || e.encountered_on::text || E'\n相遇地点：' || e.location ||
    CASE WHEN e.needs_help THEN E'\n\n希望其他潜水员帮助识别，欢迎留言分享生物名称、识别特征与参考依据。' ELSE E'\n\n记录这次与海洋生命相遇的瞬间。' END,
    'encyclopedia', e.location, picture, target_id)
  RETURNING id INTO post_id;
  RETURN post_id;
END;
$$;
REVOKE ALL ON FUNCTION public.share_marine_encounter_snapshot(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_marine_encounter_snapshot(uuid,text) TO authenticated;

-- Old cached clients may open an existing independent copy, but must refresh
-- before creating one: their fixed-path upload cannot identify the photo version.
CREATE OR REPLACE FUNCTION public.share_marine_encounter(target_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE post_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marine_encounters WHERE id = target_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION '只能转发自己的海洋相遇';
  END IF;
  SELECT id INTO post_id FROM public.forum_posts WHERE source_encounter_id = target_id AND user_id = auth.uid();
  IF post_id IS NOT NULL THEN RETURN post_id; END IF;
  RAISE EXCEPTION '请刷新页面后重新转发，以确保照片版本一致';
END;
$$;
REVOKE ALL ON FUNCTION public.share_marine_encounter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_marine_encounter(uuid) TO authenticated;
