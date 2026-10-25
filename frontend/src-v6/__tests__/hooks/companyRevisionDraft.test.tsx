import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { companyDraftKey, useCompanyRevisionDraft } from '../../components/CompanyRevisionDraft';

const initial={name:'Empresa QA',address:'Calle QA',sites:[] as string[],all:true};
const key=companyDraftKey('person/role','company','legal');
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
afterEach(cleanup);

test('batched field changes preserve all values before React rerenders',()=>{
 const draft=renderHook(()=>useCompanyRevisionDraft(initial,0,key));
 act(()=>{draft.result.current.change({name:'Editado'});draft.result.current.change({all:false});draft.result.current.change({sites:['site']});});
 expect(draft.result.current.value).toEqual({...initial,name:'Editado',all:false,sites:['site']});
 draft.unmount();const reopened=renderHook(()=>useCompanyRevisionDraft(initial,0,key));
 expect(reopened.result.current.value).toEqual({...initial,name:'Editado',all:false,sites:['site']});
});
test('a recovered server revision conflict merges only edited fields after explicit reconciliation',()=>{
 const first=renderHook(()=>useCompanyRevisionDraft(initial,0,key));
 act(()=>first.result.current.change({address:'Mi calle'}));first.unmount();
 const newer={...initial,name:'Nombre actualizado'};
 const second=renderHook(()=>useCompanyRevisionDraft(newer,1,key));
 expect(second.result.current.serverConflict).toBe(true);
 expect(second.result.current.value.address).toBe('Mi calle');
 act(()=>second.result.current.keep());
 expect(second.result.current.conflict).toBe(false);
 expect(second.result.current.revision).toBe(1);
 expect(second.result.current.value).toEqual({...newer,address:'Mi calle'});
});
test('two tabs retain competing values and require an explicit choice',()=>{
 const first=renderHook(()=>useCompanyRevisionDraft(initial,0,key));
 const second=renderHook(()=>useCompanyRevisionDraft(initial,0,key));
 act(()=>first.result.current.change({address:'Primera'}));
 act(()=>second.result.current.change({address:'Segunda'}));
 expect(second.result.current.conflict).toBe(true);
 expect(second.result.current.recovery.conflictSaved).toBe(true);
 expect(JSON.parse(localStorage.getItem(key)!).value.value.address).toBe('Primera');
 first.unmount();second.unmount();
 const reopened=renderHook(()=>useCompanyRevisionDraft(initial,0,key));
 expect(reopened.result.current.value.address).toBe('Segunda');
 expect(reopened.result.current.conflict).toBe(true);
 act(()=>reopened.result.current.recovery.overwrite());
 expect(reopened.result.current.conflict).toBe(false);
 expect(JSON.parse(localStorage.getItem(key)!).value.value.address).toBe('Segunda');
});
test.each(['expired','invalid shape','extra secret field','invalid changed field'])('rejects a %s recovery record',kind=>{
 const value={value:initial,revision:0,changedKeys:['address']};
 const record={version:1,revision:'local',savedAt:Date.now(),value};
 if(kind==='expired')record.savedAt=Date.now()-8*86400000;
 if(kind==='invalid shape')record.value.value={...initial,all:'yes'} as any;
 if(kind==='extra secret field')record.value.value={...initial,token:'must-not-persist'} as any;
 if(kind==='invalid changed field')record.value.changedKeys=['unexpected'];
 localStorage.setItem(key,JSON.stringify(record));
 const draft=renderHook(()=>useCompanyRevisionDraft(initial,0,key));
 expect(draft.result.current.value).toEqual(initial);
 expect(draft.result.current.dirty).toBe(false);
 expect(draft.result.current.recovery.restored).toBe(false);
});
