import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gpsQueueKey } from '../../../services/gpsQueue';

const mock = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('../../../services/gpsReceipts', () => ({ verifyStoredGpsReceipts: mock.verify }));
import { PendingGpsReceipts } from '../../../components/mobile/PendingGpsReceipts';

const point = { lat: -33.1, lng: -68.9, speed: null, heading: null, puntoId: '2d65f4f5-6892-42e1-958d-bd23b6d54a76' };
const key = gpsQueueKey('carrier-a', 'trip', 'transport-context');
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => localStorage.clear());

it('stays out of the way when there are no saved points', () => {
  render(<PendingGpsReceipts ownerId="carrier-a" contextOwner="transport-context" manifestId="trip" />);
  expect(screen.queryByRole('region', { name: 'Comprobar recepción de ubicaciones' })).toBeNull();
});

it('reports confirmed and unconfirmed points while preserving the stored queue', async () => {
  const raw = JSON.stringify([point]); localStorage.setItem(key, raw);
  mock.verify.mockResolvedValue({ checked: 1, confirmed: 1, unconfirmed: 0 });
  render(<PendingGpsReceipts ownerId="carrier-a" contextOwner="transport-context" manifestId="trip" />);
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar recepción' }));
  expect(await screen.findByRole('status')).toHaveTextContent('SITREP confirmó 1 de 1');
  expect(localStorage.getItem(key)).toBe(raw); expect(mock.verify).toHaveBeenCalledOnce();
});

it('keeps unconfirmed and old unowned points visible for support', async () => {
  localStorage.setItem(key, JSON.stringify([point]));
  mock.verify.mockResolvedValue({ checked: 1, confirmed: 0, unconfirmed: 1 });
  const { unmount } = render(<PendingGpsReceipts ownerId="carrier-a" contextOwner="transport-context" manifestId="trip" />);
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar recepción' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Las no confirmadas siguen guardadas');
  unmount(); localStorage.clear(); localStorage.setItem('gps_pending_trip', JSON.stringify([point]));
  render(<PendingGpsReceipts ownerId="carrier-a" contextOwner="transport-context" manifestId="trip" />);
  expect(screen.getByRole('alert')).toHaveTextContent('sin titular identificado');
  expect(screen.queryByRole('button', { name: 'Comprobar recepción' })).toBeNull();
});

it('clears the old result when another tab changes storage', async () => {
  localStorage.setItem(key, JSON.stringify([point])); mock.verify.mockResolvedValue({ checked: 1, confirmed: 1, unconfirmed: 0 });
  render(<PendingGpsReceipts ownerId="carrier-a" contextOwner="transport-context" manifestId="trip" />);
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar recepción' })); await screen.findByRole('status');
  act(() => { localStorage.removeItem(key); window.dispatchEvent(new StorageEvent('storage', { key })); });
  expect(screen.queryByRole('region', { name: 'Comprobar recepción de ubicaciones' })).toBeNull();
});

it('preserves account-only locations for review rather than attributing them to the active activity', () => {
  const oldKey = gpsQueueKey('carrier-a', 'trip'); const raw = JSON.stringify([point]);
  localStorage.setItem(oldKey, raw);
  render(<PendingGpsReceipts ownerId="carrier-a" contextOwner="transport-context" manifestId="trip" />);
  expect(screen.getByRole('alert')).toHaveTextContent('sin actividad identificada');
  expect(screen.queryByRole('button', { name: 'Comprobar recepción' })).toBeNull();
  expect(localStorage.getItem(oldKey)).toBe(raw); expect(mock.verify).not.toHaveBeenCalled();
});
