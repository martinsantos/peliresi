import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ find: vi.fn(), lock: vi.fn(), create: vi.fn(), update: vi.fn(), activate: vi.fn(), notify: vi.fn(), transaction: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  solicitudInscripcion: { findUnique: mock.find }, $transaction: mock.transaction,
  notificacion: { create: mock.notify },
} }));
vi.mock('../../utils/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendEmailVerification: vi.fn() } }));
vi.mock('../../controllers/auth.controller', () => ({ generateTokens: vi.fn() }));
vi.mock('fs', async original => { const actual = await original<typeof import('fs')>(); return { ...actual, default: { ...actual, existsSync: () => true } }; });

import { aprobarSolicitud } from '../../controllers/solicitud.controller';

const identity = { id: 'owner', email: 'qa@night-qa.invalid', nombre: 'QA responsable', cuit: '30-70987654-3' };
const declared = { razonSocial: 'QA establecimiento', cuit: identity.cuit, domicilio: 'QA Mendoza 123',
  telefono: '0261-0000000', emailContacto: 'contacto@night-qa.invalid',
  domicilioLegalCalle: 'QA legal 1', domicilioRealCalle: 'QA planta 2', domicilioRealDepto: 'Capital',
  corrientesControl: 'Y8, Y12', corrientesY: 'Y8, Y12', tefPersonal: '0', tefPotencia: '120', tefSuperficie: '1250', tefZona: 'zona_industrial',
  representanteLegalNombre: 'QA representante', representanteTecnicoMatricula: 'QA-MAT',
  certificacionISO: '2027-12-31', resolucionDPA: 'QA-RES', localidad: 'Capital',
  coordenadas: '0, -68.84', factorR: 999999, montoMxR: 999999, activo: false, usuarioId: 'attacker' };
function draft(type = 'GENERADOR') { return { id: 'draft', usuarioId: 'owner', tipoActor: type, estado: 'EN_REVISION', usuario: identity, datosActor: JSON.stringify(declared) }; }
async function approve(role = 'ADMIN') {
  const res = { json: vi.fn() }, next = vi.fn();
  await aprobarSolicitud({ params: { id: 'draft' }, user: { id: 'admin', rol: role }, body: {} } as never, res as never, next);
  return { error: next.mock.calls[0]?.[0], res };
}
beforeEach(() => {
  vi.clearAllMocks(); mock.find.mockResolvedValue(draft()); mock.lock.mockResolvedValue([]);
  mock.create.mockResolvedValue({ id: 'new-actor' }); mock.update.mockImplementation(async ({ data }) => ({ ...draft(), ...data }));
  mock.transaction.mockImplementation(callback => callback({ $queryRaw: mock.lock,
    solicitudInscripcion: { findUnique: mock.find, update: mock.update },
    generador: { create: mock.create }, operador: { create: mock.create }, transportista: { create: mock.create },
    usuario: { update: mock.activate }, notificacion: { create: mock.notify },
  }));
});

describe('approved registration preserves declarations, not invented fiscal authority', () => {
  it.each(['GENERADOR', 'OPERADOR'])('%s transfers activity, split addresses and actual contact, keeping explicit zero', async type => {
    mock.find.mockResolvedValue(draft(type));
    expect((await approve()).error).toBeUndefined();
    const data = mock.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ usuarioId: 'owner', cuit: identity.cuit, email: declared.emailContacto,
      domicilioLegalCalle: 'QA legal 1', domicilioRealCalle: 'QA planta 2', domicilioRealDepto: 'Capital',
      tefInputs: { personal: 0, potenciaHP: 120, superficieM2: 1250, zona: 'zona_industrial' } });
    expect(data).not.toHaveProperty('factorR'); expect(data).not.toHaveProperty('montoMxR');
    expect(data).not.toHaveProperty('activo');
    expect(data[type === 'GENERADOR' ? 'corrientesControl' : 'corrientesY']).toBe('Y8, Y12');
  });
  it('preserves the operator representatives without granting unrecognized database fields', async () => {
    mock.find.mockResolvedValue(draft('OPERADOR')); await approve();
    expect(mock.create.mock.calls[0][0].data).toMatchObject({ representanteLegalNombre: 'QA representante', representanteTecnicoMatricula: 'QA-MAT', resolucionDPA: 'QA-RES' });
  });
  it('retains coordinate zero from the transport form without losing longitude', async () => {
    mock.find.mockResolvedValue(draft('TRANSPORTISTA')); await approve();
    expect(mock.create.mock.calls[0][0].data).toMatchObject({ latitud: 0, longitud: -68.84, localidad: 'Capital' });
    expect(mock.create.mock.calls[0][0].data).not.toHaveProperty('tefInputs');
  });
  it('rechecks the state inside the transaction before creating an actor', async () => {
    mock.find.mockResolvedValueOnce(draft()).mockResolvedValue({ ...draft(), estado: 'RECHAZADA' });
    expect((await approve()).error).toMatchObject({ statusCode: 409 });
    expect(mock.lock).toHaveBeenCalledOnce(); expect(mock.create).not.toHaveBeenCalled(); expect(mock.activate).not.toHaveBeenCalled();
  });
  it.each(['-1', 'Infinity', 'no es un numero'])('rejects invalid activity %j with no actor creation', async value => {
    mock.find.mockResolvedValue({ ...draft(), datosActor: JSON.stringify({ ...declared, tefPotencia: value }) });
    expect((await approve()).error).toMatchObject({ statusCode: 400 }); expect(mock.create).not.toHaveBeenCalled();
  });
  it('does not turn missing activity into invented zeros', async () => {
    mock.find.mockResolvedValue({ ...draft(), datosActor: JSON.stringify({ razonSocial: 'QA', domicilio: 'QA', cuit: identity.cuit }) });
    await approve(); expect(mock.create.mock.calls[0][0].data).not.toHaveProperty('tefInputs');
  });
  it('keeps sector permission checks before any write', async () => {
    expect((await approve('ADMIN_OPERADOR')).error).toMatchObject({ statusCode: 403 });
    expect(mock.transaction).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it('does not create an actor for a CUIT substituted after account creation', async () => {
    mock.find.mockResolvedValue({ ...draft(), datosActor: JSON.stringify({ ...declared, cuit: '30-11111111-1' }) });
    expect((await approve()).error).toMatchObject({ statusCode: 400 }); expect(mock.create).not.toHaveBeenCalled();
  });
});
