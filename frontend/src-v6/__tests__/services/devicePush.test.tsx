import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/api', () => ({ default: mocks }));
import { registerDevicePush } from '../../hooks/usePushNotifications';
import { DeviceNotificationControl } from '../../components/DeviceNotificationControl';
let requestPermission: ReturnType<typeof vi.fn>;
const toJSON = () => ({ endpoint: 'https://push.qa.invalid/device' });
const registration = (scope: string) => ({ scope: location.origin + scope, active: {}, pushManager: { getSubscription: vi.fn().mockResolvedValue({ toJSON }), subscribe: vi.fn().mockResolvedValue({ toJSON }) } });
beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ data: { data: { publicKey: 'YWJj' } } }); mocks.post.mockReset().mockResolvedValue({});
  history.replaceState({}, '', '/notificaciones'); requestPermission = vi.fn().mockResolvedValue('granted');
  vi.stubGlobal('PushManager', function () {}); vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([registration('/')]) } });
});
afterEach(() => vi.unstubAllGlobals());

it('waits for an explicit tap before asking for the phone permission and confirms server subscription', async () => {
  render(<DeviceNotificationControl/>); const button = await screen.findByRole('button', { name: 'Activar avisos del teléfono' });
  expect(requestPermission).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(button); });
  expect(requestPermission).toHaveBeenCalledOnce(); expect(mocks.post).toHaveBeenCalledWith('/push/subscribe', toJSON());
  expect(await screen.findByText(/Este dispositivo quedó registrado/)).toBeVisible();
});
it('selects the exact worker scope, so a web registration does not silently subscribe the installed app', async () => {
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission }); const app = registration('/app/'), web = registration('/');
  vi.mocked(navigator.serviceWorker.getRegistrations).mockResolvedValue([app, web] as unknown as ServiceWorkerRegistration[]);
  expect(await registerDevicePush()).toBe('enabled'); expect(web.pushManager.getSubscription).toHaveBeenCalledOnce(); expect(app.pushManager.getSubscription).not.toHaveBeenCalled();
  history.replaceState({}, '', '/app/notificaciones');
  expect(await registerDevicePush()).toBe('enabled'); expect(app.pushManager.getSubscription).toHaveBeenCalledOnce(); expect(requestPermission).not.toHaveBeenCalled();
});
it('never falls back to the other app worker when the correct scope is absent', async () => {
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
  vi.mocked(navigator.serviceWorker.getRegistrations).mockResolvedValue([registration('/app/')] as unknown as ServiceWorkerRegistration[]);
  expect(await registerDevicePush()).toBe('worker-pending'); expect(mocks.post).not.toHaveBeenCalled();
});
it('does not ask for device permission when the channel is disabled or in training', async () => {
  mocks.get.mockResolvedValue({ data: { data: { publicKey: '' } } }); const view = render(<DeviceNotificationControl/>);
  expect(await screen.findByText(/Este canal todavía no está habilitado/)).toBeVisible(); expect(requestPermission).not.toHaveBeenCalled();
  view.unmount(); mocks.get.mockClear(); render(<DeviceNotificationControl training/>); expect(mocks.get).not.toHaveBeenCalled(); expect(requestPermission).not.toHaveBeenCalled();
});
it('does not claim activation after a failed registration or continue an old session', async () => {
  mocks.post.mockRejectedValue(new Error('Sin conexión')); render(<DeviceNotificationControl/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos del teléfono' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión'); expect(screen.queryByText(/Este dispositivo quedó registrado/)).toBeNull();
  mocks.post.mockClear(); await expect(registerDevicePush(false, () => false)).rejects.toThrow('sesión cambió'); expect(mocks.post).not.toHaveBeenCalled();
});
