// Cloud-only privacy diagnosis. Generated fixtures only; never change policies or production.
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const api = 'https://esovqvampbrhuhamkfcs.supabase.co';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon = (await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8')).match(/const anon = '([^']+)'/)[1];
const accounts = [], findings = [];
const expectFixed = process.env.PRIVACY_EXPECT_FIXED === 'true';
let stage = 'preflight', failed = false;
const check = (ok, text) => { if (!ok) throw Error(text); };
const pass = text => console.log('PASS: ' + text);
const finding = text => { findings.push(text); console.log('FINDING: ' + text); };
async function request(path, token = admin, method = 'GET', body, binary = false) {
  check(path.startsWith('/') && !path.startsWith('//'), 'relative recovery path');
  const response = await fetch(api + path, {
    method, headers: { apikey: token === admin ? admin : anon, Authorization: 'Bearer ' + token,
      'Content-Type': binary ? 'image/png' : 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : binary ? body : JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}
async function must(path, token, method, body, binary) {
  const result = await request(path, token, method, body, binary);
  check(result.ok, 'recovery request HTTP ' + result.status); return result.data;
}
const rowPath = id => '/rest/v1/marine_encounters?id=eq.' + id;
const sign = (bucket, path, token, expiresIn = 10) => request('/storage/v1/object/sign/' + bucket + '/' + path, token, 'POST', { expiresIn });
const canRead = (bucket, path, token) => request('/storage/v1/object/authenticated/' + bucket + '/' + path, token);
async function signedStatus(result) {
  check(result.ok && typeof result.data?.signedURL === 'string', 'signed link created');
  const url = new URL('/storage/v1' + result.data.signedURL, api);
  check(url.origin === api, 'recovery signed link only');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  await response.body?.cancel(); return response.status;
}
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'cloud-only credential guard');
  stage = 'create disposable accounts';
  for (let index = 0; index < 2; index++) {
    const email = 'privacy-' + randomBytes(12).toString('hex') + '@example.invalid';
    const password = randomBytes(32).toString('base64url');
    const account = await must('/auth/v1/admin/users', admin, 'POST', { email, password, email_confirm: true });
    accounts.push(account);
    const session = await must('/auth/v1/token?grant_type=password', anon, 'POST', { email, password });
    account.token = session.access_token;
  }
  const [a, b] = accounts;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=', 'base64');
  const id = randomUUID(), photo = a.id + '/' + id + '.png';
  await must('/storage/v1/object/marine-photos/' + photo, a.token, 'POST', png, true);
  await must('/rest/v1/marine_encounters', a.token, 'POST', { id, user_id: a.id, species_name: 'SYNTHETIC-PRIVACY', encountered_on: '2026-10-22', location: 'SYNTHETIC', photo_path: photo, needs_help: false });
  stage = 'private encounter';
  check((await must(rowPath(id) + '&select=id', b.token)).length === 0, 'private row hidden');
  check(!(await canRead('marine-photos', photo, b.token)).ok && !(await sign('marine-photos', photo, b.token)).ok, 'private image hidden');
  check(!(await canRead('marine-photos', photo, anon)).ok, 'anonymous image hidden');
  const edit = await must(rowPath(id), b.token, 'PATCH', { location: 'OUTSIDER' });
  check(edit.length === 0, 'outsider update denied');
  pass('private_encounter_row_image_anonymous_and_outsider_edit_denied');
  stage = 'open and close help';
  await must(rowPath(id), a.token, 'PATCH', { needs_help: true });
  check((await must(rowPath(id) + '&select=id', b.token)).length === 1 && (await canRead('marine-photos', photo, b.token)).ok, 'help visible');
  const oldLink = await sign('marine-photos', photo, b.token, 8);
  check(await signedStatus(oldLink) === 200, 'old signed link works initially');
  await must(rowPath(id), a.token, 'PATCH', { needs_help: false });
  check((await must(rowPath(id) + '&select=id', b.token)).length === 0 && !(await sign('marine-photos', photo, b.token)).ok, 'close prevents fresh access');
  pass('help_open_visible_and_close_blocks_new_row_and_photo_access');
  if (await signedStatus(oldLink) === 200) finding('previously_issued_photo_link_survives_help_close_until_expiry_app_uses_3600_seconds');
  await new Promise(resolve => setTimeout(resolve, 11000));
  check(await signedStatus(oldLink) !== 200, 'signed link expires');
  pass('short_lived_signed_photo_link_rejected_after_expiry');
  stage = 'foreign photo path reference';
  const forged = await request('/rest/v1/marine_encounters', b.token, 'POST', { id: randomUUID(), user_id: b.id, species_name: 'SYNTHETIC-FOREIGN-PATH', encountered_on: '2026-10-22', location: 'SYNTHETIC', photo_path: photo, needs_help: true });
  if (forged.ok && (await sign('marine-photos', photo, b.token)).ok) {
    finding('outsider_can_reference_known_foreign_photo_path_in_own_help_row_and_regain_photo_access_after_owner_closes_help');
    check(!expectFixed, 'foreign marine photo access regression');
  } else pass('foreign_photo_path_cannot_reopen_owner_private_photo');
  if (expectFixed) {
    check(!forged.ok && forged.data?.code === '23514', 'foreign marine insert rejected by constraint');
    const ownId = randomUUID(), ownPhoto = b.id + '/' + ownId + '.png';
    await must('/storage/v1/object/marine-photos/' + ownPhoto, b.token, 'POST', png, true);
    await must('/rest/v1/marine_encounters', b.token, 'POST', { id: ownId, user_id: b.id, species_name: 'SYNTHETIC-OWN', encountered_on: '2026-10-22', location: 'SYNTHETIC', photo_path: ownPhoto, needs_help: true });
    const foreignUpdate = await request(rowPath(ownId), b.token, 'PATCH', { photo_path: photo });
    check(!foreignUpdate.ok && foreignUpdate.data?.code === '23514', 'foreign marine update denied');
    check(!(await sign('marine-photos', photo, b.token)).ok, 'closed photo remains private');
    check((await canRead('marine-photos', ownPhoto, a.token)).ok, 'normal B help works');
    pass('marine_foreign_insert_update_denied_and_normal_owned_help_preserved');
  }
  stage = 'forum copy ownership and deletion';
  const forumPhoto = a.id + '/encounter-' + id + '.jpg';
  await must('/storage/v1/object/forum-media/' + forumPhoto, a.token, 'POST', png, true);
  if (expectFixed) check(!(await sign('forum-media', forumPhoto, b.token)).ok, 'unpublished image private');
  check(!(await request('/rest/v1/rpc/share_marine_encounter', b.token, 'POST', { target_id: id })).ok, 'outsider share denied');
  const postId = await must('/rest/v1/rpc/share_marine_encounter', a.token, 'POST', { target_id: id });
  check(postId === await must('/rest/v1/rpc/share_marine_encounter', a.token, 'POST', { target_id: id }), 'share idempotent');
  check((await canRead('forum-media', forumPhoto, b.token)).ok && !(await canRead('forum-media', forumPhoto, anon)).ok, 'member-only forum image');
  pass('forum_share_owner_only_idempotent_and_image_not_anonymous');
  if (expectFixed) {
    const forgedPost = await request('/rest/v1/forum_posts', b.token, 'POST', { user_id: b.id, body: 'SYNTHETIC', image_path: forumPhoto });
    check(!forgedPost.ok && forgedPost.data?.code === '23514', 'foreign forum insert denied');
    const [ownPost] = await must('/rest/v1/forum_posts', b.token, 'POST', { user_id: b.id, body: 'SYNTHETIC' });
    const forgedUpdate = await request('/rest/v1/forum_posts?id=eq.' + ownPost.id, b.token, 'PATCH', { image_path: forumPhoto });
    check(!forgedUpdate.ok && forgedUpdate.data?.code === '23514', 'foreign forum update denied');
    pass('forum_foreign_photo_insert_and_update_denied');
  }
  await must('/rest/v1/forum_posts?id=eq.' + postId, a.token, 'DELETE');
  check((await must('/rest/v1/forum_posts?id=eq.' + postId + '&select=id', b.token)).length === 0, 'deleted post hidden');
  if ((await sign('forum-media', forumPhoto, b.token)).ok) {
    finding('deleted_forum_post_image_can_still_be_read_and_newly_signed_by_other_members_with_known_path');
    check(!expectFixed, 'deleted forum image access regression');
  } else pass('deleted_forum_post_blocks_fresh_photo_access');
  if (expectFixed) {
    check(!(await canRead('forum-media', forumPhoto, b.token)).ok, 'deleted forum image direct download denied');
    check((await sign('forum-media', forumPhoto, a.token)).ok, 'owner retained object accessible');
    pass('deleted_forum_image_direct_read_denied_owner_retained_photo_preserved');
  }
} catch (error) {
  console.error('INCOMPLETE: privacy audit stage=' + stage + ' type=' + error.constructor.name + ' reason=' + error.message.slice(0, 140)); failed = true;
} finally {
  for (const account of accounts) try {
    for (const bucket of ['marine-photos', 'forum-media']) {
      const files = await must('/storage/v1/object/list/' + bucket, admin, 'POST', { prefix: account.id + '/', limit: 1000 });
      const paths = files.filter(file => file.id).map(file => account.id + '/' + file.name);
      check(paths.every(path => path.startsWith(account.id + '/') && !path.includes('..')), 'fixture prefix only');
      if (paths.length) await must('/storage/v1/object/' + bucket, admin, 'DELETE', { prefixes: paths });
      check((await must('/storage/v1/object/list/' + bucket, admin, 'POST', { prefix: account.id + '/', limit: 1000 })).length === 0, 'fixture photos removed');
    }
    await must('/auth/v1/admin/users/' + account.id, admin, 'DELETE');
    check((await request('/auth/v1/admin/users/' + account.id)).status === 404, 'fixture user removed');
    for (const table of ['marine_encounters', 'forum_posts']) check((await must('/rest/v1/' + table + '?user_id=eq.' + account.id + '&select=id')).length === 0, 'fixture rows removed');
    pass('disposable_account_rows_and_generated_photos_cleanup_verified');
  } catch (error) { failed = true; console.error('INCOMPLETE: fixture cleanup account=' + account.id + ' type=' + error.constructor.name); }
}
console.log('AUDIT: findings=' + findings.length + ' complete=' + !failed);
if (failed) process.exitCode = 1;
