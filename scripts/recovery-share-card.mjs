// One authorized synthetic dive/photo under the existing recovery test owner.
// Cloud-only, no passwords, tokens, real photos, exports or screenshots in logs/artifacts.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='ydpeng26/deepocean'||process.env.GITHUB_REF!=='refs/heads/codex/pc-layout-keyboard-audit')throw Error('Recovery cloud branch required');
const {chromium}=await import(process.env.RECOVERY_PLAYWRIGHT_MODULE||'playwright');
const api='https://esovqvampbrhuhamkfcs.supabase.co',site='https://supdiver-recovery-test.vercel.app';
const owner='97277c3f-3d5a-432d-b1e6-c3505215108b',id=randomUUID(),missing=randomUUID(),marker='CARD-ACCEPTANCE-'+id;
const path=owner+'/'+marker+'.png',admin=process.env.RECOVERY_SERVICE_ROLE_KEY;
if(!admin)throw Error('Missing recovery credential');
const anon=(await readFile(new URL('./recovery-browser.mjs',import.meta.url),'utf8')).match(/const anon = '([^']+)'/)[1];
let token,session,browser,stage='preflight',failed=false,blocked=0;
const check=(ok,message)=>{if(!ok)throw Error(message);};
const pass=name=>{stage=name;console.log('PASS: '+name);};
async function req(endpoint,{method='GET',body,member=false,binary=false}={}){
 check(endpoint.startsWith('/')&&!endpoint.startsWith('//'),'fixed_path');
 const r=await fetch(api+endpoint,{method,headers:{apikey:member?anon:admin,Authorization:'Bearer '+(member?token:admin),'Content-Type':binary?'image/png':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 check(r.ok,'http_'+r.status);const text=await r.text();return text?JSON.parse(text):null;
}
try{
 // Admin generate_link does not send email or modify the existing password.
 const user=await req('/auth/v1/admin/users/'+owner);check(user.id===owner&&user.email,'exact_recovery_owner');
 const link=await req('/auth/v1/admin/generate_link',{method:'POST',body:{type:'magiclink',email:user.email}});
 const hash=link.hashed_token??link.properties?.hashed_token;check(hash,'fixture_login_hash');
 const verified=await fetch(api+'/auth/v1/verify',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({type:'magiclink',token_hash:hash}),signal:AbortSignal.timeout(30000)});
 check(verified.ok,'fixture_login');session=await verified.json();check(session.user?.id===owner&&session.access_token,'owner_session');token=session.access_token;
 browser=await chromium.launch({channel:process.env.RECOVERY_BROWSER_CHANNEL||undefined});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,locale:'zh-CN'});
 await context.addInitScript(({session,site})=>{
  if(location.origin===site&&!sessionStorage.getItem('card-fixture-initialized')){sessionStorage.setItem('sb-esovqvampbrhuhamkfcs-auth-token',JSON.stringify(session));sessionStorage.setItem('card-fixture-initialized','true');localStorage.setItem('deepocean-language','zh-CN');}
  window.__cardTexts=[];const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__cardTexts.push(String(text));return original.call(this,text,...args);};
 },{session,site});
 const page=await context.newPage();
 const png=Buffer.from(await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1200;c.height=800;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,1200,800);g.addColorStop(0,'#23c6dc');g.addColorStop(1,'#07397d');x.fillStyle=g;x.fillRect(0,0,1200,800);x.fillStyle='#ffb25e';x.beginPath();x.ellipse(700,290,150,90,0,0,Math.PI*2);x.fill();x.fillStyle='white';x.font='40px sans-serif';x.fillText('SYNTHETIC TEST PHOTO',50,80);return Array.from(new Uint8Array(await(await new Promise(resolve=>c.toBlob(resolve,'image/png'))).arrayBuffer()));}));
 await req('/storage/v1/object/dive-photos/'+path,{method:'POST',member:true,binary:true,body:png});
 await req('/rest/v1/dives',{method:'POST',member:true,body:{id,user_id:owner,country:'Indonesia',region:'SYNTHETIC-REGION',site_name:marker,dive_date:'2026-10-20',max_depth:28,duration_min:48,water_temp:21,photo_urls:[path],photo_thumbnail_urls:[],notes:'SYNTHETIC-PRIVATE-NOTE'}});
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.origin===site)return route.continue();
  if(u.origin!==api){if(['www.supdiver.com','supdiver.com'].includes(u.hostname)||u.hostname.endsWith('.supabase.co'))blocked++;return route.abort();}
  if(u.pathname==='/rest/v1/profiles'&&request.method()==='GET'&&u.searchParams.get('id')==='eq.'+owner)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:owner,display_name:'SYNTHETIC-DIVER',avatar_url:null,cert_level:null,tank_count:0,bio:null}])});
  if(u.pathname==='/rest/v1/dives'&&request.method()==='GET'&&u.searchParams.get('user_id')==='eq.'+owner&&['eq.'+id,'eq.'+missing].includes(u.searchParams.get('id')))return route.continue();
  if(u.pathname==='/storage/v1/object/authenticated/dive-photos/'+path&&request.method()==='GET')return route.continue();
  if(u.pathname==='/auth/v1/user'&&request.method()==='GET')return route.continue();
  blocked++;return route.abort();
 });
 await page.goto(site+'/share-card?dive='+id,{waitUntil:'domcontentloaded',timeout:60000});
 const generate=()=>page.getByRole('button',{name:'生成 / 更新预览',exact:true});
 const preview=()=>page.getByAltText('纪念卡成品预览，保存与分享使用此图片',{exact:true});
 await generate().waitFor({timeout:40000});
 const render=async()=>{await page.evaluate(()=>window.__cardTexts=[]);await generate().click();await preview().waitFor({timeout:40000});return page.evaluate(()=>window.__cardTexts);};
 let texts=await render();check(texts.join('').includes(marker)&&!texts.some(x=>x.includes('SYNTHETIC-PRIVATE-NOTE'))&&!texts.some(x=>x.includes('SYNTHETIC-DIVER')),'private_defaults');
 const previewBytes=Buffer.from(await preview().evaluate(async image=>Array.from(new Uint8Array(await(await fetch(image.src)).arrayBuffer()))));
 check(previewBytes.subarray(1,4).toString()==='PNG'&&previewBytes.readUInt32BE(16)===1080&&previewBytes.readUInt32BE(20)===1350,'png_dimensions');
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'保存图片',exact:true}).click();const download=await downloadEvent;
 check(download.suggestedFilename()==='SupDiver-memory.png','generic_filename');const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);check(Buffer.concat(chunks).equals(previewBytes),'exact_preview_export');
 pass('real_photo_canvas_png_1080x1350_and_download_matches_reviewed_preview_exactly');
 await page.getByRole('checkbox',{name:'随笔摘录',exact:true}).check();check(await preview().count()===0&&!await page.getByRole('button',{name:'保存图片',exact:true}).isEnabled(),'stale_preview_invalidated');
 await page.getByLabel('摘录（仅用于图片，不修改日志）',{exact:true}).fill('SYNTHETIC-EXCERPT');await page.getByRole('checkbox',{name:'用户署名',exact:true}).check();texts=await render();check(texts.some(x=>x.includes('SYNTHETIC-EXCERPT'))&&texts.some(x=>x.includes('SYNTHETIC-DIVER')),'opt_in_private_fields');
 for(const label of ['地点与潜点名称','日期','潜水数据','随笔摘录','用户署名'])await page.getByRole('checkbox',{name:label,exact:true}).uncheck();
 texts=await render();check(texts.includes('OCEAN MEMORY')&&!texts.some(x=>x.includes('SYNTHETIC')||x.includes(marker)||x.includes('2026-10-20')||x.includes('28 m')),'hidden_fields_absent');
 pass('privacy_controls_remove_actual_rendered_location_date_metrics_note_and_signature_and_invalidate_old_export');
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});});await page.getByRole('button',{name:'分享图片',exact:true}).click();await page.getByText('此浏览器不支持图片分享，请先保存图片再分享。',{exact:true}).waitFor();
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shareKeys=Object.keys(data).sort();window.__shareName=data.files[0].name;throw new DOMException('Synthetic cancel','AbortError');}});});
 await page.getByRole('button',{name:'分享图片',exact:true}).click();await page.getByText('已取消分享，图片仍可保存。',{exact:true}).waitFor();check((await page.evaluate(()=>window.__shareKeys)).join('|')==='files|title'&&await page.evaluate(()=>window.__shareName)==='SupDiver-memory.png','file_only_share');
 await page.getByLabel('选择日志照片',{exact:true}).selectOption('');await render();
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile_no_overflow');
 pass('unsupported_share_fallback_native_cancel_file_only_payload_no_photo_template_and_mobile_layout');
 const [row]=await req('/rest/v1/dives?id=eq.'+id+'&user_id=eq.'+owner+'&select=notes,photo_urls');check(row.notes==='SYNTHETIC-PRIVATE-NOTE'&&row.photo_urls[0]===path,'source_log_unmodified');
 await page.goto(site+'/share-card?dive='+missing,{waitUntil:'domcontentloaded'});await page.getByText('无法读取这篇日志，可能已删除或无权访问。',{exact:true}).waitFor({timeout:30000});check(!await page.getByRole('button',{name:'保存图片',exact:true}).isEnabled(),'missing_log_no_export');
 check(blocked===0,'unexpected_private_or_formal_traffic');pass('no_source_log_mutation_missing_record_fails_closed_and_no_formal_or_unrelated_private_requests');
}catch(error){failed=true;console.error('INCOMPLETE: share-card stage='+stage+' reason='+error.message.slice(0,120).replace(/https?:\/\/\S+/g,'[url]'));}
finally{
 await browser?.close();
 try{
  // Exact UUID/path cleanup also covers a committed write whose reply was lost.
  await req('/rest/v1/dives?id=eq.'+id+'&user_id=eq.'+owner+'&site_name=eq.'+marker,{method:'DELETE'});
  await req('/storage/v1/object/dive-photos',{method:'DELETE',body:{prefixes:[path]}});
  check((await req('/rest/v1/dives?id=eq.'+id+'&select=id')).length===0,'fixture_row_absence');
  const files=await req('/storage/v1/object/list/dive-photos',{method:'POST',body:{prefix:owner+'/',search:marker,limit:100}});check(files.length===0,'fixture_photo_absence');
  if(token)await req('/auth/v1/logout?scope=local',{method:'POST',member:true});
  pass('exact_temporary_dive_and_synthetic_photo_cleanup_verified_existing_account_preserved');
 }catch(error){failed=true;console.error('INCOMPLETE: exact fixture cleanup id='+id+' reason='+error.message.slice(0,80));}
}
if(failed)process.exitCode=1;
