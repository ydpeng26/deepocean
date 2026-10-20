"""Manual, cloud-only recovery drill. Production credentials are never supplied."""
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse, unquote, quote

import boto3
import psycopg
from psycopg import sql
import requests

TARGET = 'esovqvampbrhuhamkfcs'
PRODUCTION = 'zmhtlhpeulhhcvlnjdrb'
BUCKET = 'supdiver-backups'


def check(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def validate_target(url):
    parsed = urlparse(url)
    check(PRODUCTION not in url and unquote(parsed.username or '') == 'postgres.' + TARGET and
          (parsed.hostname or '').endswith('.pooler.supabase.com') and parsed.port == 5432 and
          parsed.path == '/postgres' and parsed.scheme == 'postgresql' and parsed.password,
          'Safety stop: target must be the allowlisted test project session pooler.')
    return parsed


def main():
    check(os.environ.get('GITHUB_ACTIONS') == 'true', 'Cloud runner required.')
    for key in ['RECOVERY_DB_URL', 'RECOVERY_SERVICE_ROLE_KEY', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT']:
        check(bool(os.environ.get(key)), 'Missing secret: ' + key)
    url = os.environ['RECOVERY_DB_URL'].strip()
    parsed = validate_target(url)
    print('Stage: verify isolated target is empty', flush=True)
    target_url = 'https://' + TARGET + '.supabase.co'
    session = requests.Session()
    key = os.environ['RECOVERY_SERVICE_ROLE_KEY'].strip()
    session.headers.update({'apikey': key, 'Authorization': 'Bearer ' + key})

    def api(method, path, **kwargs):
        response = session.request(method, target_url + path, timeout=(20, 180), **kwargs)
        check(response.ok, 'Test project API request failed (HTTP ' + str(response.status_code) + ').')
        return response

    # Check that the key belongs to the target without writing any data.
    check(api('GET', '/storage/v1/bucket').json() == [], 'Safety stop: target storage must be empty.')
    with psycopg.connect(url, connect_timeout=20, sslmode='require', autocommit=True) as conn:
        check(conn.execute('SELECT count(*) FROM auth.users').fetchone()[0] == 0,
              'Safety stop: test project already has users. No overwrite performed.')
        check(conn.execute("SELECT count(*) FROM pg_tables WHERE schemaname='public'").fetchone()[0] == 0,
              'Safety stop: test public schema must be empty. No overwrite performed.')

    s3 = boto3.client('s3', endpoint_url=os.environ['R2_ENDPOINT'].strip(), region_name='auto',
                      aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'])
    completed = []
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=BUCKET, Prefix='snapshots/'):
        completed.extend(o['Key'] for o in page.get('Contents', []) if o['Key'].endswith('/complete.json'))
    check(bool(completed), 'No complete backup exists.')
    prefix = sorted(completed)[-1].rsplit('/', 1)[0] + '/'
    marker = json.loads(s3.get_object(Bucket=BUCKET, Key=prefix + 'complete.json')['Body'].read())
    payload = s3.get_object(Bucket=BUCKET, Key=prefix + 'manifest.json')['Body'].read()
    check(hashlib.sha256(payload).hexdigest() == marker['manifest_sha256'], 'Manifest integrity failed.')
    manifest = json.loads(payload)
    print('Stage: download and verify backup in ephemeral cloud runner', flush=True)
    env = os.environ.copy()
    env.update(PGHOST=parsed.hostname, PGPORT='5432', PGUSER=unquote(parsed.username),
               PGPASSWORD=unquote(parsed.password or ''), PGDATABASE='postgres', PGSSLMODE='require',
               PGOPTIONS='-c session_replication_role=replica')
    with tempfile.TemporaryDirectory(prefix='recovery-', dir=os.environ['RUNNER_TEMP']) as temp:
        root = Path(temp)
        archive = root / 'database.dump'
        entry = manifest['database']['database.dump']
        check(entry['key'] == prefix + 'database.dump', 'Unexpected archive location.')
        s3.download_file(BUCKET, entry['key'], str(archive))
        check(digest(archive) == entry['sha256'], 'Database archive integrity failed.')

        def pg(arguments, program='pg_restore'):
            command = ['docker', 'run', '--rm', '--volume', str(root) + ':' + str(root)]
            for variable in ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGOPTIONS']:
                command += ['--env', variable]
            result = subprocess.run(command + ['postgres:17', program] + arguments,
                                    env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode:
                # Only emit error categories, never SQL, data, paths or credentials.
                error = result.stderr.decode(errors='replace').lower()
                categories = [c for c in ['permission denied', 'already exists', 'does not exist',
                              'violates foreign key', 'duplicate key', 'unsupported version',
                              'password authentication failed', 'could not connect'] if c in error]
                constraints = re.findall(r'violates foreign key constraint "([a-z0-9_]+)"', error)
                if constraints:
                    categories += ['constraint=' + c for c in sorted(set(constraints))]
                objects = re.findall(r'permission denied (?:for|to) (?:set parameter|schema|table|function|sequence|relation) "?([a-z0-9_.]+)', error)
                categories += ['object=' + c for c in sorted(set(objects))]
                raise RuntimeError('Restore command failed; categories: ' + ', '.join(categories or ['unclassified']))
            return result.stdout.decode()

        toc = pg(['--list', str(archive)])
        selected = []
        for line in toc.splitlines():
            if not line or line.startswith(';'):
                continue
            if ' SCHEMA - public ' in line or ' ACL - SCHEMA public ' in line:
                continue
            if (' public ' in line or ' supabase_migrations ' in line or
                (' TABLE DATA auth ' in line and ' schema_migrations ' not in line) or
                ' POLICY storage ' in line or ' POLICY auth ' in line or ' TRIGGER auth ' in line):
                selected.append(line)
        check(bool(selected), 'No application entries in archive.')
        listing = root / 'restore.list'
        listing.write_text('\n'.join(selected) + '\n')
        data = root / 'data.sql'
        pg(['--data-only', '--file=' + str(data), '--use-list=' + str(listing), str(archive)])
        expected = {}
        table = None
        with data.open() as source:
            for line in source:
                match = re.match(r'^COPY (public|auth|supabase_migrations)\.([a-zA-Z_][a-zA-Z_0-9]*) \(', line)
                if match:
                    table = tuple(match.groups())
                    expected[table] = 0
                elif line.rstrip('\n') == '\\.':
                    table = None
                elif table:
                    expected[table] += 1
        print('Stage: restore application schema and account data transactionally', flush=True)
        restore_sql = root / 'restore.sql'
        pg(['--file=' + str(restore_sql), '--no-owner', '--no-tablespaces',
            '--use-list=' + str(listing), str(archive)])
        # Poolers may not forward PGOPTIONS. Set this inside the restoring session,
        # as recommended by Supabase, so existing Auth FKs don't depend on dump order.
        pg(['--dbname=postgres', '--single-transaction', '--set=ON_ERROR_STOP=1',
            '--command=SET session_replication_role = replica', '--file=' + str(restore_sql)], 'psql')
        with psycopg.connect(url, connect_timeout=20, sslmode='require', autocommit=True) as conn:
            for (schema, name), count in expected.items():
                actual = conn.execute(sql.SQL('SELECT count(*) FROM {}.{}').format(
                    sql.Identifier(schema), sql.Identifier(name))).fetchone()[0]
                check(actual == count, 'Restored table count mismatch (details suppressed).')
            tables = conn.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'").fetchall()
            # Ensure table protections were actually restored, not just content.
            policies = conn.execute("SELECT count(*) FROM pg_policies WHERE schemaname='public'").fetchone()[0]
            check(policies > 0, 'Application RLS policies missing.')
        print('Stage: restore photos to private test buckets and verify downloads', flush=True)
        for wrapped in manifest['buckets']:
            b = wrapped[0] if isinstance(wrapped, list) else wrapped
            body = {'id': b['id'], 'name': b['name'], 'public': False}
            for field in ['file_size_limit', 'allowed_mime_types']:
                if b.get(field) is not None:
                    body[field] = b[field]
            api('POST', '/storage/v1/bucket', json=body)
        for obj in manifest['objects']:
            check(obj['key'] == 'objects/sha256/' + obj['sha256'], 'Unexpected object key.')
            file = root / 'photo.bin'
            s3.download_file(BUCKET, obj['key'], str(file))
            check(digest(file) == obj['sha256'], 'Photo backup hash mismatch.')
            path = quote(obj['bucket'], safe='') + '/' + quote(obj['path'], safe='/')
            content_type = (obj.get('metadata') or {}).get('mimetype', 'application/octet-stream')
            with file.open('rb') as f:
                api('POST', '/storage/v1/object/' + path, data=f,
                    headers={'Content-Type': content_type, 'x-upsert': 'false'})
            response = api('GET', '/storage/v1/object/' + path, stream=True)
            h = hashlib.sha256()
            for chunk in response.iter_content(1024 * 1024):
                h.update(chunk)
            response.close()
            check(h.hexdigest() == obj['sha256'], 'Restored photo hash mismatch.')
            # All buckets deliberately stay private, even if the original was public.
            anonymous = requests.get(target_url + '/storage/v1/object/public/' + path, timeout=30)
            check(not anonymous.ok, 'Privacy check failed: anonymous photo access allowed.')
            file.unlink()
        summary = {'status': 'database-and-photo-recovery-verified', 'target': TARGET,
                   'backup': manifest['run'], 'tables_checked': len(expected),
                   'public_tables': len(tables), 'public_policies': policies,
                   'photos_verified': len(manifest['objects']), 'buckets_private': True,
                   'production_modified': False, 'end_to_end_login_tested': False,
                   'email_provider_and_vault_keys_restored': False}
        report = json.dumps(summary, indent=2)
        s3.put_object(Bucket=BUCKET, Key='recovery-reports/' + os.environ['GITHUB_RUN_ID'] + '.json',
                      Body=report.encode(), ContentType='application/json')
        print(report)
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
            f.write('```json\n' + report + '\n```\n')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else
              'Recovery failed (' + type(error).__name__ + '); sensitive details suppressed.')
        raise SystemExit(1)
