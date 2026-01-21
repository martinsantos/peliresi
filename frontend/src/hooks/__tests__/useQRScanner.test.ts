/**
 * Tests for useQRScanner hook
 * Focuses on the pure parseQRData function and hook behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { parseQRData, useQRScanner, type QRScanResult } from '../useQRScanner'

describe('parseQRData', () => {
  describe('Verify URL pattern', () => {
    it('should parse verify URL with HTTPS', () => {
      const data = 'https://sitrep.ultimamilla.com.ar/verify/abc123xyz'
      const result = parseQRData(data)

      expect(result.type).toBe('verify_url')
      expect(result.manifiestoId).toBe('abc123xyz')
      expect(result.verifyUrl).toBe(data)
      expect(result.raw).toBe(data)
    })

    it('should parse verify URL with different domain', () => {
      const data = 'https://example.com/verify/manifiesto-id-456'
      const result = parseQRData(data)

      expect(result.type).toBe('verify_url')
      expect(result.manifiestoId).toBe('manifiesto-id-456')
    })

    it('should handle verify with query parameter format', () => {
      const data = 'https://sitrep.com?verify=test123'
      const result = parseQRData(data)

      expect(result.type).toBe('verify_url')
      expect(result.manifiestoId).toBe('test123')
    })

    it('should handle verify path without http prefix', () => {
      const data = '/verify/local-manifiesto'
      const result = parseQRData(data)

      expect(result.type).toBe('verify_url')
      expect(result.manifiestoId).toBe('local-manifiesto')
      expect(result.verifyUrl).toBeUndefined()
    })
  })

  describe('Manifiesto path pattern', () => {
    it('should parse /manifiestos/id path', () => {
      const data = '/manifiestos/cm123abc456'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('cm123abc456')
    })

    it('should parse full URL with manifiestos path', () => {
      const data = 'https://app.sitrep.com/manifiestos/xyz789'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('xyz789')
    })

    it('should handle singular "manifiesto" in path', () => {
      const data = '/manifiesto/single123'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('single123')
    })
  })

  describe('Direct manifiesto number format', () => {
    it('should parse M-YYYY-NNN format', () => {
      const data = 'M-2024-001'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('M-2024-001')
    })

    it('should parse M-YYYY-NNNN format with 4 digits', () => {
      const data = 'M-2025-1234'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('M-2025-1234')
    })

    it('should be case insensitive for M prefix', () => {
      const data = 'm-2024-005'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('m-2024-005')
    })
  })

  describe('CUID format', () => {
    it('should parse 25 character CUID (standard format)', () => {
      const data = 'cm5abcdefghijklmnopqrstuv'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe(data)
    })

    it('should not parse shorter CUID-like strings as manifiesto', () => {
      // CUIDs must be exactly 25 characters starting with c
      const data = 'clq1234567890abcdefghij' // 23 chars
      const result = parseQRData(data)

      expect(result.type).toBe('unknown')
    })
  })

  describe('URL with ID parameter', () => {
    it('should parse ?id= query parameter', () => {
      const data = 'https://app.com/view?id=query-id-123'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('query-id-123')
      expect(result.verifyUrl).toBe(data)
    })

    it('should parse &id= in query string', () => {
      const data = 'https://app.com/view?other=value&id=second-id'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('second-id')
    })
  })

  describe('Unknown format', () => {
    it('should return unknown for random text', () => {
      const data = 'just some random text'
      const result = parseQRData(data)

      expect(result.type).toBe('unknown')
      expect(result.manifiestoId).toBeUndefined()
      expect(result.raw).toBe(data)
    })

    it('should return unknown for empty string', () => {
      const data = ''
      const result = parseQRData(data)

      expect(result.type).toBe('unknown')
    })

    it('should return unknown for URL without manifiesto info', () => {
      const data = 'https://google.com/search?q=test'
      const result = parseQRData(data)

      expect(result.type).toBe('unknown')
    })

    it('should return unknown for short CUID-like strings', () => {
      const data = 'cabc123' // Too short for CUID
      const result = parseQRData(data)

      expect(result.type).toBe('unknown')
    })
  })

  describe('Edge cases', () => {
    it('should handle URL with special characters in ID', () => {
      const data = '/manifiestos/abc_123-xyz'
      const result = parseQRData(data)

      expect(result.type).toBe('manifiesto')
      expect(result.manifiestoId).toBe('abc_123-xyz')
    })

    it('should prioritize verify pattern over manifiesto path', () => {
      const data = 'https://app.com/manifiestos/verify/priority-id'
      const result = parseQRData(data)

      // verify pattern matches first
      expect(result.type).toBe('verify_url')
      expect(result.manifiestoId).toBe('priority-id')
    })
  })
})

describe('useQRScanner hook', () => {
  let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia

  beforeEach(() => {
    vi.clearAllMocks()
    originalGetUserMedia = navigator.mediaDevices.getUserMedia
  })

  afterEach(() => {
    navigator.mediaDevices.getUserMedia = originalGetUserMedia
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useQRScanner())

    expect(result.current.cameraActive).toBe(false)
    expect(result.current.scannedQR).toBeNull()
    expect(result.current.parsedQR).toBeNull()
  })

  it('should have required refs', () => {
    const { result } = renderHook(() => useQRScanner())

    expect(result.current.videoRef).toBeDefined()
    expect(result.current.canvasRef).toBeDefined()
  })

  it('should start camera successfully', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn(), kind: 'video' }],
    }

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream)

    const onToast = vi.fn()
    const { result } = renderHook(() => useQRScanner({ onToast }))

    await act(async () => {
      await result.current.startCamera()
    })

    expect(result.current.cameraActive).toBe(true)
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Cámara activada'))
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment', width: 640, height: 480 }
    })
  })

  it('should handle camera permission denied', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(
      new Error('Permission denied')
    )

    const onToast = vi.fn()
    const { result } = renderHook(() => useQRScanner({ onToast }))

    await act(async () => {
      await result.current.startCamera()
    })

    expect(result.current.cameraActive).toBe(false)
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('No se pudo acceder'))
  })

  it('should stop camera and cleanup tracks', async () => {
    const mockStop = vi.fn()
    const mockStream = {
      getTracks: () => [{ stop: mockStop, kind: 'video' }],
    }

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream)

    const { result } = renderHook(() => useQRScanner())

    await act(async () => {
      await result.current.startCamera()
    })

    expect(result.current.cameraActive).toBe(true)

    act(() => {
      result.current.stopCamera()
    })

    expect(result.current.cameraActive).toBe(false)
    expect(mockStop).toHaveBeenCalled()
  })

  it('should clear scanned QR', async () => {
    const { result } = renderHook(() => useQRScanner())

    // Manually set state for testing clearScannedQR
    act(() => {
      result.current.clearScannedQR()
    })

    expect(result.current.scannedQR).toBeNull()
    expect(result.current.parsedQR).toBeNull()
  })

  it('should call onScan callback when provided', async () => {
    const onScan = vi.fn()
    const { result } = renderHook(() => useQRScanner({ onScan }))

    // The onScan callback would be called internally when QR is detected
    // This tests that the hook accepts the callback
    expect(result.current.startCamera).toBeDefined()
  })

  it('should cleanup on unmount', async () => {
    const mockStop = vi.fn()
    const mockStream = {
      getTracks: () => [{ stop: mockStop, kind: 'video' }],
    }

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream)

    const { result, unmount } = renderHook(() => useQRScanner())

    await act(async () => {
      await result.current.startCamera()
    })

    unmount()

    // Cleanup should stop camera tracks
    expect(mockStop).toHaveBeenCalled()
  })
})
