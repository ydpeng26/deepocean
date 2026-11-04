import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const module = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/dive-stats.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});
const {diveStats}=module.exports;
const row={country:'Indonesia',region:'Bali',site_name:'Site A',dive_date:'2026-01-01',max_depth:22.5,duration_min:48};
let s=diveStats([],2026);assert.equal(s.maxDepth,null);assert.equal(s.longestMinutes,null);assert.equal(s.annualCount,0);assert.equal(s.hundredUnlocked,false);
s=diveStats([row,{...row,site_name:' SITE   A ',max_depth:31,duration_min:42},{...row,region:'Other',dive_date:'2025-12-31',max_depth:null,duration_min:70},{...row,site_name:' ',max_depth:-1,duration_min:NaN}],2026);
assert.equal(s.maxDepth,31);assert.equal(s.longestMinutes,70);assert.equal(s.siteCount,2);assert.equal(s.annualCount,3);assert.equal(s.years[0][0],'2026');assert.equal(s.years[1][1],1);
for(const count of [99,100,101,1017]){s=diveStats(Array.from({length:count},()=>row),2026);assert.equal(s.hundredUnlocked,count>=100);assert.equal(s.progress,Math.min(count,100));assert.equal(s.annualCount,count);assert.equal(s.siteCount,1);}
assert.equal(diveStats([row],2027).annualCount,0);
assert.equal(diveStats([{...row,max_depth:0,duration_min:0}],2026).maxDepth,0);
console.log('PASS: max values, missing/invalid values, site deduplication, year boundaries, 99/100/101/1017 milestones and empty history');
