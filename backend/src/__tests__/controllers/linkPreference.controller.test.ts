import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({update:vi.fn()}));
vi.mock('../../lib/prisma',()=>({default:{usuario:{update:mock.update}}}));
vi.mock('../../services/email.service',()=>({emailService:{}}));
import { updateLinkPreference } from '../../controllers/auth.controller';
beforeEach(()=>{vi.clearAllMocks();mock.update.mockResolvedValue({id:'mine',preferenciaEnlaces:'APP'});});
describe('personal link setting',()=>{
 it.each(['AUTO','WEB','APP'])('saves %s only on current person',async value=>{
  const json=vi.fn(),next=vi.fn();await updateLinkPreference({user:{id:'mine',rol:'GENERADOR'},body:{preferenciaEnlaces:value}} as any,{json} as any,next);
  expect(next).not.toHaveBeenCalled();expect(mock.update).toHaveBeenCalledWith({where:{id:'mine'},data:{preferenciaEnlaces:value},select:{id:true,preferenciaEnlaces:true}});
 });
 it.each([{}, {preferenciaEnlaces:'OTHER'}, {preferenciaEnlaces:'WEB',id:'other'}, {preferenciaEnlaces:'WEB',notifEmail:true}])('rejects invalid/extra fields %o',async body=>{
  const next=vi.fn();await updateLinkPreference({user:{id:'mine'},body} as any,{} as any,next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:400}));expect(mock.update).not.toHaveBeenCalled();
 });
 it('rejects impersonation',async()=>{
  const next=vi.fn();await updateLinkPreference({user:{id:'other',impersonatedBy:{id:'admin'}},body:{preferenciaEnlaces:'APP'}} as any,{} as any,next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));expect(mock.update).not.toHaveBeenCalled();
 });
});