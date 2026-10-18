export const GENERADOR_FISCAL_STATUSES = [
  'AL_DIA',
  'TEF_SIN_PAGO',
  'TEF_SIN_REGISTRO',
  'DDJJ_PENDIENTE',
  'DDJJ_SIN_REGISTRO',
  'NO_HABILITADO',
  'SIN_DATOS',
] as const;

export type GeneradorFiscalStatus = (typeof GENERADOR_FISCAL_STATUSES)[number];

export type TefEstado = 'PAGADO' | 'SIN_PAGO' | 'SIN_REGISTRO';
export type DdjjEstado = 'PRESENTADA' | 'PENDIENTE' | 'SIN_REGISTRO';
export type HabilitacionEstado = 'HABILITADO' | 'NO_HABILITADO' | 'SIN_DATO';

interface PagoFiscal {
  anio: number;
  fechaPago: Date | string | null;
  habilitado: boolean | null;
}

interface DdjjFiscal {
  anio: number;
  presentada: boolean;
}

export interface SituacionFiscalGenerador {
  anio: number;
  tef: TefEstado;
  ddjj: DdjjEstado;
  habilitacion: HabilitacionEstado;
  resumen: 'AL_DIA' | 'REQUIERE_REVISION' | 'SIN_DATOS';
  pendientes: string[];
}

export function parseFiscalYear(value: unknown, fallback = new Date().getFullYear()): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallback;
}

export function parseFiscalStatus(value: unknown): GeneradorFiscalStatus | undefined {
  const normalized = String(value || '').trim().toUpperCase();
  return GENERADOR_FISCAL_STATUSES.includes(normalized as GeneradorFiscalStatus)
    ? normalized as GeneradorFiscalStatus
    : undefined;
}

export function deriveSituacionFiscal(
  pagos: PagoFiscal[] | undefined,
  ddjj: DdjjFiscal[] | undefined,
  anio: number,
): SituacionFiscalGenerador {
  const pago = pagos?.find((item) => item.anio === anio);
  const declaracion = ddjj?.find((item) => item.anio === anio);

  const tef: TefEstado = !pago ? 'SIN_REGISTRO' : pago.fechaPago ? 'PAGADO' : 'SIN_PAGO';
  const ddjjEstado: DdjjEstado = !declaracion
    ? 'SIN_REGISTRO'
    : declaracion.presentada
      ? 'PRESENTADA'
      : 'PENDIENTE';
  const habilitacion: HabilitacionEstado = pago?.habilitado === true
    ? 'HABILITADO'
    : pago?.habilitado === false
      ? 'NO_HABILITADO'
      : 'SIN_DATO';

  const pendientes: string[] = [];
  if (tef === 'SIN_PAGO') pendientes.push('TEF sin pago');
  if (tef === 'SIN_REGISTRO') pendientes.push('TEF sin registro');
  if (ddjjEstado === 'PENDIENTE') pendientes.push('DDJJ pendiente');
  if (ddjjEstado === 'SIN_REGISTRO') pendientes.push('DDJJ sin registro');
  if (habilitacion === 'NO_HABILITADO') pendientes.push('No habilitado');
  if (habilitacion === 'SIN_DATO' && pago) pendientes.push('Habilitacion sin dato');

  const sinDatos = !pago && !declaracion;
  const alDia = tef === 'PAGADO' && ddjjEstado === 'PRESENTADA' && habilitacion === 'HABILITADO';

  return {
    anio,
    tef,
    ddjj: ddjjEstado,
    habilitacion,
    resumen: alDia ? 'AL_DIA' : sinDatos ? 'SIN_DATOS' : 'REQUIERE_REVISION',
    pendientes,
  };
}

/** Prisma-compatible relation filter. Kept data-only so it can be unit tested. */
export function buildFiscalWhere(status: GeneradorFiscalStatus | undefined, anio: number): Record<string, unknown> | undefined {
  switch (status) {
    case 'AL_DIA':
      return {
        AND: [
          { pagos: { some: { anio, fechaPago: { not: null }, habilitado: true } } },
          { ddjj: { some: { anio, presentada: true } } },
        ],
      };
    case 'TEF_SIN_PAGO':
      return { pagos: { some: { anio, fechaPago: null } } };
    case 'TEF_SIN_REGISTRO':
      return { pagos: { none: { anio } } };
    case 'DDJJ_PENDIENTE':
      return { ddjj: { some: { anio, presentada: false } } };
    case 'DDJJ_SIN_REGISTRO':
      return { ddjj: { none: { anio } } };
    case 'NO_HABILITADO':
      return { pagos: { some: { anio, habilitado: false } } };
    case 'SIN_DATOS':
      return {
        AND: [
          { pagos: { none: { anio } } },
          { ddjj: { none: { anio } } },
        ],
      };
    default:
      return undefined;
  }
}

export function combineWhere(...clauses: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  const defined = clauses.filter((clause): clause is Record<string, unknown> => Boolean(clause));
  if (defined.length === 0) return {};
  if (defined.length === 1) return defined[0];
  return { AND: defined };
}
