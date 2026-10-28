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
});
