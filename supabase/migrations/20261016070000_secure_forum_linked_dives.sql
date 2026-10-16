DROP POLICY IF EXISTS "members create own forum posts" ON public.forum_posts;
DROP POLICY IF EXISTS "members update own forum posts" ON public.forum_posts;

CREATE POLICY "members create own forum posts" ON public.forum_posts
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    linked_dive_id IS NULL
    OR EXISTS (SELECT 1 FROM public.dives WHERE dives.id = linked_dive_id AND dives.user_id = auth.uid())
  )
);

CREATE POLICY "members update own forum posts" ON public.forum_posts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    linked_dive_id IS NULL
    OR EXISTS (SELECT 1 FROM public.dives WHERE dives.id = linked_dive_id AND dives.user_id = auth.uid())
  )
);
