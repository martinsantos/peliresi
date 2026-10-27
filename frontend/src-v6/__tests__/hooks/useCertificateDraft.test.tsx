import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useCertificateDraft } from '../../hooks/useCertificateDraft';
import { certificateDraftKey, readCertificateDraft, writeCertificateDraft, draftAfterCertificate, type CertificateDraft } from '../../services/certificateDraft';
import type { CertificateCommand } from '../../services/certificateCommand';
const m = vi.hoisted(() => ({ rows: new Map<string, any>(), fail: false, unreadable: false, owned: true, session: true, context: 'same', gate: null as Promise<void> | null }));
vi.mock('../../utils/supportSession', () => ({ supportSessionMatches: () => m.session, supportRequestContext: () => m.context }));
vi.mock('../../hooks/useInspectionDraftOwnership', () => ({ useInspectionDraftOwnership: (_: string, enabled: boolean) => ({ status: enabled && m.owned ? 'owned' : 'blocked', canWrite: () => enabled && m.owned, retry: vi.fn() }) }));
vi.mock('../../services/supportCommandStore', () => ({
 readSupportCommandRecord: async (key: string) => { if(m.unreadable)throw Error('Read failed');return m.rows.get(key)||null; },
 updateSupportCommandRecord: async (key: string, change: any) => { if(m.gate)await m.gate;if(m.fail)throw Error('Quota');const next=change(m.rows.get(key)||null);m.rows.set(key,next);return next; },
}));
const scope={userId:'one',context:'operator-company-site',manifestId:'manifest-one'};
const draft:CertificateDraft={kind:'PARCIAL',amounts:{r:'1.25',s:''},method:'Treatment',note:'Unsent'};
async function ready(){const hook=renderHook(()=>useCertificateDraft(scope,true));await waitFor(()=>expect(hook.result.current.ready).toBe(true));return hook;}
beforeEach(()=>{m.rows.clear();m.fail=false;m.unreadable=false;m.owned=true;m.session=true;m.context='same';m.gate=null;});
it.each(['PARCIAL','FINAL'] as const)('restores %s fields without signature',async kind=>{
 const h=await ready();await act(()=>h.result.current.replace({...draft,kind,firma:'not reusable'} as CertificateDraft));h.unmount();
 const reopened=await ready();expect(reopened.result.current.draft).toEqual({...draft,kind});expect(reopened.result.current.restored).toBe(true);
 expect(JSON.stringify([...m.rows.values()])).not.toContain('not reusable');
});
it.each(['userId','context','manifestId'] as const)('isolates %s',async field=>{
 await writeCertificateDraft(scope,draft,()=>true);expect(await readCertificateDraft({...scope,[field]:'other'})).toBeNull();
});
it('queues rapid edits and flushes latest keystroke',async()=>{
 const h=await ready();await act(()=>h.result.current.replace(draft));let done!:()=>void;m.gate=new Promise(resolve=>{done=resolve;});
 act(()=>{h.result.current.update({note:'A'});h.result.current.update({note:'AB'});h.result.current.update({note:'ABC',method:'New'});});
 expect(h.result.current.saving).toBe(true);await act(async()=>{done();expect(await h.result.current.flush()).toBe(true);});
 expect(await readCertificateDraft(scope)).toMatchObject({note:'ABC',method:'New'});
});
it('keeps unsaved edits and warns on close; local retry saves latest without reload loss',async()=>{
 const h=await ready();await act(()=>h.result.current.replace(draft));m.fail=true;act(()=>h.result.current.update({note:'Latest'}));
 await act(async()=>{expect(await h.result.current.flush()).toBe(false);await h.result.current.reload();});
 expect(h.result.current.draft?.note).toBe('Latest');expect(h.result.current.error).toContain('no cierres');
 const closing=new Event('beforeunload',{cancelable:true});window.dispatchEvent(closing);expect(closing.defaultPrevented).toBe(true);
 m.fail=false;await act(async()=>{expect(await h.result.current.flush()).toBe(true);});expect((await readCertificateDraft(scope))?.note).toBe('Latest');
 const saved=new Event('beforeunload',{cancelable:true});window.dispatchEvent(saved);expect(saved.defaultPrevented).toBe(false);
});
it('blocks replacement after failed read then recovers original',async()=>{
 await writeCertificateDraft(scope,draft,()=>true);m.unreadable=true;const h=renderHook(()=>useCertificateDraft(scope,true));
 await waitFor(()=>expect(h.result.current.error).toContain('leer'));
 await act(async()=>{expect(await h.result.current.replace({...draft,note:'Overwrite'})).toBe(false);});
 m.unreadable=false;await act(()=>h.result.current.reload());expect(h.result.current.draft?.note).toBe(draft.note);
});
it('disabled counterpart or temporary view never reads or writes',async()=>{
 await writeCertificateDraft(scope,draft,()=>true);const h=renderHook(()=>useCertificateDraft(scope,false));
 await act(async()=>{await h.result.current.reload();expect(await h.result.current.replace(null)).toBe(false);});
 expect(h.result.current.draft).toBeNull();expect(await readCertificateDraft(scope)).toEqual(draft);
});
it.each(['owned','session','context'] as const)('rechecks %s inside queued write',async field=>{
 const h=await ready();await act(()=>h.result.current.replace(draft));let done!:()=>void;m.gate=new Promise(resolve=>{done=resolve;});
 act(()=>h.result.current.update({note:'Late'}));if(field==='context')m.context='changed';else m[field]=false;
 await act(async()=>{done();await h.result.current.flush();});expect((await readCertificateDraft(scope))?.note).toBe(draft.note);
});
it('preserves corrupted record and blocks editing',async()=>{
 const id=certificateDraftKey(scope),broken={id,scope,savedAt:Date.now(),draft:{...draft,amounts:[]}};m.rows.set(id,broken);
 const h=renderHook(()=>useCertificateDraft(scope,true));await waitFor(()=>expect(h.result.current.error).toContain('leer'));
 await act(async()=>{expect(await h.result.current.replace(null)).toBe(false);});expect(m.rows.get(id)).toBe(broken);
});
it('confirmed command clears preparation durably',async()=>{
 const h=await ready();await act(()=>h.result.current.replace(draft));await act(()=>h.result.current.finish({status:'confirmed'} as CertificateCommand));h.unmount();
 const reopened=await ready();expect(reopened.result.current.draft).toBeNull();expect(reopened.result.current.restored).toBe(false);
});
it('withdrawn command restores fields without signature',async()=>{
 const h=await ready();await act(()=>h.result.current.finish({status:'withdrawn',input:{tipo:'FINAL',metodo:'New',nota:'Correct',firma:'old',cantidades:[{residuoId:'r',cantidad:3}]}} as CertificateCommand));
 expect(h.result.current.draft).toEqual({kind:'FINAL',method:'New',note:'Correct',amounts:{r:'3'}});
});
it('restores the explicit no-treatment decision when a signed request is withdrawn',()=>{
 const restored=draftAfterCertificate({status:'withdrawn',input:{tipo:'FINAL',metodo:'M',nota:'',firma:'old',
  cantidades:[{residuoId:'r',cantidad:3}],exclusionesHallazgos:['hallazgo:Y12:kg']}} as CertificateCommand);
 expect(restored?.amounts).toEqual({r:'3','hallazgo:Y12:kg':'NO_TRATADO'});
});
it('failed cleanup does not acknowledge receipt',async()=>{
 const h=await ready();m.fail=true;await act(async()=>{await expect(h.result.current.finish({status:'confirmed'} as CertificateCommand)).rejects.toThrow('borrador');});
});
it('pending command cannot reconcile draft',()=>{expect(()=>draftAfterCertificate({status:'pending'} as CertificateCommand)).toThrow('resultado');});
it('explicit discard survives reopening',async()=>{
 const h=await ready();await act(()=>h.result.current.replace(draft));await act(()=>h.result.current.replace(null));h.unmount();expect((await ready()).result.current.draft).toBeNull();
});
