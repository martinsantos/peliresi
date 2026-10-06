import api from './api';
import type { SupportCreate, SupportMutation, SupportPerson, SupportTicket } from '../types/support';
import { SupportSessionChangedError } from '../utils/supportSession';

function multipart(input: SupportCreate | SupportMutation, files: File[]) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  for (const file of files) form.append('files', file);
  return form;
}
export const supportService = {
  async access(): Promise<{ puedeGestionar: boolean; puedeConfigurar: boolean }> { return (await api.get('/soporte/acceso')).data.data; },
  async list(params: { scope: string; estado?: string; search?: string; page: number }): Promise<{ items: SupportTicket[]; total: number; page: number; totalPages: number }> {
    return (await api.get('/soporte', { params })).data.data;
  },
  async get(id: string): Promise<SupportTicket> { return (await api.get('/soporte/' + encodeURIComponent(id))).data.data; },
  async create(input: SupportCreate, files: File[], key: string): Promise<{ id: string; referencia: string }> {
    return (await api.post('/soporte', multipart(input, files), { headers: { 'Content-Type': undefined, 'Idempotency-Key': key } })).data.data;
  },
  async sent(key: string): Promise<{ id: string; referencia: string }> { return (await api.get('/soporte/envios/' + encodeURIComponent(key))).data.data; },
  async act(id: string, input: SupportMutation, files: File[], key: string): Promise<{ id: string; version: number; replay: boolean }> {
    return (await api.post('/soporte/' + encodeURIComponent(id) + '/acciones', multipart(input, files), { headers: { 'Content-Type': undefined, 'Idempotency-Key': key } })).data.data;
  },
  async team(): Promise<Array<SupportPerson & { email: string }>> { return (await api.get('/soporte/equipo')).data.data; },
  async candidates(search: string): Promise<Array<SupportPerson & { email: string; rol: string; agenteSoporte: { habilitado: boolean } | null }>> { return (await api.get('/soporte/candidatos', { params: { search } })).data.data; },
  async agent(id: string, habilitado: boolean): Promise<void> { await api.patch('/soporte/equipo/' + encodeURIComponent(id), { habilitado }); },
  async download(ticketId: string, fileId: string): Promise<Blob> { return (await api.get('/soporte/' + encodeURIComponent(ticketId) + '/adjuntos/' + encodeURIComponent(fileId), { responseType: 'blob' })).data; },
};
export function supportError(error: unknown): string {
  if (error instanceof SupportSessionChangedError) return error.message;
  const failure = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
  return failure.response?.data?.message || (failure.response ? 'No se confirmó la operación. Reintentá sin cambiar el envío.' : 'No se confirmó el envío. Conservamos el texto: comprobá la conexión y reintentá.');
}
