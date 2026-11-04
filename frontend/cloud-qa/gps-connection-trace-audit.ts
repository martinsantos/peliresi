import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase} from './safety.ts';

await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
const reports=['c18-burst-probe.json','c18-connection-probe.json'].map(name=>JSON.parse(readFileSync(path.join(out,name),'utf8')));
const expected=new Map<string,number>();
for(const report of reports){
  assert.equal(report.synthetic,true);assert.equal(report.production,false);assert.equal(report.setupFailure,null);
  for(const result of report.results.filter((item:{target:string})=>item.target==='proxy')){
    assert.equal(result.error,undefined);
    expected.set(result.probe,(expected.get(result.probe)??0)+1);
  }
  expected.set('c18-setup',(expected.get('c18-setup')??0)+1);
  expected.set('c18-abort',(expected.get('c18-abort')??0)+1);
}
const entries=readFileSync(path.join(out,'server.ts.log'),'utf8').split('\n').flatMap(line=>{
  try{const value=JSON.parse(line);return value.qaConnectionTrace?[value]:[];}catch{return [];}
});
const permitted=new Set(['qaConnectionTrace','probe','event','at','clientSocket','upstreamSocket','reused','status','finished','code']);
const actual=new Map<string,number>(),counts:Record<string,number>={};let reused=0,unfinished=0;
for(const entry of entries){
  assert.ok(Object.keys(entry).every(key=>permitted.has(key)),'QA traces must not contain headers or request bodies');
  assert.match(entry.probe,/^c18-[a-z0-9-]{1,35}$/);
  counts[entry.event]=(counts[entry.event]??0)+1;
  if(entry.event==='client-request')actual.set(entry.probe,(actual.get(entry.probe)??0)+1);
  if(entry.event==='upstream-socket'&&entry.reused===true)reused++;
  if(entry.event==='client-response-closed'&&!entry.finished)unfinished++;
}
assert.deepEqual([...actual.entries()].sort(),[...expected.entries()].sort());
assert.equal(counts['upstream-response'],counts['client-request']);
assert.equal(counts['client-response-closed'],counts['client-request']);
assert.equal(unfinished,0);assert.equal(counts['upstream-error']??0,0);
const report={synthetic:true,production:false,requests:counts['client-request'],reusedSockets:reused,unfinishedResponses:unfinished,
  upstreamErrors:counts['upstream-error']??0,traceContainsOnlyAllowedFields:true};
writeFileSync(path.join(out,'c18-trace-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
