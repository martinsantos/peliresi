import { describe, expect, it, vi } from 'vitest';
import { companyPeople, reserveCompanyPerson } from '../services/companyPeople.service';

function fixture() {
  const owner = { id: 'owner', email: 'titular@qa.invalid', nombre: 'Titular', activo: true };
  const representative = { id: 'second', email: 'persona@qa.invalid', nombre: 'Representante', activo: true };
  const db: any = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'company' }]),
    empresa: { findUnique: vi.fn().mockResolvedValue({ id: 'company', cuit: '30712345671', activa: true }) },
    autorizacionEmpresa: { findMany: vi.fn().mockResolvedValue([]) },
    responsableEmpresa: { findMany: vi.fn().mockResolvedValue([{ usuarioId: owner.id }]) },
    invitacionEmpresa: { findMany: vi.fn().mockResolvedValue([]) },
    empresaActividad: { findMany: vi.fn().mockResolvedValue([]) },
    usuario: { findMany: vi.fn().mockResolvedValue([owner]) },
    generador: { findMany: vi.fn().mockResolvedValue([{ usuarioId: owner.id }]) },
    transportista: { findMany: vi.fn().mockResolvedValue([{ usuarioId: owner.id }]) },
    operador: { findMany: vi.fn().mockResolvedValue([{ usuarioId: owner.id }]) },
  };
  return { db, owner, representative };
}
describe('two representatives per legal identity, never per role', () => {
  it('one owner with three roles uses one slot and permits a second person', async () => {
    const { db, owner, representative } = fixture();
    db.empresaActividad.findMany.mockResolvedValue(['GENERADOR','TRANSPORTISTA','OPERADOR'].map((rol, i) => ({ id: 'a'+i, rol, actorId: 'actor'+i })));
    db.autorizacionEmpresa.findMany.mockResolvedValue([0,1,2].map(i => ({ usuarioId: owner.id, actividadId:'a'+i })));
    const result = await reserveCompanyPerson(db, 'company', representative);
    expect(result.ocupados).toBe(1); expect(result.maximo).toBe(2);
    expect(result.personas[0].roles).toEqual(['GENERADOR','TRANSPORTISTA','OPERADOR']);
  });
  it('blocks a third person when both slots are occupied, without role-dependent exceptions', async () => {
    const { db, owner, representative } = fixture(); db.usuario.findMany.mockResolvedValue([owner, representative]);
    await expect(reserveCompanyPerson(db, 'company', { email: 'third@qa.invalid' })).rejects.toMatchObject({ statusCode:409 });
  });
  it('adding another activity to the same verified person consumes no additional slot', async () => {
    const { db, owner, representative } = fixture(); db.usuario.findMany.mockResolvedValue([owner, representative]);
    db.autorizacionEmpresa.findMany.mockResolvedValue([{usuarioId:representative.id}]);
    await expect(reserveCompanyPerson(db, 'company', representative)).resolves.toMatchObject({ocupados:2});
  });
  it('invitations for several activities of the same normalized email reserve one slot', async () => {
    const { db } = fixture(); db.invitacionEmpresa.findMany.mockResolvedValue([{ email:'Otro@qa.invalid' }, { email:' otro@qa.invalid ' }]);
    expect((await companyPeople(db,'company')).ocupados).toBe(2);
    await expect(reserveCompanyPerson(db,'company',{email:'OTRO@QA.INVALID'})).resolves.toMatchObject({ocupados:2});
    await expect(reserveCompanyPerson(db,'company',{email:'third@qa.invalid'})).rejects.toMatchObject({statusCode:409});
  });
  it('an invitation to an existing member does not double count that person', async () => {
    const { db, owner, representative } = fixture(); db.usuario.findMany.mockResolvedValue([owner, representative]); db.invitacionEmpresa.findMany.mockResolvedValue([{email:representative.email}]);
    expect(await companyPeople(db,'company')).toMatchObject({ocupados:2,reservas:[]});
  });
  it('counts suspended accounts until their authority is revoked, preventing reactivation from bypassing the limit', async () => {
    const { db, owner, representative } = fixture(); db.usuario.findMany.mockResolvedValue([owner,{...representative,activo:false}]);
    await expect(reserveCompanyPerson(db,'company',{email:'third@qa.invalid'})).rejects.toMatchObject({statusCode:409});
  });
  it('reports legacy overflow without revoking it and still permits adjusting an existing person', async () => {
    const { db, owner, representative } = fixture(); db.usuario.findMany.mockResolvedValue([owner,representative,{id:'legacy',email:'legacy@qa.invalid'}]);
    db.autorizacionEmpresa.findMany.mockResolvedValue([{usuarioId:representative.id}]);
    await expect(reserveCompanyPerson(db,'company',representative)).resolves.toMatchObject({ocupados:3});
    await expect(reserveCompanyPerson(db,'company',{email:'new@qa.invalid'})).rejects.toMatchObject({statusCode:409});
  });
  it('only live unaccepted invitations reserve slots and all requests lock the same entity before counting', async () => {
    const { db, representative } = fixture(); const date=new Date('2026-10-22T15:00:00Z');
    await companyPeople(db,'company',date);
    expect(db.invitacionEmpresa.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{empresaId:'company',aceptadaAt:null,revocadaAt:null,venceAt:{gt:date}}}));
    await reserveCompanyPerson(db,'company',representative);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.empresa.findUnique.mock.invocationCallOrder[1]);
  });
  it('does not resolve users or counts for an inactive or absent entity', async () => {
    const { db } = fixture(); db.empresa.findUnique.mockResolvedValue(null);
    await expect(companyPeople(db,'company')).rejects.toMatchObject({statusCode:404}); expect(db.usuario.findMany).not.toHaveBeenCalled();
  });
  it('counts two distinct account IDs separately even when legacy email casing collides', async () => {
    const {db,owner,representative}=fixture();db.usuario.findMany.mockResolvedValue([owner,representative]);
    await expect(reserveCompanyPerson(db,'company',{id:'third',email:representative.email.toUpperCase()})).rejects.toMatchObject({statusCode:409});
  });
  it('does not mistake a newly created CUIT owner for a previously authorized third person', async () => {
    const {db,owner,representative}=fixture();
    const candidate={id:'new-owner',email:'new-owner@qa.invalid',nombre:'New owner',activo:true};
    db.responsableEmpresa.findMany.mockResolvedValue([{usuarioId:owner.id},{usuarioId:representative.id}]);
    db.usuario.findMany.mockResolvedValue([owner,representative,candidate]);
    await expect(reserveCompanyPerson(db,'company',candidate)).rejects.toMatchObject({statusCode:409});
  });
  it('permits the new CUIT owner when only one established person occupies the entity', async () => {
    const {db,owner,representative}=fixture();db.usuario.findMany.mockResolvedValue([owner,representative]);
    await expect(reserveCompanyPerson(db,'company',representative)).resolves.toMatchObject({ocupados:1});
  });
  it('email-only invitations cannot count an unlinked CUIT owner as already authorized', async () => {
    const {db,owner,representative}=fixture();
    db.responsableEmpresa.findMany.mockResolvedValue([{usuarioId:owner.id},{usuarioId:representative.id}]);
    db.usuario.findMany.mockResolvedValue([owner,representative,{id:'third',email:'third@qa.invalid'}]);
    await expect(reserveCompanyPerson(db,'company',{email:'THIRD@QA.INVALID'})).rejects.toMatchObject({statusCode:409});
  });

});
