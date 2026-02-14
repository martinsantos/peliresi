/**
 * SITREP v6 - Usuario Service (Admin)
 */

import api from './api';
import type { CreateUsuarioRequest, UpdateUsuarioRequest, UsuarioFilters, PaginatedData } from '../types/api';
import type { Usuario } from '../types/models';

export const usuarioService = {
  async list(filters?: UsuarioFilters): Promise<PaginatedData<Usuario>> {
    const { data } = await api.get('/admin/usuarios', { params: filters });
    const raw = data.data;
    return {
      items: raw.usuarios || raw.users || [],
      total: raw.pagination?.total || 0,
      page: raw.pagination?.page || 1,
      limit: raw.pagination?.limit || 10,
      totalPages: raw.pagination?.pages || 1,
    };
  },

  async getById(id: string): Promise<Usuario> {
    const { data } = await api.get(`/admin/usuarios/${id}`);
    return data.data.usuario || data.data;
  },

  async create(req: CreateUsuarioRequest): Promise<Usuario> {
    const { data } = await api.post('/admin/usuarios', req);
    return data.data;
  },

  async update(id: string, req: UpdateUsuarioRequest): Promise<Usuario> {
    const { data } = await api.put(`/admin/usuarios/${id}`, req);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/admin/usuarios/${id}`);
  },

  async toggleActivo(id: string): Promise<Usuario> {
    const { data } = await api.patch(`/admin/usuarios/${id}/toggle-activo`);
    return data.data;
  },
};
