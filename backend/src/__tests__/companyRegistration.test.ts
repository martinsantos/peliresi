import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/companyPeople.service', () => ({ reserveCompanyPerson: vi.fn() }));
vi.mock('../services/empresa.service', () => ({ enterpriseEvent: vi.fn() }));
import { actorRegistrationIdentity, linkApprovedRegistration } from '../services/companyRegistration.service';
import { reserveCompanyPerson } from '../services/companyPeople.service';
import { enterpriseEvent } from '../services/empresa.service';
const application = { id: 'application', usuarioId: 'owner', tipoActor: 'GENERADOR' }, reviewer = { id: 'reviewer' };
function fixture() {
  const owner = { id: 'owner', email: 'owner@qa.invalid', activo: true, emailVerified: true, cuit: '20-12345678-6' };
  const actor = { id: 'actor', usuarioId: 'owner', cuit: owner.cuit, razonSocial: 'Artificial' };
  return { owner, actor, db: { usuario: { findUniqueOrThrow: vi.fn().mockResolvedValue(owner) }, generador: { findUniqueOrThrow: vi.fn().mockResolvedValue(actor) },
    empresa: { upsert: vi.fn().mockResolvedValue({ id: 'company', activa: true }) },
    empresaActividad: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'activity' }) },
    responsableEmpresa: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    autorizacionEmpresa: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
  } };
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ENTERPRISE_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());
describe('approved registration and representation', () => {
  it.each(['20123456786','20 12345678 6','20-12345678-6'])('normalizes administrative identity %s before uniqueness checks',cuit=>{expect(actorRegistrationIdentity(cuit,' Owner@QA.Invalid ')).toEqual({cuit:'20-12345678-6',email:'owner@qa.invalid'});});
  it.each([[20123456786,'owner@qa.invalid'],['20-12345678-5','owner@qa.invalid'],['20-12345678-6','bad']])('rejects malformed administrative identity %j', (cuit,email)=>{expect(()=>actorRegistrationIdentity(cuit,email)).toThrow();});
  it('preserves legacy registration values with both flags off',()=>{vi.stubEnv('ENTERPRISE_ENABLED','false');vi.stubEnv('ACTOR_MULTIROLE_ENABLED','false');expect(actorRegistrationIdentity('legacy','Legacy@QA.invalid')).toEqual({cuit:'legacy',email:'Legacy@QA.invalid'});});
  it('preserves the previous path while enterprise is disabled', async () => { vi.stubEnv('ENTERPRISE_ENABLED', 'false'); await linkApprovedRegistration({}, application, 'actor', reviewer); expect(reserveCompanyPerson).not.toHaveBeenCalled(); });
  it('links the approved identity with its reviewer and one shared quota', async () => {
    const { db, owner } = fixture(); await linkApprovedRegistration(db, application, 'actor', reviewer);
    expect(db.empresa.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { cuit: '20123456786' }, update: {} }));
    expect(reserveCompanyPerson).toHaveBeenCalledWith(db, 'company', owner);
    expect(db.responsableEmpresa.create).toHaveBeenCalledWith({ data: { empresaId: 'company', usuarioId: 'owner', validadoPor: 'reviewer', motivo: 'Alta aprobada: application' } });
    expect(enterpriseEvent).toHaveBeenCalledWith(db, reviewer, 'company', 'ALTA_VINCULADA', expect.objectContaining({ usuarioId: 'owner' }));
  });
  it('does not infer the legal address from the productive address', async () => { const { db }=fixture(); await linkApprovedRegistration(db,application,'actor',reviewer); expect(db.empresa.upsert.mock.calls[0][0].create.domicilioLegal).toEqual({calle:'',localidad:'',departamento:''}); });
  it.each(['invalid', 'different'])('rejects %s CUIT without granting representation', async mode => {
    const {db,owner,actor}=fixture(); if(mode==='invalid')owner.cuit='20-12345678-0'; else actor.cuit='30-12345678-1';
    await expect(linkApprovedRegistration(db,application,'actor',reviewer)).rejects.toMatchObject({ statusCode: 400 }); expect(db.empresa.upsert).not.toHaveBeenCalled();
  });
  it('requires verified email, not merely an approved document',async()=>{const {db,owner}=fixture();owner.emailVerified=false;await expect(linkApprovedRegistration(db,application,'actor',reviewer)).rejects.toMatchObject({statusCode:409});expect(db.empresa.upsert).not.toHaveBeenCalled();});
  it('never reactivates a company or substitutes an existing activity',async()=>{const {db}=fixture();db.empresa.upsert.mockResolvedValue({id:'company',activa:false});await expect(linkApprovedRegistration(db,application,'actor',reviewer)).rejects.toMatchObject({statusCode:409});db.empresa.upsert.mockResolvedValue({id:'company',activa:true});db.empresaActividad.findUnique.mockResolvedValue({id:'other',actorId:'other',activa:true} as never);await expect(linkApprovedRegistration(db,application,'actor',reviewer)).rejects.toMatchObject({statusCode:409});});
  it('never restores a previously revoked responsible or grant on another approval',async()=>{const {db}=fixture();db.responsableEmpresa.findUnique.mockResolvedValue({revocadoAt:new Date()} as never);db.autorizacionEmpresa.findUnique.mockResolvedValue({activa:false} as never);await linkApprovedRegistration(db,application,'actor',reviewer);expect(db.responsableEmpresa.create).not.toHaveBeenCalled();expect(db.autorizacionEmpresa.create).not.toHaveBeenCalled();});
});
