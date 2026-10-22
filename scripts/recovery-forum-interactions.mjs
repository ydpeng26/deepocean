// Cloud-only diagnosis: generated accounts/text; no mail, human edits or media export.
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const api='https://esovqvampbrhuhamkfcs.supabase.co', site='https://supdiver-recovery-test.vercel.app';
const admin=process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon=(await readFile(new URL('./recovery-browser.mjs',import.meta.url),'utf8')).match(/const anon = '([^']+)'/)[1];
const users=[],findings=[];let browser,page,stage='preflight',failed=false,productionTraffic=false;
const repaired=process.env.FORUM_EXPECT_FIXED==='true';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const pass=text=>console.log('PASS: '+text);
const finding=text=>{findings.push(text);console.log('FINDING: '+text);};
function observe(bad,text,success){if(bad){check(!repaired,text);finding(text);}else pass(success);}
async function request(path,{method='GET',body,token=admin}={}){
  check(path.startsWith('/')&&!path.startsWith('//'),'relative recovery path');
  const r=await fetch(api+path,{method,headers:{apikey:token===admin?admin:anon,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}return{ok:r.ok,status:r.status,data};
}
async function req(path,options){const r=await request(path,options);check(r.ok,'Recovery HTTP '+r.status);return r.data;}
async function poll(fn,predicate){for(let n=0;n<60;n++){const value=await fn();if(predicate(value))return value;await new Promise(r=>setTimeout(r,250));}throw Error('Fixture did not settle');}
try{
  check(process.env.GITHUB_ACTIONS==='true'&&admin,'Cloud recovery guard');
  const marker='INTERACTION-'+randomBytes(6).toString('hex');
  for(let index=0;index<2;index++){
    const email='forum-audit-'+randomBytes(12).toString('hex')+'@example.invalid',password=randomBytes(32).toString('base64url');
    const user=await req('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});users.push(user);
    const session=await req('/auth/v1/token?grant_type=password',{method:'POST',token:anon,body:{email,password}});
    Object.assign(user,{email,password,token:session.access_token});
    await req('/rest/v1/profiles?id=eq.'+user.id,{method:'PATCH',body:{display_name:marker+'-'+index}});
  }
  const [a,b]=users;
  const [own]=await req('/rest/v1/forum_posts',{method:'POST',token:a.token,body:{user_id:a.id,title:marker+'-OWN',body:'SYNTHETIC OWN',topic:'stories'}});
  const [post,second]=await req('/rest/v1/forum_posts',{method:'POST',token:b.token,body:[{user_id:b.id,title:marker+'-TARGET',body:'SYNTHETIC TARGET',topic:'stories'},{user_id:b.id,title:marker+'-SECOND',body:'SYNTHETIC SECOND',topic:'stories'}]});
  const comments=()=>req('/rest/v1/forum_comments?post_id=eq.'+post.id+'&select=id,body,user_id');
  const privateRows=(table,filter,token=a.token)=>req('/rest/v1/'+table+'?'+filter+'&select=*',{token});
  browser=await chromium.launch({channel:process.env.RECOVERY_BROWSER_CHANNEL||undefined});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if((u.hostname.endsWith('.supabase.co')&&u.origin!==api)||['supdiver.com','www.supdiver.com'].includes(u.hostname)){productionTraffic=true;return route.abort();}return route.continue();});
  await context.addInitScript(()=>localStorage.setItem('deepocean-language','zh-CN'));
  page=await context.newPage();
  await page.goto(site+'/auth',{waitUntil:'networkidle',timeout:90000});
  await page.getByLabel('邮箱',{exact:true}).fill(a.email);await page.getByLabel('密码',{exact:true}).fill(a.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL(u=>u.pathname!=='/auth',{timeout:60000});
  async function forum(){await page.goto(site+'/forum',{waitUntil:'networkidle'});await page.locator('#post-'+post.id).waitFor();}
  const card=()=>page.locator('#post-'+post.id);
  async function menu(name){await card().getByRole('button',{name:'更多操作',exact:true}).click();await card().getByRole('menuitem',{name,exact:true}).click();}
  async function openComments(){await card().getByRole('button',{name:'阅读全文',exact:true}).click();await page.getByRole('dialog').waitFor();}
  const dialog=()=>page.getByRole('dialog');
  const draft=()=>dialog().locator('.do-forum-comment-form textarea');
  const send=()=>dialog().locator('.do-forum-comment-form button');
  const close=()=>dialog().getByRole('button',{name:'取消',exact:true}).click();
  await forum();
  if(process.env.FORUM_SOCIAL_EXPECT_FIXED==='true'){
    stage='private relation read failures';
    for(const table of ['forum_bookmarks','forum_follows','forum_blocks']){
      const pattern=api+'/rest/v1/'+table+'*';let fail=true;
      await context.route(pattern,route=>route.request().method()==='GET'&&fail?route.fulfill({status:400,contentType:'application/json',body:'{"message":"Synthetic private state read failure"}'}):route.continue());
      await page.reload({waitUntil:'networkidle'});await page.getByText('论坛暂时无法加载，请稍后重试。',{exact:true}).waitFor();check(await page.locator('.do-forum-post').count()===0&&await card().count()===0,'Private read failure must not expose cached posts');
      fail=false;await page.getByRole('button',{name:'重新加载论坛',exact:true}).click();await card().waitFor();await context.unroute(pattern);
    }
    pass('bookmark_follow_and_block_read_failures_hide_feed_and_retry_restores_it');
    for(const relation of ['like','bookmark','follow']){
      stage='social recovery '+relation;
      const table=relation==='like'?'forum_likes':relation==='bookmark'?'forum_bookmarks':'forum_follows';
      const filter=relation==='follow'?'follower_id=eq.'+a.id+'&following_id=eq.'+b.id:'post_id=eq.'+post.id;
      const button=()=>relation==='like'?card().locator('footer > div').first().getByRole('button').first():relation==='bookmark'?card().getByRole('button',{name:'收藏',exact:true}):page.locator('.do-forum-people article').filter({has:page.locator('a[href="/divers/'+b.id+'"]')}).getByRole('button');
      const attribute=relation==='follow'?'data-followed':'data-active';let mode='reject',writes=0;
      const pattern=api+'/rest/v1/'+table+'*';
      await context.route(pattern,async route=>{
        if(['POST','DELETE'].includes(route.request().method())){
          writes++;await new Promise(resolve=>setTimeout(resolve,700));
          if(mode==='reject')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic rejected social action"}'});
          if(mode==='lost'){const response=await route.fetch();check(response.ok(),'Social fixture write commits');return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic lost social reply"}'});}
        }
        return route.continue();
      });
      await button().evaluate(element=>{element.click();element.click();});await poll(()=>writes,v=>v===1);check(await button().isDisabled(),'Pending social button must lock');await poll(()=>button().isEnabled(),Boolean);check((await privateRows(table,filter)).length===0,'Rejected social action must not write');
      mode='lost';await button().click();await poll(()=>privateRows(table,filter),rows=>rows.length===1);await poll(()=>button().isEnabled(),Boolean);check(await button().getAttribute(attribute)==='false','Lost add reply keeps last confirmed UI');
      mode='pass';await button().click();await poll(()=>button().getAttribute(attribute),v=>v==='true');check((await privateRows(table,filter)).length===1,'Lost add retry must leave one relation');
      mode='lost';await button().click();await poll(()=>privateRows(table,filter),rows=>rows.length===0);await poll(()=>button().isEnabled(),Boolean);mode='pass';await button().click();await poll(()=>button().getAttribute(attribute),v=>v==='false');check((await privateRows(table,filter)).length===0,'Lost remove retry stays absent');
      await context.unroute(pattern);await page.reload({waitUntil:'networkidle'});await card().waitFor();check(await button().getAttribute(attribute)==='false','Social final state survives reload');
      pass(relation+'_reject_double_click_pending_lock_lost_add_remove_retry_and_reload');
    }
  }
  stage='likes';
  const like=()=>card().locator('footer > div').first().getByRole('button').first();
  await like().click();await poll(()=>privateRows('forum_likes','post_id=eq.'+post.id),rows=>rows.length===1);await poll(()=>like().getAttribute('data-active'),v=>v==='true');
  await page.reload({waitUntil:'networkidle'});check(await like().getAttribute('data-active')==='true','Like reload state');
  await like().click();await poll(()=>privateRows('forum_likes','post_id=eq.'+post.id),rows=>rows.length===0);await poll(()=>like().getAttribute('data-active'),v=>v==='false');
  pass('browser_like_add_remove_and_reload_persistence');
  stage='bookmarks';
  const bookmark=()=>card().getByRole('button',{name:'收藏',exact:true});
  await bookmark().click();await poll(()=>privateRows('forum_bookmarks','post_id=eq.'+post.id),rows=>rows.length===1);await poll(()=>bookmark().getAttribute('data-active'),v=>v==='true');
  check((await privateRows('forum_bookmarks','post_id=eq.'+post.id,b.token)).length===0,'Other member sees bookmark');
  await page.reload({waitUntil:'networkidle'});check(await bookmark().getAttribute('data-active')==='true','Bookmark reload state');
  await bookmark().click();await poll(()=>privateRows('forum_bookmarks','post_id=eq.'+post.id),rows=>rows.length===0);await poll(()=>bookmark().getAttribute('data-active'),v=>v==='false');
  pass('browser_bookmark_add_remove_reload_and_other_account_privacy');
  stage='follow';
  const person=()=>page.locator('.do-forum-people article').filter({has:page.locator('a[href="/divers/'+b.id+'"]')});
  await person().getByRole('button',{name:'关注',exact:true}).click();await poll(()=>privateRows('forum_follows','follower_id=eq.'+a.id+'&following_id=eq.'+b.id),rows=>rows.length===1);
  await page.reload({waitUntil:'networkidle'});await person().getByRole('button',{name:'已关注',exact:true}).waitFor();
  await person().getByRole('button',{name:'已关注',exact:true}).click();await poll(()=>privateRows('forum_follows','follower_id=eq.'+a.id+'&following_id=eq.'+b.id),rows=>rows.length===0);
  pass('browser_follow_unfollow_and_reload_persistence');
  stage='reports';
  await menu('举报帖子');await poll(()=>privateRows('forum_reports','post_id=eq.'+post.id),rows=>rows.length===1);await menu('举报帖子');await page.waitForTimeout(1000);
  check((await privateRows('forum_reports','post_id=eq.'+post.id)).length===1&&(await privateRows('forum_reports','post_id=eq.'+post.id,b.token)).length===0,'Report duplicate or privacy');
  pass('browser_report_repeat_is_one_private_pending_record');
  stage='comment normal';
  await openComments();await draft().fill('SYNTHETIC NORMAL');await send().click();await poll(comments,rows=>rows.length===1);await poll(()=>draft().inputValue(),v=>v==='');
  await dialog().getByText('SYNTHETIC NORMAL',{exact:true}).waitFor();
  const editControls=await dialog().getByRole('button',{name:/编辑|删除/}).count();
  observe(!editControls,'own_comment_has_no_edit_or_delete_control_in_current_comment_dialog','own_comment_edit_and_delete_controls_visible');
  pass('browser_comment_submit_persisted_and_rendered');
  await close();await req('/rest/v1/forum_comments?post_id=eq.'+post.id,{method:'DELETE'});
  let mode='pass',writeCount=0;
  await context.route(api+'/rest/v1/forum_comments*',async route=>{
    const method=route.request().method();
    if(method==='GET'&&mode==='read-fail')return route.fulfill({status:400,contentType:'application/json',body:'{"message":"Synthetic comment read failure"}'});
    if(method==='POST'){
      writeCount++;await new Promise(r=>setTimeout(r,900));
      if(mode==='before')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic comment write failure"}'});
      if(mode==='lost'){const response=await route.fetch();check(response.ok(),'Synthetic comment commit');return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic lost comment response"}'});}
    }
    if((method==='PATCH'&&mode==='edit-fail')||(method==='DELETE'&&mode==='delete-fail'))return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic comment management failure"}'});
    return route.continue();
  });
  stage='comment failure retry';mode='before';await openComments();await draft().fill('SYNTHETIC RETAINED');let before=writeCount;await send().click();await poll(()=>writeCount,v=>v===before+1);await page.waitForTimeout(1600);
  check((await comments()).length===0&&await draft().inputValue()==='SYNTHETIC RETAINED','Rejected comment draft lost');
  mode='pass';await send().click();await poll(comments,rows=>rows.length===1);await poll(()=>draft().inputValue(),v=>v==='');
  pass('browser_rejected_comment_keeps_draft_and_normal_retry_saves');
  await close();await req('/rest/v1/forum_comments?post_id=eq.'+post.id,{method:'DELETE'});
  stage='comment duplicate click';await openComments();await draft().fill('SYNTHETIC DOUBLE');before=writeCount;
  await send().evaluate(button=>{button.click();button.click();});await poll(()=>writeCount,v=>v>=before+1);await page.waitForTimeout(2000);
  const doubled=await comments();
  check(doubled.length>=1,'Double-send fixture did not persist');
  observe(doubled.length>1,'synchronous_double_send_creates_duplicate_comments','comment_double_send_has_one_persisted_row');
  await close();await req('/rest/v1/forum_comments?post_id=eq.'+post.id,{method:'DELETE'});
  stage='comment lost response';mode='lost';await openComments();await draft().fill('SYNTHETIC LOST');await send().click();await poll(comments,rows=>rows.length===1);await page.waitForTimeout(1400);
  check(await draft().inputValue()==='SYNTHETIC LOST','Lost response draft not retained');mode='pass';const requestsBeforeRetry=writeCount;await send().click();await poll(()=>draft().inputValue(),v=>v==='');
  const afterRetry=await comments();observe(afterRetry.length>1,'committed_comment_lost_response_then_retry_creates_second_comment','lost_comment_response_retry_has_one_row');
  check(afterRetry.length>=1,'Lost-response fixture missing after retry');
  if(repaired)check(writeCount===requestsBeforeRetry,'Retry must confirm existing row without another INSERT');
  await poll(()=>draft().inputValue(),v=>v==='');await close();await req('/rest/v1/forum_comments?post_id=eq.'+post.id,{method:'DELETE'});
  stage='comment pending draft';await openComments();await draft().fill('SYNTHETIC SENT');await send().click();
  const canEdit=await draft().isEnabled();if(canEdit)await draft().fill('SYNTHETIC NEXT UNSENT DRAFT');
  await poll(comments,rows=>rows.length===1);await page.waitForTimeout(800);
  observe(canEdit&&await draft().inputValue()==='','comment_response_clears_new_text_typed_while_previous_send_pending','comment_input_locked_while_previous_send_pending');
  await draft().fill('SYNTHETIC FOR FIRST POST');await close();await page.locator('#post-'+second.id).getByRole('button',{name:'阅读全文',exact:true}).click();
  observe(await draft().inputValue()==='SYNTHETIC FOR FIRST POST','unsent_comment_draft_carries_into_different_post_dialog','comment_drafts_isolated_by_post');
  await draft().fill('');await close();
  if(repaired){await openComments();check(await draft().inputValue()==='SYNTHETIC FOR FIRST POST','Original post draft not preserved');await draft().fill('');await close();pass('return_to_original_post_preserves_its_own_draft');}
  stage='comment read failure';mode='read-fail';await page.reload({waitUntil:'networkidle'});await openComments();await page.waitForTimeout(12000);
  observe(await dialog().getByText('还没有回应。',{exact:true}).count()>0,'comment_load_error_displayed_as_no_comments_instead_of_retry_error','comment_read_failure_not_empty_state');
  mode='pass';
  if(repaired){await dialog().getByRole('button',{name:'重新加载回应',exact:true}).click();await dialog().getByText('SYNTHETIC SENT',{exact:true}).waitFor();pass('comment_load_error_retry_restores_actual_list');}
  await close();
  if(repaired){
    stage='comment owner management';
    await req('/rest/v1/forum_comments',{method:'POST',token:b.token,body:{post_id:post.id,user_id:b.id,body:'SYNTHETIC OTHER AUTHOR'}});
    await openComments();await dialog().getByRole('button',{name:'重新加载回应',exact:true}).click();
    const other=dialog().locator('article').filter({hasText:'SYNTHETIC OTHER AUTHOR'});await other.waitFor();check(await other.getByRole('button',{name:/编辑回应|删除回应/}).count()===0,'Foreign comment management exposed');
    const mine=()=>dialog().locator('article').filter({hasText:'SYNTHETIC SENT'});
    await mine().getByRole('button',{name:'编辑回应',exact:true}).click();const editor=()=>dialog().getByLabel('编辑回应内容',{exact:true});
    await editor().fill('SYNTHETIC EDITED');mode='edit-fail';await dialog().getByRole('button',{name:'保存回应修改',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'操作未确认'}).waitFor();
    check(await editor().inputValue()==='SYNTHETIC EDITED'&&(await comments()).some(row=>row.body==='SYNTHETIC SENT'),'Failed edit draft/row lost');
    mode='pass';await dialog().getByRole('button',{name:'保存回应修改',exact:true}).click();await dialog().getByText('SYNTHETIC EDITED',{exact:true}).waitFor();
    await close();await page.reload({waitUntil:'networkidle'});await openComments();const edited=()=>dialog().locator('article').filter({hasText:'SYNTHETIC EDITED'});await edited().waitFor();
    await edited().getByRole('button',{name:'删除回应',exact:true}).click();mode='delete-fail';await edited().getByRole('button',{name:'确认删除回应',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'操作未确认'}).waitFor();check((await comments()).some(row=>row.body==='SYNTHETIC EDITED'),'Rejected deletion removed comment');
    mode='pass';await edited().getByRole('button',{name:'确认删除回应',exact:true}).click();await edited().waitFor({state:'hidden'});check((await comments()).length===1&&(await comments())[0].user_id===b.id,'Owner delete affected another account');
    await close();await req('/rest/v1/forum_comments?post_id=eq.'+post.id,{method:'DELETE'});
    await req('/rest/v1/forum_comments',{method:'POST',token:a.token,body:{post_id:post.id,user_id:a.id,body:'SYNTHETIC GUARD'}});
    pass('own_comment_edit_delete_failure_retry_reload_and_foreign_controls_denial');
  }
  stage='post edit delete UI';const ownCard=()=>page.locator('#post-'+own.id);
  await ownCard().getByRole('button',{name:'更多操作',exact:true}).click();await ownCard().getByRole('menuitem',{name:'编辑帖子',exact:true}).click();
  await dialog().locator('textarea').fill('SYNTHETIC OWN EDITED');await dialog().getByRole('button',{name:'保存修改',exact:true}).click();await dialog().waitFor({state:'hidden'});
  const ownerRow=()=>req('/rest/v1/forum_posts?id=eq.'+own.id+'&select=body');await poll(ownerRow,rows=>rows[0]?.body==='SYNTHETIC OWN EDITED');
  await ownCard().getByRole('button',{name:'更多操作',exact:true}).click();await ownCard().getByRole('menuitem',{name:'删除帖子',exact:true}).click();await ownCard().getByRole('button',{name:'确认删除',exact:true}).click();await poll(ownerRow,rows=>rows.length===0);await ownCard().waitFor({state:'hidden'});
  pass('browser_own_post_edit_and_confirmed_delete_persist');
  stage='block UI';await menu('屏蔽该用户');await poll(()=>privateRows('forum_blocks','blocker_id=eq.'+a.id+'&blocked_id=eq.'+b.id),rows=>rows.length===1);await card().waitFor({state:'hidden'});await page.reload({waitUntil:'networkidle'});
  check(await card().count()===0&&(await privateRows('forum_blocks','blocker_id=eq.'+a.id,b.token)).length===0,'Block visibility/privacy');
  pass('browser_block_hides_author_after_reload_and_block_list_is_private');
  const unblockControl=await page.getByRole('button',{name:/取消屏蔽|解除屏蔽|Unblock/i}).count();
  if(repaired){
    stage='open blocked author management';
    await page.getByRole('button',{name:'管理已屏蔽用户',exact:true}).click();
    const panel=page.getByRole('region',{name:'屏蔽管理',exact:true});await panel.getByRole('button',{name:'解除屏蔽',exact:true}).waitFor();
    stage='blocked author public name';
    await panel.locator('li').filter({hasText:marker+'-1'}).getByRole('button',{name:'解除屏蔽',exact:true}).waitFor();
    let failUnblock=true;
    await context.route(api+'/rest/v1/forum_blocks*',route=>route.request().method()==='DELETE'&&failUnblock?route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic unblock failure"}'}):route.continue());
    stage='rejected unblock';await panel.getByRole('button',{name:'解除屏蔽',exact:true}).click();await panel.getByRole('alert').waitFor();check((await privateRows('forum_blocks','blocker_id=eq.'+a.id+'&blocked_id=eq.'+b.id)).length===1,'Failed unblock removed row');
    stage='unblock retry and reload';
    failUnblock=false;await panel.getByRole('button',{name:'解除屏蔽',exact:true}).click();await poll(()=>privateRows('forum_blocks','blocker_id=eq.'+a.id+'&blocked_id=eq.'+b.id),rows=>rows.length===0);await card().waitFor();
    await page.reload({waitUntil:'networkidle'});await card().waitFor();pass('unblock_failure_retry_restores_author_and_persists_after_reload');
  }else if(!unblockControl)finding('forum_has_no_visible_unblock_management_control');
  stage='outsider write guards';
  const denied=await req('/rest/v1/forum_posts?id=eq.'+post.id,{method:'PATCH',token:a.token,body:{body:'OUTSIDER'}});check(denied.length===0,'Outsider edited post');
  check((await req('/rest/v1/forum_posts?id=eq.'+post.id,{method:'DELETE',token:a.token})).length===0,'Outsider deleted post');
  check((await req('/rest/v1/forum_comments?post_id=eq.'+post.id,{method:'PATCH',token:b.token,body:{body:'OUTSIDER'}})).length===0,'Outsider edited comments');
  pass('other_account_cannot_edit_delete_post_or_edit_authored_comment_api');
  check(!productionTraffic,'Production traffic prohibited');
}catch(error){failed=true;console.error('INCOMPLETE: forum interaction stage='+stage+' type='+error.constructor.name+' reason='+error.message.slice(0,120));}
finally{
  await browser?.close();
  for(const user of users)try{
    await req('/auth/v1/admin/users/'+user.id,{method:'DELETE'});
    check((await request('/auth/v1/admin/users/'+user.id)).status===404,'Synthetic account remains');
    for(const [table,column] of [['forum_posts','user_id'],['forum_comments','user_id'],['forum_likes','user_id'],['forum_bookmarks','user_id'],['forum_reports','reporter_id'],['forum_blocks','blocker_id'],['forum_follows','follower_id']])check((await req('/rest/v1/'+table+'?'+column+'=eq.'+user.id+'&select='+column)).length===0,'Synthetic rows remain');
    pass('disposable_forum_account_and_interaction_rows_cleanup_verified');
  }catch(error){failed=true;console.error('INCOMPLETE: forum fixture cleanup account='+user.id+' type='+error.constructor.name);}
}
console.log('AUDIT: complete='+!failed+' findings='+findings.length);if(failed)process.exitCode=1;
