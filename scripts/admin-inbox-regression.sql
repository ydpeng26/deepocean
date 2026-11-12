-- Recovery project only. Synthetic messages and temporary membership roll back.
BEGIN;
SELECT set_config('inbox.checks','{}',true);
SELECT set_config('inbox.admin',(SELECT id::text FROM public.profiles ORDER BY id LIMIT 1),true);
SELECT set_config('inbox.member',(SELECT id::text FROM public.profiles WHERE id::text <> current_setting('inbox.admin') ORDER BY id LIMIT 1),true);
INSERT INTO supdiver_private.feedback_administrators(user_id) VALUES(current_setting('inbox.admin')::uuid);
SELECT set_config('request.jwt.claim.sub',current_setting('inbox.member'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('inbox.member'),'role','authenticated','user_metadata',jsonb_build_object('admin',true))::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.website_feedback(id,user_id,category,body)
VALUES('f846b6a5-4b2f-4c01-bf3d-6845f2b00001',auth.uid(),'suggestion','Synthetic inbox member message');
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || (SELECT to_jsonb(checks) FROM (
SELECT NOT public.is_feedback_admin() AS metadata_cannot_grant_admin,
  (SELECT count(*)=1 FROM public.website_feedback WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00001') AS member_reads_own,
  (SELECT count(*)=0 FROM public.feedback_inbox) AS member_cannot_read_inbox
) checks))::text,true);
WITH changed AS (UPDATE public.website_feedback SET status='resolved' WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00001' RETURNING id)
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || jsonb_build_object('member_cannot_change_status',count(*)=0))::text,true) FROM changed;
RESET ROLE;
INSERT INTO public.guest_contact_messages(id,request_hash,browser_hash,network_hash,category,body,reply_email)
VALUES('f846b6a5-4b2f-4c01-bf3d-6845f2b00002',repeat('a',64),repeat('b',64),repeat('c',64),'issue','Synthetic inbox guest message','synthetic@example.invalid');
SET LOCAL ROLE authenticated;
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || (SELECT to_jsonb(checks) FROM (
SELECT (SELECT count(*)=0 FROM public.guest_contact_messages WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00002') AS member_cannot_read_guest
) checks))::text,true);
SELECT set_config('request.jwt.claim.sub',current_setting('inbox.admin'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('inbox.admin'),'role','authenticated')::text,true);
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || (SELECT to_jsonb(checks) FROM (
SELECT public.is_feedback_admin() AS admin_verified,
  (SELECT count(*)=2 FROM public.feedback_inbox WHERE id IN ('f846b6a5-4b2f-4c01-bf3d-6845f2b00001','f846b6a5-4b2f-4c01-bf3d-6845f2b00002')) AS admin_reads_both_sources,
  NOT has_column_privilege(current_user,'public.guest_contact_messages','network_hash','SELECT') AS hashes_hidden,
  NOT has_table_privilege(current_user,'supdiver_private.feedback_administrators','INSERT') AS membership_not_editable,
  NOT has_column_privilege(current_user,'public.website_feedback','body','UPDATE') AS member_body_immutable,
  NOT has_column_privilege(current_user,'public.guest_contact_messages','body','UPDATE') AS guest_body_immutable,
  NOT has_table_privilege('anon','public.feedback_inbox','SELECT') AS anonymous_denied,
  NOT has_function_privilege('anon','public.is_feedback_admin()','EXECUTE') AS anonymous_rpc_denied
) checks))::text,true);
UPDATE public.website_feedback SET status='read' WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00001' AND status='unread';
UPDATE public.guest_contact_messages SET status='resolved' WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00002' AND status='unread';
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || (SELECT to_jsonb(checks) FROM (
SELECT (SELECT status='read' AND body='Synthetic inbox member message' FROM public.feedback_inbox WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00001') AS member_status_saved,
  (SELECT status='resolved' AND body='Synthetic inbox guest message' FROM public.feedback_inbox WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00002') AS guest_status_saved
) checks))::text,true);
WITH changed AS (UPDATE public.guest_contact_messages SET status='read' WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00002' AND status='unread' RETURNING id)
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || jsonb_build_object('stale_update_cannot_overwrite',count(*)=0))::text,true) FROM changed;
RESET ROLE;
INSERT INTO account_private.deletion_jobs(id,user_id) VALUES('f846b6a5-4b2f-4c01-bf3d-6845f2b00003',current_setting('inbox.admin')::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || (SELECT to_jsonb(checks) FROM (
SELECT NOT public.is_feedback_admin() AS deleting_admin_denied,
  (SELECT count(*)=0 FROM public.feedback_inbox) AS deleting_admin_inbox_empty
) checks))::text,true);
RESET ROLE;
DELETE FROM account_private.deletion_jobs WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2b00003';
DELETE FROM supdiver_private.feedback_administrators WHERE user_id=current_setting('inbox.admin')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('inbox.checks',(current_setting('inbox.checks')::jsonb || (SELECT to_jsonb(checks) FROM (
SELECT NOT public.is_feedback_admin() AS revoked_admin_denied,
  (SELECT count(*)=0 FROM public.feedback_inbox) AS revoked_admin_inbox_empty
) checks))::text,true);
SELECT current_setting('inbox.checks')::jsonb AS checks;
ROLLBACK;
