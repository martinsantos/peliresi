import type { TEFInputs } from '../components/CalculadoraTEF';
import { A_OPTIONS, DEFAULT_A, ZONAS } from './calculoTEF';

function record(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { return record(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function magnitude(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** New declarations take precedence over a historical calculator snapshot. */
export function tefDeclaredInputs(declaration: unknown): { inputs: TEFInputs; missing: string[] } {
  const data = record(declaration), saved = record(data.tefInputs);
  const coefficients = record(saved.coefA ?? data.coefA);
  const coefA = { ...DEFAULT_A };
  for (const key of Object.keys(DEFAULT_A) as (keyof typeof DEFAULT_A)[]) {
    const value = magnitude(coefficients[key]);
    if (value !== null && A_OPTIONS[key].some(option => option.valor === value)) coefA[key] = value;
  }
  const personal = magnitude(data.tefPersonal ?? saved.personal ?? data.personal);
  const potenciaHP = magnitude(data.tefPotencia ?? saved.potenciaHP ?? data.potenciaHP);
  const superficieM2 = magnitude(data.tefSuperficie ?? saved.superficieM2 ?? data.superficieM2);
  const zona = data.tefZona ?? saved.zona ?? data.zona;
  const knownZone = ZONAS.find(item => item.id === zona);
  const missing = [personal === null ? 'personal' : '', potenciaHP === null ? 'potencia instalada' : '', superficieM2 === null ? 'superficie' : '', !knownZone ? 'zona' : ''].filter(Boolean);
  return { inputs: { zona: knownZone?.id || 'zona_rural', coefA, personal: personal ?? 0, potenciaHP: potenciaHP ?? 0, superficieM2: superficieM2 ?? 0 }, missing };
}
