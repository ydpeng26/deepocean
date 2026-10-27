// One explicitly disposable cloud-only recovery account. No human account data,
// passwords, tokens, images, database exports or downloadable artifacts logged.
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='ydpeng26/deepocean'||process.env.GITHUB_REF!=='refs/heads/codex/pc-layout-keyboard-audit')throw Error('Cloud recovery branch required');
const api='https://esovqvampbrhuhamkfcs.supabase.co',site='https://supdiver-recovery-test.vercel.app';
const admin=process.env.RECOVERY_SERVICE_ROLE_KEY;
if(!admin)throw Error('Recovery credential unavailable');
const anon=(await readFile(new URL('./recovery-browser.mjs',import.meta.url),'utf8')).match(/const anon = '([^']+)'/)[1];
const marker='account-deletion-'+randomBytes(12).toString('hex');
const email=marker+'@example.invalid',password=randomBytes(8).toString('base64url'),requestId=randomUUID();
const publicId=randomUUID(),privateId=randomUUID(),commentId=randomUUID();
let user,token,stage='preflight',failed=false;
const check=(ok,message)=>{if(!ok)throw Error(message);};
const pass=name=>{stage=name;console.log('PASS: '+name);};
async function raw(path,{method='GET',body,member=false,binary=false,origin}={}){
 check(path.startsWith('/')&&!path.startsWith('//'),'fixed API path');
 return fetch(api+path,{method,headers:{apikey:member?anon:admin,Authorization:'Bearer '+(member?token:admin),'Content-Type':binary?'image/png':'application/json',Prefer:'return=representation',...(origin?{Origin:origin}:{})},body:body===undefined?undefined:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
}
async function req(path,options){const r=await raw(path,options);check(r.ok,'Recovery HTTP '+r.status);const text=await r.text();return text?JSON.parse(text):null;}
const edge=(action,extra={})=>raw('/functions/v1/delete-account',{method:'POST',member:true,origin:site,body:{action,request_id:requestId,confirmation:action==='delete'?'DELETE MY ACCOUNT':'',...extra}});
const files=()=>['gear-photos','forum-media'].map(bucket=>({bucket,path:user.id+'/'+marker+'.png'}));
try {
 user=await req('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true,user_metadata:{display_name:marker}}});
 check(user.email===email&&/^[a-f0-9-]{36}$/.test(user.id),'Exact disposable account');
 const login=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(30000)});
 check(login.ok,'Fixture sign-in');token=(await login.json()).access_token;check(!!token,'Fixture session');
 const status=await edge('status');check(status.ok&&(await status.json()).code==='none','Status read only');
 check((await edge('delete',{user_id:user.id})).status===400,'Client target user rejected');
 const denied=await raw('/rest/v1/rpc/account_deletion_step',{method:'POST',member:true,body:{p_user:user.id,p_request:requestId,p_action:'begin'}});
 check(!denied.ok,'Member cannot invoke worker');
 pass('authenticated_status_and_worker_privilege_boundaries');
 await req('/rest/v1/gear_items',{method:'POST',member:true,body:{user_id:user.id,category:'mask',brand:marker,model:'Synthetic deletion'}});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=','base64');
 for(const file of files())await req('/storage/v1/object/'+file.bucket+'/'+file.path,{method:'POST',member:true,binary:true,body:png});
 await req('/rest/v1/forum_posts',{method:'POST',member:true,body:{id:publicId,user_id:user.id,body:'Synthetic public '+marker,visibility:'public',image_path:files()[1].path}});
 await req('/rest/v1/forum_posts',{method:'POST',member:true,body:{id:privateId,user_id:user.id,body:'Synthetic private '+marker,visibility:'private'}});
 await req('/rest/v1/forum_comments',{method:'POST',member:true,body:{id:commentId,user_id:user.id,post_id:publicId,body:'Synthetic comment '+marker}});
 pass('active_member_profile_gear_storage_public_private_post_comment_fixtures_created');
 const result=await edge('delete');const receipt=await result.json();check(result.ok&&receipt.code==='completed'&&receipt.id===requestId,'Exact completion receipt');
 check((await raw('/auth/v1/admin/users/'+user.id)).status===404,'Auth removed');
 for(const table of ['profiles','gear_items','dives','diver_certificates','marine_encounters']){
  const column=table==='profiles'?'id':'user_id';check((await req('/rest/v1/'+table+'?'+column+'=eq.'+user.id+'&select='+column)).length===0,'Private rows absent');
 }
 const posts=await req('/rest/v1/forum_posts?id=in.('+publicId+','+privateId+')&select=id,user_id,author_name,image_path,body');
 check(posts.length===1&&posts[0].id===publicId&&posts[0].user_id===null&&posts[0].author_name==='已注销用户'&&posts[0].image_path===null&&posts[0].body==='Synthetic public '+marker,'Public anonymous/private removed');
 const comments=await req('/rest/v1/forum_comments?id=eq.'+commentId+'&select=user_id,author_name,body');
 check(comments.length===1&&comments[0].user_id===null&&comments[0].author_name==='已注销用户'&&comments[0].body==='Synthetic comment '+marker,'Anonymous comment retained');
 for(const file of files())check((await req('/storage/v1/object/list/'+file.bucket,{method:'POST',body:{prefix:user.id+'/',limit:100}})).length===0,'Private image absent');
 pass('real_self_deletion_removes_auth_private_rows_images_and_retains_anonymous_public_text');
 const oldUpload=await raw('/storage/v1/object/gear-photos/'+user.id+'/'+marker+'-old-token.png',{method:'POST',member:true,binary:true,body:png});
 check(!oldUpload.ok,'Deleted account old JWT cannot upload');
 const oldEdit=await raw('/rest/v1/forum_posts?id=eq.'+publicId,{method:'PATCH',member:true,body:{user_id:user.id,title:'forbidden'}});
 check(!oldEdit.ok||(await oldEdit.json()).length===0,'Old token cannot reclaim anonymous post');
 const relogin=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(30000)});
 check(!relogin.ok,'Deleted login rejected');
 pass('old_jwt_storage_and_anonymous_post_reclaim_denied_login_removed');
} catch(error){failed=true;console.error('INCOMPLETE: account deletion stage='+stage+' type='+error.constructor.name);}
finally {
 if(user)try{
  // Only exact fixture IDs and marker bodies, never arbitrary member content.
  await req('/rest/v1/forum_comments?id=eq.'+commentId+'&body=eq.'+encodeURIComponent('Synthetic comment '+marker),{method:'DELETE'});
  for(const [id,kind] of [[publicId,'public'],[privateId,'private']])await req('/rest/v1/forum_posts?id=eq.'+id+'&body=eq.'+encodeURIComponent('Synthetic '+kind+' '+marker),{method:'DELETE'});
  for(const file of files())await req('/storage/v1/object/'+file.bucket,{method:'DELETE',body:{prefixes:[file.path,user.id+'/'+marker+'-old-token.png']}});
  const current=await raw('/auth/v1/admin/users/'+user.id);
  if(current.ok){check((await current.json()).email===email,'Cleanup identity');await req('/auth/v1/admin/users/'+user.id,{method:'DELETE'});}else check(current.status===404,'Cleanup Auth lookup');
  check((await raw('/auth/v1/admin/users/'+user.id)).status===404,'Cleanup Auth absence');
  check((await req('/rest/v1/forum_posts?id=in.('+publicId+','+privateId+')&select=id')).length===0,'Cleanup post absence');
  check((await req('/rest/v1/forum_comments?id=eq.'+commentId+'&select=id')).length===0,'Cleanup comment absence');
  for(const file of files())check((await req('/storage/v1/object/list/'+file.bucket,{method:'POST',body:{prefix:user.id+'/',limit:100}})).length===0,'Cleanup exact private files');
  console.log('Receipt for exact metadata cleanup: '+requestId);
  pass('exact_disposable_auth_public_private_comment_and_image_cleanup_verified');
 }catch(error){failed=true;console.error('INCOMPLETE: cleanup fixture='+user.id+' receipt='+requestId+' type='+error.constructor.name);}
}
if(failed)process.exitCode=1;
