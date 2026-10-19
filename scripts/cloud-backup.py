"""Cloud-runner-only backup. Never logs records, paths, credentials or SQL."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from datetime import datetime, timezone
from urllib.parse import quote, urlparse, unquote

import boto3
from botocore.exceptions import ClientError
import psycopg
import requests


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('This task must run on GitHub Actions, not a personal computer.')
    required = ['SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCESS_KEY_ID',
                'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET']
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise RuntimeError('Missing Actions Secrets/config: ' + ', '.join(missing))
    endpoint = os.environ['R2_ENDPOINT']
    if urlparse(endpoint).scheme != 'https':
        raise RuntimeError('R2 endpoint must use HTTPS.')
    s3 = boto3.client('s3', endpoint_url=endpoint, region_name='auto',
                      aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'])
    bucket = os.environ['R2_BUCKET']
    run = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ') + '-' + os.environ['GITHUB_RUN_ID']
    prefix = 'snapshots/' + run + '/'
    manifest = {'version': 1, 'run': run, 'database': {}, 'objects': [], 'buckets': []}

    def verify_file(key, path):
        expected = digest(path)
        response = s3.get_object(Bucket=bucket, Key=key)
        h = hashlib.sha256()
        try:
            for chunk in response['Body'].iter_chunks(chunk_size=1024 * 1024):
                h.update(chunk)
        finally:
            response['Body'].close()
        if h.hexdigest() != expected:
            raise RuntimeError('R2 round-trip checksum failed.')
        return expected

    with tempfile.TemporaryDirectory(prefix='supdiver-', dir=os.environ['RUNNER_TEMP']) as temporary:
        root = Path(temporary)
        # Keep connection credentials out of process arguments and console output.
        parsed = urlparse(os.environ['SUPABASE_DB_URL'])
        env = os.environ.copy()
        env.update(PGHOST=parsed.hostname or '', PGPORT=str(parsed.port or 5432),
                   PGUSER=unquote(parsed.username or ''), PGPASSWORD=unquote(parsed.password or ''),
                   PGDATABASE=unquote(parsed.path.lstrip('/')), PGSSLMODE='require',
                   PGOPTIONS='-c default_transaction_read_only=on')
        with psycopg.connect(os.environ['SUPABASE_DB_URL'], autocommit=True) as connection:
            connection.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
            snapshot = connection.execute('SELECT pg_export_snapshot()').fetchone()[0]
            manifest['buckets'] = connection.execute('SELECT to_jsonb(b) FROM storage.buckets b').fetchall()
            objects = connection.execute(
                'SELECT bucket_id, name, metadata, updated_at::text FROM storage.objects ORDER BY bucket_id,name'
            ).fetchall()
            archive = root / 'database.dump'
            roles = root / 'roles.sql'
            commands = [
                ['pg_dump', '--format=custom', '--snapshot=' + snapshot, '--file=' + str(archive)],
                ['pg_dumpall', '--roles-only', '--no-role-passwords', '--file=' + str(roles)],
                ['pg_restore', '--list', str(archive)],
            ]
            for command in commands:
                docker = ['docker', 'run', '--rm', '--volume', str(root) + ':' + str(root)]
                for variable in ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGOPTIONS']:
                    docker.extend(['--env', variable])
                result = subprocess.run(docker + ['postgres:17'] + command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                if result.returncode:
                    raise RuntimeError('Database export/archive inspection failed; credentials and SQL suppressed.')
            connection.execute('COMMIT')
        for path in [archive, roles]:
            key = prefix + path.name
            s3.upload_file(str(path), bucket, key)
            manifest['database'][path.name] = {'key': key, 'sha256': verify_file(key, path), 'bytes': path.stat().st_size}

        session = requests.Session()
        token = os.environ['SUPABASE_SERVICE_ROLE_KEY']
        session.headers.update({'Authorization': 'Bearer ' + token, 'apikey': token})
        for bucket_id, name, metadata, updated_at in objects:
            path = root / 'object.bin'
            url = 'https://zmhtlhpeulhhcvlnjdrb.supabase.co/storage/v1/object/' + quote(bucket_id, safe='') + '/' + quote(name, safe='/')
            with session.get(url, stream=True, timeout=(20, 180)) as response:
                if response.status_code != 200:
                    raise RuntimeError('Storage download failed; incomplete backup will not be marked successful.')
                with path.open('wb') as target:
                    for chunk in response.iter_content(1024 * 1024):
                        target.write(chunk)
            sha = digest(path)
            key = 'objects/sha256/' + sha
            try:
                s3.head_object(Bucket=bucket, Key=key)
            except ClientError as error:
                if error.response['Error']['Code'] not in ('404', 'NoSuchKey', 'NotFound'):
                    raise
                s3.upload_file(str(path), bucket, key)
            verify_file(key, path)
            manifest['objects'].append({'bucket': bucket_id, 'path': name, 'key': key,
                                        'sha256': sha, 'bytes': path.stat().st_size,
                                        'metadata': metadata, 'updated_at': updated_at})
            path.unlink()
        manifest['verification'] = 'R2 SHA256 round-trip and pg_restore archive inspection; no restore drill performed'
        payload = json.dumps(manifest, ensure_ascii=False, default=str).encode()
        s3.put_object(Bucket=bucket, Key=prefix + 'manifest.json', Body=payload, ContentType='application/json')
        if s3.get_object(Bucket=bucket, Key=prefix + 'manifest.json')['Body'].read() != payload:
            raise RuntimeError('Manifest verification failed.')
        s3.put_object(Bucket=bucket, Key=prefix + 'complete.json', Body=json.dumps({
            'manifest_sha256': hashlib.sha256(payload).hexdigest(), 'objects': len(objects),
            'restore_drill': False}).encode(), ContentType='application/json')
        summary = f'Cloud backup complete. Files: {len(objects)}. Database and files verified by SHA256 in R2. Restore drill: NOT yet performed.\n'
        print(summary)
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
            output.write(summary)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Network/driver exceptions can contain URLs and credentials. Do not expose them.
        if isinstance(error, RuntimeError):
            print(str(error))
        else:
            print('Cloud backup failed (' + type(error).__name__ + '); sensitive details suppressed.')
        raise SystemExit(1)
