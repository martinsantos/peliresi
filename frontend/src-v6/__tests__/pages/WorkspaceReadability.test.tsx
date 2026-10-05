import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActoresPage } from '../../pages/actores/ActoresPage';
import { AdminResiduosPage } from '../../pages/admin/AdminResiduosPage';
import AdminTratamientosPage from '../../pages/admin/AdminTratamientosPage';
import CargaMasivaPage from '../../pages/carga-masiva/CargaMasivaPage';

const qa = vi.hoisted(() => ({
  get: vi.fn(), mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  user: { rol: 'ADMIN', esInspector: false, actorId: 'qa-own' },
  generadores: [] as Array<{ id: string; razonSocial: string; cuit: string }>,
  transportistas: [] as Array<{ id: string; razonSocial: string; cuit: string }>,
  operadores: [] as Array<{ id: string; razonSocial: string; cuit: string }>,
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: qa.user, isRestricted: false }) }));
vi.mock('../../services/api', () => ({ default: { get: qa.get } }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../../hooks/useActores', () => ({
  useGeneradores: () => ({ data: { items: qa.generadores, total: 33, totalPages: 2 }, isLoading: false }),
  useTransportistas: () => ({ data: { items: qa.transportistas, total: 4, totalPages: 1 }, isLoading: false }),
  useOperadores: () => ({ data: { items: qa.operadores, total: 5, totalPages: 1 }, isLoading: false }),
  useCreateGenerador: qa.mutation, useCreateTransportista: qa.mutation, useCreateOperador: qa.mutation,
  useDeleteGenerador: qa.mutation, useDeleteTransportista: qa.mutation, useDeleteOperador: qa.mutation,
}));
vi.mock('../../hooks/useOperadores', () => ({ useOperadores: () => ({ data: { items: [] } }) }));
vi.mock('../../hooks/useEnrichment', () => ({ useOperadoresEnrichment: () => ({ data: { operadores: {}, porCorriente: {} } }) }));
vi.mock('../../hooks/useManifiestos', () => ({ useManifiestos: () => ({ data: { manifiestos: [] }, isLoading: false }) }));
vi.mock('../../hooks/useCatalogos', () => ({
  useTiposResiduoEnriched: () => ({ data: {
    tiposResiduos: [
      { id: 'qa-y8', codigo: 'Y8', nombre: 'QA Aceite', peligrosidad: 'TOXICO', activo: true },
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

beforeEach(() => {
  qa.get.mockReset();
  qa.user = { rol: 'ADMIN', esInspector: false, actorId: 'qa-own' };
  qa.generadores = []; qa.transportistas = []; qa.operadores = [];
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Actor workspaces retain readable native navigation', () => {
  it.each([
    ['Generadores', 'generadores', '33'], ['Transportistas', 'transportistas', '4'], ['Operadores', 'operadores', '5'],
  ])('%s is a native app link with the real API total and complete caption', (label, route, count) => {
    render(<MemoryRouter basename="/app" initialEntries={['/app/admin/actores']}><ActoresPage /></MemoryRouter>);
    const caption = screen.getByText(label, { exact: true, selector: 'p' });
    expect(caption).toHaveClass('whitespace-normal', 'break-normal');
    expect(caption).not.toHaveClass('break-words');
    expect(caption).toHaveAttribute('data-actor-summary-label');
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
    expect(cardFor(total)).toHaveTextContent('42');
    expect(total.closest('a,button,[role="button"]')).toBeNull();
  });
});

describe('Actor overview offers only actions that the existing API permits', () => {
  it.each([['GENERADOR', true], ['GENERADOR', false], ['TRANSPORTISTA', false], ['OPERADOR', false]] as const)(
    '%s inspector=%s cannot create or delete actors from a consultation page', (rol, esInspector) => {
      qa.user = { ...qa.user, rol, esInspector };
      qa.generadores = [{ id: 'qa-other', razonSocial: 'QA Otra Empresa', cuit: '99-00000002-0' }];
      const { container } = render(<MemoryRouter initialEntries={['/actores']}><ActoresPage /></MemoryRouter>);
      expect(screen.queryByRole('button', { name: 'Nuevo Actor', exact: true })).not.toBeInTheDocument();
      expect(container.querySelector('svg[class*="lucide-trash"]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Generadores 33', exact: true })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'Generadores 33', exact: true }).querySelector('svg.lucide-funnel')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Generadores 33', exact: true }).querySelector('svg.lucide-chevron-right')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Generadores 33', exact: true }));
      expect(screen.getByRole('button', { name: 'Generadores 33', exact: true })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Generadores 33', exact: true }).querySelector('svg.lucide-check')).not.toBeNull();
    },
  );

  it('a sector administrator may create only its own category and cannot delete another sector', () => {
    qa.user.rol = 'ADMIN_OPERADOR';
    qa.generadores = [{ id: 'qa-other', razonSocial: 'QA Otra Empresa', cuit: '99-00000002-0' }];
    const { container } = render(<MemoryRouter><ActoresPage /></MemoryRouter>);
    expect(container.querySelector('svg[class*="lucide-trash"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo Actor', exact: true }));
    fireEvent.click(screen.getByLabelText('Tipo de Actor'));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Operador']);
    expect(screen.getByRole('option', { name: 'Operador', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  it('a normal actor has no full-ficha destination for a foreign record', () => {
    qa.user.rol = 'GENERADOR';
    qa.generadores = [{ id: 'qa-other', razonSocial: 'QA Otra Empresa', cuit: '99-00000002-0' }];
    render(<MemoryRouter><ActoresPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('row', { name: /QA Otra Empresa/ }));
    const dialog = screen.getByRole('dialog', { name: 'Detalle del Actor', exact: true });
    expect(within(dialog).queryByRole('button', { name: 'Ver detalle completo', exact: true })).toBeNull();
  });

  it('keeps the full administrator creation choices and describes a ficha as consultation, not editing', () => {
    qa.generadores = [{ id: 'qa-own', razonSocial: 'QA Empresa Propia', cuit: '99-00000001-0' }];
    const { container } = render(<MemoryRouter><ActoresPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Abrir ficha de QA Empresa Propia', exact: true })).toBeEnabled();
    expect(container.querySelector('svg.lucide-square-pen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo Actor', exact: true }));
    fireEvent.click(screen.getByLabelText('Tipo de Actor'));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Generador', 'Transportista', 'Operador']);
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

describe('Waste identity never presents a dangerous declaration as harmless', () => {
  it('keeps TOXICO as declared and uses the dangerous identity, not a green leaf', () => {
    render(<MemoryRouter><AdminResiduosPage /></MemoryRouter>);
    const row = screen.getByRole('row', { name: /QA Aceite/ });
    expect(row).toHaveTextContent('TOXICO');
    const symbol = within(row).getByRole('img', { name: 'Peligroso', exact: true });
    expect(symbol.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
    expect(row.querySelector('svg.lucide-leaf')).toBeNull();
    expect(symbol).not.toHaveClass('bg-success-100');
  });

  it('retains the explicit non-dangerous identity without changing its declaration', () => {
    render(<MemoryRouter><AdminResiduosPage /></MemoryRouter>);
    const row = screen.getByRole('row', { name: /QA No peligroso/ });
    expect(row).toHaveTextContent('Ninguna');
    const symbol = within(row).getByRole('img', { name: 'No Peligroso', exact: true });
    expect(symbol.querySelector('svg.lucide-leaf')).not.toBeNull();
    expect(row.querySelector('svg.lucide-triangle-alert')).toBeNull();
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
