import '@testing-library/jest-dom/vitest';

// ========================================
// Mock window.matchMedia (responsive components)
// ========================================
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ========================================
// Mock IntersectionObserver
// ========================================
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// ========================================
// Mock navigator.geolocation (GPS features)
// ========================================
Object.defineProperty(navigator, 'geolocation', {
  writable: true,
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn().mockReturnValue(1),
    clearWatch: vi.fn(),
  },
});

// ========================================
// Mock import.meta.env defaults
// ========================================
// Vitest already provides import.meta.env; this is a safety net
if (!import.meta.env.VITE_API_URL) {
  (import.meta.env as Record<string, string>).VITE_API_URL = '/api';
}
