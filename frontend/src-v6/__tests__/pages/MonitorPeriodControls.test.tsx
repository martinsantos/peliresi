import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimelineControls } from '../../pages/monitor/components/TimelineControls';
afterEach(cleanup);
const props = { mode: 'PLAYBACK' as const, liveData: null, playbackDate: '2026-09-05', timelineData: null, isLoading: false, playback: null, onDateChange: vi.fn(), onSwitchToPlayback: vi.fn(), activeDays: ['2026-09-05', '2026-09-06'] };
it('exposes a thirty-day period without automatically opening search or losing the selected range', () => {
  const change = vi.fn(); render(<TimelineControls {...props} onPeriodChange={change} />);
  const select = screen.getByRole('button', { name: 'Período de reproducción' });
  expect(select).not.toHaveFocus(); fireEvent.click(select);
  expect(screen.getByRole('listbox', { name: 'Período de reproducción' })).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: 'Últimos 30 días' }));
  expect(change).toHaveBeenCalledWith(30); expect(select).toHaveFocus();
});
it('Escape closes only the shared selector and preserves the current period', () => {
  const change = vi.fn(); render(<TimelineControls {...props} playbackDias={30} onPeriodChange={change} />);
  const trigger = screen.getByRole('button', { name: 'Período de reproducción' }); fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('option', { name: 'Últimos 30 días' }), { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(trigger).toHaveTextContent('Últimos 30 días');
  expect(trigger).toHaveFocus(); expect(change).not.toHaveBeenCalled();
});
it('a monthly movie shows both dates and does not navigate or auto-continue to overlapping single days', () => {
  render(<TimelineControls {...props} playbackDias={30} onPeriodChange={vi.fn()} onAutoContinueToggle={vi.fn()} />);
  expect(screen.getByText('05 de sept de 2026 — 04 de oct de 2026')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Día activo siguiente' })).not.toBeInTheDocument();
});
