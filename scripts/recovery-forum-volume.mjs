// Cloud-only diagnosis. Generated text and exact disposable accounts only; no media/mail/export.
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const api = 'https://esovqvampbrhuhamkfcs.supabase.co';
const site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon = (await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8')).match(/const anon = '([^']+)'/)[1];
const users = [], findings = [];
let browser, stage = 'guard', failed = false, productionTraffic = false;
const check = (ok, message) => { if (!ok) throw Error(message); };
const pass = message => console.log('PASS: ' + message);
const finding = message => { findings.push(message); console.log('FINDING: ' + message); };
async function request(path, { method = 'GET', body, token = admin } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Recovery relative path');
  const response = await fetch(api + path, { method, headers: {
    apikey: token === admin ? admin : anon, Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json', Prefer: 'return=minimal,count=exact',
  }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: response.ok, status: response.status, data, count: Number(response.headers.get('content-range')?.split('/')[1]) };
}
async function req(path, options) { const r = await request(path, options); check(r.ok, 'Recovery HTTP ' + r.status); return r; }
async function chunks(table, rows, token) {
  for (let start = 0; start < rows.length; start += 150)
    await req('/rest/v1/' + table, { method: 'POST', body: rows.slice(start, start + 150), token });
}
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud-only recovery guard');
  const marker = 'VOLUME-' + randomBytes(8).toString('hex');
  stage = 'create three disposable users';
  for (let index = 0; index < 3; index++) {
    const email = 'volume-' + randomBytes(12).toString('hex') + '@example.invalid';
    const password = randomBytes(32).toString('base64url');
    const { data: user } = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
    check(user?.id, 'Disposable account ID'); users.push(user);
    const { data: session } = await req('/auth/v1/token?grant_type=password', { method: 'POST', token: anon, body: { email, password } });
    Object.assign(user, { email, password, token: session.access_token });
    await req('/rest/v1/profiles?id=eq.' + user.id, { method: 'PATCH', body: { display_name: marker + '-' + index } });
  }
  const [viewer, author, followedAuthor] = users;
  const rows = Array.from({ length: 1005 }, (_, i) => ({ id: randomUUID(), user_id: author.id,
    title: marker + '-' + i, body: 'SYNTHETIC BULK TEXT', topic: 'stories',
    created_at: new Date(Date.now() + i * 1000).toISOString() }));
  const old = { id: randomUUID(), user_id: followedAuthor.id, title: marker + '-OLDEST-SENTINEL',
    body: 'SYNTHETIC OLDEST TEXT', topic: 'gear', created_at: '2000-01-01T00:00:00Z' };
  stage = 'seed synthetic posts bookmarks comments';
  await chunks('forum_posts', rows, author.token);
  await chunks('forum_posts', [old], followedAuthor.token);
  const all = [...rows, old];
  await chunks('forum_bookmarks', all.map(post => ({ user_id: viewer.id, post_id: post.id })), viewer.token);
  await chunks('forum_comments', Array.from({ length: 1005 }, (_, i) => ({ id: randomUUID(), post_id: rows[1004].id,
    user_id: viewer.id, body: marker + '-COMMENT-' + i })), viewer.token);
  await chunks('forum_follows', [{ follower_id: viewer.id, following_id: followedAuthor.id }], viewer.token);
  const postProof = await req('/rest/v1/forum_posts?user_id=in.(' + author.id + ',' + followedAuthor.id + ')&select=id&limit=1', { token: viewer.token });
  const bookmarkProof = await req('/rest/v1/forum_bookmarks?user_id=eq.' + viewer.id + '&select=post_id', { token: viewer.token });
  check(postProof.count === 1006 && bookmarkProof.count === 1006, 'Fixture exact counts');
  const missingBookmark = all.find(post => !bookmarkProof.data.some(row => row.post_id === post.id));
  check(missingBookmark, 'Bookmark cap independently observed');
  // Bring an omitted bookmark target into the first feed page without changing private relation rows.
  const missingOwner = missingBookmark.user_id === author.id ? author : followedAuthor;
  await req('/rest/v1/forum_posts?id=eq.' + missingBookmark.id, { method: 'PATCH', token: missingOwner.token,
    body: { created_at: new Date(Date.now() + 2000000).toISOString() } });
  // If the oldest sentinel was selected, use a different old sentinel not bookmarked for search/follow.
  const searchOld = missingBookmark.id === old.id ? { ...old, id: randomUUID(), title: marker + '-SEARCH-SENTINEL' } : old;
  if (searchOld !== old) await chunks('forum_posts', [searchOld], followedAuthor.token);
  pass('real_recovery_fixture_1006_posts_1006_bookmarks_1005_comments_three_accounts');
  stage = 'desktop browser login';
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    if ((u.hostname.endsWith('.supabase.co') && u.origin !== api) || ['supdiver.com', 'www.supdiver.com'].includes(u.hostname)) {
      productionTraffic = true; return route.abort();
    } return route.continue();
  });
  await context.addInitScript(() => localStorage.setItem('deepocean-language', 'zh-CN'));
  const page = await context.newPage();
  await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByLabel('邮箱', { exact: true }).fill(viewer.email);
  await page.getByLabel('密码', { exact: true }).fill(viewer.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(u => u.pathname !== '/auth', { timeout: 60000 });
  stage = 'feed completeness browser';
  await page.goto(site + '/forum', { waitUntil: 'networkidle', timeout: 90000 });
  const target = page.locator('#post-' + missingBookmark.id);
  await target.waitFor();
  check(await page.locator('#post-' + searchOld.id).count() === 0, 'Old sentinel beyond returned feed');
  const tail = await req('/rest/v1/forum_posts?id=eq.' + searchOld.id + '&select=id', { token: viewer.token });
  check(tail.data.length === 1, 'Old sentinel independently readable under same user RLS');
  finding('real_1006_plus_posts_old_readable_post_missing_from_desktop_feed');
  const search = page.getByPlaceholder('搜索潜点、海洋生物或用户', { exact: true });
  await search.fill(searchOld.title);
  check(await page.locator('.do-forum-post').count() === 0, 'Search missing old fixture');
  finding('desktop_search_reports_no_post_for_existing_old_sentinel');
  await search.fill('');
  check(await target.getByRole('button', { name: '收藏', exact: true }).getAttribute('data-active') === 'false', 'Omitted bookmark renders unsaved');
  check((await req('/rest/v1/forum_bookmarks?user_id=eq.' + viewer.id + '&post_id=eq.' + missingBookmark.id + '&select=post_id', { token: viewer.token })).data.length === 1, 'Omitted bookmark exists owner scope');
  finding('real_1006_bookmarks_existing_saved_post_renders_unsaved');
  stage = 'comment list completeness browser';
  const commentCard = page.locator('#post-' + rows[1004].id);
  await commentCard.getByRole('button', { name: '阅读全文', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  const commentResponse = await req('/rest/v1/forum_comments?post_id=eq.' + rows[1004].id + '&select=id&order=created_at', { token: viewer.token });
  check(commentResponse.count === 1005 && commentResponse.data.length === 1000, 'Actual comments cap confirmed');
  await page.getByRole('dialog').getByText(marker + '-COMMENT-0', { exact: true }).waitFor();
  const rendered = await page.getByRole('dialog').getByText(new RegExp('^' + marker + '-COMMENT-')).count();
  check(rendered === 1000, 'Rendered comment cap confirmed');
  check((await req('/rest/v1/forum_comments?post_id=eq.' + rows[1004].id + '&select=id&order=created_at&offset=1000', { token: viewer.token })).data.length === 5, 'Remaining five comments readable');
  finding('real_1005_comments_only_first_1000_rendered_no_remaining_page');
  check(!productionTraffic, 'Production traffic forbidden');
} catch (error) {
  failed = true; console.error('INCOMPLETE: forum_volume stage=' + stage + ' type=' + error.constructor.name);
} finally {
  await browser?.close();
  for (const user of users) try {
    await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
    check((await request('/auth/v1/admin/users/' + user.id)).status === 404, 'Fixture account remains');
    for (const [table, column] of [['forum_posts', 'user_id'], ['forum_comments', 'user_id'], ['forum_bookmarks', 'user_id'], ['forum_follows', 'follower_id']])
      check((await req('/rest/v1/' + table + '?' + column + '=eq.' + user.id + '&select=' + column)).data.length === 0, 'Fixture rows remain');
    pass('exact_disposable_account_and_dependent_rows_cleanup_verified');
  } catch (error) { failed = true; console.error('INCOMPLETE: forum_volume_cleanup account=' + user.id + ' type=' + error.constructor.name); }
}
console.log('AUDIT: complete=' + !failed + ' findings=' + findings.length);
if (failed) process.exitCode = 1;
