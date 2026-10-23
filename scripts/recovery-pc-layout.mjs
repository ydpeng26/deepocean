// Diagnosis only; recovery application unchanged. Synthetic account/text, no media/mail/artifacts.
import { randomBytes, randomUUID } from 'node:crypto';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const api = 'https://esovqvampbrhuhamkfcs.supabase.co', site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
let browser, user, stage = 'guard', incomplete = false, productionTraffic = false, cleaned = false;
const findings = [], matrix = [];
const check = (ok, message) => { if (!ok) throw Error(message); };
const pass = name => console.log('PASS: ' + name);
const finding = (name, facts = {}) => { findings.push({ name, ...facts }); console.log('FINDING: ' + JSON.stringify({ name, ...facts })); };
async function request(path, { method = 'GET', body } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Relative recovery path required');
  const r = await fetch(api + path, { method, signal: AbortSignal.timeout(45000),
    headers: { apikey: admin, Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: r.ok, status: r.status, data };
}
async function req(path, options) { const r = await request(path, options); check(r.ok, 'Recovery HTTP ' + r.status); return r.data; }
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud recovery guard');
  const marker = 'PC-LAYOUT-' + randomBytes(6).toString('hex'), postId = randomUUID();
  const email = 'pc-layout-' + randomBytes(12).toString('hex') + '@example.invalid', password = randomBytes(32).toString('base64url');
  stage = 'create exact disposable fixtures';
  user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  await req('/rest/v1/profiles?id=eq.' + user.id, { method: 'PATCH', body: { display_name: 'LONGNAME' + 'A'.repeat(52), bio: 'B'.repeat(300), tank_count: 2 } });
  await req('/rest/v1/dives', { method: 'POST', body: { user_id: user.id, country: 'C'.repeat(80), site_name: 'S'.repeat(120),
    dive_date: '2026-10-24', dive_type: 'recreational', notes: 'N'.repeat(2000), photo_urls: [], photo_thumbnail_urls: [] } });
  await req('/rest/v1/forum_posts', { method: 'POST', body: { id: postId, user_id: user.id, title: marker + 'T'.repeat(80), body: 'D'.repeat(1000), topic: 'stories' } });
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    if ((u.hostname.endsWith('.supabase.co') && u.origin !== api) || ['supdiver.com', 'www.supdiver.com'].includes(u.hostname)) {
      productionTraffic = true; return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(() => { if (!localStorage.getItem('deepocean-language')) localStorage.setItem('deepocean-language', 'zh-CN'); });
  const page = await context.newPage();
  await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByLabel('邮箱', { exact: true }).fill(email); await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click(); await page.waitForURL('**/dives', { timeout: 60000 });
  const paths = ['/dives', '/dives/logs', '/dives/new', '/profile', '/certificates', '/gear', '/marine', '/forum', '/offline-sync'];
  for (const language of ['zh-CN', 'en']) {
    await page.evaluate(language => localStorage.setItem('deepocean-language', language), language);
    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of paths) {
        stage = 'layout ' + language + ' ' + width + ' ' + path;
        await page.goto(site + path, { waitUntil: 'networkidle', timeout: 60000 });
        check(new URL(page.url()).pathname === path, 'Unexpected route redirect');
        const metrics = await page.evaluate(() => {
          const root = document.documentElement, header = document.querySelector('.do-member-header');
          const h = header?.getBoundingClientRect();
          const outside = [...(header?.querySelectorAll('a,button') || [])].filter(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && (r.left < -2 || r.right > innerWidth + 2);
          }).length;
          return { cssWidth: innerWidth, scrollWidth: root.scrollWidth, headerWidth: h ? Math.round(h.width) : null,
            outsideHeaderControls: outside, chineseDiveLabel: !!document.querySelector('label[for="country"]')?.textContent.includes('潜水国家'),
            chineseGearHeading: [...document.querySelectorAll('h1')].some(el => el.textContent === '我的潜水装备'),
            chineseMarineAction: [...document.querySelectorAll('button')].some(el => el.textContent.includes('记录一次相遇')) };
        });
        matrix.push({ path, language, width, ...metrics });
        if (metrics.scrollWidth > width + 2) finding('root_horizontal_overflow', { path, language, width, scrollWidth: metrics.scrollWidth });
        if (metrics.outsideHeaderControls) finding('header_controls_outside_viewport', { path, language, width, count: metrics.outsideHeaderControls });
        if (language === 'en' && width === 1440 && (metrics.chineseDiveLabel || metrics.chineseGearHeading || metrics.chineseMarineAction))
          finding('english_mode_retains_primary_chinese_form_or_action', { path });
      }
    }
  }
  pass('desktop_layout_matrix_54_route_language_width_combinations_completed_with_synthetic_long_text');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => localStorage.setItem('deepocean-language', 'zh-CN'));
  async function keyboardDialog(name, opener) {
    stage = 'keyboard dialog ' + name;
    await opener.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const focusEntered = await dialog.evaluate(el => el.contains(document.activeElement));
    await dialog.locator('button,textarea,input,select,a[href]').first().focus();
    let escaped = false;
    for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); if (!(await dialog.evaluate(el => el.contains(document.activeElement)))) { escaped = true; break; } }
    await page.keyboard.press('Escape');
    const escapeClosed = await dialog.count() === 0;
    if (!focusEntered || escaped || !escapeClosed) finding('dialog_keyboard_management_missing', { dialog: name, focusEntered, tabEscaped: escaped, escapeClosed });
    else pass('dialog_keyboard_management_' + name);
    if (!escapeClosed) await dialog.getByRole('button', { name: name === 'comments' ? '取消' : '关闭', exact: true }).click();
  }
  await page.goto(site + '/forum', { waitUntil: 'networkidle' });
  await keyboardDialog('comments', page.locator('#post-' + postId).getByRole('button', { name: /回应/ }).first());
  await page.goto(site + '/marine', { waitUntil: 'networkidle' });
  await keyboardDialog('marine_editor', page.getByRole('button', { name: '记录一次相遇', exact: true }));
  stage = 'auth tabs keyboard';
  await page.goto(site + '/auth', { waitUntil: 'networkidle' });
  const signin = page.getByRole('tab', { name: '登录', exact: true }), signup = page.getByRole('tab', { name: '注册', exact: true });
  await signin.focus(); await page.keyboard.press('ArrowRight');
  const arrowMoved = await signup.getAttribute('aria-selected') === 'true';
  if (!arrowMoved) finding('auth_tab_arrow_key_does_not_switch_tabs');
  await signup.focus(); await page.keyboard.press('Enter');
  check(await signup.getAttribute('aria-selected') === 'true', 'Keyboard Enter cannot activate signup');
  pass('auth_tabs_keyboard_enter_activation_works_no_signup_or_email_submitted');
  check(!productionTraffic, 'Production traffic blocked');
} catch (error) {
  incomplete = true; console.log('INCOMPLETE: stage=' + stage + ' error=' + error.constructor.name + '; details suppressed');
} finally {
  if (browser) await browser.close();
  if (user) {
    try {
      await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
      const absent = await request('/auth/v1/admin/users/' + user.id);
      const dives = await req('/rest/v1/dives?user_id=eq.' + user.id + '&select=id');
      const posts = await req('/rest/v1/forum_posts?user_id=eq.' + user.id + '&select=id');
      check(absent.status === 404 && !dives.length && !posts.length, 'Cleanup incomplete'); cleaned = true;
      pass('exact_disposable_account_profile_dive_post_cleanup_verified_no_media_or_mail');
    } catch { incomplete = true; console.log('INCOMPLETE: cleanup disposable account ' + user.id); }
  }
  console.log('AUDIT: complete=' + (!incomplete && cleaned && !productionTraffic) + ' findings=' + findings.length + ' matrix_cases=' + matrix.length);
  console.log('AUDIT: diagnosis_only_application_unchanged_no_screenshots_traces_or_exports');
  if (incomplete || productionTraffic || !cleaned) process.exitCode = 1;
}
