/**
 * Test Setup - Vitest Configuration
 * Runs before each test file
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Import fake-indexeddb for IndexedDB mocking
import 'fake-indexeddb/auto'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock navigator.mediaDevices for camera tests
const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [{
      stop: vi.fn(),
      kind: 'video',
    }],
  }),
  enumerateDevices: vi.fn().mockResolvedValue([]),
}

Object.defineProperty(navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true,
})

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
})

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn().mockImplementation((success) => {
    success({
      coords: {
        latitude: -32.8895,
        longitude: -68.8458,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    })
  }),
  watchPosition: vi.fn().mockReturnValue(1),
  clearWatch: vi.fn(),
}

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

// Mock window.AudioContext for QR scanner beep
class MockAudioContext {
  createOscillator() {
    return {
      connect: vi.fn(),
      frequency: { value: 0 },
      type: 'sine',
      start: vi.fn(),
      stop: vi.fn(),
    }
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: { value: 0 },
    }
  }
  destination = {}
}

// @ts-expect-error - Mock AudioContext
window.AudioContext = MockAudioContext
// @ts-expect-error - Mock webkitAudioContext
window.webkitAudioContext = MockAudioContext

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(Date.now()), 16)
})

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  clearTimeout(id)
})

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

vi.stubGlobal('ResizeObserver', MockResizeObserver)

// Suppress console.warn for expected warnings in tests
const originalWarn = console.warn
console.warn = (...args: unknown[]) => {
  // Suppress React 18/19 act warnings in tests
  if (typeof args[0] === 'string' && args[0].includes('act(')) return
  originalWarn(...args)
}
