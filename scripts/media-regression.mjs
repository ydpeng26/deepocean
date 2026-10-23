// Local actual-module tests; generated objects only. No network/browser/storage credentials.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(path, require) {
  const code = ts.transpileModule(fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; vm.runInNewContext(code, { module, exports: module.exports, require, fetch() { throw Error('Network forbidden'); } }); return module.exports;
}
const imageApi = load('src/lib/images.ts', () => ({}));
for (const file of [{ name: 'iphone.HEIC', type: 'image/heic' }, { name: 'x.heif', type: '' }, { name: 'x', type: 'image/heif-sequence' }]) assert.throws(() => imageApi.assertSupportedWebImage(file), /HEIC\/HEIF/);
for (const type of ['image/jpeg', 'image/png', 'image/webp']) imageApi.assertSupportedWebImage({ name: 'synthetic', type });
imageApi.assertSupportedWebImage({ name: 'generated.JPG', type: '' });
assert.throws(() => imageApi.assertSupportedWebImage({ name: 'generated.svg', type: 'image/svg+xml' }));
assert.ok(!imageApi.WEB_IMAGE_ACCEPT.includes('*'));
console.log('PASS: explicit_jpeg_png_webp_acceptance_and_early_heic_heif_or_unsupported_format_guidance');
const state = { owner: 'a', calls: [], writes: 0, fail: false, swap: false };
const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } } }) }, storage: { from: () => ({
  upload: async () => { state.writes++; return { error: null }; },
  createSignedUrls: async paths => { state.calls.push(paths.length); if (state.swap) state.owner = 'b'; return state.fail ? { error: Error('Synthetic signing failure') } : { data: [...paths].reverse().filter(p => !p.includes('missing')).map(path => ({ path, signedUrl: 'signed:' + path })), error: null }; },
}) } };
const api = load('src/lib/dives.ts', name => name.endsWith('/images') ? imageApi : { supabase });
assert.equal(api.diveCover({ photo_urls: ['a/movie.MOV'], photo_thumbnail_urls: [''] }).videoOnly, true);
const mixed = api.diveCover({ photo_urls: ['a/movie.mp4', 'a/photo.jpg'], photo_thumbnail_urls: ['', 'a/thumb.jpg'] });
assert.equal(mixed.path, 'a/thumb.jpg'); assert.equal(mixed.videoOnly, false);
assert.equal(api.diveCover({ photo_urls: [], photo_thumbnail_urls: [] }).path, null);
await assert.rejects(api.uploadPhotos([{ name: 'good.jpg', type: 'image/jpeg' }, { name: 'iphone.heic', type: 'image/heic' }], 'a', 'request'), /HEIC/); assert.equal(state.writes, 0);
console.log('PASS: video_only_placeholder_mixed_cover_uses_real_photo_and_invalid_sibling_rejects_before_any_upload');
const paths = Array.from({ length: 205 }, (_, i) => 'a/' + i + '.jpg'); paths[100] = 'a/missing.jpg';
const urls = await api.signedPhotoUrls([...paths, paths[0]], 'a');
assert.deepEqual(state.calls, [100, 100, 5]); assert.equal(urls.length, 206); assert.equal(urls[100], ''); assert.equal(urls[205], urls[0]);
state.fail = true; await assert.rejects(api.signedPhotoUrls(['a/one.jpg'], 'a')); state.fail = false;
state.swap = true; await assert.rejects(api.signedPhotoUrls(['a/one.jpg'], 'a')); state.swap = false; state.owner = 'a';
console.log('PASS: signing_batches_at_most_100_preserve_missing_slots_duplicates_and_reject_failure_or_account_switch');
function nodes(tree, out = []) { if (Array.isArray(tree)) tree.forEach(x => nodes(x, out)); else if (tree && typeof tree === 'object') { if (tree.type) out.push(tree); nodes(tree.props?.children, out); } return out; }
function harness() {
  let cursor = 0; const cells = [], cleanup = []; let finish;
  const s = { calls: 0, updates: 0, props: { ownerId: 'a', path: 'a/photo.jpg', url: 'signed-old', version: 1, label: 'Synthetic', className: 'aspect-square' } };
  const react = { useRef(v) { const i = cursor++; return cells[i] ??= { current: v }; }, useState(v) { const i = cursor++; if (!(i in cells)) cells[i] = v; return [cells[i], next => { s.updates++; cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; }, useEffect(fn) { const i = cursor++; if (!(i in cells)) { cells[i] = true; cleanup.push(fn()); } } };
  const jsx = (type, props) => ({ type, props });
  const Component = load('src/components/DiveMedia.tsx', name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name.includes('LanguageProvider') ? { useLanguage: () => ({ language: 'zh-CN' }) } : api).DiveMedia;
  s.props.reload = () => { s.calls++; return new Promise(resolve => finish = resolve); };
  s.render = () => { cursor = 0; return nodes(Component(s.props)); };
  s.finish = () => finish(); s.unmount = () => cleanup.forEach(fn => fn?.()); return s;
}
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
let s = harness(); const oldImage = s.render().find(n => n.type === 'img'); oldImage.props.onError();
assert.ok(s.render().some(n => n.props.role === 'alert'));
const retry = s.render().find(n => n.type === 'button'); retry.props.onClick(); retry.props.onClick(); assert.equal(s.calls, 1); assert.equal(s.render().find(n => n.type === 'button').props.disabled, true);
s.props.url = 'signed-new'; s.props.version = 2; s.render(); s.finish(); await tick(); oldImage.props.onError(); assert.equal(s.render().some(n => n.props.role === 'alert'), false);
s.props.error = true; assert.equal(s.render().some(n => n.type === 'img'), false);
console.log('PASS: actual_media_component_download_error_retry_lock_success_remount_stale_error_ignored_and_signing_error_hides_cached_image');
s = harness(); s.props.path = 'a/clip.mp4'; s.render().find(n => n.type === 'video').props.onError(); assert.equal(s.calls, 0); assert.ok(s.render().some(n => n.props.role === 'alert'));
s = harness(); s.props.path = null; s.props.url = null; s.props.cover = true; s.props.videoOnly = true; assert.equal(s.render().some(n => n.type === 'img' || n.type === 'video'), false); assert.equal(s.render().some(n => n.props['aria-label'] === '视频附件'), true);
s = harness(); s.props.url = null; s.props.pending = true; assert.ok(s.render().some(n => n.props.role === 'status')); assert.equal(s.render().some(n => n.props.role === 'alert'), false);
s = harness(); s.render().find(n => n.type === 'img').props.onError(); s.render().find(n => n.type === 'button').props.onClick(); s.unmount(); const before = s.updates; s.finish(); await tick(); assert.equal(s.updates, before);
console.log('PASS: video_download_error_no_retry_loop_video_cover_placeholder_pending_not_failure_and_no_late_unmounted_updates');
