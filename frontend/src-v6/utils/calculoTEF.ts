/**
 * Calculo TEF - Tasa de Evaluacion y Fiscalizacion
 * Decreto 2625/99 - Ley 5917 (Mendoza)
 *
 * Formula: TEF = M x R x ISO_factor
 * Donde:   R = Z x A x D x C
 */

// M: Coeficiente anual de fiscalizacion (lo fija la autoridad cada ano)
export const M_COEFICIENTE = 162;

// Z: Coeficiente zonal
export const ZONAS = [
  { id: 'parque_industrial', label: 'Parque Industrial', valor: 0.75 },
  { id: 'zona_industrial', label: 'Zona Industrial Exclusiva', valor: 1 },
  { id: 'zona_rural', label: 'Zona Rural', valor: 1.5 },
  { id: 'zona_urbana', label: 'Zona Urbana', valor: 2 },
] as const;

// A: Coeficientes de peligrosidad ambiental (A1..A10)
export interface CoeficientesA {
  a1_stock: number;       // 0, 0.125, 0.25, 0.5
  a2_almacenamiento: number; // 0, 0.25, 0.5
  a3_peligrosidad: number;   // 0, 0.25, 0.5
  a4_tratabilidad: number;   // 0, 0.25, 0.5
  a5_transporte: number;     // 0, 0.125, 0.25, 0.5
  a6_contingencia: number;   // 0, 0.125, 0.25, 0.5
  a7_monitoreo: number;      // 0, 0.125, 0.25, 0.5
  a8_instalMonitoreo: number; // 0, 0.25, 0.5
  a9_instalGenerales: number; // 0, 0.25, 0.5
  a10_idoneidad: number;     // 0, 0.25, 0.5
}

export const A_OPTIONS = {
  a1_stock: [
    { label: 'Nulo', valor: 0 },
    { label: 'Menores de 50 kg', valor: 0.125 },
    { label: 'Entre 100 y 50 kg', valor: 0.25 },
    { label: 'Mayores de 100 kg', valor: 0.5 },
  ],
  a2_almacenamiento: [
    { label: 'Muy Bueno', valor: 0 },
    { label: 'Bueno', valor: 0.25 },
    { label: 'Regular', valor: 0.5 },
  ],
  a3_peligrosidad: [
    { label: 'Con Bajo Riesgo', valor: 0 },
    { label: 'Riesgo Moderado', valor: 0.25 },
    { label: 'Riesgo Severo', valor: 0.5 },
  ],
  a4_tratabilidad: [
    { label: 'Sin necesidad de tratamiento', valor: 0 },
    { label: 'De tratamientos convencionales', valor: 0.25 },
    { label: 'Dificultoso de tratar', valor: 0.5 },
  ],
  a5_transporte: [
    { label: 'No requiere transporte', valor: 0 },
    { label: 'Bajo riesgo en su transporte', valor: 0.125 },
    { label: 'Requieren cuidados', valor: 0.25 },
    { label: 'Requieren cuidados especiales', valor: 0.5 },
  ],
  a6_contingencia: [
    { label: 'Excelente nivel', valor: 0 },
    { label: 'De buen nivel', valor: 0.125 },
    { label: 'Mejorables', valor: 0.25 },
    { label: 'Elementales', valor: 0.5 },
  ],
  a7_monitoreo: [
    { label: 'Excelente nivel', valor: 0 },
    { label: 'De buen nivel', valor: 0.125 },
    { label: 'Mejorables', valor: 0.25 },
    { label: 'Elementales', valor: 0.5 },
  ],
  a8_instalMonitoreo: [
    { label: 'Adecuadas para monitorear', valor: 0 },
    { label: 'En regulares condiciones', valor: 0.25 },
    { label: 'Basicas muy mejorables', valor: 0.5 },
  ],
  a9_instalGenerales: [
    { label: 'De excelente nivel y conservacion', valor: 0 },
    { label: 'De buen nivel y conservacion', valor: 0.25 },
    { label: 'De regular nivel y conservacion', valor: 0.5 },
  ],
  a10_idoneidad: [
    { label: 'Excelente conciencia ambiental', valor: 0 },
    { label: 'Buen nivel', valor: 0.25 },
    { label: 'Debe ser mejorada', valor: 0.5 },
  ],
} as const;

export const A_LABELS: Record<keyof CoeficientesA, string> = {
  a1_stock: 'A1: Stock de Residuos',
  a2_almacenamiento: 'A2: Sitios de Almacenamiento',
  a3_peligrosidad: 'A3: Peligrosidad por Contingencias',
  a4_tratabilidad: 'A4: Grado de Tratabilidad',
  a5_transporte: 'A5: Formas de Transporte',
  a6_contingencia: 'A6: Planes de Contingencia',
  a7_monitoreo: 'A7: Plan de Monitoreo',
  a8_instalMonitoreo: 'A8: Instalaciones de Monitoreo',
  a9_instalGenerales: 'A9: Instalaciones Generales',
  a10_idoneidad: 'A10: Idoneidad del Personal',
};

// C: Coeficiente por corriente Y (peligrosidad del residuo)
export const C_CORRIENTES: Record<string, number> = {
  Y4: 1.8, Y5: 1.5, Y6: 2, Y7: 1.5, Y8: 1.3, Y9: 1.5,
  Y10: 2, Y11: 1.8, Y12: 2, Y13: 2, Y14: 1.5, Y15: 2,
  Y16: 1.3, Y17: 1.5, Y18: 1.5, Y19: 1, Y20: 1.5,
  Y21: 1.5, Y22: 1.5, Y23: 1.5, Y24: 1.5, Y25: 1.5,
  Y26: 1.5, Y27: 1.5, Y28: 1.5, Y29: 1.5, Y30: 1,
  Y31: 1, Y32: 1.5, Y33: 1.5, Y34: 1.3, Y35: 1.3,
  Y36: 1, Y37: 1.8, Y38: 2, Y39: 2, Y40: 2,
  Y41: 1.8, Y42: 2, Y43: 2, Y44: 2, Y45: 1.8, Y48: 1.5,
};

// D: Coeficiente de magnitud
// D = 0.15 x (P + HP) + 0.005 x S
export function calcularD(personal: number, potenciaHP: number, superficieM2: number): number {
  return 0.15 * (personal + potenciaHP) + 0.005 * superficieM2;
}

// A: Sumatoria de A1..A10
export function calcularA(coefs: CoeficientesA): number {
  return Object.values(coefs).reduce((sum, v) => sum + v, 0);
}

// C: Maximo coeficiente de las corrientes Y del generador
export function calcularC(corrientesY: string[]): number {
  if (corrientesY.length === 0) return 0;
  return Math.max(...corrientesY.map(y => C_CORRIENTES[y.trim()] || 0));
}

// R: Indice de riesgo
export function calcularR(Z: number, A: number, D: number, C: number): number {
  return Z * A * D * C;
}

// ISO factor
export function isoFactor(tieneISO: boolean): number {
  return tieneISO ? 2 : 1;
}

// TEF final
export interface TEFInput {
  zona: string;
  coeficientesA: CoeficientesA;
  personal: number;
  potenciaHP: number;
  superficieM2: number;
  corrientesY: string[];
  tieneISO: boolean;
  m?: number; // permite override del coeficiente anual
}

export interface TEFResult {
  M: number;
  Z: number;
  A: number;
  D: number;
  C: number;
  R: number;
  ISO: number;
  TEF: number;
}

export function calcularTEF(input: TEFInput): TEFResult {
  const M = input.m ?? M_COEFICIENTE;
  const zonaObj = ZONAS.find(z => z.id === input.zona);
  const Z = zonaObj?.valor ?? 1;
  const A = calcularA(input.coeficientesA);
  const D = calcularD(input.personal, input.potenciaHP, input.superficieM2);
  const C = calcularC(input.corrientesY);
  const R = calcularR(Z, A, D, C);
  const ISO = isoFactor(input.tieneISO);
  const TEF = M * R * ISO;

  return { M, Z, A, D, C, R, ISO, TEF };
}

export const DEFAULT_A: CoeficientesA = {
  a1_stock: 0,
  a2_almacenamiento: 0,
  a3_peligrosidad: 0,
  a4_tratabilidad: 0,
  a5_transporte: 0,
  a6_contingencia: 0,
  a7_monitoreo: 0,
  a8_instalMonitoreo: 0,
  a9_instalGenerales: 0,
  a10_idoneidad: 0,
};
