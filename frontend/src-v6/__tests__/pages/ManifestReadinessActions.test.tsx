import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ManifiestoActions from '../../pages/manifiestos/components/ManifiestoActions';
import { EstadoManifiesto, type Manifiesto } from '../../types/models';

vi.mock('../../pages/manifiestos/components/ManifestProposalApprovals', () => ({ ManifestProposalApprovals: () => <div>Panel de aprobaciones</div> }));
// Has its own data query and tests (GeneratorCurrentException.test.tsx); this suite checks readiness only.
vi.mock('../../pages/manifiestos/components/GeneratorCurrentExceptionPanel', () => ({ GeneratorCurrentExceptionPanel: () => null }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'qa-user', rol: 'GENERADOR', actorId: 'qa-actor' }, isRestricted: false }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: null }) }));
const pending = { isPending: false };
const marker = [{ tipo: 'PROPUESTA_PARTES_V1' }] as NonNullable<Manifiesto['eventos']>;
const mutations = { firmar: pending, confirmarRetiro: pending, confirmarEntrega: pending, confirmarRecepcion: pending, confirmarRecepcionInSitu: pending, pesaje: pending, registrarTratamiento: pending, cerrar: pending, rechazar: pending, registrarIncidente: pending, revertir: pending };
function mount(manifiesto: Partial<Manifiesto>, role = 'TRANSPORTISTA', isInSitu = false, isAdmin = false) {
  const noop = vi.fn(), reload = vi.fn(), action = vi.fn();
  const view = render(<MemoryRouter><ManifiestoActions manifiesto={manifiesto} manifiestoId="qa" userRol={role} isAdmin={isAdmin} isActionPending={false} isCancelling={false} isInSitu={isInSitu} mutations={mutations}
    onRetryApprovalCheck={reload} onCerrar={noop} onFirmar={noop} onConfirmarRetiro={action} onConfirmarEntrega={noop} onConfirmarRecepcion={noop} onConfirmarRecepcionInSitu={action}
    onPesaje={noop} onTratamiento={noop} onRechazar={noop} onIncidente={noop} onCancelar={noop} onRevertir={noop} onDescargarPDF={noop} onDescargarCertificado={noop} /></MemoryRouter>);
  return { ...view, reload, action };
}
describe('physical start uses the server readiness of the complete proposal', () => {
  it('offers the separate proposal form for a historical draft without enabling the old manifest', () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    mount({ estado: EstadoManifiesto.BORRADOR, eventos: [] }, 'GENERADOR');
    expect(screen.getByRole('link', { name: 'Abrir nueva propuesta' })).toHaveAttribute('href', '/manifiestos/nuevo');
    expect(screen.getByText(/Las tres partes deben aprobar antes de iniciar/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Firmar Manifiesto' })).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
  it.each(['INCONSISTENTE', 'RECHAZADA', 'FALTAN_APROBACIONES', 'FALTA_COORDINACION', undefined] as const)('blocks pickup when readiness is %s', state => {
    const { action } = mount({ estado: EstadoManifiesto.APROBADO, eventos: marker, aprobacionOperacion: state });
    const button = screen.getByRole('button', { name: 'Confirmar Retiro' });
    expect(button).toBeDisabled(); fireEvent.click(button); expect(action).not.toHaveBeenCalled();
    if (state === 'INCONSISTENTE' || state === 'RECHAZADA') expect(screen.getByRole('alert')).toHaveTextContent('Contactá a Ambiente');
  });
  it('allows the action when the server verifies all decisions and coordination', () => {
    const { action } = mount({ estado: EstadoManifiesto.APROBADO, eventos: marker, aprobacionOperacion: 'LISTA' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Retiro' }));
    expect(action).toHaveBeenCalledOnce();
  });
  it('also blocks in-situ receipt for an inconsistent proposal', () => {
    mount({ estado: EstadoManifiesto.APROBADO, eventos: marker, aprobacionOperacion: 'INCONSISTENTE', transportistaId: 't' }, 'OPERADOR', true);
    expect(screen.getByRole('button', { name: 'Confirmar recepción en origen' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Contactá a Ambiente');
  });
  it('offers an explicit retry if readiness was not received', () => {
    const { reload } = mount({ estado: EstadoManifiesto.APROBADO, eventos: marker });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar manifiesto' }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it.each(['GENERADOR', 'TRANSPORTISTA', 'ADMIN'])('explains treatment as the operator’s work for %s', role => {
    mount({ estado: EstadoManifiesto.EN_TRATAMIENTO }, role);
    expect(screen.getByText('Le toca a:').parentElement).toHaveTextContent('Operador');
    fireEvent.click(screen.getByText('Cómo continuar'));
    expect(screen.getByText(/^El operador puede emitir parciales/)).toBeVisible();
    expect(screen.queryByText(/^Podés emitir parciales/)).not.toBeInTheDocument();
  });
  it('keeps direct treatment guidance for the operator', () => {
    mount({ estado: EstadoManifiesto.EN_TRATAMIENTO }, 'OPERADOR');
    fireEvent.click(screen.getByText('Cómo continuar'));
    expect(screen.getByText(/^Podés emitir parciales/)).toBeVisible();
  });
  it.each([undefined, []])('blocks weighing, treatment and closure until unavailable waste details are refreshed: %j', residuos => {
    const { reload, unmount } = mount({ estado: EstadoManifiesto.RECIBIDO, residuos }, 'OPERADOR');
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos comprobar el pesaje');
    expect(screen.getByText('Pesaje por comprobar')).toBeVisible();
    for (const name of ['Registrar Pesaje', 'Registrar Tratamiento', 'Cerrar Manifiesto']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar manifiesto' }));
    expect(reload).toHaveBeenCalledOnce();
    unmount();
    mount({ estado: EstadoManifiesto.RECIBIDO, residuos: [{ cantidadRecibida: 12 }] } as unknown as Partial<Manifiesto>, 'OPERADOR');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar Tratamiento' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cerrar Manifiesto' })).toBeEnabled();
  });
  it('also prevents an administrator from acting while the waste details are unavailable', () => {
    mount({ estado: EstadoManifiesto.RECIBIDO, residuos: [] }, 'ADMIN', false, true);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos comprobar el pesaje');
    for (const name of ['Registrar Pesaje', 'Registrar Tratamiento', 'Cerrar Manifiesto']) expect(screen.getByRole('button', { name })).toBeDisabled();
  });
  it('directs a pending record without a proposal to review rather than displaying a fictitious approval', () => {
    mount({ estado: EstadoManifiesto.PENDIENTE_APROBACION, eventos: [] }, 'GENERADOR');
    expect(screen.getByRole('alert')).toHaveTextContent('Contactá a Ambiente');
    expect(screen.queryByRole('button', { name: 'Firmar Manifiesto' })).not.toBeInTheDocument();
  });
});

describe('rejection presentation follows recorded events',()=>{
 it('does not describe a refused proposal as rejected cargo or duplicate its guidance',()=>{
  vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');
  mount({estado:EstadoManifiesto.RECHAZADO,eventos:[...marker,{tipo:'RECHAZO_PARTE'}] as NonNullable<Manifiesto['eventos']>},'OPERADOR');
  expect(screen.getByText('Panel de aprobaciones')).toBeVisible();
  expect(screen.queryByText('Carga rechazada')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Próximo paso del manifiesto')).not.toBeInTheDocument();
  vi.unstubAllEnvs();
 });
 it('retains load rejection when the operator actually rejected the delivery',()=>{
  mount({estado:EstadoManifiesto.RECHAZADO,eventos:[...marker,{tipo:'RECHAZO'}] as NonNullable<Manifiesto['eventos']>},'OPERADOR');
  expect(screen.getByText('Carga rechazada')).toBeVisible();
 });
 it('still identifies a refused participation when proposal actions are disabled',()=>{
  vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','false');
  mount({estado:EstadoManifiesto.RECHAZADO,eventos:[...marker,{tipo:'RECHAZO_PARTE'}] as NonNullable<Manifiesto['eventos']>},'OPERADOR');
  expect(screen.getByText('Propuesta detenida')).toBeVisible();
  expect(screen.queryByText('Carga rechazada')).not.toBeInTheDocument();
  vi.unstubAllEnvs();
 });
 it('asks for review when no rejection type is recorded',()=>{
  mount({estado:EstadoManifiesto.RECHAZADO,eventos:[]},'OPERADOR');
  expect(screen.getByText('Rechazo por comprobar')).toBeVisible();
 });
});
