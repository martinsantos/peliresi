import {expect,it,vi} from 'vitest';
import {assertCertificateCommandAvailable,recoverCertificateCommand,CERTIFICATE_WITHDRAWN} from '../../services/certificateRecovery.service';
const tx=()=>({certificadoManifiesto:{findUnique:vi.fn().mockResolvedValue(null)},eventoManifiesto:{findUnique:vi.fn().mockResolvedValue(null),create:vi.fn()}});
it('records non-application durably, without emitting or notifying',async()=>{
 const db=tx();expect(await recoverCertificateCommand(db as any,'m','u','key')).toEqual({id:'key',status:'withdrawn'});
 expect(db.eventoManifiesto.create).toHaveBeenCalledWith({data:expect.objectContaining({id:'key',manifiestoId:'m',usuarioId:'u',tipo:CERTIFICATE_WITHDRAWN})});
});
it('returns the existing receipt without another event',async()=>{
 const db=tx();db.certificadoManifiesto.findUnique.mockResolvedValue({id:'key',manifiestoId:'m',autorId:'u',numero:'M-P1',pdfSha256:'hash'});
 expect(await recoverCertificateCommand(db as any,'m','u','key')).toMatchObject({status:'confirmed',id:'key',numero:'M-P1'});expect(db.eventoManifiesto.create).not.toHaveBeenCalled();
});
it.each(['manifiestoId','autorId'])('does not reveal another certificate %s',async field=>{
 const db=tx();db.certificadoManifiesto.findUnique.mockResolvedValue({id:'key',manifiestoId:'m',autorId:'u',[field]:'other'});
 await expect(recoverCertificateCommand(db as any,'m','u','key')).rejects.toThrow('No se puede');expect(db.eventoManifiesto.create).not.toHaveBeenCalled();
});
it('recovery is idempotent after withdrawal',async()=>{
 const db=tx();db.eventoManifiesto.findUnique.mockResolvedValue({id:'key',manifiestoId:'m',usuarioId:'u',tipo:CERTIFICATE_WITHDRAWN});
 expect(await recoverCertificateCommand(db as any,'m','u','key')).toMatchObject({status:'withdrawn'});expect(db.eventoManifiesto.create).not.toHaveBeenCalled();
});
it.each(['manifiestoId','usuarioId','tipo'])('cannot claim an existing event with different %s',async field=>{
 const db=tx();db.eventoManifiesto.findUnique.mockResolvedValue({id:'key',manifiestoId:'m',usuarioId:'u',tipo:CERTIFICATE_WITHDRAWN,[field]:'other'});
 await expect(recoverCertificateCommand(db as any,'m','u','key')).rejects.toThrow('No se puede');
});
it('blocks a delayed emission using the withdrawn key',async()=>{
 const db=tx();db.eventoManifiesto.findUnique.mockResolvedValue({tipo:CERTIFICATE_WITHDRAWN});
 await expect(assertCertificateCommandAvailable(db as any,'key')).rejects.toThrow('retirado');
});
it('allows a fresh command',async()=>{await expect(assertCertificateCommandAvailable(tx() as any,'fresh')).resolves.toBeUndefined();});
