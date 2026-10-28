import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmManifestClosure } from '../../pages/manifiestos/components/ConfirmManifestClosure';
import ManifiestoActions from '../../pages/manifiestos/components/ManifiestoActions';
import { EstadoManifiesto } from '../../types/models';

describe('manifest closure confirmation', () => {
  it('explains why an earlier draft cannot be signed when three-party proposals are enabled', () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    const noop = vi.fn(), pending = { isPending: false };
    render(<ManifiestoActions manifiesto={{estado:EstadoManifiesto.BORRADOR,eventos:[]}} manifiestoId="qa"
      userRol="GENERADOR" isAdmin={false} isActionPending={false} isCancelling={false}
      mutations={{firmar:pending,confirmarRetiro:pending,confirmarEntrega:pending,confirmarRecepcion:pending,confirmarRecepcionInSitu:pending,pesaje:pending,registrarTratamiento:pending,cerrar:pending,rechazar:pending,registrarIncidente:pending,revertir:pending}}
      onCerrar={noop} onFirmar={noop} onConfirmarRetiro={noop} onConfirmarEntrega={noop} onConfirmarRecepcion={noop} onConfirmarRecepcionInSitu={noop}
      onPesaje={noop} onTratamiento={noop} onRechazar={noop} onIncidente={noop} onCancelar={noop} onRevertir={noop} onDescargarPDF={noop} onDescargarCertificado={noop} />);
    expect(screen.getByRole('region',{name:'Estado del borrador'})).toHaveTextContent('Las tres partes deben aprobar');
    expect(screen.queryByRole('button',{name:'Firmar Manifiesto'})).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
  it('opens the confirmation from the real action instead of closing on the first click', async () => {
    const onCerrar = vi.fn().mockResolvedValue(true), noop = vi.fn();
    const pending = { isPending: false };
    render(<ManifiestoActions manifiesto={{estado:EstadoManifiesto.EN_TRATAMIENTO,residuos:[]}} manifiestoId="qa"
      userRol="OPERADOR" isAdmin={false} isActionPending={false} isCancelling={false}
      mutations={{firmar:pending,confirmarRetiro:pending,confirmarEntrega:pending,confirmarRecepcion:pending,confirmarRecepcionInSitu:pending,pesaje:pending,registrarTratamiento:pending,cerrar:pending,rechazar:pending,registrarIncidente:pending,revertir:pending}}
      onCerrar={onCerrar} onFirmar={noop} onConfirmarRetiro={noop} onConfirmarEntrega={noop} onConfirmarRecepcion={noop} onConfirmarRecepcionInSitu={noop}
      onPesaje={noop} onTratamiento={noop} onRechazar={noop} onIncidente={noop} onCancelar={noop} onRevertir={noop} onDescargarPDF={noop} onDescargarCertificado={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Manifiesto' }));
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Cerrar manifiesto' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalledOnce());
  });
  it('allows returning without closing and warns when treatment has not been recorded', () => {
    const onConfirm = vi.fn().mockResolvedValue(true), onClose = vi.fn();
    render(<ConfirmManifestClosure open received onClose={onClose} onConfirm={onConfirm} />);
    expect(screen.getByText(/Todavía no se registró un tratamiento/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('requires confirmation and sends only once while the request is pending', async () => {
    let resolve!: (confirmed: boolean) => void;
    const onConfirm = vi.fn(() => new Promise<boolean>(done => { resolve = done; })), onClose = vi.fn();
    render(<ConfirmManifestClosure open received={false} onClose={onClose} onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: 'Confirmar cierre' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    resolve(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
  it('keeps the dialog available for a retry if the server does not confirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(false), onClose = vi.fn();
    render(<ConfirmManifestClosure open received={false} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se confirmó el cierre');
    expect(screen.getByRole('button', { name: 'Confirmar cierre' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
