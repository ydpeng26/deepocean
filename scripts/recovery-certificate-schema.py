"""Cloud-only, recovery-only additive certificate schema. No production credentials."""
import os
from pathlib import Path
from urllib.parse import urlsplit, unquote, parse_qsl
import psycopg

stage = 'preflight'
try:
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('Cloud required')
    uri = os.environ['RECOVERY_DB_URL']
    parsed = urlsplit(uri)
    if not (parsed.scheme in ('postgresql', 'postgres')
            and unquote(parsed.username or '') == 'postgres.esovqvampbrhuhamkfcs'
            and (parsed.hostname or '').endswith('.pooler.supabase.com')
            and parsed.port == 5432 and parsed.path == '/postgres' and parsed.password
            and not parsed.fragment
            and all(key == 'sslmode' and value in ('require', 'verify-ca', 'verify-full') for key, value in parse_qsl(parsed.query))):
        raise RuntimeError('Recovery session URI required')
    stage = 'recovery schema transaction'
    with psycopg.connect(uri, sslmode='require', connect_timeout=20) as db:
        db.execute("SET statement_timeout = '45s'")
        db.execute("SELECT pg_advisory_xact_lock(20261022, 20000)")
        applied = db.execute("SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = %s", ('20261022020000',)).fetchone()
        if not applied:
            sql = (Path(__file__).resolve().parent.parent / 'supabase/migrations/20261022020000_certificate_vault.sql').read_text()
            db.execute(sql)
            db.execute("INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (%s,%s,%s)",
                       ('20261022020000', 'certificate_vault', [sql]))
        assert db.execute("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.diver_certificates'::regclass").fetchone()[0]
        assert db.execute("SELECT public FROM storage.buckets WHERE id='certificate-fronts'").fetchone() == (False,)
        assert not db.execute("SELECT has_function_privilege('anon', 'public.get_public_diver_certificates(uuid)', 'EXECUTE')").fetchone()[0]
        assert db.execute("SELECT pg_get_function_result('public.get_public_diver_certificates(uuid)'::regprocedure)").fetchone()[0] == 'TABLE(id uuid, agency text, level text, issued_on date, issued_at text)'
    print('PASS: recovery_certificate_schema_private_bucket_rls_and_safe_rpc')
except Exception as error:
    print(f'Certificate schema incomplete during {stage} ({type(error).__name__}); details suppressed.')
    raise SystemExit(1)
