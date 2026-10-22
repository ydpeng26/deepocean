// Cloud-only recovery fixtures. No restored users, production traffic or downloadable artifacts.
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const api='https://esovqvampbrhuhamkfcs.supabase.co', site='https://supdiver-recovery-test.vercel.app';
const admin=process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon=(await readFile(new URL('./recovery-browser.mjs',import.meta.url),'utf8')).match(/const anon = '([^']+)'/)[1];
let user,browser,page,stage='preflight',failed=false;
const check=(ok,message)=>{if(!ok)throw Error(message);};
const pass=name=>{stage=name;console.log('PASS: '+name);};
async function req(path,{method='GET',body}={}) {
  check(path.startsWith('/')&&!path.startsWith('//'),'API path');
  const result=await fetch(api+path,{method,headers:{apikey:admin,Authorization:`Bearer ${admin}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  check(result.ok,'Recovery HTTP '+result.status);const text=await result.text();return text?JSON.parse(text):null;
}
const rows=table=>req('/rest/v1/'+table+'?user_id=eq.'+user.id+'&select=*');
const photoList=()=>req('/storage/v1/object/list/marine-photos',{method:'POST',body:{prefix:user.id+'/',limit:1000}});
async function settle(fn,predicate) {for(let n=0;n<80;n++){const value=await fn();if(predicate(value))return value;await new Promise(r=>setTimeout(r,250));}throw Error('Fixture did not settle');}
try {
  check(process.env.GITHUB_ACTIONS==='true'&&admin,'Cloud recovery credential');
  const email=`resilience-${randomBytes(12).toString('hex')}@example.invalid`,password=randomBytes(32).toString('base64url');
  user=await req('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
  await req('/rest/v1/gear_items',{method:'POST',body:{user_id:user.id,category:'mask',brand:'ORIGINAL-FIXTURE',model:'MODEL',dive_count:1}});
  browser=await chromium.launch({channel:process.env.RECOVERY_BROWSER_CHANNEL||undefined});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if((url.hostname.endsWith('.supabase.co')&&url.origin!==api)||['supdiver.com','www.supdiver.com'].includes(url.hostname)){failed=true;return route.abort();}return route.continue();});
  await context.addInitScript(()=>localStorage.setItem('deepocean-language','zh-CN'));
  page=await context.newPage();page.on('dialog',dialog=>dialog.accept());
  async function login(){await page.goto(site+'/auth',{waitUntil:'networkidle',timeout:90000});await page.getByLabel('邮箱',{exact:true}).fill(email);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL(url=>url.pathname!=='/auth',{timeout:60000});}
  await login();
  let marineMode='before',marinePosts=0,marinePatches=0;
  await context.route(api+'/rest/v1/marine_encounters*',async route=>{
    const method=route.request().method();
    if(method==='POST') {
      marinePosts++;await new Promise(r=>setTimeout(r,1000));
      if(marineMode==='before')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic failure"}'});
      if(marineMode==='lost'){const response=await route.fetch();check(response.ok(),'Commit synthetic row');return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic lost response"}'});}
    }
    if(method==='PATCH'){marinePatches++;if(marineMode==='edit-fail')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic edit failure"}'});}
    return route.continue();
  });
  stage='marine create failure';
  await page.goto(site+'/marine',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'记录一次相遇',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('生物名称',{exact:true}).fill('SYNTHETIC-TURTLE');
  await dialog.getByLabel('相遇地点',{exact:true}).fill('SYNTHETIC-LOCATION');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=','base64');
  await dialog.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});
  await dialog.getByRole('button',{name:'保存相遇',exact:true}).evaluate(button=>{button.click();button.click();});
  check(await dialog.getByLabel('生物名称',{exact:true}).isDisabled(),'Marine pending fields locked');
  await page.getByText(/保存未确认，内容与照片已保留/).first().waitFor();
  check(marinePosts===1&&(await rows('marine_encounters')).length===0,'One rejected post');
  check((await photoList()).length===1&&await dialog.getByLabel('生物名称',{exact:true}).inputValue()==='SYNTHETIC-TURTLE','Private photo and draft retained');
  pass('marine_failure_retains_draft_private_photo_and_blocks_duplicate_submit');
  stage='marine lost response';marineMode='lost';
  await dialog.getByRole('button',{name:'保存相遇',exact:true}).click();
  const [saved]=await settle(()=>rows('marine_encounters'),value=>value.length===1);
  await settle(()=>dialog.getByRole('button',{name:'保存相遇',exact:true}).isEnabled(),Boolean);
  check((await photoList()).length===1,'Referenced photo retained after lost response');
  await req('/storage/v1/object/sign/marine-photos/'+saved.photo_path,{method:'POST',body:{expiresIn:60}});
  marineMode='pass';const postsBeforeRetry=marinePosts;
  await dialog.getByRole('button',{name:'保存相遇',exact:true}).click();await dialog.waitFor({state:'hidden'});
  check(marinePosts===postsBeforeRetry&&(await rows('marine_encounters')).length===1&&(await photoList()).length===1,'Retry confirms same row and upload');
  await page.reload({waitUntil:'networkidle'});await page.getByText('SYNTHETIC-TURTLE',{exact:true}).waitFor();
  await settle(()=>page.locator('.do-marine-card img').evaluateAll(images=>images.some(image=>image.complete&&image.naturalWidth>0)),Boolean);
  pass('marine_committed_lost_response_retry_has_one_row_and_decodable_photo');
  stage='marine edit failure';
  await page.locator('.do-marine-card').click();await dialog.getByRole('button',{name:'编辑名称与记录 / 关闭求助',exact:true}).click();
  await dialog.getByLabel('相遇地点',{exact:true}).fill('EDITED-LOCATION');
  const replacement=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const painter=canvas.getContext('2d');painter.fillStyle='#39759b';painter.fillRect(0,0,2,2);return canvas.toDataURL('image/png').split(',')[1];});
  await dialog.locator('input[type=file]').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from(replacement,'base64')});
  marineMode='edit-fail';await dialog.getByRole('button',{name:'保存相遇',exact:true}).click();
  await settle(()=>dialog.getByRole('button',{name:'保存相遇',exact:true}).isEnabled(),Boolean);
  check((await rows('marine_encounters'))[0].photo_path===saved.photo_path,'Failed edit does not change row');
  check((await photoList()).length===2,'Both private old and new images retained');
  marineMode='pass';await dialog.getByRole('button',{name:'保存相遇',exact:true}).click();await dialog.waitFor({state:'hidden'});
  const [edited]=await rows('marine_encounters');check(edited.location==='EDITED-LOCATION'&&edited.photo_path!==saved.photo_path,'Edited row confirmed');
  pass('marine_failed_photo_replacement_and_retry_preserve_old_and_new_images');
  stage='marine zero-row update';
  await page.locator('.do-marine-card').click();await dialog.getByRole('button',{name:'编辑名称与记录 / 关闭求助',exact:true}).click();
  await req('/rest/v1/marine_encounters?id=eq.'+edited.id+'&user_id=eq.'+user.id,{method:'DELETE'});
  await dialog.getByLabel('相遇地点',{exact:true}).fill('MISSING-ROW-EDIT');await dialog.getByRole('button',{name:'保存相遇',exact:true}).click();
  await settle(()=>dialog.getByRole('button',{name:'保存相遇',exact:true}).isEnabled(),Boolean);
  check(await dialog.isVisible()&&(await rows('marine_encounters')).length===0&&(await photoList()).length===2,'Missing update stays open and does not delete photos');
  pass('marine_zero_row_edit_fails_without_false_success_or_photo_deletion');
  let gearReadFail=true,gearMode='pass',gearReads=0,gearWrites=0;
  await context.route(api+'/rest/v1/gear_items*',async route=>{
    const method=route.request().method();
    if(method==='GET'){gearReads++;if(gearReadFail)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic gear read failure"}'});}
    if(method==='PATCH'||method==='POST'){
      gearWrites++;await new Promise(r=>setTimeout(r,1600));
      if(gearMode==='before')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic gear write failure"}'});
      if(gearMode==='lost'){const response=await route.fetch();check(response.ok(),'Synthetic gear committed');return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic gear lost response"}'});}
    }return route.continue();
  });
  stage='gear load failure';
  await page.goto(site+'/gear',{waitUntil:'networkidle'});await page.getByRole('alert').waitFor({timeout:30000});
  check(await page.getByText('还没有登记装备。点击“新增装备”建立你的第一条装备档案。',{exact:true}).count()===0,'Error not empty');
  check(await page.getByLabel('品牌',{exact:true}).count()===0,'No blank form on read failure');
  gearReadFail=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();
  await settle(()=>page.getByLabel('品牌',{exact:true}).inputValue(),value=>value==='ORIGINAL-FIXTURE');
  pass('gear_load_error_has_retry_not_empty_collection_or_blank_editor');
  stage='gear background refresh';
  await page.getByLabel('品牌',{exact:true}).fill('UNSAVED-BRAND');
  await req('/rest/v1/gear_items?user_id=eq.'+user.id,{method:'PATCH',body:{brand:'SERVER-REFRESH'}});
  await page.waitForTimeout(31000);
  const readsBefore=gearReads;await context.setOffline(true);await page.waitForTimeout(500);
  const refetched=page.waitForResponse(response=>response.url().startsWith(api+'/rest/v1/gear_items')&&response.request().method()==='GET'&&response.ok(),{timeout:30000});
  await context.setOffline(false);
  const refetchResponse=await refetched;check((await refetchResponse.json())[0]?.brand==='SERVER-REFRESH','Actual fresh server data returned');
  await settle(()=>Promise.resolve(gearReads),value=>value>readsBefore);
  await page.waitForTimeout(800);check(await page.getByLabel('品牌',{exact:true}).inputValue()==='UNSAVED-BRAND','Draft survives refetch');
  pass('gear_real_reconnect_refetch_preserves_unsaved_draft');
  stage='gear save failure';gearMode='before';const writesBefore=gearWrites;
  await page.getByRole('button',{name:'保存装备',exact:true}).evaluate(button=>{button.click();button.click();});
  check(await page.getByRole('button',{name:'新增装备',exact:true}).isDisabled()&&await page.getByLabel('品牌',{exact:true}).isDisabled(),'Gear controls locked');
  await settle(()=>page.getByRole('button',{name:'保存装备',exact:true}).isEnabled(),Boolean);
  check(gearWrites===writesBefore+1&&await page.getByLabel('品牌',{exact:true}).inputValue()==='UNSAVED-BRAND','One failed write and draft retained');
  gearMode='pass';await page.getByRole('button',{name:'保存装备',exact:true}).click();
  await settle(()=>rows('gear_items'),value=>value[0]?.brand==='UNSAVED-BRAND');await settle(()=>page.getByRole('button',{name:'保存装备',exact:true}).isEnabled(),Boolean);
  await page.reload({waitUntil:'networkidle'});await settle(()=>page.getByLabel('品牌',{exact:true}).inputValue(),value=>value==='UNSAVED-BRAND');
  pass('gear_pending_controls_failure_retry_and_reload_preserve_exact_saved_fields');
  stage='gear new lost response';
  await page.getByRole('button',{name:'新增装备',exact:true}).click();await page.getByLabel('品牌',{exact:true}).fill('NEW-GEAR');
  gearMode='lost';await page.getByRole('button',{name:'保存装备',exact:true}).click();await settle(()=>rows('gear_items'),value=>value.length===2);await settle(()=>page.getByRole('button',{name:'保存装备',exact:true}).isEnabled(),Boolean);
  const writesBeforeRetry=gearWrites;gearMode='pass';await page.getByRole('button',{name:'保存装备',exact:true}).click();
  await page.getByText('新装备已添加',{exact:true}).waitFor();check(gearWrites===writesBeforeRetry&&(await rows('gear_items')).length===2,'No duplicate gear after lost response');
  pass('gear_committed_lost_response_retry_confirms_existing_row_without_duplicate');
  check(!failed,'Production traffic forbidden');
} catch(error){console.error(`Marine/gear test incomplete during ${stage} (${error.constructor.name}); details suppressed.`);failed=true;}
finally {
  await browser?.close();
  if(user)try {
    const files=(await photoList()).filter(item=>item.id).map(item=>user.id+'/'+item.name);check(files.every(path=>path.startsWith(user.id+'/')),'Exact fixture prefix');
    if(files.length)await req('/storage/v1/object/marine-photos',{method:'DELETE',body:{prefixes:files}});
    await req('/auth/v1/admin/users/'+user.id,{method:'DELETE'});
    const result=await fetch(api+'/auth/v1/admin/users/'+user.id,{headers:{apikey:admin,Authorization:`Bearer ${admin}`},signal:AbortSignal.timeout(45000)});
    check(result.status===404&&(await rows('marine_encounters')).length===0&&(await rows('gear_items')).length===0&&(await photoList()).length===0,'Cleanup verified');
    pass('disposable_account_marine_gear_rows_and_private_photos_cleanup_verified');
  }catch(error){console.error('Fixture cleanup incomplete ('+error.constructor.name+'); synthetic account id='+user.id);failed=true;}
}
if(failed)process.exitCode=1;
