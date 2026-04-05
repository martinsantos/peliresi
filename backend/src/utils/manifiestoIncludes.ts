/**
 * Shared Prisma include objects for Manifiesto queries.
 *
 * Centralizes the common include patterns used across controllers to avoid
 * duplication and ensure consistency. Each controller can spread and override
 * fields as needed.
 */

/** Lightweight include for list views (ManifiestosPage, reportes, dashboards). */
export const MANIFIESTO_LIST_INCLUDE = {
  generador: { select: { razonSocial: true, cuit: true } },
  transportista: { select: { razonSocial: true, cuit: true } },
  operador: { select: { razonSocial: true, cuit: true } },
  residuos: { include: { tipoResiduo: true } },
} as const;

/** Full include for detail views (ManifiestoDetallePage). */
export const MANIFIESTO_DETAIL_INCLUDE = {
  generador: true,
  transportista: {
    include: {
      vehiculos: true,
      choferes: true,
    },
  },
  operador: true,
  residuos: {
    include: {
      tipoResiduo: true,
    },
  },
  eventos: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      usuario: {
        select: {
          nombre: true,
          apellido: true,
          rol: true,
        },
      },
    },
  },
  tracking: {
    orderBy: { timestamp: 'desc' as const },
    take: 100,
  },
} as const;
