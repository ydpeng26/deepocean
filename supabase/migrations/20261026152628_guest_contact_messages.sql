-- Separate, write-through-server visitor inbox. Never expose rows to visitors.
-- Filename aligned with the version recorded by the recovery migration service.
CREATE TABLE public.guest_contact_messages (
  id uuid PRIMARY KEY,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  browser_hash text NOT NULL CHECK (browser_hash ~ '^[0-9a-f]{64}$'),
  network_hash text NOT NULL CHECK (network_hash ~ '^[0-9a-f]{64}$'),
  category text NOT NULL CHECK (category IN ('suggestion', 'issue', 'other')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000 AND body ~ '[^[:space:]]'),
  reply_email text CHECK (char_length(reply_email) BETWEEN 3 AND 254 AND reply_email !~ '[[:space:]]'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX guest_contact_created_idx ON public.guest_contact_messages(created_at DESC);
CREATE INDEX guest_contact_browser_created_idx ON public.guest_contact_messages(browser_hash, created_at DESC);
CREATE INDEX guest_contact_network_created_idx ON public.guest_contact_messages(network_hash, created_at DESC);
ALTER TABLE public.guest_contact_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_contact_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.guest_contact_messages TO service_role;

-- Invoker-only entrypoint: browser roles have neither table access nor EXECUTE.
-- A short global lock serializes count checks and insert, including concurrent
-- requests with different browser/network hashes. No caller can backdate a row.
CREATE FUNCTION public.submit_guest_contact(
  p_id uuid, p_request_hash text, p_browser_hash text, p_network_hash text,
  p_category text, p_body text, p_reply_email text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_prior public.guest_contact_messages%ROWTYPE;
BEGIN
  IF (SELECT auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'contact_denied' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
    OR p_browser_hash IS NULL OR p_browser_hash !~ '^[0-9a-f]{64}$'
    OR p_network_hash IS NULL OR p_network_hash !~ '^[0-9a-f]{64}$'
    OR p_category IS NULL OR p_category NOT IN ('suggestion', 'issue', 'other')
    OR p_body IS NULL OR char_length(p_body) NOT BETWEEN 1 AND 3000 OR p_body !~ '[^[:space:]]'
    OR (p_reply_email IS NOT NULL AND (char_length(p_reply_email) NOT BETWEEN 3 AND 254 OR p_reply_email ~ '[[:space:]]')) THEN
    RAISE EXCEPTION 'contact_invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(39022, 1);
  SELECT * INTO v_prior FROM public.guest_contact_messages WHERE id = p_id;
  IF FOUND THEN
    IF v_prior.request_hash = p_request_hash AND v_prior.browser_hash = p_browser_hash THEN
      RETURN p_id; -- Exact opaque receipt only, never return content or email.
    END IF;
    RAISE EXCEPTION 'contact_conflict' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.guest_contact_messages
       WHERE browser_hash = p_browser_hash AND created_at > clock_timestamp() - interval '1 minute')
    OR (SELECT count(*) FROM public.guest_contact_messages WHERE browser_hash = p_browser_hash AND created_at > clock_timestamp() - interval '24 hours') >= 5
    OR (SELECT count(*) FROM public.guest_contact_messages WHERE network_hash = p_network_hash AND created_at > clock_timestamp() - interval '1 minute') >= 3
    OR (SELECT count(*) FROM public.guest_contact_messages WHERE network_hash = p_network_hash AND created_at > clock_timestamp() - interval '24 hours') >= 20
    OR (SELECT count(*) FROM public.guest_contact_messages WHERE created_at > clock_timestamp() - interval '1 minute') >= 30
    OR (SELECT count(*) FROM public.guest_contact_messages WHERE created_at > clock_timestamp() - interval '24 hours') >= 300 THEN
    RAISE EXCEPTION 'contact_rate_limit' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.guest_contact_messages(id, request_hash, browser_hash, network_hash, category, body, reply_email)
    VALUES(p_id, p_request_hash, p_browser_hash, p_network_hash, p_category, p_body, p_reply_email);
  RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_guest_contact(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_contact(uuid,text,text,text,text,text,text) TO service_role;
