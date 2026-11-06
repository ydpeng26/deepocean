import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: 1, target: 9 },
  }).outputText, { module, exports: module.exports, require: name => {
    if (name === '@/lib/dive-record') return record;
    throw Error('Unexpected dependency: ' + name);
  } });
  return module.exports;
}
const record = load('src/lib/dive-record.ts');
const { diveRecordFields, divePeriodLabel, diveNumberLabel, diveCount } = record;
const { diveStats } = load('src/lib/dive-stats.ts');
const { diveNumbers } = load('src/lib/dive-order.ts');
const json = value => JSON.parse(JSON.stringify(value));
const fields = { record_mode: 'summary', dive_count: '12', date_precision: 'month', dive_date: '2024-03-18', site_names: 'Monad Shoal\nGato Island\n monad  shoal ' };
const summary = { ...diveRecordFields(fields, 60), id: 'summary', country: 'Philippines', region: 'Malapascua', site_name: 'Malapascua', max_depth: 30, duration_min: 60, created_at: '2026-11-06' };
assert.equal(summary.dive_date, '2024-03-01');
assert.equal(summary.period_end, '2024-03-31');
assert.equal(divePeriodLabel(summary, true), '2024-03');
assert.deepEqual(json(summary.site_names), ['Monad Shoal', 'Gato Island']);
let stats = diveStats([summary], 2024);
assert.equal(stats.total, 12); assert.equal(stats.annualCount, 12); assert.equal(stats.siteCount, 2);
assert.equal(stats.longestMinutes, 60); assert.equal(stats.totalMinutes, 0); assert.equal(stats.missingTotalCount, 12);
assert.equal(diveNumberLabel(1, summary), '001–012');
const precise = { ...summary, ...diveRecordFields({ dive_date: '2024-04-01' }), id: 'precise', site_name: 'Monad Shoal', duration_min: 45 };
assert.equal(diveCount(precise), 1);
assert.equal(diveNumbers([precise, summary]).get('precise'), 13);
stats = diveStats([precise, summary], 2024);
assert.equal(stats.total, 13); assert.equal(stats.siteCount, 2); assert.equal(stats.totalMinutes, 45);
assert.equal(diveNumbers([precise]).get('precise'), 1, 'Deleting summary releases its number range');
const backdated = { ...precise, id: 'old', dive_date: '2023-12-31' };
assert.equal(diveNumbers([summary, precise, backdated]).get('precise'), 14);
assert.equal(diveStats([{...summary, dive_count: 100}],2024).hundredUnlocked, true);
stats = diveStats([{...summary, total_duration_min: 600}, precise],2024);
assert.equal(stats.totalMinutes,645); assert.equal(stats.longestMinutes,60);
const placeOnly = {...summary,site_names:[]};
assert.equal(diveStats([placeOnly],2024).siteCount,0,'A region title must never count as a known dive site');
assert.equal(diveRecordFields({...fields,dive_date:'2024-02-20'}).period_end,'2024-02-29');
assert.equal(diveRecordFields({...fields,dive_date:'2023-02-20'}).period_end,'2023-02-28');
const year = diveRecordFields({...fields,date_precision:'year'});
assert.equal(year.dive_date,'2024-01-01'); assert.equal(year.period_end,'2024-12-31'); assert.equal(divePeriodLabel(year,true),'2024');
assert.equal(diveRecordFields({...fields,date_precision:'day'}).period_end,'2024-03-18');
const range = diveRecordFields({...fields,date_precision:'range',period_end:'2024-04-02'});
assert.equal(divePeriodLabel(range,true),'2024-03-18 – 2024-04-02');
for(const patch of [{dive_count:''},{dive_count:'0'},{dive_count:'-1'},{dive_count:'1.5'},{dive_count:'1e2'},{dive_count:'100001'},
  {dive_date:'2024-02-30'},{dive_date:'2024-13-01'},{dive_date:'2024-3-1'},{dive_date:'1899-01-01'},
  {date_precision:'range',period_end:''},{date_precision:'range',period_end:'2024-03-17'},
  {date_precision:'range',period_end:'2025-01-01'}, {total_duration_min:'59'}, {total_duration_min:'1.5'},
  {site_names:'x'.repeat(121)},{site_names:Array.from({length:201},(_,i)=>'Site'+i).join('\n')}])
  assert.throws(()=>diveRecordFields({...fields,...patch},60),JSON.stringify(patch));
const legacy={country:'Philippines',region:'Malapascua',site_name:'Monad Shoal',duration_min:45,max_depth:20,dive_date:'2024-03-12'};
assert.equal(diveStats([legacy],2024).total,1); assert.equal(diveStats([legacy],2024).totalMinutes,45);
const { cardLines, defaultCardOptions } = load('src/lib/share-card.ts');
const card = cardLines(summary, defaultCardOptions, '', '', true);
assert.equal(card.date,'2024-03'); assert.equal(card.stats[1].label,'LONGEST DIVE'); assert.equal(card.stats[2].value,'12');
assert.equal(cardLines(summary,{...defaultCardOptions,date:false},'','',true).date,'');
console.log('PASS: twelve dives / one entry, number ranges, edits/deletion, site deduplication, annual counts, milestones, known totals, legacy rows, date precision, validation and share-card labels');
