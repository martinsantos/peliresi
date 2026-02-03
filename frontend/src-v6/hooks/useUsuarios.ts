/**
 * SITREP v6 - Usuarios Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usuarioService } from '../services/usuario.service';
import type { CreateUsuarioRequest, UpdateUsuarioRequest, UsuarioFilters } from '../types/api';

const KEYS = {
  usuarios: (filters?: UsuarioFilters) => ['usuarios', 'list', filters] as const,
  usuario: (id: string) => ['usuarios', 'detail', id] as const,
};

export function useUsuarios(filters?: UsuarioFilters) {
  return useQuery({
    queryKey: KEYS.usuarios(filters),
    queryFn: () => usuarioService.list(filters),
  });
}

export function useUsuario(id: string) {
  return useQuery({
    queryKey: KEYS.usuario(id),
    queryFn: () => usuarioService.getById(id),
    enabled: !!id,
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateUsuarioRequest) => usuarioService.create(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUsuarioRequest }) =>
      usuarioService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useDeleteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usuarioService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useToggleUsuarioActivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usuarioService.toggleActivo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}
