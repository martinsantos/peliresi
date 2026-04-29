/**
 * SITREP v6 - NotificationBell Unit Tests
 * Smoke-level: component renders, exports exist.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock AuthContext
vi.mock('@src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { id: 1, nombre: 'Test', email: 'test@test.com', rol: 'ADMIN' },
  })),
}));

// Mock notificacion service
vi.mock('@src/services/notificacion.service', () => ({
  notificacionService: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, noLeidas: 0, page: 1, limit: 5, totalPages: 1 }),
    marcarLeida: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock api
vi.mock('@src/services/api', () => ({
  getAccessToken: vi.fn(() => 'mock-token'),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export NotificationBell (wrapped in React.memo)', async () => {
    const { NotificationBell } = await import('@src/components/NotificationBell');
    // React.memo returns an object (MemoExoticComponent), not a function directly
    expect(NotificationBell).toBeDefined();
    expect(typeof NotificationBell).toBe('object');
  });

  it('should render the bell button', async () => {
    const { NotificationBell } = await import('@src/components/NotificationBell');
    const Wrapper = createWrapper();

    const { container } = render(
      React.createElement(Wrapper, null,
        React.createElement(NotificationBell)
      )
    );

    // The bell icon button should exist
    const button = container.querySelector('button');
    expect(button).toBeDefined();
    expect(button?.getAttribute('aria-label')).toContain('Notificaciones');
  });

  it('should render default export', async () => {
    const NotificationBellDefault = (await import('@src/components/NotificationBell')).default;
    // NotificationBell is exported as both named and default, both via React.memo
    expect(NotificationBellDefault).toBeDefined();
  });
});
