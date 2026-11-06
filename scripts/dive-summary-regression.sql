-- Recovery test only: authenticated writes to synthetic rows, all rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles ORDER BY id LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT set_config('supdiver.test_baseline',(SELECT coalesce(tank_count,0)::text FROM public.profiles WHERE id=auth.uid()),true);
SELECT set_config('supdiver.test_checks','{}',true);
INSERT INTO public.gear_items(id,user_id,category,brand,dive_count)
VALUES('f846b6a5-4b2f-4c01-bf3d-6845f2a00001',auth.uid(),'mask','Synthetic summary test',7);
INSERT INTO public.dives(id,user_id,country,region,site_name,dive_date,record_mode,dive_count,date_precision,period_end,site_names,max_depth,duration_min,count_tank,used_gear_ids)
VALUES('f846b6a5-4b2f-4c01-bf3d-6845f2a00002',auth.uid(),'Philippines','Malapascua','Synthetic summary test','2024-03-01','summary',12,'month','2024-03-31',ARRAY['Monad Shoal','Gato Island'],30,60,true,ARRAY['f846b6a5-4b2f-4c01-bf3d-6845f2a00001','f846b6a5-4b2f-4c01-bf3d-6845f2a00001']::uuid[]);
SELECT set_config('supdiver.test_checks',jsonb_build_object(
'insert_tanks',tank_count=current_setting('supdiver.test_baseline')::integer+12,
'insert_gear',(SELECT dive_count=19 FROM public.gear_items WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00001'),
'one_entry_twelve_dives',(SELECT count(*)=1 AND sum(dive_count)=12 FROM public.dives WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00002'))::text,true)
FROM public.profiles WHERE id=auth.uid();
UPDATE public.dives SET notes='Unrelated edit' WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00002';
INSERT INTO public.dives(id,user_id,country,site_name,dive_date) VALUES('f846b6a5-4b2f-4c01-bf3d-6845f2a00002',auth.uid(),'Philippines','Retry','2024-03-01') ON CONFLICT(id) DO NOTHING;
SELECT set_config('supdiver.test_checks',(current_setting('supdiver.test_checks')::jsonb || jsonb_build_object(
'retry_idempotent',tank_count=current_setting('supdiver.test_baseline')::integer+12 AND (SELECT dive_count=19 FROM public.gear_items WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00001')))::text,true)
FROM public.profiles WHERE id=auth.uid();
UPDATE public.dives SET dive_count=20 WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00002';
SELECT set_config('supdiver.test_checks',(current_setting('supdiver.test_checks')::jsonb || jsonb_build_object(
'count_edit_tanks',tank_count=current_setting('supdiver.test_baseline')::integer+20,
'count_edit_gear',(SELECT dive_count=27 FROM public.gear_items WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00001')))::text,true)
FROM public.profiles WHERE id=auth.uid();
UPDATE public.dives SET dive_count=5,count_tank=false WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00002';
SELECT set_config('supdiver.test_checks',(current_setting('supdiver.test_checks')::jsonb || jsonb_build_object(
'decrease_and_uncheck',tank_count=current_setting('supdiver.test_baseline')::integer AND (SELECT dive_count=12 FROM public.gear_items WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00001')))::text,true)
FROM public.profiles WHERE id=auth.uid();
UPDATE public.dives SET record_mode='precise',dive_count=1,date_precision='day',period_end=NULL,site_names='{}',count_tank=true WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00002';
SELECT set_config('supdiver.test_checks',(current_setting('supdiver.test_checks')::jsonb || jsonb_build_object(
'mode_conversion',tank_count=current_setting('supdiver.test_baseline')::integer+1 AND (SELECT dive_count=8 FROM public.gear_items WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00001')))::text,true)
FROM public.profiles WHERE id=auth.uid();
UPDATE public.dives SET record_mode='summary',dive_count=12,date_precision='year',dive_date='2024-01-01',period_end='2024-12-31',total_duration_min=600 WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00002';
DELETE FROM public.dives WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00002';
SELECT current_setting('supdiver.test_checks')::jsonb || jsonb_build_object(
'delete_restores_tanks',tank_count=current_setting('supdiver.test_baseline')::integer,
'delete_restores_gear',(SELECT dive_count=7 FROM public.gear_items WHERE id='f846b6a5-4b2f-4c01-bf3d-6845f2a00001')) AS checks
FROM public.profiles WHERE id=auth.uid();
ROLLBACK;
