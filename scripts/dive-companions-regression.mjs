import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(path, require=()=>({})) {
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:1,jsx:4,target:9}}).outputText,{module,exports:module.exports,require});
 return module.exports;
}
const api=load('src/lib/dive-companions.ts');
assert.equal(api.readCompanions({buddy_name:'Old guide',buddy_role:'instructor'})[0].name,'Old guide');
assert.equal(api.readCompanions({companions:[],buddy_name:'Old guide'}).length,0);
assert.equal(api.readCompanions({buddy_name:'Someone'} )[0].role,null);
assert.equal(api.normalizeCompanions([{name:'  Name  ',role:'guide'},{name:'  ',role:'buddy'}])[0].name,'Name');
assert.throws(()=>api.normalizeCompanions([{name:'X'.repeat(81),role:'buddy'}]));
assert.throws(()=>api.normalizeCompanions([{name:'Name',role:'invalid'}]));
const jsx=(type,props)=>({type,props});
const Editor=load('src/components/DiveCompanionsEditor.tsx',name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:{}).DiveCompanionsEditor;
let people=[];
function nodes(tree,all=[]){if(Array.isArray(tree))tree.forEach(n=>nodes(n,all));else if(tree&&typeof tree==='object'){all.push(tree);nodes(tree.props?.children,all);}return all;}
const render=()=>nodes(Editor({value:people,onChange:value=>{people=value;}}));
for(let i=0;i<60;i++)render().find(n=>n.type==='button'&&n.props.children==='+ 添加人员').props.onClick();
assert.equal(people.length,60);
render().find(n=>n.type==='input'&&n.props['aria-label']==='姓名 1').props.onChange({target:{value:'Guide One'}});
render().find(n=>n.type==='select'&&n.props['aria-label']==='身份 1').props.onChange({target:{value:'guide'}});
render().find(n=>n.type==='input'&&n.props['aria-label']==='姓名 2').props.onChange({target:{value:'Buddy Two'}});
assert.equal(api.companionFields(people).companions.length,2);
assert.equal(api.companionFields(people).buddy_role,'instructor');
assert.match(api.companionsText({companions:api.normalizeCompanions(people)}),/向导：Guide One；潜伴：Buddy Two/);
render().find(n=>n.type==='button'&&n.props['aria-label']==='移除人员 1').props.onClick();
assert.equal(people[0].name,'Buddy Two');
assert.equal(api.companionFields(people).buddy_role,'buddy');
assert.equal(api.companionFields([]).buddy_name,null);
assert.equal(api.companionFields([]).buddy_role,null);
console.log('PASS: actual editor adds 60 people without a count cap, changes roles/names, removes exactly one; legacy fallback, empty clearing and summaries verified');
