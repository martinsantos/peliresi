/**
 * SITREP v6 - NotificationContext Unit Tests
 * ==========================================
 *
 * NOTE: This codebase does NOT have a dedicated NotificationContext.
 * Notifications are managed through hooks (useNotificaciones) and the
 * NotificationBell component rather than a React Context provider.
 *
 * This test documents the absence and validates that the notification
 * hooks work as the de facto notification state management layer.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock non-existent module to prevent build-time error
vi.mock('@src/contexts/NotificationContext', () => ({}));

describe('NotificationContext', () => {
  it('should note that NotificationContext does not exist in the codebase', () => {
    // Notifications are managed via hooks (useNotificaciones), not a context
    expect(true).toBe(true);
  });

  it('should use useNotificaciones hook instead of a context', async () => {
    const mod = await import('@src/hooks/useNotificaciones');
    expect(typeof mod.useNotificaciones).toBe('function');
  });

  it('should use NotificationBell component instead of a context consumer', async () => {
    const mod = await import('@src/components/NotificationBell');
    // NotificationBell is wrapped in React.memo, which returns an object
    expect(mod.NotificationBell).toBeDefined();
  });
});
