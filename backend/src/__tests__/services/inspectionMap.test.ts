import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { validateInspectionMap } from '../../services/inspectionMap.service';
describe('mapa guardado', () => {
  it('admite una imagen PNG limitada y ausencia de mapa', async () => { const png = await sharp({ create: { width: 768, height: 432, channels: 3, background: '#ffffff' } }).png().toBuffer(); await expect(validateInspectionMap('data:image/png;base64,' + png.toString('base64'))).resolves.toBeUndefined(); await expect(validateInspectionMap()).resolves.toBeUndefined(); });
  it('rechaza SVG, datos corruptos y dimensiones excesivas', async () => { await expect(validateInspectionMap('data:image/svg+xml;base64,AAAA')).rejects.toThrow(); await expect(validateInspectionMap('data:image/png;base64,AAAA')).rejects.toThrow(); const png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#ffffff' } }).png().toBuffer(); await expect(validateInspectionMap('data:image/png;base64,' + png.toString('base64'))).rejects.toThrow(); });
});
