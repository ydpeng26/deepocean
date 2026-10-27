import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(path, require=()=>({})){
  const module={exports:{}};
  let source=read(path).replace('if (import.meta.main)','if (false)');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require,Request,Response,Headers,AbortSignal,TextDecoder,Uint8Array,Map,Date,setTimeout,clearTimeout});
  return module.exports;
}
const {createHandler}=load('supabase/functions/delete-account/index.ts');
const api='https://esovqvampbrhuhamkfcs.supabase.co',origin='https://supdiver-recovery-test.vercel.app';
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const request=(action='delete',extra={},requestOrigin=origin)=>new Request(api+'/functions/v1/delete-account',{method:'POST',headers:{Origin:requestOrigin,Authorization:'Bearer member','Content-Type':'application/json'},body:JSON.stringify({action,request_id:id,confirmation:action==='delete'?'DELETE MY ACCOUNT':'',...extra})});
function scenario({stale=false,pending=false,failStorage=false,wrongFinish=false,endless=false,authFail=false}={}){
  const calls=[];let removed=false;
  const handler=createHandler(key=>key==='SUPABASE_URL'?api:key==='SUPABASE_SERVICE_ROLE_KEY'?'server-only':undefined,async (input,init)=>{
    const path=new URL(input).pathname;calls.push({path,method:init?.method,body:init?.body});
    if(path==='/auth/v1/user')return authFail?json({},401):json({id:owner,last_sign_in_at:new Date(Date.now()-(stale?3600000:0)).toISOString()});
    if(path==='/rest/v1/rpc/account_deletion_step'){
      const body=JSON.parse(init.body);assert.equal(body.p_user,owner);assert.equal(body.p_request,id);
      if(body.p_action==='status')return json({id,status:pending?'pending':'none'});
      if(body.p_action==='files')return json({id,status:'pending',files:removed&&!endless?[]:[{bucket:'gear-photos',path:owner+'/synthetic.png'}]});
      return json({id:wrongFinish&&body.p_action==='finish'?owner:id,status:body.p_action==='finish'?'completed':'pending'});
    }
    if(path==='/storage/v1/object/gear-photos'){
      assert.deepEqual(JSON.parse(init.body).prefixes,[owner+'/synthetic.png']);
      removed=true;return json({},failStorage?503:200);
    }
    if(path==='/auth/v1/admin/users/'+owner)return json({});
    throw Error('Unexpected outbound request');
  });
  return {handler,calls};
}
let s=scenario();let response=await s.handler(request('status'));assert.equal((await response.json()).code,'none');assert.equal(s.calls.length,2);
s=scenario();assert.equal((await s.handler(request('delete',{user_id:owner}))).status,400);assert.equal(s.calls.length,0);
assert.equal((await s.handler(request('delete',{},'https://www.supdiver.com'))).status,403);
assert.equal((await s.handler(new Request(api,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'}}))).status,401);
console.log('PASS: status never starts deletion; foreign origins, missing auth and caller user IDs rejected before privileged work');
s=scenario({stale:true});response=await s.handler(request());assert.equal((await response.json()).code,'reauth');assert.equal(s.calls.length,2);
s=scenario({authFail:true});response=await s.handler(request());assert.notEqual((await response.json()).code,'completed');assert.equal(s.calls.length,1);
s=scenario();response=await s.handler(request());assert.equal((await response.json()).code,'completed');
assert.ok(s.calls.findIndex(c=>c.path.startsWith('/storage'))<s.calls.findIndex(c=>c.path.includes('/admin/users/')));
assert.equal(JSON.parse(s.calls.at(-1).body).p_action,'finish');
console.log('PASS: fresh server-verified sign-in required; private freeze/anonymization precedes Storage API removal, Auth delete and exact completion receipt');
s=scenario({failStorage:true});response=await s.handler(request());assert.equal((await response.json()).code,'pending');assert.ok(!s.calls.some(c=>c.path.includes('/admin/users/')));
s=scenario({pending:true,stale:true});assert.equal((await (await s.handler(request())).json()).code,'completed');
s=scenario({wrongFinish:true});assert.equal((await (await s.handler(request())).json()).code,'pending');
s=scenario({endless:true});response=await s.handler(request());assert.equal(response.status,202);assert.equal((await response.json()).code,'pending');assert.ok(!s.calls.some(c=>c.path.includes('/admin/users/')));
console.log('PASS: failed uploads/removal, invalid completion and bounded large-account batches never report success; pending work can resume without a new job');
let account=owner,receipt={id,code:'completed'},error=null;
const client=load('src/lib/account-management.ts',()=>({supabase:{auth:{getSession:async()=>({data:{session:{user:{id:account}}}})},functions:{invoke:async()=>({data:receipt,error})}}}));
assert.equal((await client.accountDeletion('delete',id,owner)).code,'completed');
receipt={id:owner,code:'completed'};await assert.rejects(client.accountDeletion('delete',id,owner));
receipt={id,code:'completed'};error=Error('lost reply');await assert.rejects(client.accountDeletion('delete',id,owner));
error=null;account='changed';await assert.rejects(client.accountDeletion('delete',id,owner));
console.log('PASS: client verifies account and exact successful receipt; wrong owner/receipt and lost response never become success');
const sql=read('supabase/migrations/20261027040335_account_deletion_anonymous_forum.sql');
assert.ok(sql.includes('as restrictive for all to authenticated'));
assert.ok(sql.includes("visibility='private'"));assert.ok(sql.includes('user_id=null'));
assert.ok(!/delete from storage\.objects/i.test(sql));
assert.ok(sql.includes('revoke all on function account_private.deletion_step(uuid,uuid,text) from public,anon,authenticated'));
assert.ok(sql.includes('security definer set search_path=\'\''));
assert.ok(read('src/routes/_authenticated/settings.tsx').includes('confirmation !== "DELETE MY ACCOUNT"'));
console.log('PASS: SQL boundaries preserve anonymous discussion, delete private posts, revoke worker access, block old JWT member access and never delete Storage metadata directly');
