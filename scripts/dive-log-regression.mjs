// Local synthetic regression only: no network, credentials, browser or database.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
function load(path, require) {
  const code = ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require,crypto:webcrypto,Uint8Array,fetch(){throw Error('Network forbidden');}});
  return module.exports;
}
const state={owner:'a',rows:[],writes:0,lost:false,readFailPage:-1,changePage:-1,pages:[],objects:new Set(),uploadLost:false};
function query(){let action='read',body,filters=[],range=null;const chain={
  select(){return chain;},eq(k,v){filters.push([k,v]);return chain;},order(){return chain;},range(a,b){range=[a,b];return chain;},insert(v){action='insert';body=v;return chain;},update(v){action='update';body=v;return chain;},then(a,b){return execute().then(a,b);},single(){return execute(true);},maybeSingle(){return execute(false,true);}
};async function execute(single=false,maybe=false){
  let rows=state.rows.filter(r=>filters.every(([k,v])=>r[k]===v));
  const count=rows.length;
  if(range){state.pages.push(range);if(range[0]===state.readFailPage)return{error:Error('Synthetic page failure')};if(range[0]===state.changePage)state.owner='b';rows=rows.slice(range[0],range[1]+1);}
  if(action==='insert'){state.writes++;if(state.rows.some(r=>r.id===body.id))return{error:{code:'23505'}};const row={...body,created_at:'2026-10-22',country:'Indonesia'};state.rows.push(row);if(state.lost){state.lost=false;return{error:Error('Lost response')};}rows=[row];}
  if(action==='update'){state.writes++;rows.forEach(r=>Object.assign(r,body));}
  if(single&&!rows.length)return{error:Error('No row')};
  return{data:single||maybe?(rows[0]??null):rows,count,error:null};
}return chain;}
const supabase={auth:{getSession:async()=>({data:{session:{user:{id:state.owner}}}})},from:query,storage:{from:()=>({upload:async(path)=>{if(state.objects.has(path))return{error:{statusCode:'409'}};state.objects.add(path);if(state.uploadLost){state.uploadLost=false;return{error:Error('Lost upload response')};}return{error:null};},createSignedUrls:async paths=>({data:paths.filter(p=>!p.includes('missing')).reverse().map(path=>({path,signedUrl:'signed:'+path})),error:null})})}};
const images=load('src/lib/images.ts',()=>({}));
const ordering=load('src/lib/dive-order.ts',()=>({}));
const api=load('src/lib/dives.ts',name=>name==='@/lib/dive-companions'?load('src/lib/dive-companions.ts',()=>({})):name.endsWith('/images')?{...images,prepareWebImage:async file=>file}:{supabase});
for(const [raw,kind] of [['-1','depth'],['-1','duration'],['1.5','duration'],['1,5','temperature'],['NaN','temperature'],['Infinity','depth'],['1.22','temperature'],['2147483648','duration']])assert.throws(()=>api.parseDiveNumber(raw,'字段',kind));
assert.equal(api.parseDiveNumber('-2.5','温度','temperature'),-2.5);assert.equal(api.parseDiveNumber('','温度','temperature'),null);assert.equal(api.parseDiveNumber('0','深度','depth'),0);
console.log('PASS: numeric_validation_preserves_valid_negative_temperature_rejects_malformed_negative_depth_and_fractional_duration');
state.rows=Array.from({length:1017},(_,i)=>({id:String(i),user_id:'a'}));
assert.equal((await api.listDives()).length,1017);assert.deepEqual(state.pages,[[0,499],[500,999],[1000,1499]]);
state.readFailPage=500;await assert.rejects(api.listDives());state.readFailPage=-1;state.changePage=500;await assert.rejects(api.listDives());state.changePage=-1;state.owner='a';
console.log('PASS: complete_1017_row_history_rejects_partial_page_failure_and_account_switch');
state.rows=[];
const payload={user_id:'a',country:'印度尼西亚',region:null,site_name:'Synthetic',dive_date:'2026-10-22',weather:null,surface_temp:-2,water_temp:20,max_depth:10,duration_min:30,dive_type:'recreational',buddy_role:null,buddy_name:null,photo_urls:[],photo_thumbnail_urls:[],notes:null};
state.lost=true;await assert.rejects(api.saveDive(payload,'stable',false));assert.equal(state.rows.length,1);assert.equal((await api.saveDive(payload,'stable',false)).id,'stable');assert.equal(state.writes,1);
await assert.rejects(api.saveDive({...payload,notes:'changed'},'stable',false));assert.equal(state.writes,1);
await Promise.all([api.saveDive(payload,'race',false),api.saveDive(payload,'race',false)]);assert.equal(state.rows.filter(r=>r.id==='race').length,1);
await assert.rejects(api.saveDive(payload,'missing',true));await assert.rejects(api.saveDive({...payload,photo_urls:Array(7).fill('x')},'too-many',false));
state.owner='b';await assert.rejects(api.saveDive(payload,'wrong-owner',false));state.owner='a';
console.log('PASS: stable_create_id_lost_response_concurrent_retry_changed_payload_missing_update_and_owner_guards');
const file={type:'image/png',name:'synthetic.png',size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
state.uploadLost=true;await assert.rejects(api.uploadPhotos([file],'a','request'));const first=await api.uploadPhotos([file],'a','request');await api.uploadPhotos([file],'a','request');assert.equal(state.objects.size,2);assert.equal(first.photoPaths.length,1);assert.equal(first.thumbnailPaths.length,1);
await assert.rejects(api.uploadPhotos([{type:'video/mp4',size:100*1024*1024+1}],'a','large'));assert.equal(state.objects.size,2);
assert.deepEqual(Array.from(await api.signedPhotoUrls(['a/missing.mp4','a/good.png'])),['','signed:a/good.png']);
console.log('PASS: immutable_retry_uploads_reuse_two_objects_oversized_video_rejected_and_signing_preserves_path_slots');

function nodes(tree,out=[]){if(Array.isArray(tree))tree.forEach(item=>nodes(item,out));else if(tree&&typeof tree==='object'){if(tree.type)out.push(tree);nodes(tree.props?.children,out);}return out;}
function formHarness(dive){let cursor=0;const cells=[],cleanups=[];let resolve,reject;const s={calls:0,payload:null,cache:0,navigations:0,busy:[],tree:null};
const react={useRef(value){const i=cursor++;return cells[i]??={current:value};},useState(value){const i=cursor++;if(!(i in cells))cells[i]=typeof value==='function'?value():value;return[cells[i],v=>{cells[i]=typeof v==='function'?v(cells[i]):v;}];},useEffect(fn){const i=cursor++;if(!(i in cells)){cells[i]=true;cleanups.push(fn());}}};
const jsx=(type,props)=>({type,props});
const Component=load('src/components/DiveForm.tsx',name=>{
 if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
 if(name==='@tanstack/react-router')return{useNavigate:()=>()=>s.navigations++};
 if(name==='@tanstack/react-query')return{useQuery:()=>({data:[],isError:false,isFetching:false,dataUpdatedAt:1,refetch:async()=>({})}),useQueryClient:()=>({setQueryData:()=>s.cache++,invalidateQueries:async()=>{}})};
 if(name==='sonner')return{toast:{error:()=>{},success:()=>{}}};
 if(name==='@/lib/images')return images;
 if(name==='@/lib/dive-companions')return load('src/lib/dive-companions.ts',()=>({}));
 if(name==='@/i18n/LanguageProvider')return{useLanguage:()=>({language:'zh-CN'})};
 if(name==='@/lib/dive-order')return ordering;
 if(name==='@/lib/dives')return{...api,requireDiveOwner:async()=> 'a',signedPhotoUrls:async()=>[],saveDive:(payload)=>{s.payload=payload;s.calls++;return new Promise((a,b)=>{resolve=a;reject=b;});}};
 if(name==="@/i18n/LanguageProvider")return{useLanguage:()=>({language:"zh-CN"})};if(name==="@/i18n/liveCopy")return{useLiveCopy:()=>x=>x};if(name==="@/hooks/useModalFocus")return{useModalFocus(){}};return new Proxy({},{get:(_,key)=>key});
}).DiveForm;
s.render=()=>{cursor=0;s.tree=Component({dive,onBusyChange:v=>s.busy.push(v)});return nodes(s.tree);};
s.input=(id,value)=>s.render().find(n=>n.props.id===id).props.onChange({target:{value}});
s.submit=()=>s.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
s.resolve=()=>resolve({...payload,id:'saved'});s.reject=()=>reject(Error('Synthetic'));s.unmount=()=>cleanups.forEach(fn=>fn?.());return s;}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
let s=formHarness();s.input('country','Indonesia');s.input('site','Synthetic');const firstSubmit=s.submit();const duplicate=s.submit();await tick();assert.equal(s.calls,1);assert.equal(s.render().find(n=>n.type==='fieldset').props.disabled,true);s.reject();await Promise.all([firstSubmit,duplicate]);assert.equal(s.render().find(n=>n.props.id==='site').props.value,'Synthetic');assert.equal(s.render().find(n=>n.type==='fieldset').props.disabled,false);
const retry=s.submit();await tick();s.resolve();await retry;assert.equal(s.calls,2);assert.equal(s.navigations,1);
s=formHarness();s.input('country','Indonesia');s.input('site','Synthetic');const late=s.submit();await tick();s.unmount();s.resolve();await late;assert.equal(s.cache,0);assert.equal(s.navigations,0);
console.log('PASS: real_form_synchronous_lock_disabled_fieldset_failure_draft_retention_and_no_late_cache_or_navigation');
s=formHarness();s.input('country','Indonesia');s.input('site','Retained draft');const selection={files:[{name:'camera.heic',type:'image/heic'}],value:'selected'};
s.render().find(n=>n.props.id==='photos').props.onChange({target:selection});assert.equal(selection.value,'');assert.equal(s.render().find(n=>n.props.id==='site').props.value,'Retained draft');assert.equal(s.calls,0);
console.log('PASS: actual_form_heic_rejected_at_selection_before_save_and_keeps_location_draft');

s=formHarness();s.input('country','Indonesia');s.input('site','Timed dive');s.input('entry-time','08:30');
const timedSubmit=s.submit();await tick();assert.equal(s.payload.entry_time,'08:30:00');s.resolve();await timedSubmit;
s=formHarness();s.input('country','Indonesia');s.input('site','Untimed dive');const untimedSubmit=s.submit();await tick();assert.equal(s.payload.entry_time,null);s.resolve();await untimedSubmit;
s=formHarness();s.input('country','Indonesia');s.input('site','Bad time');s.input('entry-time','24:00');await s.submit();assert.equal(s.calls,0);
console.log('PASS: actual form saves canonical entry time, allows old untimed records and rejects invalid input before saving');

s=formHarness({...payload,id:"editing",entry_time:"14:15:00",updated_at:"v1"});
assert.equal(s.render().find(n=>n.props.id==="entry-time").props.value,"14:15");
console.log("PASS: editing prefills saved entry time in minute format");

s=formHarness();s.input('country','Indonesia');s.input('site','Group dive');
const group=[{name:'Buddy A',role:'buddy'},{name:'Buddy B',role:'buddy'},{name:'Guide A',role:'guide'},{name:'Guide B',role:'guide'}];
s.render().find(n=>n.type==='DiveCompanionsEditor').props.onChange(group);
const groupSave=s.submit();await tick();assert.equal(s.payload.companions.length,4);assert.equal(s.payload.companions[3].name,'Guide B');s.resolve();await groupSave;
s=formHarness({...payload,id:'legacy',buddy_name:'Legacy buddy',buddy_role:'buddy',updated_at:'v'});
assert.equal(s.render().find(n=>n.type==='DiveCompanionsEditor').props.value[0].name,'Legacy buddy');
s.render().find(n=>n.type==='DiveCompanionsEditor').props.onChange([]);
const removeSave=s.submit();await tick();assert.equal(s.payload.companions.length,0);assert.equal(s.payload.buddy_name,null);s.resolve();await removeSave;
console.log('PASS: actual form saves multiple buddies/guides, prefills legacy person and clearing people clears legacy fields');

s=formHarness();s.input('country','Indonesia');s.input('site','Gas test');s.input('gas-type',' Nitrox 32 ');
const gasSave=s.submit();await tick();assert.equal(s.payload.gas_type,'Nitrox 32');s.resolve();await gasSave;
s=formHarness({...payload,id:'gas-edit',gas_type:'Trimix 21/35',updated_at:'v'});
assert.equal(s.render().find(n=>n.props.id==='gas-type').props.value,'Trimix 21/35');
s.input('gas-type','');const clearGas=s.submit();await tick();assert.equal(s.payload.gas_type,null);s.resolve();await clearGas;
s=formHarness();s.input('country','Indonesia');s.input('site','Invalid gas');s.input('gas-type','x'.repeat(81));await s.submit();assert.equal(s.calls,0);
console.log('PASS: gas type saves trimmed mix, prefills editing, clears to null and validates length');
