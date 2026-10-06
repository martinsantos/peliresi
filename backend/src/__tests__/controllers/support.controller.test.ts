import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ agent: vi.fn(), person: vi.fn(), ticket: vi.fn(), tickets: vi.fn(), count: vi.fn(), messages: vi.fn(), events: vi.fn(), transaction: vi.fn(), create: vi.fn(), createMessage: vi.fn(), createNotices: vi.fn(), team: vi.fn(), update: vi.fn(), event: vi.fn(), createEvent: vi.fn(), lock: vi.fn(), persist: vi.fn(), discard: vi.fn(), file: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  agenteSoporte: { findUnique: mocks.agent }, usuario: { findMany: mocks.team },
  ticketSoporte: { findUnique: mocks.ticket, findMany: mocks.tickets, count: mocks.count },
  mensajeSoporte: { findMany: mocks.messages }, eventoSoporte: { findMany: mocks.events },
  adjuntoSoporte: { findFirst: mocks.file }, $transaction: mocks.transaction,
} }));
vi.mock('../../services/supportFile.service', () => ({ persistSupportFiles: mocks.persist, discardSupportFiles: mocks.discard, describeSupportFile: vi.fn(), resolveSupportFile: vi.fn() }));
import { accionarTicket, obtenerTicket, listarTickets, crearTicket, descargarAdjuntoSoporte, comprobarEnvioTicket, equipoSoporte } from '../../controllers/support.controller';
const user = { id: 'owner', rol: 'GENERADOR', activo: true, restricted: false };
const ticket = { id: 'ticket', numero: 1, autorId: 'owner', responsableId: 'agent', estado: 'EN_CURSO', version: 2, huella: 'hash', clienteId: 'creation123' };
const response = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis(), setHeader: vi.fn(), type: vi.fn(), download: vi.fn() });
const request = (body = {}, who = user) => ({ user: who, body, params: { id: 'ticket', fileId: 'private-file', key: 'creation123' }, query: {}, files: [], get: () => 'request123' });
describe('support identity, visibility and transactional workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.agent.mockResolvedValue(null); mocks.ticket.mockResolvedValue(ticket);
    mocks.messages.mockResolvedValue([]); mocks.events.mockResolvedValue([]); mocks.event.mockResolvedValue(null);
    mocks.persist.mockResolvedValue([]); mocks.team.mockResolvedValue([{ id: 'agent' }, { id: 'admin' }]); mocks.file.mockResolvedValue(null);
    mocks.tickets.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
    mocks.update.mockResolvedValue({ ...ticket, version: 3 });
    mocks.person.mockResolvedValue({ ...user, id: 'agent', rol: 'ADMIN' });
    mocks.transaction.mockImplementation(callback => callback({ $queryRaw: mocks.lock,
      agenteSoporte: { findUnique: mocks.agent }, usuario: { findMany: mocks.team, findUnique: mocks.person },
      ticketSoporte: { findUnique: mocks.ticket, update: mocks.update, create: mocks.create },
      mensajeSoporte: { create: mocks.createMessage }, eventoSoporte: { findUnique: mocks.event, create: mocks.createEvent },
      notificacion: { createMany: mocks.createNotices },
    }));
  });
  it('constrains an actor list to its authenticated account', async () => {
    const res = response(), next = vi.fn(); await listarTickets(request() as never, res as never, next);
    expect(next).not.toHaveBeenCalled(); expect(mocks.tickets).toHaveBeenCalledWith(expect.objectContaining({ where: { autorId: 'owner' } }));
  });
  it('exposes registered contact identifiers only inside the authenticated support directory', async () => {
    const next = vi.fn(); await equipoSoporte(request({}, { ...user, rol: 'ADMIN' }) as never, response() as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.team).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, nombre: true, apellido: true, email: true } }));
  });
  it('does not disclose the support directory to a common report author', async () => {
    const next = vi.fn(); await equipoSoporte(request() as never, response() as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 }); expect(mocks.team).not.toHaveBeenCalled();
  });
  it('denies a foreign ticket without disclosing that it exists', async () => {
    const next = vi.fn(); await obtenerTicket(request({}, { ...user, id: 'foreign' }) as never, response() as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 }); expect(mocks.messages).not.toHaveBeenCalled();
  });
  it('filters private notes and events on the server for the reporter', async () => {
    const res = response(); await obtenerTicket(request() as never, res as never, vi.fn());
    expect(mocks.messages).toHaveBeenCalledWith(expect.objectContaining({ where: { ticketId: 'ticket', interno: false } }));
    expect(mocks.events).toHaveBeenCalledWith(expect.objectContaining({ where: { ticketId: 'ticket', interno: false } }));
    expect(res.json.mock.calls[0][0].data.huella).toBeUndefined();
  });
  it('cannot download the attachment of a private note', async () => {
    const next = vi.fn(); await descargarAdjuntoSoporte(request() as never, response() as never, next);
    expect(mocks.file).toHaveBeenCalledWith({ where: { id: 'private-file', mensaje: { ticketId: 'ticket', interno: false } } });
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
  });
  it('rejects stale versions before any mutation, event or notice', async () => {
    const next = vi.fn(); await accionarTicket(request({ accion: 'RESPONDER', version: 1, cuerpo: 'Respuesta del usuario' }) as never, response() as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 }); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.createNotices).not.toHaveBeenCalled();
  });
  it('does not grant support power through a sector role or inspector flag', async () => {
    const next = vi.fn(); await accionarTicket(request({ accion: 'TOMAR', version: 2 }, { ...user, rol: 'ADMIN_GENERADOR' }) as never, response() as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it('reopens the same ticket when its reporter responds after closure', async () => {
    mocks.ticket.mockResolvedValue({ ...ticket, estado: 'CERRADO' });
    const next = vi.fn(); await accionarTicket(request({ accion: 'RESPONDER', version: 2, cuerpo: 'El problema sigue ocurriendo.' }) as never, response() as never, next);
    expect(next).not.toHaveBeenCalled(); expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ticket' }, data: expect.objectContaining({ estado: 'ABIERTO', cerradoAt: null }) }));
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ interno: false, autorId: 'owner' }) }));
  });
  it('keeps an internal note private and never notifies the reporter about its text', async () => {
    const req = request({ accion: 'NOTA', version: 2, cuerpo: 'Diagnóstico reservado.' }, { ...user, id: 'agent', rol: 'ADMIN' });
    await accionarTicket(req as never, response() as never, vi.fn());
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ interno: true }) }));
    expect(mocks.createNotices).not.toHaveBeenCalled();
  });
  it('puts reopened work back on the active desk if the old agent was disabled', async () => {
    mocks.ticket.mockResolvedValue({ ...ticket, estado: 'CERRADO' }); mocks.person.mockResolvedValue({ ...user, id: 'agent', activo: false });
    const next = vi.fn(); await accionarTicket(request({ accion: 'RESPONDER', version: 2, cuerpo: 'El problema persiste después del cierre.' }) as never, response() as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ABIERTO', responsableId: null }) }));
    expect(mocks.createNotices.mock.calls[0][0].data.map((item: { usuarioId: string }) => item.usuarioId)).toContain('admin');
  });
  it('records a public response and its internal notification atomically', async () => {
    const next = vi.fn(); await accionarTicket(request({ accion: 'RESPONDER', version: 2, cuerpo: 'Actualizamos el permiso.' }, { ...user, id: 'agent', rol: 'ADMIN' }) as never, response() as never, next);
    expect(next).not.toHaveBeenCalled(); expect(mocks.createEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createNotices.mock.calls[0][0].data).toEqual([expect.objectContaining({ usuarioId: 'owner', tipo: 'INFO_GENERAL' })]);
  });
  it('checks uncertain sends only under the current owner', async () => {
    const res = response(); await comprobarEnvioTicket(request() as never, res as never, vi.fn());
    expect(mocks.ticket).toHaveBeenCalledWith({ where: { autorId_clienteId: { autorId: 'owner', clienteId: 'creation123' } } });
  });
  it('rejects a reused creation key with different contents and does not write', async () => {
    const next = vi.fn(); await crearTicket(request({ asunto: 'GPS no responde', descripcion: 'No muestra el marcador después del permiso.', categoria: 'GPS' }) as never, response() as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 }); expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
