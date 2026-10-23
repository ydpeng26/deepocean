// Cloud-only PC diagnosis. Generated media, exact disposable account, no human data/export/mail.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const ts = (await import(process.env.RECOVERY_TYPESCRIPT_MODULE)).default;
const api = 'https://esovqvampbrhuhamkfcs.supabase.co', site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon = (await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8')).match(/const anon = '([^']+)'/)[1];
const findings = []; let user, browser, page, temporary, stage = 'guard', failed = false, productionTraffic = false;
const check = (ok, message) => { if (!ok) { const e = Error(message); e.safeDiagnostic = true; throw e; } };
const pass = message => console.log('PASS: ' + message);
const finding = message => { findings.push(message); console.log('FINDING: ' + message); };
async function request(path, { method = 'GET', body, token = admin } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Relative recovery path');
  const response = await fetch(api + path, { method, headers: { apikey: token === admin ? admin : anon,
    Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const text = await response.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}
async function req(path, options) { const r = await request(path, options); check(r.ok, 'Recovery HTTP ' + r.status); return r.data; }
async function poll(fn, predicate) { for (let i = 0; i < 80; i++) { const v = await fn(); if (predicate(v)) return v; await new Promise(r => setTimeout(r, 250)); } throw Error('Fixture did not settle'); }
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud recovery guard');
  temporary = await mkdtemp(join(tmpdir(), 'supdiver-generated-media-'));
  const marker = 'MEDIA-' + randomBytes(7).toString('hex');
  stage = 'create disposable account';
  const email = 'media-' + randomBytes(12).toString('hex') + '@example.invalid', password = randomBytes(32).toString('base64url');
  user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await context.route('**/*', route => { const u = new URL(route.request().url());
    if ((u.hostname.endsWith('.supabase.co') && u.origin !== api) || ['supdiver.com', 'www.supdiver.com'].includes(u.hostname)) { productionTraffic = true; return route.abort(); }
    return route.continue(); });
  await context.addInitScript(() => localStorage.setItem('deepocean-language', 'zh-CN'));
  page = await context.newPage();
  await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByLabel('邮箱', { exact: true }).fill(email); await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click(); await page.waitForURL(u => u.pathname !== '/auth', { timeout: 60000 });
  stage = 'generated format and orientation samples';
  const samples = await page.evaluate(async () => {
    const bytes = async (width, height, type) => { const c = document.createElement('canvas'); c.width = width; c.height = height;
      const x = c.getContext('2d'); x.fillStyle = 'red'; x.fillRect(0, 0, width / 2, height); x.fillStyle = 'blue'; x.fillRect(width / 2, 0, width / 2, height);
      const blob = await new Promise(r => c.toBlob(r, type, 0.9)); return Array.from(new Uint8Array(await blob.arrayBuffer())); };
    return { jpeg: await bytes(120, 80, 'image/jpeg'), png: await bytes(4000, 3000, 'image/png'), webp: await bytes(160, 100, 'image/webp') };
  });
  const exif = Buffer.alloc(32); exif.write('Exif\0\0', 0, 'binary'); exif.write('II', 6); exif.writeUInt16LE(42, 8); exif.writeUInt32LE(8, 10);
  exif.writeUInt16LE(1, 14); exif.writeUInt16LE(0x112, 16); exif.writeUInt16LE(3, 18); exif.writeUInt32LE(1, 20); exif.writeUInt16LE(6, 24);
  const app1 = Buffer.from([0xff, 0xe1, 0, exif.length + 2]);
  const oriented = Buffer.concat([Buffer.from(samples.jpeg).subarray(0, 2), app1, exif, Buffer.from(samples.jpeg).subarray(2)]);
  const fixtures = [{ name: 'orientation-6.jpg', mimeType: 'image/jpeg', buffer: oriented },
    { name: 'large.png', mimeType: 'image/png', buffer: Buffer.from(samples.png) },
    { name: 'generated.webp', mimeType: 'image/webp', buffer: Buffer.from(samples.webp) }];
  for (const [ext, codec, mimeType] of [['mp4', 'libx264', 'video/mp4'], ['mov', 'libx264', 'video/quicktime'], ['webm', 'libvpx-vp9', 'video/webm']]) {
    const path = join(temporary, 'generated.' + ext);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x48:d=0.4', '-an', '-c:v', codec, '-pix_fmt', 'yuv420p', path], { stdio: 'ignore' });
    fixtures.push({ name: 'generated.' + ext, mimeType, buffer: await readFile(path) });
  }
  const source = ts.transpileModule(await readFile(new URL('../src/lib/images.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const transforms = await page.evaluate(async ({ source, inputs }) => {
    const exports = {}; new Function('exports', source)(exports);
    const results = [];
    for (const input of inputs) {
      const file = new File([new Uint8Array(input.bytes)], input.name, { type: input.type });
      const output = await exports.prepareWebImage(file, { maxEdge: 2400, quality: 0.84 }); const bitmap = await createImageBitmap(output);
      results.push({ width: bitmap.width, height: bitmap.height, type: output.type }); bitmap.close();
    }
    return results;
  }, { source, inputs: fixtures.slice(0, 3).map(f => ({ name: f.name, type: f.mimeType, bytes: [...f.buffer] })) });
  check(transforms[0].width === 80 && transforms[0].height === 120, 'EXIF orientation dimensions');
  check(transforms[1].width === 2400 && transforms[1].height === 1800 && transforms.every(x => x.type === 'image/jpeg'), 'Image conversion dimensions');
  pass('actual_image_module_exif_orientation_6_png_4000x3000_to_2400x1800_and_webp_to_jpeg');
  const rows = () => req('/rest/v1/dives?user_id=eq.' + user.id + '&select=id,site_name,photo_urls,photo_thumbnail_urls');
  async function form(suffix) { await page.goto(site + '/dives/new', { waitUntil: 'networkidle' }); await page.locator('#country').fill('Indonesia'); await page.locator('#site').fill(marker + '-' + suffix); }
  const submit = () => page.getByRole('button', { name: '保存记录', exact: true });
  stage = 'six real mixed media upload'; await form('VALID'); await page.locator('#photos').setInputFiles(fixtures); await submit().click();
  const saved = await poll(rows, r => r.some(x => x.site_name === marker + '-VALID')); const record = saved.find(x => x.site_name === marker + '-VALID');
  check(record.photo_urls.length === 6 && record.photo_thumbnail_urls.filter(Boolean).length === 3, 'Mixed media persisted paths');
  await page.goto(site + '/dives/' + record.id, { waitUntil: 'networkidle' });
  await poll(() => page.locator('video').evaluateAll(v => v.map(x => ({ width: x.videoWidth, error: !!x.error }))), v => v.length === 3 && v.every(x => x.width > 0 || x.error));
  const videos = await page.locator('video').evaluateAll(v => v.map(x => ({ width: x.videoWidth, height: x.videoHeight, error: !!x.error })));
  if (videos.every(v => v.width === 64 && v.height === 48 && !v.error)) pass('real_mp4_h264_mov_h264_webm_vp9_upload_reload_and_desktop_chromium_metadata_decode');
  else finding('one_or_more_generated_video_formats_upload_but_fail_desktop_chromium_decode');
  await poll(() => page.locator('img[src*="/storage/"]').evaluateAll(v => v.map(x => [x.naturalWidth, x.naturalHeight])), v => v.length === 3 && v.every(x => x[0] > 0));
  const sizes = await page.locator('img[src*="/storage/"]').evaluateAll(v => v.map(x => [x.naturalWidth, x.naturalHeight]));
  check(sizes.some(x => x[0] === 80 && x[1] === 120) && sizes.some(x => x[0] === 2400 && x[1] === 1800), 'Stored image orientation/resize');
  pass('actual_form_six_mixed_media_original_and_thumbnail_paths_reload_with_correct_image_dimensions');
  stage = 'expired download response';
  let denied = 0;
  await context.route(api + '/storage/v1/object/sign/dive-photos/**', route => { denied++; return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Synthetic expired signed download"}' }); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('img[src*="/storage/"]').first().waitFor();
  await poll(() => page.locator('img[src*="/storage/"]').evaluateAll(v => v.every(x => x.complete && x.naturalWidth === 0)), Boolean);
  check(denied > 0, 'Actual signed media GET rejected');
  if (await page.getByText(/附件暂不可用|链接.*过期|重新加载附件|重试.*附件/).count() === 0 && await page.getByRole('button', { name: /重试.*附件|重新加载.*附件|刷新.*附件/ }).count() === 0)
    finding('detail_signed_download_403_leaves_broken_image_or_video_without_media_error_or_in_page_retry');
  else pass('signed_download_failure_has_explicit_media_error_or_retry');
  await context.unroute(api + '/storage/v1/object/sign/dive-photos/**');
  stage = 'oversized video rejection'; await form('OVERSIZE');
  await page.locator('#photos').evaluate(input => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(100 * 1024 * 1024 + 1)], 'too-large.mp4', { type: 'video/mp4' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await submit().click(); await page.getByText('单个视频不能超过 100MB', { exact: true }).waitFor();
  check((await rows()).length === 1 && await page.locator('#site').inputValue() === marker + '-OVERSIZE', 'Oversize rejection retained draft');
  pass('100MiB_plus_one_video_rejected_no_new_record_and_text_draft_retained');
  stage = 'genuine HEIC diagnosis';
  await writeFile(join(temporary, 'source.jpg'), Buffer.from(samples.jpeg));
  execFileSync('heif-enc', ['-q', '35', '-o', join(temporary, 'generated.heic'), join(temporary, 'source.jpg')], { stdio: 'ignore', timeout: 60000 });
  await form('HEIC'); await page.locator('#photos').setInputFiles({ name: 'generated.heic', mimeType: 'image/heic', buffer: await readFile(join(temporary, 'generated.heic')) }); await submit().click();
  await poll(async () => ({ saved: (await rows()).some(x => x.site_name === marker + '-HEIC'), error: await page.getByText('无法处理该图片，请选择 JPG、PNG 或 WebP 格式', { exact: true }).count() }), v => v.saved || v.error > 0).then(v => {
    if (v.saved) pass('genuine_heic_decoded_and_saved_in_this_desktop_browser'); else finding('image_wildcard_picker_accepts_genuine_heic_but_current_desktop_converter_rejects_it');
  });
  check(!productionTraffic, 'Production traffic forbidden');
} catch (error) { failed = true; console.error('INCOMPLETE: media stage=' + stage + ' type=' + error.constructor.name + (error.safeDiagnostic ? ' reason=' + error.message : '')); }
finally {
  await browser?.close();
  if (user) try {
    for (const prefix of [user.id + '/', user.id + '/thumbs/']) {
      const files = await req('/storage/v1/object/list/dive-photos', { method: 'POST', body: { prefix, limit: 1000 } });
      const paths = files.filter(x => x.id).map(x => prefix + x.name); check(paths.every(x => x.startsWith(user.id + '/') && !x.includes('..')), 'Exact generated object prefix');
      if (paths.length) await req('/storage/v1/object/dive-photos', { method: 'DELETE', body: { prefixes: paths } });
      check((await req('/storage/v1/object/list/dive-photos', { method: 'POST', body: { prefix, limit: 1000 } })).filter(x => x.id).length === 0, 'Generated media remains');
    }
    await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' }); check((await request('/auth/v1/admin/users/' + user.id)).status === 404, 'Generated account remains');
    check((await req('/rest/v1/dives?user_id=eq.' + user.id + '&select=id')).length === 0, 'Generated dive rows remain');
    pass('exact_disposable_account_logs_originals_and_thumbnails_cleanup_verified');
  } catch (error) { failed = true; console.error('INCOMPLETE: media_cleanup account=' + user.id + ' type=' + error.constructor.name); }
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
console.log('AUDIT: complete=' + !failed + ' findings=' + findings.length);
if (failed) process.exitCode = 1;
