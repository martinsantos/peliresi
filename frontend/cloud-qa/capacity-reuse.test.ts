import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCapacityReuse } from './capacity-reuse.ts';
function fixture() {
  const frozen={commit:'d12d57fa34ee048aae72a743dd25208406a1dd3c',backendFiles:Array.from({length:120},(_,i)=>({file:'dist/'+i,sha256:'same'}))};
  return {frozen,current:structuredClone(frozen),prior:{commit:frozen.commit,accounts:50,distinctAccounts:50,authenticatedAccounts:50,
    externalProvidersDisabled:true,productionDataWritten:false,checks:[...Array.from({length:6},()=>({status:'PASS'})),{status:'FAIL',error:'TypeError: Do not know how to serialize a BigInt'}],
    startedAt:'2026-10-08T20:00:00Z',endedAt:'2026-10-08T20:30:00Z',
    phases:[{sessions:10,seconds:300},{sessions:25,seconds:300},{sessions:50,seconds:1200}],
    samples:Array.from({length:60},()=>({database:{connections:41},workers:{workers:[{node:'v20.19.6',rss:150*1048576},{node:'v20.19.6',rss:150*1048576}]}})),
    metrics:['read','write','pdf'].map(group=>({group,count:50,p95Ms:200,statuses:{200:50}}))}};
}
test('only actual passed capacity with this exact final evidence-serialization failure can be reused',()=>{
  const {prior,frozen,current}=fixture(); assert.doesNotThrow(()=>assertCapacityReuse(prior,frozen,current));
});
test('failed load, short duration, unexpected status or changed backend cannot hide behind reuse',()=>{
  for(const kind of ['failed','short','status','backend','identity'] as const){
    const {prior,frozen,current}=fixture();
    if(kind==='failed')prior.checks[5].status='FAIL';
    if(kind==='short')prior.endedAt=prior.startedAt;
    if(kind==='status')prior.metrics[0].statuses={503:1};
    if(kind==='backend')current.backendFiles[0].sha256='different';
    if(kind==='identity')prior.distinctAccounts=1;
    assert.throws(()=>assertCapacityReuse(prior,frozen,current));
  }
});
