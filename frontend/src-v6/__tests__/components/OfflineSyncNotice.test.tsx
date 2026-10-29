import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineSyncNotice } from '../../components/OfflineSyncNotice';

describe('OfflineSyncNotice', () => {
  it('explains a failed sync and offers a visible retry', () => {
    const retry = vi.fn(async () => {});
    render(<OfflineSyncNotice status={{ processed:0, pending:1, retryable:1, terminal:0, auth:0, skipped:0, syncing:false, lastError:'No se pudo enviar el punto', retry }} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 pendiente');
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo enviar el punto');
    fireEvent.click(screen.getByRole('button', { name:'Reintentar', exact:true }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows a storage error even when the pending count could not be read', () => {
    const retry = vi.fn(async () => {});
    render(<OfflineSyncNotice status={{ processed:0, pending:0, retryable:0, terminal:0, auth:0, skipped:0,
      syncing:false, lastError:'No se pudo abrir la copia local.', retry }} />);
    expect(screen.getByRole('status')).toHaveTextContent('No pudimos revisar la sincronización');
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo abrir la copia local.');
    fireEvent.click(screen.getByRole('button', { name:'Reintentar', exact:true }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('asks the person to return to the original activity instead of offering a retry there', () => {
    render(<OfflineSyncNotice status={{ processed:0,pending:1,retryable:1,terminal:0,auth:0,skipped:1,contextBlocked:1,
      syncing:false,lastError:'Volvé a la actividad donde guardaste el cambio.',retry:vi.fn(async()=>{}) }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cambios de otra actividad');
    expect(screen.getByRole('status')).toHaveTextContent('Volvé a la actividad');
    expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument();
  });

  it('preserves guidance for a mixture of other-activity and unidentified legacy changes', () => {
    render(<OfflineSyncNotice status={{ processed:0,pending:2,retryable:2,terminal:0,auth:0,skipped:2,contextBlocked:1,legacyBlocked:1,
      syncing:false,lastError:'Un cambio anterior no identifica su empresa.',retry:vi.fn(async()=>{}) }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Volvé a la actividad');
    expect(screen.getByRole('status')).toHaveTextContent('consultá a soporte');
    expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument();
  });

  it('reports a confirmed delivery when only the local copy could not be cleared', () => {
    render(<OfflineSyncNotice status={{ processed:1,pending:0,retryable:0,terminal:0,auth:0,skipped:0,cleanupError:true,
      syncing:false,lastError:'La entrega se confirmó, pero no se pudo actualizar la copia local.',retry:vi.fn(async()=>{}) }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrega confirmada');
    expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument();
  });
});
