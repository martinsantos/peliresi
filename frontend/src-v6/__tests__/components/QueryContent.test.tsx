import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryContent } from '../../components/ui/QueryContent';

describe('query recovery keyboard focus', () => {
  it.each([true, false])('restores focus at the result only if the user stayed at retry (%s)', stayed => {
    const refetch = vi.fn();
    const view = (isError: boolean, isFetching = false) => <><QueryContent query={{ isPending: false, isError, isFetching, refetch }}
      loading="Cargando…" error="No se pudo consultar." retryLabel="Reintentar documentos"><p>Documento disponible</p></QueryContent><button>Otra sección</button></>;
    const { rerender } = render(view(true));
    const retry = screen.getByRole('button', { name: 'Reintentar documentos' });
    retry.focus(); fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledOnce();
    rerender(view(true, true));
    expect(screen.getByRole('button', { name: 'Reintentando…' })).toBeDisabled();
    if (!stayed) screen.getByRole('button', { name: 'Otra sección' }).focus();
    rerender(view(false));
    expect(screen.getByRole('status')).toHaveTextContent('Consulta actualizada.');
    if (stayed) expect(screen.getByText('Documento disponible').parentElement).toHaveFocus();
    else expect(screen.getByRole('button', { name: 'Otra sección' })).toHaveFocus();
  });
});
