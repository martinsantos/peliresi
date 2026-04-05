/**
 * Tests for src-v6/services/api.ts
 * Token helpers + axios instance configuration
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Must import AFTER setup.ts mocks are applied
import { api, getAccessToken, getRefreshToken, setTokens, clearTokens } from '../../services/api';

const TOKEN_KEY = 'sitrep_access_token';
const REFRESH_TOKEN_KEY = 'sitrep_refresh_token';

describe('api.ts — API client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ========================================
  // Token helpers
  // ========================================

  describe('getAccessToken()', () => {
    it('returns null when no token stored', () => {
      expect(getAccessToken()).toBeNull();
    });

    it('returns stored token', () => {
      localStorage.setItem(TOKEN_KEY, 'test-token-abc');
      expect(getAccessToken()).toBe('test-token-abc');
    });
  });

  describe('getRefreshToken()', () => {
    it('returns null when no refresh token stored', () => {
      expect(getRefreshToken()).toBeNull();
    });

    it('returns stored refresh token', () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-xyz');
      expect(getRefreshToken()).toBe('refresh-xyz');
    });
  });

  describe('setTokens()', () => {
    it('stores both access and refresh tokens in localStorage', () => {
      setTokens('access-123', 'refresh-456');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('access-123');
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-456');
    });

    it('overwrites previous tokens', () => {
      setTokens('old-access', 'old-refresh');
      setTokens('new-access', 'new-refresh');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('new-access');
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('new-refresh');
    });
  });

  describe('clearTokens()', () => {
    it('removes both tokens from localStorage', () => {
      setTokens('a', 'b');
      clearTokens();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });

    it('is safe to call when no tokens exist', () => {
      expect(() => clearTokens()).not.toThrow();
    });
  });

  // ========================================
  // Axios instance
  // ========================================

  describe('axios instance', () => {
    it('exports an axios instance', () => {
      expect(api).toBeDefined();
      expect(typeof api.get).toBe('function');
      expect(typeof api.post).toBe('function');
      expect(typeof api.put).toBe('function');
      expect(typeof api.delete).toBe('function');
    });

    it('has baseURL configured to /api', () => {
      // import.meta.env.VITE_API_URL defaults to /api in test env
      expect(api.defaults.baseURL).toBe('/api');
    });

    it('has Content-Type JSON header', () => {
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('has 30s timeout', () => {
      expect(api.defaults.timeout).toBe(30000);
    });
  });
});
