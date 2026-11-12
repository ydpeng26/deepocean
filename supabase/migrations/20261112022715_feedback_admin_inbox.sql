-- Administrator membership is provisioned by an operator, never by a browser.
CREATE SCHEMA IF NOT EXISTS supdiver_private;
REVOKE ALL ON SCHEMA supdiver_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA supdiver_private TO authenticated;
CREATE TABLE supdiver_private.feedback_administrators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE supdiver_private.feedback_administrators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON supdiver_private.feedback_administrators FROM PUBLIC, anon, authenticated;
GRANT ALL ON supdiver_private.feedback_administrators TO service_role;

-- Narrow definer helper: returns only whether the caller is an active admin.
-- No caller-supplied user id, email, or user-editable metadata is trusted.
CREATE FUNCTION supdiver_private.is_feedback_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND account_private.member_active()
    AND EXISTS (SELECT 1 FROM supdiver_private.feedback_administrators a WHERE a.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION supdiver_private.is_feedback_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION supdiver_private.is_feedback_admin() TO authenticated;
CREATE FUNCTION public.is_feedback_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT supdiver_private.is_feedback_admin();
$$;
REVOKE ALL ON FUNCTION public.is_feedback_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_feedback_admin() TO authenticated;

ALTER TABLE public.website_feedback ADD COLUMN status text NOT NULL DEFAULT 'unread'
  CHECK (status IN ('unread','read','resolved'));
ALTER TABLE public.guest_contact_messages ADD COLUMN status text NOT NULL DEFAULT 'unread'
  CHECK (status IN ('unread','read','resolved'));
CREATE POLICY "feedback admins read" ON public.website_feedback FOR SELECT TO authenticated
  USING ((SELECT supdiver_private.is_feedback_admin()));
CREATE POLICY "feedback admins update status" ON public.website_feedback FOR UPDATE TO authenticated
  USING ((SELECT supdiver_private.is_feedback_admin()))
  WITH CHECK ((SELECT supdiver_private.is_feedback_admin()));
CREATE POLICY "feedback admins read" ON public.guest_contact_messages FOR SELECT TO authenticated
  USING ((SELECT supdiver_private.is_feedback_admin()));
CREATE POLICY "feedback admins update status" ON public.guest_contact_messages FOR UPDATE TO authenticated
  USING ((SELECT supdiver_private.is_feedback_admin()))
  WITH CHECK ((SELECT supdiver_private.is_feedback_admin()));
-- Guest anti-abuse hashes remain unavailable even to browser administrators.
GRANT SELECT (id,category,body,reply_email,created_at,status)
  ON public.guest_contact_messages TO authenticated;
GRANT UPDATE (status) ON public.website_feedback, public.guest_contact_messages TO authenticated;
CREATE VIEW public.feedback_inbox WITH (security_invoker = true) AS
  SELECT 'member'::text AS source, id, user_id, category, body,
    NULL::text AS reply_email, created_at, status
  FROM public.website_feedback WHERE (SELECT supdiver_private.is_feedback_admin())
  UNION ALL
  SELECT 'guest'::text AS source, id, NULL::uuid AS user_id, category, body,
    reply_email, created_at, status
  FROM public.guest_contact_messages WHERE (SELECT supdiver_private.is_feedback_admin());
REVOKE ALL ON public.feedback_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feedback_inbox TO authenticated;
NOTIFY pgrst, 'reload schema';
