import { describe, expect, it } from 'vitest';
import { advanceExceptional, exceptionalApproval, exceptionalApprovers, exceptionalCanApprove, exceptionalCanRegister, exceptionalCreateSchema,
  exceptionalCreator, exceptionalEventSchema, exceptionalPending, planExceptionalSlots, type ExceptionalEvent } from '../domain/manifiestoExcepcional';
const id = '00000000-0000-4000-8000-000000000001';
const difference = '00000000-0000-4000-8000-000000000002';
const base = { id: difference, version: 0, nota: 'Carga recibida diferente' };
describe('baja intensidad: hechos separados de conformidad', () => {
  it.each(['RETIRADO', 'RECIBIDO', 'TRATADO'] as const)('permite %s con original pendiente', etapa => {
    const previous = { RETIRADO: 'REGISTRADO', RECIBIDO: 'RETIRADO', TRATADO: 'RECIBIDO' } as const;
    expect(advanceExceptional(id, previous[etapa], [], { ...base, tipo: 'AVANCE', etapa }, false)).toBe(etapa);
    expect(exceptionalPending(id, [])).toEqual([{ objetivo: id, estado: 'PENDIENTE', solicitada: false }]);
  });
  it('no permite saltar etapas ni fingir conformidad por avance', () => {
    expect(() => advanceExceptional(id, 'REGISTRADO', [], { ...base, tipo: 'AVANCE', etapa: 'TRATADO' }, false)).toThrow();
  });
  it('la diferencia tiene revisión propia, no hereda la del original', () => {
    const events = [
      { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' },
      { ...base, tipo: 'DIFERENCIA', residuos: [{ corriente: 'Y2', cantidad: 5, unidad: 'kg' }] },
    ] as ExceptionalEvent[];
    expect(exceptionalPending(id, events).map(p => p.estado)).toEqual(['APROBADA', 'PENDIENTE']);
    expect(advanceExceptional(id, 'RECIBIDO', events, { ...base, tipo: 'AVANCE', etapa: 'TRATADO' }, false)).toBe('TRATADO');
  });
  it('observación posterior conserva la operación y requiere revisión explícita', () => {
    const events = [{ ...base, tipo: 'SOLICITAR_REVISION', objetivo: id }] as ExceptionalEvent[];
    expect(advanceExceptional(id, 'TRATADO', events, { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'OBSERVADA' }, true)).toBe('TRATADO');
    expect(advanceExceptional(id, 'TRATADO', events, { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'RECHAZADA' }, true)).toBe('TRATADO');
    expect(() => advanceExceptional(id, 'TRATADO', events, { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' }, false)).toThrow();
    expect(() => advanceExceptional(id, 'TRATADO', [], { ...base, tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' }, true)).toThrow();
  });
  it('no acepta objetivo inexistente ni diferencia vacía', () => {
    expect(() => advanceExceptional(id, 'RECIBIDO', [], { ...base, tipo: 'SOLICITAR_REVISION', objetivo: difference }, false)).toThrow();
    expect(() => advanceExceptional(id, 'RECIBIDO', [], { ...base, tipo: 'DIFERENCIA' }, false)).toThrow();
  });
  it('valida identidad, cantidades y rechaza campos que finjan aprobación o número', () => {
    const actor = { nombre: 'QA externo', identificacion: 'Declarado QA', domicilio: 'Calle sintética 1' };
    const input = { id, generador: actor, transportista: actor, patente: 'QA001', motivo: 'Sin alta', residuos: [{ corriente: 'Y1', cantidad: 2, unidad: 'kg' }] };
    expect(exceptionalCreateSchema.safeParse(input).success).toBe(true);
    expect(exceptionalCreateSchema.safeParse({ ...input, transportista: { ...actor, padronId: 'qa-registered' } }).success).toBe(true);
    expect(exceptionalCreateSchema.safeParse({ ...input, generador: { ...actor, padronId: 'qa-generator' }, transportista: { ...actor, padronId: 'qa-carrier' } }).success).toBe(false);
    expect(exceptionalCreateSchema.safeParse({ ...input, numero: 'OFICIAL' }).success).toBe(false);
    const incomplete = exceptionalCreateSchema.parse({ ...input, patente: '', generador: {}, transportista: { nombre: ' ' } });
    expect(incomplete.generador).toEqual({ nombre: '', identificacion: '', domicilio: '' });
    expect(incomplete.transportista.nombre).toBe('');
    expect(exceptionalCreateSchema.safeParse({ ...input, generador: { telefono: 'x'.repeat(101) } }).success).toBe(false);
    expect(exceptionalCreateSchema.safeParse({ ...input, generador: { nombre: 123 } }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, tipo: 'DIFERENCIA', residuos: [{ corriente: 'Y1', cantidad: -1, unidad: 'kg' }] }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, tipo: 'AVANCE', etapa: 'RETIRADO', decision: 'APROBADA' }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, tipo: 'DIFERENCIA' }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ ...base, nota: '', tipo: 'AVANCE', etapa: 'RETIRADO' }).success).toBe(true);
    expect(exceptionalEventSchema.safeParse({ ...base, nota: '', tipo: 'RESOLVER', objetivo: id, decision: 'APROBADA' }).success).toBe(false);
  });
});

// Especificación aprobada 17/10/2026: docs/ESPEC-EVENTUALES-20261017.md (v2).
describe('eventual: cualquier parte inicia y las partes con usuario aprueban antes de avanzar', () => {
  const actor = { nombre: 'QA externo', identificacion: 'Declarado QA', domicilio: 'Calle sintética 1' };
  const waste = [{ corriente: 'Y1', cantidad: 2, unidad: 'kg' as const }];
  const input = (extra: Record<string, unknown> = {}) => exceptionalCreateSchema.parse({ id, patente: '', motivo: 'Sin alta', residuos: waste, ...extra });
  const party = (rol: string, key: string, extra: Record<string, unknown> = {}) => ({ id: 'u-' + key, rol, [key]: { id: 'f-' + key }, ...extra });

  it('crea desde la sesión: GENERADOR, TRANSPORTISTA, OPERADOR con ficha y ADMIN sin suplantar', () => {
    expect(exceptionalCreator(party('GENERADOR', 'generador') as never)).toEqual({ rol: 'GENERADOR', parte: 'generador', actorId: 'f-generador' });
    expect(exceptionalCreator(party('TRANSPORTISTA', 'transportista') as never)).toEqual({ rol: 'TRANSPORTISTA', parte: 'transportista', actorId: 'f-transportista' });
    expect(exceptionalCreator(party('OPERADOR', 'operador') as never)).toEqual({ rol: 'OPERADOR', parte: 'operador', actorId: 'f-operador' });
    expect(exceptionalCreator({ id: 'admin', rol: 'ADMIN' } as never)).toEqual({ rol: 'ADMIN' });
  });
  it('rechaza ADMIN de sector, parte sin ficha, sesión restringida y ADMIN suplantado', () => {
    for (const user of [{ id: 'x', rol: 'ADMIN_GENERADOR' }, { id: 'x', rol: 'ADMIN_OPERADOR' }, { id: 'x', rol: 'GENERADOR' },
      { id: 'x', rol: 'OPERADOR', operador: null }, party('GENERADOR', 'generador', { restricted: true }),
      { id: 'x', rol: 'ADMIN', impersonatedBy: { id: 'y' } }, { id: 'x', rol: 'ADMIN', restricted: true }])
      expect(() => exceptionalCreator(user as never)).toThrow(expect.objectContaining({ statusCode: 403 }));
  });
  it('el lugar propio sale de la sesión y no se puede declarar otra empresa en él', () => {
    const creator = { rol: 'GENERADOR', parte: 'generador', actorId: 'f-gen' } as const;
    const slots = planExceptionalSlots(creator, input({ transportista: actor, operador: actor }));
    expect(slots.generador).toEqual({ padronId: 'f-gen' });
    expect(slots.operador).toEqual({ ...actor });
    expect(planExceptionalSlots(creator, input({ generador: { padronId: 'f-gen' } })).generador).toEqual({ padronId: 'f-gen' });
    expect(() => planExceptionalSlots(creator, input({ generador: { padronId: 'ajeno' } }))).toThrow(expect.objectContaining({ statusCode: 400 }));
    // Omitted slots stay external and empty: no invented identity.
    expect(planExceptionalSlots(creator, input()).transportista).toEqual({ nombre: '', identificacion: '', domicilio: '' });
  });
  it('rechaza los tres lugares con alta, también cuando uno es el propio', () => {
    const operator = { rol: 'OPERADOR', parte: 'operador', actorId: 'f-op' } as const;
    // Bypass the schema to prove the planner itself refuses, not only the request validation.
    const registered = { ...input(), generador: { padronId: 'g' }, transportista: { padronId: 't' } };
    expect(() => planExceptionalSlots(operator, registered)).toThrow(/Un eventual requiere al menos un participante sin alta/);
    expect(() => planExceptionalSlots({ rol: 'ADMIN' }, { ...registered, operador: { padronId: 'o' } })).toThrow(/sin alta/);
    expect(planExceptionalSlots({ rol: 'ADMIN' }, input({ generador: { padronId: 'g' }, transportista: { padronId: 't' }, operador: actor })).operador).toEqual(actor);
    expect(exceptionalCreateSchema.safeParse({ id, generador: { padronId: 'g' }, transportista: { padronId: 't' }, operador: { padronId: 'o' }, motivo: 'x', residuos: waste }).success).toBe(false);
  });
  it('conserva la huella de pedidos con forma anterior: no agrega lugares por defecto', () => {
    const legacy = exceptionalCreateSchema.parse({ id, generador: actor, transportista: actor, motivo: 'Sin alta', residuos: waste });
    expect(Object.keys(legacy).sort()).toEqual(['generador', 'id', 'motivo', 'patente', 'residuos', 'transportista']);
  });
  it('calcula aprobadores: quien crea, más cada lugar de padrón con usuario activo, sin duplicar el propio', () => {
    const gen = { rol: 'GENERADOR', parte: 'generador', actorId: 'f-gen' } as const;
    const ext = { nombre: '', identificacion: '', domicilio: '' };
    expect(exceptionalApprovers(gen, 'u-gen', { generador: { padronId: 'f-gen' }, transportista: ext, operador: ext }, { generador: true }))
      .toEqual([{ parte: 'creador', rol: 'GENERADOR', usuarioId: 'u-gen', actorId: 'f-gen' }]);
    expect(exceptionalApprovers(gen, 'u-gen', { generador: { padronId: 'f-gen' }, transportista: ext, operador: { padronId: 'f-op' } }, { generador: true, operador: true }))
      .toEqual([{ parte: 'creador', rol: 'GENERADOR', usuarioId: 'u-gen', actorId: 'f-gen' }, { parte: 'operador', rol: 'OPERADOR', actorId: 'f-op' }]);
    // A padrón slot whose account is inactive cannot approve and must not block forever.
    expect(exceptionalApprovers(gen, 'u-gen', { generador: { padronId: 'f-gen' }, transportista: { padronId: 'f-tr' }, operador: ext }, { transportista: false }))
      .toHaveLength(1);
    expect(exceptionalApprovers({ rol: 'ADMIN' }, 'u-admin', { generador: ext, transportista: ext, operador: ext }, {}))
      .toEqual([{ parte: 'creador', rol: 'ADMIN', usuarioId: 'u-admin' }]);
    expect(exceptionalApprovers({ rol: 'ADMIN' }, 'u-admin', { generador: { padronId: 'f-gen' }, transportista: ext, operador: ext }, { generador: true }))
      .toEqual([{ parte: 'creador', rol: 'ADMIN', usuarioId: 'u-admin' }, { parte: 'generador', rol: 'GENERADOR', actorId: 'f-gen' }]);
  });

  const approvers = [{ parte: 'creador', rol: 'GENERADOR', usuarioId: 'u-gen', actorId: 'f-gen' }, { parte: 'operador', rol: 'OPERADOR', actorId: 'f-op' }] as const;
  const cmd = (extra: Record<string, unknown>) => ({ id: difference, version: 0, nota: '', ...extra }) as never;
  const approved = (parte: string, tipo = 'APROBAR_PARTE') => ({ id: parte, version: 0, nota: 'ok', tipo, parte, autorId: 'x', fecha: '' }) as ExceptionalEvent;

  it('cada aprobador aprueba sólo su lugar, con su propia sesión', () => {
    expect(exceptionalCanApprove(party('GENERADOR', 'generador', { id: 'u-gen', generador: { id: 'f-gen' } }) as never, approvers[0])).toBe(true);
    expect(exceptionalCanApprove(party('GENERADOR', 'generador', { id: 'otro', generador: { id: 'f-gen' } }) as never, approvers[0])).toBe(false);
    expect(exceptionalCanApprove(party('OPERADOR', 'operador', { operador: { id: 'f-op' } }) as never, approvers[1])).toBe(true);
    expect(exceptionalCanApprove(party('OPERADOR', 'operador', { operador: { id: 'ajeno' } }) as never, approvers[1])).toBe(false);
    expect(exceptionalCanApprove(party('GENERADOR', 'generador', { generador: { id: 'f-op' } }) as never, approvers[1])).toBe(false);
    expect(exceptionalCanApprove(party('OPERADOR', 'operador', { operador: { id: 'f-op' }, impersonatedBy: { id: 'admin' } }) as never, approvers[1])).toBe(false);
    expect(exceptionalCanApprove(party('OPERADOR', 'operador', { operador: { id: 'f-op' }, restricted: true }) as never, approvers[1])).toBe(false);
    expect(exceptionalCanApprove({ id: 'u-admin', rol: 'ADMIN' } as never, { parte: 'creador', rol: 'ADMIN', usuarioId: 'u-admin' })).toBe(true);
    expect(exceptionalCanApprove({ id: 'otro-admin', rol: 'ADMIN' } as never, { parte: 'creador', rol: 'ADMIN', usuarioId: 'u-admin' })).toBe(false);
  });
  it('ningún hecho avanza hasta la última aprobación', () => {
    for (const command of [{ tipo: 'AVANCE', etapa: 'RETIRADO' }, { tipo: 'DIFERENCIA', nota: 'x', residuos: waste }, { tipo: 'SOLICITAR_REVISION', nota: 'x', objetivo: id }]) {
      expect(() => advanceExceptional(id, 'REGISTRADO', [], cmd(command), false, { aprobaciones: [...approvers] })).toThrow(expect.objectContaining({ statusCode: 409 }));
      expect(() => advanceExceptional(id, 'REGISTRADO', [approved('creador')], cmd(command), false, { aprobaciones: [...approvers] })).toThrow(expect.objectContaining({ statusCode: 409 }));
    }
    expect(advanceExceptional(id, 'REGISTRADO', [approved('creador'), approved('operador')], cmd({ tipo: 'AVANCE', etapa: 'RETIRADO' }), false, { aprobaciones: [...approvers] })).toBe('RETIRADO');
  });
  it('los registros anteriores, sin aprobadores, siguen avanzando como hasta ahora', () => {
    expect(advanceExceptional(id, 'REGISTRADO', [], cmd({ tipo: 'AVANCE', etapa: 'RETIRADO' }), false)).toBe('RETIRADO');
    expect(exceptionalApproval(undefined, []).estado).toBe('NO_REQUIERE');
    expect(() => advanceExceptional(id, 'REGISTRADO', [], cmd({ tipo: 'APROBAR_PARTE', parte: 'creador' }), false, { puedeAprobar: ['creador'] })).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
  it('aprobar y rechazar: un lugar por acción, una sola decisión, rechazo conserva y bloquea', () => {
    const options = (puedeAprobar: string[]) => ({ aprobaciones: [...approvers], puedeAprobar });
    expect(advanceExceptional(id, 'REGISTRADO', [], cmd({ tipo: 'APROBAR_PARTE', parte: 'creador' }), false, options(['creador']))).toBe('REGISTRADO');
    expect(() => advanceExceptional(id, 'REGISTRADO', [], cmd({ tipo: 'APROBAR_PARTE', parte: 'operador' }), false, options(['creador']))).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(() => advanceExceptional(id, 'REGISTRADO', [], cmd({ tipo: 'APROBAR_PARTE', parte: 'transportista' }), false, options(['transportista']))).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => advanceExceptional(id, 'REGISTRADO', [approved('creador')], cmd({ tipo: 'RECHAZAR_PARTE', parte: 'creador', nota: 'cambio' }), false, options(['creador']))).toThrow(expect.objectContaining({ statusCode: 409 }));
    const rejected = [approved('creador'), approved('operador', 'RECHAZAR_PARTE')];
    expect(exceptionalApproval([...approvers], rejected).estado).toBe('RECHAZADO');
    expect(() => advanceExceptional(id, 'REGISTRADO', rejected, cmd({ tipo: 'AVANCE', etapa: 'RETIRADO' }), false, options([]))).toThrow(/rechaz/i);
    expect(exceptionalApproval([...approvers], [approved('creador')])).toMatchObject({ estado: 'PENDIENTE',
      partes: [{ parte: 'creador', estado: 'APROBADA' }, { parte: 'operador', estado: 'PENDIENTE' }] });
    expect(exceptionalApproval([...approvers], [approved('creador'), approved('operador')]).estado).toBe('APROBADO');
  });
  it('el comando de aprobación exige un lugar; el rechazo exige motivo', () => {
    expect(exceptionalEventSchema.safeParse({ id: difference, version: 0, tipo: 'APROBAR_PARTE', parte: 'creador' }).success).toBe(true);
    expect(exceptionalEventSchema.safeParse({ id: difference, version: 0, tipo: 'APROBAR_PARTE' }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ id: difference, version: 0, tipo: 'RECHAZAR_PARTE', parte: 'operador' }).success).toBe(false);
    expect(exceptionalEventSchema.safeParse({ id: difference, version: 0, tipo: 'RECHAZAR_PARTE', parte: 'operador', nota: 'No corresponde' }).success).toBe(true);
    expect(exceptionalEventSchema.safeParse({ id: difference, version: 0, tipo: 'AVANCE', etapa: 'RETIRADO', parte: 'creador' }).success).toBe(false);
  });
  it('registran hechos quien creó y las partes con usuario del registro; nadie ajeno', () => {
    const record = { creadoPorId: 'u-admin', autorRol: 'ADMIN', operadorId: 'f-op', datos: { generador: { padronId: 'f-gen' }, transportista: { nombre: '' } } };
    expect(exceptionalCanRegister({ id: 'u-admin', rol: 'ADMIN' } as never, record)).toBe(true);
    expect(exceptionalCanRegister({ id: 'otro', rol: 'ADMIN' } as never, record)).toBe(false);
    expect(exceptionalCanRegister(party('OPERADOR', 'operador', { operador: { id: 'f-op' } }) as never, record)).toBe(true);
    expect(exceptionalCanRegister(party('GENERADOR', 'generador', { generador: { id: 'f-gen' } }) as never, record)).toBe(true);
    expect(exceptionalCanRegister(party('GENERADOR', 'generador', { generador: { id: 'ajeno' } }) as never, record)).toBe(false);
    expect(exceptionalCanRegister(party('TRANSPORTISTA', 'transportista') as never, record)).toBe(false);
    expect(exceptionalCanRegister(party('OPERADOR', 'operador', { operador: { id: 'f-op' }, restricted: true }) as never, record)).toBe(false);
    // Legacy rows: the operator keeps registering facts.
    expect(exceptionalCanRegister(party('OPERADOR', 'operador', { operador: { id: 'f-op' } }) as never, { creadoPorId: 'u', operadorId: 'f-op', datos: {} })).toBe(true);
  });
});
