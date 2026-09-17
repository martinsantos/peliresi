/**
 * TEF is liquidated server-side only. Client data is declarative input and
 * never an authority for factorR or montoMxR.
 */
export const TEF_M_COEFICIENTE = 162;

const ZONAS: Record<string, number> = {
  parque_industrial: 0.75,
  zona_industrial: 1,
  zona_rural: 1.5,
  zona_urbana: 2,
};

const C_CORRIENTES: Record<string, number> = {
  Y4: 1.8, Y5: 1.5, Y6: 2, Y7: 1.5, Y8: 1.3, Y9: 1.5, Y10: 2, Y11: 1.8, Y12: 2, Y13: 2,
  Y14: 1.5, Y15: 2, Y16: 1.3, Y17: 1.5, Y18: 1.5, Y19: 1, Y20: 1.5, Y21: 1.5, Y22: 1.5,
  Y23: 1.5, Y24: 1.5, Y25: 1.5, Y26: 1.5, Y27: 1.5, Y28: 1.5, Y29: 1.5, Y30: 1,
  Y31: 1, Y32: 1.5, Y33: 1.5, Y34: 1.3, Y35: 1.3, Y36: 1, Y37: 1.8, Y38: 2, Y39: 2,
  Y40: 2, Y41: 1.8, Y42: 2, Y43: 2, Y44: 2, Y45: 1.8, Y48: 1.5,
};

export interface TefInputsServer {
  zona?: unknown;
  coefA?: Record<string, unknown>;
  coeficientesA?: Record<string, unknown>;
  personal?: unknown;
  potenciaHP?: unknown;
  superficieM2?: unknown;
}

export interface TefLiquidation {
  version: string;
  M: number;
  Z: number;
  A: number;
  D: number;
  C: number;
  R: number;
  MxR: number;
  calculatedAt: string;
}

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function calculateFinalTef(rawInputs: TefInputsServer, rawCorrientes: unknown): TefLiquidation {
  const inputs = rawInputs || {};
  const coefs = inputs.coefA || inputs.coeficientesA || {};
  let A = 0;
  Object.values(coefs).forEach((value) => { A += Math.min(n(value), 0.5); });
  const personal = n(inputs.personal);
  const potenciaHP = n(inputs.potenciaHP);
  const superficieM2 = n(inputs.superficieM2);
  const D = 0.15 * (personal + potenciaHP) + 0.005 * superficieM2;
  const zonaKey = String(inputs.zona || 'zona_rural');
  const Z = ZONAS[zonaKey] ?? 1;
  const corrientes = String(rawCorrientes || '').split(/[,;/]/).map((value) => value.trim().toUpperCase());
  let C = 0;
  corrientes.forEach((corriente) => { C = Math.max(C, C_CORRIENTES[corriente] || 0); });
  const R = Z * A * D * C;
  return {
    version: 'TEF-2026-D2625-99',
    M: TEF_M_COEFICIENTE,
    Z, A, D, C, R,
    MxR: TEF_M_COEFICIENTE * R,
    calculatedAt: new Date().toISOString(),
  };
}

export function sanitizeTefInputs(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as TefInputsServer;
  const coefs = input.coefA || input.coeficientesA || {};
  return {
    zona: String(input.zona || 'zona_rural'),
    coefA: Object.fromEntries(Object.entries(coefs).map(([key, value]) => [key, Math.min(n(value), 0.5)])),
    personal: n(input.personal),
    potenciaHP: n(input.potenciaHP),
    superficieM2: n(input.superficieM2),
  };
}
