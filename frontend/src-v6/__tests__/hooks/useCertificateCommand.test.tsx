import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {useCertificateCommand} from '../../hooks/useCertificateCommand';
import {claimCertificateCommand,loadCertificateCommand,settleCertificateCommand,releaseCertificateCommand,type CertificateInput} from '../../services/certificateCommand';
const mocks=vi.hoisted(()=>({rows:new Map<string,any>(),fail:false,gate:null as Promise<void>|null,post:vi.fn(),session:true,context:'operator'}));
vi.mock('../../services/api',()=>({api:{post:mocks.post}}));
vi.mock('../../utils/supportSession',()=>({supportSessionMatches:()=>mocks.session,supportRequestContext:()=>mocks.context}));
vi.mock('../../services/supportCommandStore',()=>({
 readSupportCommandRecord:async(k:string)=>mocks.rows.get(k)||null,
 updateSupportCommandRecord:async(k:string,change:any)=>{if(mocks.gate)await mocks.gate;if(mocks.fail)throw Error('Quota');const next=change(mocks.rows.get(k)||null);if(next)mocks.rows.set(k,next);else mocks.rows.delete(k);return next;}
}));
const scope={userId:'user',context:'company/operator/site',manifestId:'manifest'};
const input:CertificateInput={tipo:'PARCIAL',firma:'original-signature',metodo:'Método',nota:'Nota',cantidades:[{residuoId:'waste',cantidad:3}]};
const response=(id:string,status='confirmed')=>({data:{data:{id,status,numero:'M-P01',pdfSha256:'digest'}}});
async function ready(){const h=renderHook(()=>useCertificateCommand(scope,true));await waitFor(()=>expect(h.result.current.ready).toBe(true));return h;}
beforeEach(()=>{mocks.rows.clear();mocks.fail=false;mocks.gate=null;mocks.session=true;mocks.context='operator';mocks.post.mockReset().mockImplementation(async(_url,body)=>response(body.id));});
it('waits for durable storage and blocks a double click',async()=>{
 const h=await ready();let release!:()=>void;mocks.gate=new Promise(r=>release=r);let first!:Promise<void>;
 act(()=>{first=h.result.current.submit(input);void h.result.current.submit(input);});
 expect(mocks.post).not.toHaveBeenCalled();await act(async()=>{release();await first;});expect(mocks.post).toHaveBeenCalledOnce();
});
it('does not send if the copy cannot be saved',async()=>{
 const h=await ready();mocks.fail=true;await act(()=>h.result.current.submit(input));expect(mocks.post).not.toHaveBeenCalled();expect(h.result.current.error).toContain('Quota');
});
it.each(['PARCIAL','FINAL'] as const)('reopens uncertain %s without automatic sending and replays exact key, body and signature',async tipo=>{
 mocks.post.mockRejectedValueOnce(Error('Lost response'));const first=await ready();await act(()=>first.result.current.submit({...input,tipo}));first.unmount();
 const h=await ready();expect(mocks.post).toHaveBeenCalledOnce();expect(h.result.current.command?.status).toBe('pending');
 await act(()=>h.result.current.retry());expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);expect(h.result.current.command?.status).toBe('confirmed');
});
it.each(['userId','context','manifestId'] as const)('isolates %s',async field=>{
 await claimCertificateCommand(scope,'key',input);expect(await loadCertificateCommand({...scope,[field]:'other'})).toBeNull();
});
it('never replaces another tab command',async()=>{
 const [a,b]=await Promise.all([claimCertificateCommand(scope,'a',input),claimCertificateCommand(scope,'b',{...input,nota:'different'})]);expect(a.key).toBe(b.key);
 const h=await ready();await act(()=>h.result.current.submit(input));expect(mocks.post).not.toHaveBeenCalled();expect(h.result.current.error).toContain('anterior');
});
it.each([400,401,403,409,500])('keeps uncertain HTTP %s until server recovery',async status=>{
 mocks.post.mockRejectedValueOnce({response:{status}});const h=await ready();await act(()=>h.result.current.submit(input));
 expect(h.result.current.command?.status).toBe('pending');await expect(releaseCertificateCommand(scope,h.result.current.command!.key)).rejects.toThrow('Comprobá');
});
it.each(['confirmed','withdrawn'] as const)('server recovery resolves %s using the original id',async status=>{
 await claimCertificateCommand(scope,'key',input);const h=await ready();mocks.post.mockResolvedValue(response('key',status));
 await act(()=>h.result.current.recover());expect(mocks.post).toHaveBeenCalledWith('/manifiestos/manifest/certificados/key/recuperar',{});expect(h.result.current.command?.status).toBe(status);
});
it('does not trust a receipt for another request',async()=>{
 mocks.post.mockResolvedValue(response('other'));const h=await ready();await act(()=>h.result.current.submit(input));expect(h.result.current.command?.status).toBe('pending');
});
it('preserves server confirmation when local acknowledgement fails',async()=>{
 const h=await ready();mocks.post.mockImplementation(async(_u,b)=>{mocks.fail=true;return response(b.id);});await act(()=>h.result.current.submit(input));
 expect(h.result.current.command?.status).toBe('confirmed');expect(h.result.current.error).toContain('servidor confirmó');
 h.unmount();mocks.fail=false;const next=await ready();expect(next.result.current.command?.status).toBe('pending');
});
it('keeps confirmed receipt if cleanup fails and does not resend',async()=>{
 const h=await ready();await act(()=>h.result.current.submit(input));await act(()=>h.result.current.release(async()=>{throw Error('Refresh failed');}));
 await act(()=>h.result.current.retry());expect(mocks.post).toHaveBeenCalledOnce();expect((await loadCertificateCommand(scope))?.status).toBe('confirmed');
});
it('a late withdrawal cannot overwrite a confirmed receipt',async()=>{
 await claimCertificateCommand(scope,'key',input);await settleCertificateCommand(scope,'key',{id:'key',status:'confirmed',numero:'M',pdfSha256:'hash'});
 expect((await settleCertificateCommand(scope,'key',{id:'key',status:'withdrawn'})).status).toBe('confirmed');
});
it.each(['session','context'] as const)('does not dispatch after %s changes during storage',async which=>{
 const h=await ready();let resume!:()=>void;mocks.gate=new Promise(r=>resume=r);let first!:Promise<void>;act(()=>{first=h.result.current.submit(input);});
 if(which==='session')mocks.session=false;else mocks.context='another-role';
 await act(async()=>{resume();await first;});expect(mocks.post).not.toHaveBeenCalled();
});
it('keeps malformed copy blocked without overwriting it',async()=>{
 const c=await claimCertificateCommand(scope,'key',input);mocks.rows.set(c.id,{...c,input:{...input,firma:null}});
 const h=renderHook(()=>useCertificateCommand(scope,true));await waitFor(()=>expect(h.result.current.error).toContain('verificar'));expect(h.result.current.ready).toBe(false);expect(mocks.post).not.toHaveBeenCalled();
});
