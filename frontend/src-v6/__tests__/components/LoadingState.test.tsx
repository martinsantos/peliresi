import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrandSpinner, FormSkeleton, PageLoader, SITREP_CYCLE_PATH } from '../../components/ui/LoadingState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/ButtonV2';

describe('shared branded loading', () => {
  it('uses the approved mark, not a new loading logo', () => {
    expect(readFileSync('public/favicon.svg', 'utf8')).toContain(SITREP_CYCLE_PATH);
    const { container } = render(<BrandSpinner size={18} />);
    expect(container.querySelectorAll('path')).toHaveLength(3);
    expect([...container.querySelectorAll('path')].map(path => path.getAttribute('transform'))).toEqual([
      'rotate(0 50 50)', 'rotate(120 50 50)', 'rotate(240 50 50)',
    ]);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
  it('announces initial loading once without interactive or invented fields', () => {
    const { container } = render(<FormSkeleton fields={8} />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando datos…');
    expect(container.querySelector('[data-form-skeleton]')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.sitrep-skeleton')).toHaveLength(17);
    expect(container.querySelectorAll('input, textarea, select, button')).toHaveLength(0);
    expect([...container.querySelectorAll('.sitrep-skeleton')].every(node => node.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
  it('keeps the button label and blocks a second submission while busy', () => {
    const submit = vi.fn();
    const view = render(<Button isLoading onClick={submit}>Guardar borrador</Button>);
    const button = screen.getByRole('button', { name: 'Guardar borrador' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(submit).not.toHaveBeenCalled();
    view.rerender(<Button onClick={submit}>Guardar borrador</Button>);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledOnce();
    expect(button.querySelector('[data-sitrep-cycle]')).toBeNull();
  });
  it('keeps table skeleton widths stable across renders', () => {
    const view = render(<SkeletonTable />);
    const widths = () => [...view.container.querySelectorAll<HTMLElement>('.sitrep-skeleton')].map(node => node.style.width);
    const before = widths();
    view.rerender(<SkeletonTable />);
    expect(widths()).toEqual(before);
    expect(before.length).toBeGreaterThan(0);
  });
  it('labels route loading without obsolete version text', () => {
    render(<PageLoader />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando SITREP…');
    expect(screen.queryByText(/v6/)).not.toBeInTheDocument();
  });
});
