import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NuevoGeneradorPage from '../../pages/admin/NuevoGeneradorPage';
import NuevoOperadorPage from '../../pages/admin/NuevoOperadorPage';
import NuevoTransportistaPage from '../../pages/admin/NuevoTransportistaPage';

const mock = vi.hoisted(() => ({
  actor: { id: 'qa', razonSocial: 'QA Ficha', cuit: '99-00000024-0', email: 'edit@night-qa.invalid', domicilio: 'QA', telefono: '123', corrientesY: 'Y8/Y9', corrientesControl: 'Y8;Y9', vehiculos: [], choferes: [] } as any,
  update: vi.fn(), navigate: vi.fn(), draft: vi.fn(), restore: null as any, reload: vi.fn(),
}));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => mock.navigate }));
vi.mock('../../hooks/useActorRegistrationDraft', () => ({ useActorRegistrationDraft: (...args: any[]) => {
  mock.draft(...args); mock.restore = args[3];
  return { available: null, owner: 'qa-admin', checkpoint: async () => true, clear: async () => true, assertSession: () => {}, restoring: false };
} }));
vi.mock('../../hooks/useActores', () => {
  const query = () => ({ data: mock.actor, isLoading: false, refetch: mock.reload });
  const mutation = () => ({ mutateAsync: mock.update, isPending: false });
  return { useGenerador: query, useOperador: query, useTransportista: query, useUpdateGenerador: mutation, useUpdateOperador: mutation, useUpdateTransportista: mutation, useCreateGenerador: mutation, useCreateOperador: mutation, useCreateTransportista: mutation };
});
vi.mock('../../hooks/useGeneradorFiscal', () => ({ useUploadDocumento: () => ({}), useUploadOperadorDocumento: () => ({}) }));
vi.mock('../../hooks/useEnrichment', () => ({
  useGeneradoresEnrichment: () => ({ data: { generadores: { '99-00000024-0': { telefono: '999', domicilio: 'Histórico, Antigua, Capital', categoriasControl: ['Y8'] } } } }),
  useOperadoresEnrichment: () => ({ data: { operadores: { '99-00000024-0': { telefono: '999', domicilioLegal: { calle: 'Histórico' }, tecnologia: 'Histórica', corrientes: ['Y8'] } } } }),
}));
vi.mock('../../components/CalculadoraTEF', () => ({ default: () => null }));
vi.mock('../../components/DocumentUpload', () => ({ default: () => null }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), add: vi.fn() } }));

const actors = [
  { role: 'GENERADOR', plural: 'generadores', Page: NuevoGeneradorPage, last: 6 },
  { role: 'OPERADOR', plural: 'operadores', Page: NuevoOperadorPage, last: 7 },
  { role: 'TRANSPORTISTA', plural: 'transportistas', Page: NuevoTransportistaPage, last: 5 },
];
for (const actor of actors) describe(actor.role + ' edit continuity', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.update.mockResolvedValue({ id: 'qa' }); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());
  function open() {
    const list = '/admin/actores/' + actor.plural;
    render(<MemoryRouter initialEntries={[{ pathname: list+'/qa/editar', state: { actorReturn: list+'?search=QA&page=2', actorDetailReturn: list+'/qa?tab=historial' } }]}><Routes><Route path={list+'/:id/editar'} element={<actor.Page />} /></Routes></MemoryRouter>);
    return list;
  }
  it('loading an existing record is not a pending edit and its CUIT is read-only', () => {
    open();
    expect(screen.getByLabelText('Razon Social *')).toHaveValue('QA Ficha');
    expect(screen.getByLabelText('CUIT *')).toHaveAttribute('readonly');
    expect(mock.draft.mock.calls.at(-1)![4]).toBe(false);
    expect(screen.getByRole('region', { name: 'Borrador de edición' })).toHaveTextContent('sin modificar todavía la ficha');
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '456' } });
    expect(mock.draft.mock.calls.at(-1)![4]).toBe(true);
  });
  it('returns to the same ficha/tab with the original list filters', () => {
    const list = open();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la ficha' }));
    expect(mock.navigate).toHaveBeenCalledWith(list+'/qa?tab=historial', { state: { actorReturn: list+'?search=QA&page=2' } });
  });
  it('does not revive cleared saved fields from historical imports', () => {
    const original = mock.actor;
    mock.actor = { ...original, telefono: '', domicilioLegalCalle: '', corrientesControl: '', corrientesY: '', tecnologia: '' };
    try {
      open();
      expect(screen.getByLabelText('Telefono')).toHaveValue('');
      if (actor.role !== 'TRANSPORTISTA') {
        expect(mock.draft.mock.calls.at(-1)![2].form.domicilioLegalCalle).toBe('');
        expect(mock.draft.mock.calls.at(-1)![2].selectedY).toEqual([]);
      }
    } finally { mock.actor = original; }
  });
  it('validates required fields and email before leaving the step', () => {
    open();
    fireEvent.change(screen.getByLabelText('Razon Social *'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'invalid' } });
    fireEvent.click(screen.getByRole('button', { name: /^(Siguiente|Continuar)$/ }));
    expect(screen.getByLabelText('Razon Social *')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email *')).toHaveAttribute('aria-invalid', 'true');
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('restores edits without replacing them with fetched data', () => {
    open();
    act(() => mock.restore({ form: { razonSocial: 'QA Recuperada', cuit: mock.actor.cuit, email: mock.actor.email, telefono: '789' }, step: 1 }));
    expect(screen.getByLabelText('Razon Social *')).toHaveValue('QA Recuperada');
    expect(screen.getByLabelText('Telefono')).toHaveValue('789');
    expect(mock.draft.mock.calls.at(-1)![4]).toBe(true);
    expect(mock.update).not.toHaveBeenCalled();
  });
  if (actor.role !== 'TRANSPORTISTA') it('keeps both saved corrientes through draft restoration', () => {
    open();
    const saved = mock.draft.mock.calls.at(-1)![2];
    expect(saved.selectedY).toEqual(['Y8', 'Y9']);
    act(() => mock.restore(saved));
    expect(mock.draft.mock.calls.at(-1)![2].selectedY).toEqual(['Y8', 'Y9']);
    act(() => mock.restore({ ...saved, selectedY: ['Y8/Y9'] }));
    expect(mock.draft.mock.calls.at(-1)![2].selectedY).toEqual(['Y8', 'Y9']);
  });
  it('keeps errors and the data available after a failed save', async () => {
    open(); mock.update.mockRejectedValueOnce(new Error('QA conexión interrumpida'));
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '456' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Paso del registro' }), { target: { value: actor.last } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(screen.getByText('QA conexión interrumpida')).toBeVisible());
    expect(mock.navigate).not.toHaveBeenCalled();
    expect(mock.draft.mock.calls.at(-1)![2].form.telefono).toBe('456');
  });
  it('saves once, explicitly clears optional coordinates, and returns to the ficha', async () => {
    const list = open();
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '456' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Paso del registro' }), { target: { value: actor.last } });
    const save = screen.getByRole('button', { name: 'Guardar Cambios' });
    act(() => { fireEvent.click(save); fireEvent.click(save); });
    await waitFor(() => expect(mock.navigate).toHaveBeenCalledWith(list+'/qa?tab=historial', { state: { actorReturn: list+'?search=QA&page=2' } }));
    expect(mock.update).toHaveBeenCalledOnce();
    expect(mock.update.mock.calls[0][0].data).toMatchObject({ telefono: '456', latitud: null, longitud: null });
  });
});
