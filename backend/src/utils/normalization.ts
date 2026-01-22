/**
 * Utilidades de normalización de texto para datos de generadores
 * Sistema de Trazabilidad de Residuos Peligrosos
 */

// ============================================================
// NORMALIZACIÓN DE TEXTO GENÉRICA
// ============================================================

// Normalizar texto removiendo acentos y espacios extra
export function normalizeText(text: string | null): string | null {
  if (!text) return null;
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remover acentos
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');            // Normalizar espacios
}

// Función para comparar dos textos ignorando acentos
export function textsMatch(text1: string | null, text2: string | null): boolean {
  if (!text1 || !text2) return false;
  return normalizeText(text1) === normalizeText(text2);
}

// ============================================================
// NORMALIZACIÓN DE DEPARTAMENTOS DE MENDOZA
// ============================================================

export const DEPARTAMENTO_NORMALIZATION: Record<string, string> = {
  // Capital / Mendoza (todas las variantes)
  'CAPITAL': 'CAPITAL',
  'CIUDAD': 'CAPITAL',
  'CIUDAD DE MENDOZA': 'CAPITAL',
  'MENDOZA': 'CAPITAL',
  'CAPITAL - MZA': 'CAPITAL',
  'CAPITAL-MZA': 'CAPITAL',
  'CAPITAL MZA': 'CAPITAL',
  'CAPITAL MENDOZA': 'CAPITAL',
  'MZA': 'CAPITAL',
  'MZA CAPITAL': 'CAPITAL',
  // CABA
  'CABA': 'CABA (BUENOS AIRES)',
  'CABA (BUENOS AIRES)': 'CABA (BUENOS AIRES)',
  'BUENOS AIRES': 'BUENOS AIRES',
  // Godoy Cruz
  'GODOY CRUZ': 'GODOY CRUZ',
  'GODOYCRUZ': 'GODOY CRUZ',
  'GODOY CRUZ-LUJAN DE CUYO': 'GODOY CRUZ',
  'GODOY CRUZ - LUJAN DE CUYO': 'GODOY CRUZ',
  'GODOY CRUZ/LUJAN DE CUYO': 'GODOY CRUZ',
  // Guaymallén
  'GUAYMALLEN': 'GUAYMALLÉN',
  'GUAYMLLEN': 'GUAYMALLÉN',
  'GUYMALLEN': 'GUAYMALLÉN',
  'GIUAYMALLEN': 'GUAYMALLÉN',
  'GUAYMALEN': 'GUAYMALLÉN',
  'GUAIMALLEN': 'GUAYMALLÉN',
  // Las Heras
  'LAS HERAS': 'LAS HERAS',
  'LA HERAS': 'LAS HERAS',
  'LASHERAS': 'LAS HERAS',
  // Luján de Cuyo
  'LUJAN DE CUYO': 'LUJÁN DE CUYO',
  'LUJN DE CUYO': 'LUJÁN DE CUYO',
  'LUJAN  DE CUYO': 'LUJÁN DE CUYO',
  'LUJA DE CUYO': 'LUJÁN DE CUYO',
  'LUJAN DEL CUYO': 'LUJÁN DE CUYO',
  'LUJAN': 'LUJÁN DE CUYO',
  // Maipú
  'MAIPU': 'MAIPÚ',
  'MIPU': 'MAIPÚ',
  'MAPU': 'MAIPÚ',
  // Malargüe
  'MALARGUE': 'MALARGÜE',
  'MALARGÜE': 'MALARGÜE',
  // San Martín
  'SAN MARTIN': 'SAN MARTÍN',
  'SAN MRTIN': 'SAN MARTÍN',
  'SANMARTIN': 'SAN MARTÍN',
  // San Rafael (todas las variantes con errores de tipeo)
  'SAN RAFAEL': 'SAN RAFAEL',
  'SAN RDFAEL': 'SAN RAFAEL',
  'SAN RFAEL': 'SAN RAFAEL',
  'SAN RAFEL': 'SAN RAFAEL',
  'SANRAFAEL': 'SAN RAFAEL',
  'SN RAFAEL': 'SAN RAFAEL',
  // General Alvear
  'GENERAL ALVEAR': 'GENERAL ALVEAR',
  'GRAL. ALVEAR': 'GENERAL ALVEAR',
  'GRAL.  ALVEAR': 'GENERAL ALVEAR',
  'GRAL ALVEAR': 'GENERAL ALVEAR',
  'GENERALALVEAR': 'GENERAL ALVEAR',
  // Tunuyán
  'TUNUYAN': 'TUNUYÁN',
  'TUNUYÁN': 'TUNUYÁN',
  // Tupungato
  'TUPUNGATO': 'TUPUNGATO',
  // Junín
  'JUNIN': 'JUNÍN',
  'JUNÍN': 'JUNÍN',
  // Otros departamentos de Mendoza
  'RIVADAVIA': 'RIVADAVIA',
  'SAN CARLOS': 'SAN CARLOS',
  'SANTA ROSA': 'SANTA ROSA',
  'LA PAZ': 'LA PAZ',
  'LAVALLE': 'LAVALLE',
  // Otras provincias
  'GENERAL ROCA': 'GENERAL ROCA (RÍO NEGRO)',
  'GENERAL ROCA (RÍO NEGRO)': 'GENERAL ROCA (RÍO NEGRO)',
  'CORDOBA': 'CÓRDOBA',
  'CÓRDOBA': 'CÓRDOBA'
};

// Lista oficial de departamentos de Mendoza
export const DEPARTAMENTOS_MENDOZA = [
  'CAPITAL',
  'GENERAL ALVEAR',
  'GODOY CRUZ',
  'GUAYMALLÉN',
  'JUNÍN',
  'LA PAZ',
  'LAS HERAS',
  'LAVALLE',
  'LUJÁN DE CUYO',
  'MAIPÚ',
  'MALARGÜE',
  'RIVADAVIA',
  'SAN CARLOS',
  'SAN MARTÍN',
  'SAN RAFAEL',
  'SANTA ROSA',
  'TUNUYÁN',
  'TUPUNGATO'
];

/**
 * Normaliza el nombre de un departamento a su forma canónica
 */
export function normalizarDepartamento(depto: string | null | undefined): string | null {
  if (!depto) return null;
  const upper = depto.trim().toUpperCase();
  return DEPARTAMENTO_NORMALIZATION[upper] || upper;
}

// ============================================================
// NORMALIZACIÓN DE RUBROS
// ============================================================

// Mapeo de rubros conocidos a forma canónica
export const RUBRO_NORMALIZATION: Record<string, string> = {
  // Mecánica
  'MECANICA': 'MECÁNICA',
  'MECANICA INTEGRAL': 'MECÁNICA INTEGRAL',
  'MECANICA LIGERA': 'MECÁNICA LIGERA',
  'MECANICA LIGERA Y VENTAS': 'MECÁNICA LIGERA',
  'MECANICA DE MOTOS': 'MECÁNICA DE MOTOS',
  'TALLER MECANICO': 'TALLER MECÁNICO',
  'TALLER MECANICO INTEGRAL': 'TALLER MECÁNICO INTEGRAL',

  // Metalmecánica
  'METALMECANICA': 'METALMECÁNICA',
  'METAL MECANICA': 'METALMECÁNICA',
  'METAL MECÁNICA': 'METALMECÁNICA',
  'METALMECANICO': 'METALMECÁNICA',

  // Mantenimiento
  'MANTENIMIENTO Y REPARACION': 'MANTENIMIENTO Y REPARACIÓN',
  'MANTENIMIENTO Y REPARACIÓN DE': 'MANTENIMIENTO Y REPARACIÓN',
  'MANTENIMIENTO Y REPARACION DE': 'MANTENIMIENTO Y REPARACIÓN',
  'MANTENIMIENTO Y REPARACION DEL': 'MANTENIMIENTO Y REPARACIÓN',
  'MANTENIMIENTO Y REPARACIÓN DEL': 'MANTENIMIENTO Y REPARACIÓN',
  'MANTENIMIENTO Y REPARACION DE VEHICULOS': 'MANTENIMIENTO Y REPARACIÓN',
  'MANTENIMIENTO DE VEHICULOS': 'MANTENIMIENTO Y REPARACIÓN',
  'REPARACION DE VEHICULOS': 'REPARACIÓN DE VEHÍCULOS',
  'REPARACION Y MANTENIMIENTO': 'MANTENIMIENTO Y REPARACIÓN',

  // Lubricentro
  'LUBRICENTRO': 'LUBRICENTRO',
  'LUBRICENTRO Y GOMERIA': 'LUBRICENTRO Y GOMERÍA',
  'LUBRICENTRO Y GOMERÍA GRILLO': 'LUBRICENTRO Y GOMERÍA',
  'LUBRICENTRO, LAVADERO': 'LUBRICENTRO Y LAVADERO',
  'LUBRICENTRO DEL AUTOMOTOR': 'LUBRICENTRO',
  'LUBRICENTRO Y VENTA DE REPUESTOS': 'LUBRICENTRO',
  'LUBRICENTRO Y LAVADERO': 'LUBRICENTRO Y LAVADERO',

  // Gomería
  'GOMERIA': 'GOMERÍA',
  'GOMERIA Y ALINEACION': 'GOMERÍA Y ALINEACIÓN',

  // Lavadero
  'LAVADERO': 'LAVADERO DE VEHÍCULOS',
  'LAVADERO AUTOMATICO': 'LAVADERO DE VEHÍCULOS',
  'LAVADERO AUTOMATICO DE VEHICULOS': 'LAVADERO DE VEHÍCULOS',
  'LAVADO Y LIMPIEZA DE VEHICULOS': 'LAVADERO DE VEHÍCULOS',
  'LIMPIEZA Y LAVADO DE VEHICULOS': 'LAVADERO DE VEHÍCULOS',
  'LAVADERO DE AUTOS': 'LAVADERO DE VEHÍCULOS',

  // Industrias
  'METALURGICA': 'METALÚRGICA',
  'MINERIA': 'MINERÍA',
  'PETROLERA': 'PETROLERA',
  'OTRAS INDUSTRIAS': 'OTRAS INDUSTRIAS',
  'OTRAS INDUSTRIAS Y/O SERVICIOS': 'OTRAS INDUSTRIAS',

  // Construcción
  'OBRA CONSTRUCCION': 'CONSTRUCCIÓN',
  'CONSTRUCCION': 'CONSTRUCCIÓN',
  'OBRA DE CONSTRUCCION': 'CONSTRUCCIÓN',

  // Electricidad
  'ELECTRICIDAD': 'ELECTRICIDAD',
  'ELECTRICIDAD DEL AUTOMOTOR': 'ELECTRICIDAD DEL AUTOMOTOR',
  'ELECTRICIDAD AUTOMOTOR': 'ELECTRICIDAD DEL AUTOMOTOR',

  // Pintura
  'PINTURA': 'PINTURA AUTOMOTOR',
  'PINTURA AUTOMOTOR': 'PINTURA AUTOMOTOR',
  'PINTURA DE VEHICULOS': 'PINTURA AUTOMOTOR',
  'CHAPA Y PINTURA': 'CHAPA Y PINTURA',

  // Transporte
  'TRANSPORTE': 'TRANSPORTE',
  'TRANSPORTE DE CARGAS': 'TRANSPORTE DE CARGAS',
  'TRANSPORTE DE RESIDUOS': 'TRANSPORTE DE RESIDUOS',

  // Vitivinícola / Bodega (NUEVA CATEGORÍA)
  'BODEGA': 'VITIVINÍCOLA',
  'BODEGA - ELABORACION DE VINOS': 'VITIVINÍCOLA',
  'BODEGA VITIVINICOLA': 'VITIVINÍCOLA',
  'BODEGA VITIVINICOLA - ELABORACION DE VINOS': 'VITIVINÍCOLA',
  'BODEGA Y ELABORACION DE VINOS': 'VITIVINÍCOLA',
  'ELABORACION DE VINOS': 'VITIVINÍCOLA',
  'ELABORACION DE VINO': 'VITIVINÍCOLA',
  'VITIVINICOLA': 'VITIVINÍCOLA',
  'CULTIVO DE VID': 'VITIVINÍCOLA',
  'CULTIVOS DE VID': 'VITIVINÍCOLA',
  'CULTIVO DE UVA': 'VITIVINÍCOLA',
  'VINEDO': 'VITIVINÍCOLA',
  'FINCA': 'VITIVINÍCOLA',
  'FINCA VITIVINICOLA': 'VITIVINÍCOLA',

  // Construcción (agregar variantes faltantes)
  'CONSTRUCTORA': 'CONSTRUCCIÓN',
  'CONTRUCCION': 'CONSTRUCCIÓN',
  'EMPRESA CONSTRUCTORA': 'CONSTRUCCIÓN',
  'EMPRESA DE CONSTRUCCION': 'CONSTRUCCIÓN',
  'SERVICIOS DE CONSTRUCCION': 'CONSTRUCCIÓN',
  'CONSTRUCTOR': 'CONSTRUCCIÓN',

  // Comercio (variantes comunes)
  'COMERCIO': 'COMERCIO',
  'COMERCIO MINORISTA': 'COMERCIO',
  'COMERCIO MAYORISTA': 'COMERCIO',
  'VENTA DE REPUESTOS': 'COMERCIO',
  'VENTA DE AUTOPARTES': 'COMERCIO',
  'FERRETERIA': 'COMERCIO',

  // Servicios varios
  'SERVICIOS': 'SERVICIOS VARIOS',
  'SERVICIO': 'SERVICIOS VARIOS',
  'SERVICIOS GENERALES': 'SERVICIOS VARIOS',

  // Salud
  'HOSPITAL': 'SALUD',
  'CLINICA': 'SALUD',
  'SANATORIO': 'SALUD',
  'LABORATORIO': 'SALUD',
  'CONSULTORIO': 'SALUD',
  'FARMACIA': 'SALUD',

  // Agropecuario
  'AGROPECUARIO': 'AGROPECUARIO',
  'AGROPECUARIA': 'AGROPECUARIO',
  'AGRICOLA': 'AGROPECUARIO',
  'AGRICULTURA': 'AGROPECUARIO',
};

// Lista de rubros canónicos para dropdowns
export const RUBROS_CANONICOS = [
  'AGROPECUARIO',
  'CHAPA Y PINTURA',
  'COMERCIO',
  'CONSTRUCCIÓN',
  'ELECTRICIDAD',
  'ELECTRICIDAD DEL AUTOMOTOR',
  'GOMERÍA',
  'GOMERÍA Y ALINEACIÓN',
  'LAVADERO DE VEHÍCULOS',
  'LUBRICENTRO',
  'LUBRICENTRO Y GOMERÍA',
  'LUBRICENTRO Y LAVADERO',
  'MANTENIMIENTO Y REPARACIÓN',
  'MECÁNICA',
  'MECÁNICA DE MOTOS',
  'MECÁNICA INTEGRAL',
  'MECÁNICA LIGERA',
  'METALMECÁNICA',
  'METALÚRGICA',
  'MINERÍA',
  'OTRAS INDUSTRIAS',
  'PETROLERA',
  'PINTURA AUTOMOTOR',
  'REPARACIÓN DE VEHÍCULOS',
  'SALUD',
  'SERVICIOS VARIOS',
  'TALLER MECÁNICO',
  'TALLER MECÁNICO INTEGRAL',
  'TRANSPORTE',
  'TRANSPORTE DE CARGAS',
  'TRANSPORTE DE RESIDUOS',
  'VITIVINÍCOLA',
];

export function normalizeRubro(rubro: string | null): string {
  if (!rubro) return 'SIN ESPECIFICAR';

  const normalized = normalizeText(rubro);
  if (!normalized) return 'SIN ESPECIFICAR';

  // Buscar en mapeo exacto
  if (RUBRO_NORMALIZATION[normalized]) {
    return RUBRO_NORMALIZATION[normalized];
  }

  // Buscar coincidencia parcial (el normalizado contiene la clave o viceversa)
  for (const [key, value] of Object.entries(RUBRO_NORMALIZATION)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Si no encuentra mapeo, devolver capitalizado con acentos restaurados
  return rubro.trim();
}
