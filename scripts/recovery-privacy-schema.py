"""Apply the photo-reference repair only to the allowlisted recovery database."""
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
        db.execute("SET lock_timeout = '8s'")
        db.execute('SELECT pg_advisory_xact_lock(20261022, 70000)')
        applied = db.execute('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = %s', ('20261022070000',)).fetchone()
        if not applied:
            sql = (Path(__file__).resolve().parent.parent / 'supabase/migrations/20261022070000_photo_reference_privacy.sql').read_text()
            db.execute(sql)
            db.execute('INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (%s,%s,%s)',
                       ('20261022070000', 'photo_reference_privacy', [sql]))
        assert db.execute("SELECT count(*) FROM pg_constraint WHERE conname IN ('marine_photo_owned_path','forum_photo_owned_path') AND contype='c'").fetchone()[0] == 2
        assert db.execute("SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='photo reference privacy boundary' AND permissive='RESTRICTIVE' AND cmd='SELECT'").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM storage.buckets WHERE id IN ('marine-photos','forum-media') AND public=false").fetchone()[0] == 2
    print('PASS: recovery_only_photo_reference_migration_constraints_and_restrictive_read_boundary')
except Exception as error:
    print(f'Privacy schema incomplete during {stage} ({type(error).__name__}); details suppressed.')
    raise SystemExit(1)
