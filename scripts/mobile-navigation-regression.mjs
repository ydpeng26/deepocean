import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const jsx=(type,props)=>({type,props});
function load(path,require,globals={}) {
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require,...globals});
  return module.exports;
}
let pathname='/dives';
const nav=load('src/components/MainNavigation.tsx',name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='@tanstack/react-router'?{Link:'Link',useRouterState:({select})=>select({location:{pathname}})}:{useLanguage:()=>({language:'zh-CN'})}).MainNavigation;
for(const [path,current] of [['/dives','/dives'],['/dives/','/dives'],['/dives/logs','/dives/logs'],['/dives/new','/dives/logs'],['/dives/abc','/dives/logs'],['/forum','/forum'],['/marine','/marine'],['/feedback','/feedback']]) {
  pathname=path;const links=nav().props.children;
  assert.equal(links.filter(n=>n.props['aria-current']==='page').length,1);
  assert.equal(links.find(n=>n.props['aria-current']==='page').props.to,current);
  assert.ok(links.every(n=>n.props.activeOptions.exact));
}
let visible=false,installed=false,cleanup,scrollHandler,removed=false,lastScroll,reduced=false;
const browser={scrollY:0,addEventListener:(name,handler)=>{scrollHandler=handler;},removeEventListener:()=>{removed=true;},scrollTo:options=>{lastScroll=options;},matchMedia:()=>({matches:reduced})};
const back=load('src/components/BackToTop.tsx',name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react'?{useState:()=>[visible,v=>{visible=v;}],useEffect:fn=>{if(!installed){installed=true;cleanup=fn();}}}:name==='lucide-react'?{ArrowUp:'ArrowUp'}:{useLanguage:()=>({language:'zh-CN'})},{window:browser}).BackToTop;
assert.equal(back(),null);browser.scrollY=500;scrollHandler();let button=back();assert.equal(button.props['aria-label'],'回到顶部');button.props.onClick();assert.equal(lastScroll.top,0);assert.equal(lastScroll.behavior,'smooth');reduced=true;button.props.onClick();assert.equal(lastScroll.behavior,'instant');browser.scrollY=0;scrollHandler();assert.equal(back(),null);cleanup();assert.ok(removed);
console.log('PASS: one current navigation item on passport/logs/new/detail/forum/marine/contact; back-to-top visibility, action, reduced-motion and cleanup');
