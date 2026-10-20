"""One real test mail, credentials remain only in ephemeral runner memory.

This tests SMTP + Auth signup token + restored frontend confirmation. It does
NOT configure Supabase custom SMTP or prove automatic signup-email delivery.
"""
import hashlib
import json
import os
import secrets
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.parse import urlencode

import boto3
from botocore.exceptions import ClientError
import requests


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('Cloud runner required.')
    names = ['RECOVERY_SERVICE_ROLE_KEY', 'RECOVERY_SMTP_PASSWORD', 'RECOVERY_TEST_EMAIL',
             'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT']
    missing = [k for k in names if not os.environ.get(k)]
    if missing:
        raise RuntimeError('Missing encrypted configuration: ' + ', '.join(missing))
    recipient = os.environ['RECOVERY_TEST_EMAIL'].strip()
    # Only the one human-authorized mailbox is allowed; no private address in source.
    expected = 'f458de9ff9a355dc9cc89e8c901bbc19dbb05f11edbc4cfc94ab3cac4fdf62a4'
    if hashlib.sha256(recipient.lower().encode()).hexdigest() != expected:
        raise RuntimeError('Recipient does not match authorized mailbox.')
    s3 = boto3.client('s3', endpoint_url=os.environ['R2_ENDPOINT'].strip(), region_name='auto',
                      aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'])
    bucket = 'supdiver-backups'
    marker_key = 'recovery-mail/' + expected + '.json'
    try:
        previous = json.loads(s3.get_object(Bucket=bucket, Key=marker_key)['Body'].read())
        if previous.get('smtp_accepted'):
            print('A test mail has already been accepted by SMTP. Not sending a duplicate.')
            return
    except ClientError as e:
        if e.response['Error']['Code'] not in ('404', 'NoSuchKey', 'NotFound'):
            raise
    base = 'https://esovqvampbrhuhamkfcs.supabase.co'
    key = os.environ['RECOVERY_SERVICE_ROLE_KEY'].strip()
    response = requests.post(base + '/auth/v1/admin/generate_link', timeout=30,
                             headers={'apikey': key, 'Authorization': 'Bearer ' + key},
                             json={'type': 'signup', 'email': recipient, 'password': secrets.token_urlsafe(36)})
    if not response.ok:
        try:
            code = response.json().get('error_code', '')
        except ValueError:
            code = ''
        safe_codes = {'email_exists', 'user_already_exists', 'signup_disabled',
                      'email_address_invalid', 'validation_failed', 'weak_password',
                      'over_email_send_rate_limit', 'unexpected_failure'}
        safe_code = code if code in safe_codes else 'unclassified'
        raise RuntimeError('Test signup-link generation failed (HTTP ' + str(response.status_code)
                           + ', code=' + safe_code + '); no email sent.')
    generated = response.json()
    uid = generated.get('id') or generated.get('user', {}).get('id')
    token = generated.get('hashed_token')
    if not uid or not token or generated.get('verification_type') not in ('signup', None):
        raise RuntimeError('Unexpected test signup-link response; no email sent.')
    link = 'https://supdiver-recovery-test.vercel.app/auth-confirmed?' + urlencode({'token_hash': token})
    message = EmailMessage()
    message['From'] = 'SupDiver Recovery Test <no-reply@auth.supdiver.com>'
    message['To'] = recipient
    message['Subject'] = 'SupDiver 恢复演练：请确认测试邮箱'
    message.set_content('这是你授权的恢复演练邮件，不会修改正式网站。\n点击以下链接完成测试邮箱确认，无需输入密码：\n' + link)
    message.add_alternative('<h2>SupDiver 恢复演练</h2><p>这是你授权的测试邮件，不会修改正式网站。</p>'
                            '<p><a href="' + link + '">确认测试邮箱</a></p>'
                            '<p>确认页面应显示“邮箱验证成功”，无需输入密码。</p>', subtype='html')
    with smtplib.SMTP_SSL('smtp.resend.com', 465, timeout=30, context=ssl.create_default_context()) as server:
        server.login('resend', os.environ['RECOVERY_SMTP_PASSWORD'].strip())
        refused = server.send_message(message)
        if refused:
            raise RuntimeError('Test recipient refused by SMTP.')
    record = {'smtp_accepted': True, 'user_id': uid, 'project': 'esovqvampbrhuhamkfcs',
              'sent_at': datetime.now(timezone.utc).isoformat(), 'run_id': os.environ['GITHUB_RUN_ID'],
              'recipient_hash': expected, 'inbox_receipt_verified': False, 'confirmation_click_verified': False,
              'automatic_supabase_smtp_configured': False, 'credential_copied_to_test_project': False}
    s3.put_object(Bucket=bucket, Key=marker_key, Body=json.dumps(record).encode(), ContentType='application/json')
    summary = 'SMTP accepted one recovery confirmation message. Inbox delivery and human confirmation click are NOT yet verified. No SMTP credential was copied to Supabase.\n'
    print(summary)
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as out:
        out.write(summary)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Mail test failed (' + type(error).__name__ + '); sensitive details suppressed.')
        raise SystemExit(1)
