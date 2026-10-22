// Executes application API contracts against an isolated in-memory database.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto, randomUUID } from 'node:crypto';
import ts from 'typescript';
function load(file, require) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require, console, crypto: { subtle: webcrypto.subtle, randomUUID }, fetch() { throw Error('Network forbidden'); } });
  return module.exports;
}
function database() {
  const state = { owner: 'fixture-owner', tables: { marine_encounters: new Map(), gear_items: new Map() }, photos: new Set(), removed: [], writes: 0, fail: null };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } } }) },
    storage: { from: () => ({ upload: async path => { if (state.photos.has(path)) return { error: { statusCode: '409' } }; state.photos.add(path); return { error: null }; }, remove: async paths => { state.removed.push(...paths); paths.forEach(path => state.photos.delete(path)); return { error: null }; } }) },
    from(table) {
      let operation='select', payload, filters=[];
      const execute = (single=false) => {
        if (table==='profiles') return { data: { display_name: 'Fixture' }, error: null };
        const rows = state.tables[table];
        const matches = row => filters.every(([key,value]) => row[key]===value);
        let data;
        if (operation==='insert') {
          if (rows.has(payload.id)) return { data: null, error: { code: '23505' } };
          if (state.fail==='before') { state.fail=null; return { data:null,error:Error('synthetic failure') }; }
          data = { ...payload }; rows.set(data.id,data); state.writes++;
        } else if (operation==='update') {
          data = [...rows.values()].find(matches);
          if (data) { data={...data,...payload};rows.set(data.id,data);state.writes++; }
        } else data=[...rows.values()].filter(matches);
        if(operation!=='select'&&state.fail==='lost') { state.fail=null;return { data:null,error:Error('synthetic lost response') }; }
        if(Array.isArray(data)&&single)data=data[0]??null;
        return { data: data??null, error: single&&!data ? Error('No returned row') : null };
      };
      const q = new Proxy({}, { get: (_, key) => {
        if(key==='then')return resolve=>Promise.resolve(resolve(execute()));
        if(key==='single')return async()=>execute(true);
        if(key==='maybeSingle')return async()=>execute(false).data instanceof Array ? { data: execute(false).data[0]??null,error:null } : execute(false);
        return (...args)=>{if(key==='insert'||key==='update'){operation=key;payload=args[0];}if(key==='eq')filters.push(args);return q;};
      } });return q;
    },
  };
  const require = name => name.endsWith('/client') ? { supabase } : { prepareWebImage: async () => ({ arrayBuffer: async () => new TextEncoder().encode('synthetic-image').buffer }) };
  return { state, marine: load('src/lib/marine.ts',require), gear: load('src/lib/gear.ts',require) };
}
const encounter = { file:{type:'image/png',size:100},species_name:'Fixture',encountered_on:'2026-10-21',location:'Fixture',needs_help:false };
const gearInput = { category:'mask',brand:'Fixture',model:'M',purchased_on:null,next_service_on:null,serial_number:null,dive_count:1,notes:null,photo_path:null };
{
  const {state,marine}=database();state.fail='lost';
  await assert.rejects(marine.saveEncounter(encounter,undefined,'stable-id','fixture-owner'));
  const saved=state.tables.marine_encounters.get('stable-id');assert(saved);assert(state.photos.has(saved.photo_path));assert.equal(state.removed.length,0);
  const retried=await marine.saveEncounter(encounter,undefined,'stable-id','fixture-owner');
  assert.equal(retried.id,'stable-id');assert.equal(state.tables.marine_encounters.size,1);assert.equal(state.photos.size,1);assert.equal(state.writes,1);
  await assert.rejects(marine.saveEncounter({...encounter,location:'Changed after ambiguous commit'},undefined,'stable-id','fixture-owner'));
  assert.equal(state.tables.marine_encounters.get('stable-id').location,'Fixture');
  console.log('PASS: marine lost response preserves referenced photo; identical retry confirms one row; changed retry rejected');
}
{
  const {state,marine}=database();state.photos.add('fixture-owner/old.jpg');
  await assert.rejects(marine.saveEncounter(encounter,{id:'missing',user_id:'fixture-owner',photo_path:'fixture-owner/old.jpg'},'missing','fixture-owner'));
  assert(state.photos.has('fixture-owner/old.jpg'));assert.equal(state.removed.length,0);
  console.log('PASS: marine zero-row edit is an error and cannot delete old or new photo');
}
{
  const {state,marine}=database();state.fail='before';
  await assert.rejects(marine.saveEncounter(encounter,undefined,'stable-id','fixture-owner'));
  assert.equal(state.tables.marine_encounters.size,0);assert.equal(state.photos.size,1);
  await marine.saveEncounter(encounter,undefined,'stable-id','fixture-owner');assert.equal(state.tables.marine_encounters.size,1);assert.equal(state.photos.size,1);
  console.log('PASS: marine definite failure retains private upload and retry reuses it');
}
{
  const {state,marine,gear}=database();
  await assert.rejects(marine.saveEncounter(encounter,undefined,'stable-id','other-owner'));
  await assert.rejects(gear.createGear(gearInput,'stable-id','other-owner'));
  assert.equal(state.photos.size,0);assert.equal(state.writes,0);
  console.log('PASS: expected account mismatch blocks marine and gear writes before upload');
}
{
  const {state,gear}=database();state.fail='lost';
  await assert.rejects(gear.createGear(gearInput,'stable-id','fixture-owner'));
  const saved=await gear.createGear(gearInput,'stable-id','fixture-owner');assert.equal(saved.id,'stable-id');assert.equal(state.tables.gear_items.size,1);assert.equal(state.writes,1);
  await assert.rejects(gear.createGear({...gearInput,brand:'changed'},'stable-id','fixture-owner'));
  await assert.rejects(gear.updateGear('missing',gearInput,'fixture-owner'));
  for(const count of [-1,1.5,Infinity,2147483648])assert.throws(()=>gear.validateGear({...gearInput,dive_count:count}));
  console.log('PASS: gear stable retry, changed retry rejection, zero-row edit failure and integer bounds');
}
console.log('Scope: local mocked API checks, no real credentials, network or data changes.');
