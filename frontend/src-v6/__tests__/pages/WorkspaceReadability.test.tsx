import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActoresPage } from '../../pages/actores/ActoresPage';
import { AdminResiduosPage } from '../../pages/admin/AdminResiduosPage';
import AdminTratamientosPage from '../../pages/admin/AdminTratamientosPage';
import CargaMasivaPage from '../../pages/carga-masiva/CargaMasivaPage';

const qa = vi.hoisted(() => ({ get: vi.fn(), mutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('../../services/api', () => ({ default: { get: qa.get } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../../hooks/useActores', () => ({
  useGeneradores: () => ({ data: { items: [], total: 33, totalPages: 2 }, isLoading: false }),
  useTransportistas: () => ({ data: { items: [], total: 4, totalPages: 1 }, isLoading: false }),
  useOperadores: () => ({ data: { items: [], total: 5, totalPages: 1 }, isLoading: false }),
  useCreateGenerador: qa.mutation, useCreateTransportista: qa.mutation, useCreateOperador: qa.mutation,
  useDeleteGenerador: qa.mutation, useDeleteTransportista: qa.mutation, useDeleteOperador: qa.mutation,
}));
vi.mock('../../hooks/useOperadores', () => ({ useOperadores: () => ({ data: { items: [] } }) }));
vi.mock('../../hooks/useEnrichment', () => ({ useOperadoresEnrichment: () => ({ data: { operadores: {}, porCorriente: {} } }) }));
vi.mock('../../hooks/useManifiestos', () => ({ useManifiestos: () => ({ data: { manifiestos: [] }, isLoading: false }) }));
vi.mock('../../hooks/useCatalogos', () => ({
  useTiposResiduoEnriched: () => ({ data: {
    tiposResiduos: [
      { id: 'qa-y8', codigo: 'Y8', nombre: 'QA Aceite', peligrosidad: 'tóxico', activo: true },
      { id: 'qa-clean', codigo: 'QA', nombre: 'QA No peligroso', peligrosidad: 'ninguna', activo: true },
    ], manifiestosPorResiduo: { 'qa-y8': 5, 'qa-clean': 2 }, operadoresPorResiduo: {},
  }, isLoading: false, isError: false }),
  useCatalogoGeneradores: () => ({ data: [] }),
  useCreateTipoResiduo: qa.mutation, useUpdateTipoResiduo: qa.mutation, useDeleteTipoResiduo: qa.mutation,
  useAllTratamientos: () => ({ data: { tratamientos: [
    { id: 'qa-t1', operadorId: 'qa-o1', tipoResiduoId: 'qa-y8', metodo: 'QA Método 1', activo: true },
    { id: 'qa-t2', operadorId: 'qa-o1', tipoResiduoId: 'qa-y8', metodo: 'QA Método 2', activo: false },
    { id: 'qa-t3', operadorId: 'qa-o2', tipoResiduoId: 'qa-y8', metodo: 'QA Método 3', activo: true },
  ] }, isLoading: false }),
  useTiposResiduo: () => ({ data: [] }),
  useCreateTratamiento: qa.mutation, useUpdateTratamiento: qa.mutation, useDeleteTratamiento: qa.mutation,
}));

function cardFor(element: Element): Element {
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.classList.contains('rounded-[12px]')) return ancestor;
  }
  throw new Error('The actual card is missing');
}

beforeEach(() => { qa.get.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Actor workspaces retain readable native navigation', () => {
  it.each([
    ['Generadores', 'generadores', '33'], ['Transportistas', 'transportistas', '4'], ['Operadores', 'operadores', '5'],
  ])('%s is a native app link with the real API total and complete caption', (label, route, count) => {
    render(<MemoryRouter basename="/app" initialEntries={['/app/admin/actores']}><ActoresPage /></MemoryRouter>);
    const caption = screen.getByText(label, { exact: true, selector: 'p' });
    expect(caption).toHaveClass('whitespace-normal', 'break-words');
    expect(caption.parentElement).toHaveClass('min-w-0');
    const card = cardFor(caption);
    expect(card).toHaveClass('p-0');
    const link = screen.getByRole('link', { name: new RegExp(label) });
    expect(link).toHaveAttribute('href', `/app/admin/actores/${route}`);
    expect(link).toHaveTextContent(count);
    expect(link.className).toContain('focus-visible:');
  });

  it('preserves the existing mobile route prefix and the total is not a false button', () => {
    render(<MemoryRouter initialEntries={['/mobile/admin/actores']}><ActoresPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Generadores/ })).toHaveAttribute('href', '/mobile/admin/actores/generadores');
    const total = screen.getByText('Total', { exact: true });
    expect(total.parentElement).toHaveTextContent('42');
    expect(total.closest('a,button,[role="button"]')).toBeNull();
  });
});

describe('Read-only catalog summaries disclose complete labels and unchanged counts', () => {
  it.each([
    ['Residuos', AdminResiduosPage, [['Total Tipos', '2'], ['Peligrosos', '1'], ['No Peligrosos', '1'], ['Corrientes Y', '1'], ['Manifiestos', '7']]],
    ['Autorizaciones', AdminTratamientosPage, [['Total Autorizaciones', '3'], ['Activas', '2'], ['Operadores', '2'], ['Inactivas', '1']]],
  ] as const)('%s fits each full caption in a single padded card without fabricating values', (_kind, Page, values) => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    for (const [label, value] of values) {
      const caption = screen.getByText(label, { exact: true, selector: 'p' });
      expect(caption).toHaveClass('whitespace-normal', 'break-words');
      expect(caption.parentElement).toHaveClass('min-w-0');
      expect(within(caption.parentElement!).getByText(value, { exact: true })).toBeVisible();
      expect(cardFor(caption)).toHaveClass('p-0');
      expect(caption.closest('a,button,[role="button"]')).toBeNull();
    }
    expect(screen.getByRole('group', { name: 'Resumen de registros', exact: true })).toBeVisible();
  });
});

describe('Bulk templates keep the canonical category and honest interaction', () => {
  it.each([
    ['Generadores', 'factory', 'generador'], ['Transportistas', 'truck', 'transportista'], ['Operadores', 'flask-conical', 'operador'],
  ])('%s uses the same category symbol as the map, without a dead clickable card', (label, glyph, category) => {
    render(<MemoryRouter><CargaMasivaPage /></MemoryRouter>);
    const card = cardFor(screen.getByRole('heading', { name: label, exact: true }));
    expect(card.querySelector(`[data-map-symbol="${category}"] svg.lucide-${glyph}`)).not.toBeNull();
    expect(card).not.toHaveClass('cursor-pointer');
    expect(card).toHaveClass('p-0');
    expect(within(card as HTMLElement).getByRole('button', { name: 'Descargar plantilla' })).toBeEnabled();
    expect(qa.get).not.toHaveBeenCalled();
  });

  it.each(['generadores', 'transportistas', 'operadores'])('the %s button still downloads the correct API template, not an upload', async (tipo) => {
    const create = vi.fn(() => 'blob:qa-template');
    const revoke = vi.fn();
    class TemplateURL extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    }
    vi.stubGlobal('URL', TemplateURL);
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blob = new Blob(['QA template'], { type: 'text/csv' });
    qa.get.mockResolvedValue({ data: blob });
    render(<MemoryRouter><CargaMasivaPage /></MemoryRouter>);
    const heading = screen.getByRole('heading', { name: tipo[0].toUpperCase() + tipo.slice(1), exact: true });
    fireEvent.click(within(cardFor(heading) as HTMLElement).getByRole('button', { name: 'Descargar plantilla' }));
    await waitFor(() => expect(qa.get).toHaveBeenCalledExactlyOnceWith(`/carga-masiva/plantilla/${tipo}`, { responseType: 'blob' }));
    expect(create).toHaveBeenCalledWith(blob);
    expect(anchor).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:qa-template');
  });
});
