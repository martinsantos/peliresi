/**
 * SITREP v6 - Usuario Service (Admin)
 */

import api from './api';
import type { CreateUsuarioRequest, UpdateUsuarioRequest, UsuarioFilters, PaginatedData } from '../types/api';
import type { Usuario } from '../types/models';

export const usuarioService = {
  async list(filters?: UsuarioFilters): Promise<PaginatedData<Usuario>> {
    const { data } = await api.get('/auth/users', { params: filters });
    return data.data;
  },

  async getById(id: string): Promise<Usuario> {
    const { data } = await api.get(`/auth/users/${id}`);
    return data.data;
  },

  async create(req: CreateUsuarioRequest): Promise<Usuario> {
    const { data } = await api.post('/auth/users', req);
    return data.data;
  },

  async update(id: string, req: UpdateUsuarioRequest): Promise<Usuario> {
    const { data } = await api.put(`/auth/users/${id}`, req);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/auth/users/${id}`);
  },

  async toggleActivo(id: string): Promise<Usuario> {
    const { data } = await api.patch(`/auth/users/${id}/toggle-activo`);
    return data.data;
  },
};
