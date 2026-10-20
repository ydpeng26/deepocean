"""Functional recovery checks, no real email delivery or production connection."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import uuid
from urllib.parse import quote

import boto3
import psycopg
from psycopg import sql
import requests

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).with_name('recovery-drill.py'))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)
check = recovery.check


def main():
    check(os.environ.get('GITHUB_ACTIONS') == 'true', 'Cloud runner required.')
    url = os.environ['RECOVERY_DB_URL'].strip()
    recovery.validate_target(url)
    base = 'https://' + recovery.TARGET + '.supabase.co'
    key = os.environ['RECOVERY_SERVICE_ROLE_KEY'].strip()
    admin_headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
    report = {'target': recovery.TARGET, 'checks': [], 'production_modified': False,
              'real_email_sent': False, 'frontend_tested': False, 'restored_original_password_login': False}

    def passed(name):
        report['checks'].append(name)
        print('PASS: ' + name, flush=True)

    def request(method, path, token=None, admin=False, **kwargs):
        headers = dict(admin_headers) if admin else {'apikey': key}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        response = requests.request(method, base + path, headers=headers, timeout=(20, 90), **kwargs)
        return response

    def okay(response, stage):
        check(response.ok, stage + ' failed (HTTP ' + str(response.status_code) + ').')
        return response.json()

    s3 = boto3.client('s3', endpoint_url=os.environ['R2_ENDPOINT'].strip(), region_name='auto',
                      aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'])
    reports = []
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=recovery.BUCKET, Prefix='recovery-reports/'):
        reports += page.get('Contents', [])
    check(bool(reports), 'A successful recovery report is required before validation.')
    latest = max(reports, key=lambda r: r['LastModified'])['Key']
    drill = json.loads(s3.get_object(Bucket=recovery.BUCKET, Key=latest)['Body'].read())
    check(drill['target'] == recovery.TARGET and drill['status'] == 'database-and-photo-recovery-verified',
          'Recovery report target or status mismatch.')
    prefix = 'snapshots/' + drill['backup'] + '/'
    marker = json.loads(s3.get_object(Bucket=recovery.BUCKET, Key=prefix + 'complete.json')['Body'].read())
    payload = s3.get_object(Bucket=recovery.BUCKET, Key=prefix + 'manifest.json')['Body'].read()
    check(hashlib.sha256(payload).hexdigest() == marker['manifest_sha256'], 'Manifest hash mismatch.')
    manifest = json.loads(payload)
    with psycopg.connect(url, connect_timeout=20, sslmode='require', autocommit=True) as conn:
        users = conn.execute('SELECT id::text,email,encrypted_password FROM auth.users ORDER BY id').fetchall()
        check(bool(users), 'Restored accounts missing.')
        # Read only password hashes from the verified cloud archive to check preservation.
        with tempfile.TemporaryDirectory(dir=os.environ['RUNNER_TEMP']) as temp:
            root = Path(temp)
            archive = root / 'database.dump'
            entry = manifest['database']['database.dump']
            check(entry['key'] == prefix + 'database.dump', 'Archive location mismatch.')
            s3.download_file(recovery.BUCKET, entry['key'], str(archive))
            check(recovery.digest(archive) == entry['sha256'], 'Archive hash mismatch.')
            data = root / 'users.sql'
            result = subprocess.run(['docker', 'run', '--rm', '--volume', str(root) + ':' + str(root),
                                     'postgres:17', 'pg_restore', '--data-only', '--schema=auth', '--table=users',
                                     '--file=' + str(data), str(archive)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            check(result.returncode == 0, 'Account archive extraction failed; details suppressed.')
            expected = {}
            columns = None
            with data.open() as source:
                for line in source:
                    m = re.match(r'^COPY auth.users \((.+)\) FROM stdin;', line)
                    if m:
                        columns = [c.strip().strip('"') for c in m[1].split(',')]
                    elif line.rstrip('\n') == '\\.':
                        columns = None
                    elif columns:
                        row = dict(zip(columns, line.rstrip('\n').split('\t')))
                        expected[row['id']] = row['encrypted_password']
            actual = {uid: password if password is not None else '\\N' for uid, _, password in users}
            check(expected == actual, 'Restored account/password-hash mismatch.')
        passed('restored_account_ids_and_password_hashes_match_backup')

        def as_user(uid, statement, parameters=(), role='authenticated'):
            try:
                conn.execute('BEGIN')
                claims = json.dumps({'sub': uid, 'role': role, 'aud': 'authenticated'})
                conn.execute("SELECT set_config('request.jwt.claims',%s,true), set_config('request.jwt.claim.sub',%s,true)", (claims, uid))
                conn.execute(sql.SQL('SET LOCAL ROLE {}').format(sql.Identifier(role)))
                check(str(conn.execute('SELECT auth.uid()').fetchone()[0]) == uid, 'Auth UID context mismatch.')
                return conn.execute(statement, parameters).fetchall()
            finally:
                conn.execute('ROLLBACK')

        outsider = str(uuid.uuid4())
        for table, owner in [('profiles', 'id'), ('dives', 'user_id'), ('gear_items', 'user_id'),
                              ('forum_bookmarks', 'user_id'), ('forum_blocks', 'blocker_id'), ('forum_reports', 'reporter_id')]:
            identifier = sql.Identifier(table)
            for uid, _, _ in users:
                expected_count = conn.execute(sql.SQL('SELECT count(*) FROM public.{} WHERE {}=%s').format(
                    identifier, sql.Identifier(owner)), (uid,)).fetchone()[0]
                rows = as_user(uid, sql.SQL('SELECT count(*) FROM public.{}').format(identifier))
                check(rows[0][0] == expected_count, 'Private row isolation check failed: ' + table)
            check(as_user(outsider, sql.SQL('SELECT count(*) FROM public.{}').format(identifier))[0][0] == 0,
                  'Outsider can see private rows: ' + table)
        passed('per_user_private_table_read_isolation')
        fixture = conn.execute('SELECT id,user_id::text FROM public.dives LIMIT 1').fetchone()
        check(fixture is not None, 'No restored dive available for mutation-isolation check.')
        dive_id, owner = fixture
        statement = 'UPDATE public.dives SET notes=notes WHERE id=%s RETURNING id'
        check(len(as_user(owner, statement, (dive_id,))) == 1, 'Owner update unexpectedly denied.')
        check(as_user(outsider, statement, (dive_id,)) == [], 'Cross-user update allowed.')
        check(as_user(outsider, 'DELETE FROM public.dives WHERE id=%s RETURNING id', (dive_id,)) == [],
              'Cross-user deletion allowed.')
        passed('owner_update_and_cross_user_write_denial_rollback_only')
        for table in ['profiles', 'dives', 'gear_items']:
            try:
                rows = as_user(outsider, sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(table)), role='anon')
                check(rows[0][0] == 0, 'Anonymous private data access allowed.')
            except psycopg.errors.InsufficientPrivilege:
                pass
        passed('anonymous_private_table_access_denied')

    sessions = {}
    for uid, email, _ in users:
        generated = okay(request('POST', '/auth/v1/admin/generate_link', admin=True,
                                 json={'type': 'magiclink', 'email': email}), 'Restored account link generation')
        verified = okay(request('POST', '/auth/v1/verify', json={
            'type': 'magiclink', 'token_hash': generated['hashed_token']}), 'Restored account token verification')
        check(verified['user']['id'] == uid and bool(verified.get('access_token')), 'Restored account session mismatch.')
        token = verified['access_token']
        check(okay(request('GET', '/auth/v1/user', token=token), 'Session validation')['id'] == uid,
              'Authenticated identity mismatch.')
        sessions[uid] = token
    passed('restored_accounts_auth_service_session_and_user_identity')

    photo_checks = 0
    negative_photo_checks = 0
    for obj in manifest['objects']:
        if obj['bucket'] not in ('dive-photos', 'gear-photos'):
            continue
        uid = obj['path'].split('/')[0]
        if uid not in sessions:
            continue
        path = quote(obj['bucket'], safe='') + '/' + quote(obj['path'], safe='/')
        signed = okay(request('POST', '/storage/v1/object/sign/' + path, token=sessions[uid],
                              json={'expiresIn': 60}), 'Owner photo signing')['signedURL']
        signed_path = '/storage/v1' + signed if signed.startswith('/object/') else signed
        check(signed_path.startswith('/storage/v1/object/sign/'), 'Unexpected signed URL destination.')
        response = requests.get(base + signed_path, timeout=60)
        check(response.ok and hashlib.sha256(response.content).hexdigest() == obj['sha256'],
              'Authenticated restored photo hash mismatch.')
        photo_checks += 1
        for other_uid, token in sessions.items():
            if other_uid != uid:
                denial = request('POST', '/storage/v1/object/sign/' + path, token=token, json={'expiresIn': 60})
                check(not denial.ok, 'Cross-user photo signing allowed.')
                negative_photo_checks += 1
    check(photo_checks > 0 and negative_photo_checks > 0, 'Insufficient photo ownership fixtures.')
    report['owner_photo_checks'] = photo_checks
    report['negative_photo_checks'] = negative_photo_checks
    passed('owner_photo_signed_download_and_cross_user_photo_denial')
    for token in sessions.values():
        response = request('POST', '/auth/v1/logout?scope=global', token=token)
        check(response.status_code in (200, 204), 'Restored account logout failed.')
    passed('restored_account_session_logout')

    # No real mailbox is involved in this separate password-login smoke test.
    synthetic_email = 'recovery-' + secrets.token_hex(12) + '@example.invalid'
    password = secrets.token_urlsafe(36)
    created_id = None
    try:
        created = okay(request('POST', '/auth/v1/admin/users', admin=True,
                               json={'email': synthetic_email, 'password': password, 'email_confirm': True}),
                       'Synthetic signup trigger test')
        created_id = created['id']
        good = okay(request('POST', '/auth/v1/token?grant_type=password',
                            json={'email': synthetic_email, 'password': password}), 'Synthetic password login')
        check(good['user']['id'] == created_id, 'Synthetic login mismatch.')
        bad = request('POST', '/auth/v1/token?grant_type=password',
                      json={'email': synthetic_email, 'password': secrets.token_urlsafe(36)})
        check(not bad.ok, 'Wrong password accepted.')
        refreshed = okay(request('POST', '/auth/v1/token?grant_type=refresh_token',
                                 json={'refresh_token': good['refresh_token']}), 'Refresh token test')
        check(refreshed['user']['id'] == created_id, 'Refresh identity mismatch.')
        with psycopg.connect(url, sslmode='require', connect_timeout=20) as conn:
            check(conn.execute('SELECT count(*) FROM public.profiles WHERE id=%s', (created_id,)).fetchone()[0] == 1,
                  'Signup profile trigger missing.')
        passed('synthetic_password_login_wrong_password_rejection_refresh_and_profile_trigger')
    finally:
        if created_id:
            response = request('DELETE', '/auth/v1/admin/users/' + created_id, admin=True)
            check(response.ok, 'Synthetic test user cleanup failed.')
    passed('synthetic_user_cleanup')
    report['status'] = 'backend_functional_validation_passed'
    payload = json.dumps(report, indent=2)
    s3.put_object(Bucket=recovery.BUCKET, Key='recovery-validation/' + os.environ['GITHUB_RUN_ID'] + '.json',
                  Body=payload.encode(), ContentType='application/json')
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
        f.write('```json\n' + payload + '\n```\n')
    print('Backend validation passed. Real email and frontend tests remain pending.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(str(e) if isinstance(e, RuntimeError) else 'Validation failed (' + type(e).__name__ + '); sensitive details suppressed.')
        raise SystemExit(1)
