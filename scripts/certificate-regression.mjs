// Isolated API regression tests: no credentials, network or database writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const state = { owner: 'account-a', result: null, error: null, writes: [] };
const chain = new Proxy({}, { get: (_, method) => (...args) => {
  state.writes.push([method, ...args]);
  return method === 'single' ? Promise.resolve({ data: state.result, error: state.error }) : chain;
} });
const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } } }) },
  from: () => chain, rpc: async () => ({ data: [], error: null }) };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/certificates.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(code, { module, exports: module.exports, require: name => {
  if (name.endsWith('/client')) return { supabase };
  if (name.endsWith('/images')) return { prepareWebImage() { throw Error('Not reached'); } };
  throw Error('Unexpected dependency');
}, fetch() { throw Error('Network forbidden'); } });
const api = module.exports;
const input = { agency: ' PADI ', level: ' OW ', certificate_number: ' private-number ', issued_on: '2024-02-29', issued_at: '', front_photo_path: null };
const validated = api.validateCertificate({ ...input, id: 'stripped', user_id: 'forged' });
assert.equal(validated.is_public, false);
assert.equal(validated.agency, 'PADI');
assert.equal(validated.certificate_number, 'private-number');
assert.equal(validated.issued_at, null);
assert.equal('id' in validated || 'user_id' in validated, false);
console.log('PASS: private_default_trim_and_write_allowlist');
for (const value of [{ agency: '' }, { level: '' }, { issued_on: '2025-02-29' }, { issued_on: 'bad' }, { issued_at: 'x'.repeat(161) }, { certificate_number: 'x'.repeat(121) }]) {
  assert.throws(() => api.validateCertificate({ ...input, ...value }));
}
console.log('PASS: required_fields_lengths_and_real_calendar_dates');
await assert.rejects(api.saveCertificate('stable-id', input, 'account-b'));
assert.equal(state.writes.length, 0);
console.log('PASS: changed_account_blocks_write');
state.result = { id: 'stable-id', user_id: 'account-a' };
await api.saveCertificate('stable-id', input, 'account-a');
await api.saveCertificate('stable-id', input, 'account-a');
assert.equal(state.writes.filter(([m]) => m === 'upsert').every(([, row]) => row.id === 'stable-id' && row.user_id === 'account-a' && !row.is_public), true);
console.log('PASS: retries_keep_stable_id_and_session_owner');
state.result = null;
await assert.rejects(api.saveCertificate('stable-id', input, 'account-a'));
await assert.rejects(api.archiveCertificate('stable-id', true, 'account-a'));
state.result = { user_id: 'account-b' };
await assert.rejects(api.saveCertificate('stable-id', input, 'account-a'));
console.log('PASS: missing_or_wrong_owner_save_confirmation_rejected');
for (const file of [{ type: 'application/pdf', size: 5 }, { type: 'image/jpeg', size: 0 }, { type: 'image/png', size: 10485761 }]) {
  await assert.rejects(api.uploadCertificateFront('stable-id', file, 'account-a'));
}
console.log('PASS: unsupported_empty_and_oversized_photos_rejected');
