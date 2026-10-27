-- RECOVERY ONLY. All synthetic records and auth rows roll back. No login or files.
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$ begin
 if exists(select 1 from auth.users where id in ('a6272700-1111-4111-8111-111111111111','b6272700-1111-4111-8111-111111111111')) then raise exception 'fixture_collision'; end if;
end $$;
insert into auth.users(id,raw_user_meta_data) values
 ('a6272700-1111-4111-8111-111111111111','{"display_name":"Synthetic deletion A"}'),
 ('b6272700-1111-4111-8111-111111111111','{"display_name":"Synthetic deletion B"}');
insert into public.forum_posts(id,user_id,body,visibility,image_path) values
 ('c6272700-1111-4111-8111-111111111111','a6272700-1111-4111-8111-111111111111','Synthetic retained text','public','a6272700-1111-4111-8111-111111111111/synthetic.png'),
 ('d6272700-1111-4111-8111-111111111111','a6272700-1111-4111-8111-111111111111','Synthetic private text','private',null);
insert into public.forum_comments(id,post_id,user_id,body) values
 ('e6272700-1111-4111-8111-111111111111','c6272700-1111-4111-8111-111111111111','a6272700-1111-4111-8111-111111111111','Synthetic retained response');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6272700-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 if not account_private.member_active() then raise exception 'active_member_denied'; end if;
 begin perform public.account_deletion_step(auth.uid(),'f6272700-1111-4111-8111-111111111111','begin'); raise exception 'client_worker_allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.account_deletion_step('a6272700-1111-4111-8111-111111111111','f6272700-1111-4111-8111-111111111111','begin');
reset role;
do $$ begin
 if exists(select 1 from public.forum_posts where id='d6272700-1111-4111-8111-111111111111') then raise exception 'private_retained'; end if;
 if not exists(select 1 from public.forum_posts where id='c6272700-1111-4111-8111-111111111111' and user_id is null and image_path is null and author_name='已注销用户') then raise exception 'post_not_anonymous'; end if;
 if not exists(select 1 from public.forum_comments where id='e6272700-1111-4111-8111-111111111111' and user_id is null and author_name='已注销用户') then raise exception 'comment_not_anonymous'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6272700-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 if account_private.member_active() then raise exception 'pending_still_active'; end if;
 if exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'pending_read_allowed'; end if;
 begin insert into public.gear_items(user_id,category,brand) values(auth.uid(),'mask','SYNTHETIC'); raise exception 'pending_write_allowed';
 exception when insufficient_privilege then null; when raise_exception then if sqlerrm<>'account_unavailable' then raise; end if; end;
end $$;
-- Simulate a legacy definer bypassing RLS: trigger must still check original JWT.
reset role;
do $$ begin
 begin insert into public.gear_items(user_id,category,brand) values('a6272700-1111-4111-8111-111111111111','mask','SYNTHETIC'); raise exception 'legacy_bypass_allowed';
 exception when raise_exception then if sqlerrm<>'account_unavailable' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
delete from auth.users where id='a6272700-1111-4111-8111-111111111111';
set local role service_role;
select public.account_deletion_step('a6272700-1111-4111-8111-111111111111','f6272700-1111-4111-8111-111111111111','finish');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b6272700-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 if not exists(select 1 from public.forum_posts where id='c6272700-1111-4111-8111-111111111111' and user_id is null) then raise exception 'anonymous_post_hidden'; end if;
 update public.forum_posts set user_id=auth.uid() where id='c6272700-1111-4111-8111-111111111111';
 if found then raise exception 'anonymous_post_claimed'; end if;
end $$;
reset role;
select 'PASS: private removal, post/comment anonymity, client worker denial, active-member liveness, pending read/write and definer write barriers, Auth cascade and nonclaimable discussion' as result;
rollback;
