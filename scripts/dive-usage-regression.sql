-- Run ONLY on recovery test project. Every test change is rolled back.
BEGIN;
DO $$
DECLARE u uuid; g uuid := gen_random_uuid(); d uuid := gen_random_uuid(); baseline integer; failed boolean := false;
BEGIN
  SELECT id, tank_count INTO u, baseline FROM public.profiles LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'Test profile required'; END IF;
  PERFORM set_config('request.jwt.claim.sub', u::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.gear_items(id,user_id,category,brand,dive_count) VALUES(g,u,'mask','Synthetic counter test',7);
  INSERT INTO public.dives(id,user_id,country,site_name,dive_date,count_tank,used_gear_ids)
    VALUES(d,u,'Indonesia','Synthetic counter test',current_date,true,ARRAY[g,g]);
  IF (SELECT tank_count FROM public.profiles WHERE id=u) <> baseline+1 OR (SELECT dive_count FROM public.gear_items WHERE id=g) <> 8 THEN RAISE EXCEPTION 'Insert or dedup failed'; END IF;
  UPDATE public.dives SET notes='Unrelated edit' WHERE id=d;
  INSERT INTO public.dives(id,user_id,country,site_name,dive_date,count_tank,used_gear_ids)
    VALUES(d,u,'Indonesia','Retry',current_date,true,ARRAY[g]) ON CONFLICT(id) DO NOTHING;
  IF (SELECT tank_count FROM public.profiles WHERE id=u) <> baseline+1 OR (SELECT dive_count FROM public.gear_items WHERE id=g) <> 8 THEN RAISE EXCEPTION 'Retry counted twice'; END IF;
  UPDATE public.dives SET count_tank=false,used_gear_ids='{}' WHERE id=d;
  IF (SELECT tank_count FROM public.profiles WHERE id=u) <> baseline OR (SELECT dive_count FROM public.gear_items WHERE id=g) <> 7 THEN RAISE EXCEPTION 'Uncheck failed'; END IF;
  BEGIN
    UPDATE public.dives SET count_tank=true,used_gear_ids=ARRAY[gen_random_uuid()] WHERE id=d;
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  IF NOT failed OR (SELECT tank_count FROM public.profiles WHERE id=u) <> baseline OR (SELECT count_tank FROM public.dives WHERE id=d) THEN RAISE EXCEPTION 'Atomic rejection failed'; END IF;
  UPDATE public.dives SET count_tank=true,used_gear_ids=ARRAY[g] WHERE id=d;
  DELETE FROM public.dives WHERE id=d;
  IF (SELECT tank_count FROM public.profiles WHERE id=u) <> baseline OR (SELECT dive_count FROM public.gear_items WHERE id=g) <> 7 THEN RAISE EXCEPTION 'Delete failed'; END IF;
END $$;
ROLLBACK;
