import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActorDetailUnavailable } from '../../components/ActorDetailUnavailable';

describe('ficha load recovery', () => {
  it('explains the failed load with independent retry and return actions', () => {
    const retry = vi.fn(), back = vi.fn();
    render(<ActorDetailUnavailable onRetry={retry} onBack={back} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar la ficha');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce(); expect(back).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }));
    expect(back).toHaveBeenCalledOnce();
  });
});
