import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionLegalProgress } from '../../pages/inspecciones/InspectionLegalProgress';
import { inspectionLegalFollowUp, inspectionExchangeNextStep } from '../../pages/inspecciones/inspectionProcess';

const mocks = vi.hoisted(() => ({ transition: vi.fn() }));
vi.mock('../../services/inspeccion.service', () => ({ inspeccionService: { transition: mocks.transition } }));
vi.mock('../../hooks/useInspecciones', () => ({ useInspectionMutation: (fn: (input: unknown) => Promise<unknown>) => ({ mutateAsync: fn, isPending: false }) }));
vi.mock('../../components/ui/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const props = { id: 'qa-legal', state: 'DERIVADA_LEGALES' as const, version: 7, canManage: true, online: true };

describe('PSIP legal progress records existing administrative actions', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.transition.mockResolvedValue({}); });
  it('makes the next responsible party and the limit of the recorded derivation explicit', () => {
    expect(inspectionLegalFollowUp('DERIVADA_LEGALES')).toMatchObject({ next: 'EN_TRAMITE_LEGAL', step: 0 });
    expect(inspectionExchangeNextStep('DERIVADA_LEGALES', [], true).detail).toContain('no confirma recepción externa');
    expect(inspectionLegalFollowUp('EN_TRAMITE_LEGAL')).toMatchObject({ next: 'FINALIZADA', step: 1 });
    expect(inspectionLegalFollowUp('FINALIZADA')).toBeNull();
  });
  it('preserves legacy ATM without presenting a new ATM action or a payment control', () => {
    render(<InspectionLegalProgress {...props} state="DERIVADA_ATM" />);
    expect(screen.getByRole('status')).toHaveTextContent('no representa el control del ticket');
    expect(screen.queryByRole('button')).toBeNull();
    expect(mocks.transition).not.toHaveBeenCalled();
  });
  it('keeps inspector and inspected-party views read-only', () => {
    render(<InspectionLegalProgress {...props} canManage={false} />);
    expect(screen.getByRole('list', { name: 'Seguimiento de Legales' })).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('requires an explicit record and sends the original version and existing transition', async () => {
    render(<InspectionLegalProgress {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trámite legal' }));
    expect(screen.getByRole('button', { name: 'Confirmar registro' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Referencia QA EX-01. Constancia registrada en administración.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro' }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledWith('qa-legal', 7, 'EN_TRAMITE_LEGAL', { detalle: 'Referencia QA EX-01. Constancia registrada en administración.' }));
  });
  it('preserves entered text after a server conflict instead of silently retrying', async () => {
    mocks.transition.mockRejectedValue(new Error('Conflict'));
    render(<InspectionLegalProgress {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trámite legal' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Constancia QA que debe conservarse.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro' }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledOnce());
    expect(screen.getByRole('textbox')).toHaveValue('Constancia QA que debe conservarse.');
  });
  it('blocks a stale form even if refreshed props bring a newer version', () => {
    const view = render(<InspectionLegalProgress {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar trámite legal' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Constancia anterior QA.' } });
    view.rerender(<InspectionLegalProgress {...props} state="EN_TRAMITE_LEGAL" version={8} />);
    expect(screen.getByRole('alert')).toHaveTextContent('El expediente cambió');
    expect(screen.getByRole('textbox')).toHaveValue('Constancia anterior QA.');
    expect(screen.getByRole('button', { name: 'Confirmar registro' })).toBeDisabled();
    expect(mocks.transition).not.toHaveBeenCalled();
  });
  it('requires a deliberate finalization and never proposes ATM as an intermediate step', async () => {
    render(<InspectionLegalProgress {...props} state="EN_TRAMITE_LEGAL" />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar finalización' }));
    expect(screen.getByText(/Este resumen queda visible al inspeccionado/)).toBeVisible();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Resultado público QA, sin afirmar sanción ni firmeza.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro' }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledWith('qa-legal', 7, 'FINALIZADA', { detalle: 'Resultado público QA, sin afirmar sanción ni firmeza.' }));
  });
  it('does not offer an administrative write while offline', () => {
    render(<InspectionLegalProgress {...props} online={false} />);
    expect(screen.getByRole('button', { name: 'Registrar trámite legal' })).toBeDisabled();
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
