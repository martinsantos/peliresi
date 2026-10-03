import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, test, vi, expect } from 'vitest';
import ManifiestoDetallePage from '../../pages/manifiestos/ManifiestoDetallePage';
import { canAccessMobilePath } from '../../utils/mobileAccess';

const state = vi.hoisted(() => ({ user: {rol: 'ADMIN', esInspector: false, actorId: 'g-1'}, writes: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({useAuth: () => ({currentUser: state.user, isAdmin: state.user.rol === 'ADMIN'})}));
vi.mock('../../hooks/useManifiestos', () => {
  const mutation = () => ({isPending: false, mutateAsync: state.writes});
  return {
    useManifiesto: () => ({data: {id: 'm-1', numero: 'QA-1', estado: 'TRATADO', createdAt: '2026-10-02T12:00:00Z',
      generadorId: 'g-1', transportistaId: 't-1', operadorId: 'o-1',
      generador: {razonSocial: 'QA Generador', cuit: '30123456789'}, transportista: {razonSocial: 'QA Transporte'}, operador: {razonSocial: 'QA Operador'}, residuos: [], eventos: []}}),
    useFirmarManifiesto: mutation, useConfirmarRetiro: mutation, useConfirmarEntrega: mutation,
    useConfirmarRecepcion: mutation, useConfirmarRecepcionInSitu: mutation, usePesaje: mutation,
    useRegistrarTratamiento: mutation, useCerrarManifiesto: mutation, useCancelarManifiesto: mutation,
    useRechazarManifiesto: mutation, useRegistrarIncidente: mutation, useRevertirEstado: mutation,
  };
});
vi.mock('../../components/BlockchainPanel', () => ({default: () => null}));
vi.mock('../../pages/manifiestos/components/ManifiestoTimeline', () => ({default: () => null}));
vi.mock('../../pages/manifiestos/components/ManifiestoActions', () => ({default: () => null}));
vi.mock('../../services/manifiesto.service', () => ({manifiestoService: {}}));

beforeEach(() => { state.user = {rol: 'ADMIN', esInspector: false, actorId: 'g-1'}; state.writes.mockClear(); });
afterEach(cleanup);
const open = () => render(<MemoryRouter initialEntries={['/manifiestos/m-1']}><Routes><Route path="/manifiestos/:id" element={<ManifiestoDetallePage/>}/></Routes></MemoryRouter>);
const actorLinks = () => screen.queryAllByRole('link').filter(link => (link.getAttribute('href') || '').includes('/admin/actores/'));
test('administrator actor blocks are semantic keyboard links to the exact three fichas', () => {
  open();
  expect(actorLinks().map(link => link.getAttribute('href'))).toEqual(['/admin/actores/generadores/g-1','/admin/actores/transportistas/t-1','/admin/actores/operadores/o-1']);
  expect(state.writes).not.toHaveBeenCalled();
});
test('inspector consultation exposes the same actor links without granting mutations', () => {
  state.user.rol = 'GENERADOR'; state.user.esInspector = true; open();
  expect(actorLinks()).toHaveLength(3); expect(state.writes).not.toHaveBeenCalled();
});
test('sector administrator can navigate all categories in read-only consultation', () => {
  state.user.rol = 'ADMIN_GENERADOR'; open(); expect(actorLinks()).toHaveLength(3);
});
test('ordinary generator has a link only to its own actor', () => {
  state.user.rol = 'GENERADOR'; open();
  expect(actorLinks().map(link => link.getAttribute('href'))).toEqual(['/admin/actores/generadores/g-1']);
});
test('generator uses the same Factory icon as ficha and map', () => {
  const {container} = open(); expect(container.querySelectorAll('svg.lucide-factory')).toHaveLength(1);
});
test('app inspector can open an actor detail without being redirected to dashboard', () => {
  expect(canAccessMobilePath({...state.user,rol:'GENERADOR',esInspector:true} as never,'/admin/actores/generadores/g-2')).toBe(true);
});
test('app sector administrator can read another category without entering its editor', () => {
  expect(canAccessMobilePath({...state.user,rol:'ADMIN_GENERADOR'} as never,'/admin/actores/operadores/o-1')).toBe(true);
  expect(canAccessMobilePath({...state.user,rol:'ADMIN_GENERADOR'} as never,'/admin/actores/operadores/o-1/editar')).toBe(false);
});
test('app ordinary transportista cannot render another actor detail', () => {
  expect(canAccessMobilePath({...state.user,rol:'TRANSPORTISTA',actorId:'t-1'} as never,'/admin/actores/transportistas/t-2')).toBe(false);
});
