"""Apply only the authorized sharing-function repair to the recovery database."""
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
    stage = 'recovery sharing-function transaction'
    sql = (Path(__file__).resolve().parent.parent / 'supabase/migrations/20261023030000_marine_help_snapshots.sql').read_text()
    with psycopg.connect(uri, sslmode='require', connect_timeout=20) as db:
        db.execute("SET statement_timeout = '45s'")
        db.execute("SET lock_timeout = '8s'")
        db.execute('SELECT pg_advisory_xact_lock(20261023, 30000)')
        prior = db.execute('SELECT statements FROM supabase_migrations.schema_migrations WHERE version = %s', ('20261023030000',)).fetchone()
        if prior:
            assert prior[0] == [sql], 'Migration source differs'
        else:
            db.execute(sql)
            db.execute('INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (%s,%s,%s)',
                       ('20261023030000', 'marine_help_snapshots', [sql]))
        assert not db.execute("SELECT has_function_privilege('anon','public.share_marine_encounter_snapshot(uuid,text)','EXECUTE')").fetchone()[0]
        assert db.execute("SELECT has_function_privilege('authenticated','public.share_marine_encounter_snapshot(uuid,text)','EXECUTE')").fetchone()[0]
        assert db.execute("SELECT count(*) FROM storage.buckets WHERE id IN ('marine-photos','forum-media') AND public=false").fetchone()[0] == 2
    print('PASS: recovery_only_versioned_sharing_functions_migration_and_anonymous_denial')
except Exception as error:
    print(f'Marine sharing schema incomplete during {stage} ({type(error).__name__}); details suppressed.')
    raise SystemExit(1)
