/**
 * Catálogo de categorías de residuos peligrosos según el Convenio de Basilea
 * Y-codes: Categorías de desechos que hay que controlar
 * Referencia: Anexos I, II y VIII del Convenio de Basilea
 */

export interface CategoriaYCode {
  codigo: string;
  nombre: string;
  descripcion: string;
  peligrosidad: 'Alta' | 'Media' | 'Baja' | 'Variable';
  colorClass: string;
}

export const CATEGORIAS_Y_CODES: Record<string, CategoriaYCode> = {
  // Corrientes de desechos (Y1-Y18)
  Y1: {
    codigo: 'Y1',
    nombre: 'Desechos clínicos',
    descripcion: 'Desechos clínicos resultantes de la atención médica en hospitales, centros médicos y clínicas',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y2: {
    codigo: 'Y2',
    nombre: 'Desechos de producción farmacéutica',
    descripcion: 'Desechos resultantes de la producción y preparación de productos farmacéuticos',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y3: {
    codigo: 'Y3',
    nombre: 'Desechos de medicamentos',
    descripcion: 'Desechos de medicamentos y productos farmacéuticos para la salud humana o animal',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y4: {
    codigo: 'Y4',
    nombre: 'Desechos de biocidas y fitosanitarios',
    descripcion: 'Desechos resultantes de la producción, preparación y utilización de biocidas y productos fitosanitarios',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y5: {
    codigo: 'Y5',
    nombre: 'Desechos de conservantes de madera',
    descripcion: 'Desechos resultantes de la fabricación, preparación y utilización de productos químicos para conservación de madera',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y6: {
    codigo: 'Y6',
    nombre: 'Desechos de disolventes orgánicos',
    descripcion: 'Desechos resultantes de la producción, preparación y utilización de disolventes orgánicos',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y7: {
    codigo: 'Y7',
    nombre: 'Desechos de tratamientos térmicos',
    descripcion: 'Desechos que contengan cianuros, resultantes del tratamiento térmico y operaciones de temple',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y8: {
    codigo: 'Y8',
    nombre: 'Desechos con PCB/PCT/PBB',
    descripcion: 'Desechos de aceites minerales no aptos para uso, como aceites de corte, aceites hidráulicos y de aislamiento que contengan PCB',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y9: {
    codigo: 'Y9',
    nombre: 'Mezclas de aceites',
    descripcion: 'Mezclas y emulsiones de desechos de aceite y agua o de hidrocarburos y agua',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y10: {
    codigo: 'Y10',
    nombre: 'Sustancias halogenadas',
    descripcion: 'Sustancias y artículos de desecho que contengan o estén contaminados por PCB, PCT o PBB',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y11: {
    codigo: 'Y11',
    nombre: 'Residuos alquitranados',
    descripcion: 'Residuos alquitranados resultantes de la refinación, destilación o cualquier otro tratamiento pirolítico',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y12: {
    codigo: 'Y12',
    nombre: 'Tintas, colorantes y pigmentos',
    descripcion: 'Desechos resultantes de la producción, preparación y utilización de tintas, colorantes, pigmentos, pinturas, lacas o barnices',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y13: {
    codigo: 'Y13',
    nombre: 'Resinas y látex',
    descripcion: 'Desechos resultantes de la producción, preparación y utilización de resinas, látex, plastificantes o colas y adhesivos',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y14: {
    codigo: 'Y14',
    nombre: 'Sustancias químicas de investigación',
    descripcion: 'Sustancias químicas de desecho no identificadas o nuevas resultantes de investigación y desarrollo',
    peligrosidad: 'Variable',
    colorClass: 'badge-info'
  },
  Y15: {
    codigo: 'Y15',
    nombre: 'Desechos explosivos',
    descripcion: 'Desechos de carácter explosivo que no estén sometidos a otra legislación',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y16: {
    codigo: 'Y16',
    nombre: 'Desechos de fotografía',
    descripcion: 'Desechos resultantes de la producción, preparación y utilización de productos químicos para fotografía',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y17: {
    codigo: 'Y17',
    nombre: 'Desechos de tratamiento de superficies',
    descripcion: 'Desechos resultantes del tratamiento de superficies de metales y plásticos',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y18: {
    codigo: 'Y18',
    nombre: 'Residuos industriales',
    descripcion: 'Residuos resultantes de operaciones industriales de eliminación de desechos',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },

  // Desechos que contengan constituyentes (Y19-Y45)
  Y19: {
    codigo: 'Y19',
    nombre: 'Carbonilos metálicos',
    descripcion: 'Carbonilos metálicos',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y20: {
    codigo: 'Y20',
    nombre: 'Berilio y compuestos',
    descripcion: 'Berilio, compuestos de berilio',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y21: {
    codigo: 'Y21',
    nombre: 'Cromo hexavalente',
    descripcion: 'Compuestos de cromo hexavalente',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y22: {
    codigo: 'Y22',
    nombre: 'Compuestos de cobre',
    descripcion: 'Compuestos de cobre',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y23: {
    codigo: 'Y23',
    nombre: 'Compuestos de zinc',
    descripcion: 'Compuestos de zinc',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y24: {
    codigo: 'Y24',
    nombre: 'Arsénico y compuestos',
    descripcion: 'Arsénico, compuestos de arsénico',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y25: {
    codigo: 'Y25',
    nombre: 'Selenio y compuestos',
    descripcion: 'Selenio, compuestos de selenio',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y26: {
    codigo: 'Y26',
    nombre: 'Cadmio y compuestos',
    descripcion: 'Cadmio, compuestos de cadmio',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y27: {
    codigo: 'Y27',
    nombre: 'Antimonio y compuestos',
    descripcion: 'Antimonio, compuestos de antimonio',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y28: {
    codigo: 'Y28',
    nombre: 'Telurio y compuestos',
    descripcion: 'Telurio, compuestos de telurio',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y29: {
    codigo: 'Y29',
    nombre: 'Mercurio y compuestos',
    descripcion: 'Mercurio, compuestos de mercurio',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y30: {
    codigo: 'Y30',
    nombre: 'Talio y compuestos',
    descripcion: 'Talio, compuestos de talio',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y31: {
    codigo: 'Y31',
    nombre: 'Plomo y compuestos',
    descripcion: 'Plomo, compuestos de plomo (incluye baterías)',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y32: {
    codigo: 'Y32',
    nombre: 'Compuestos de flúor inorgánicos',
    descripcion: 'Compuestos inorgánicos de flúor, con exclusión del fluoruro de calcio',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y33: {
    codigo: 'Y33',
    nombre: 'Cianuros inorgánicos',
    descripcion: 'Cianuros inorgánicos',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y34: {
    codigo: 'Y34',
    nombre: 'Soluciones ácidas',
    descripcion: 'Soluciones ácidas o ácidos en forma sólida',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y35: {
    codigo: 'Y35',
    nombre: 'Soluciones básicas',
    descripcion: 'Soluciones básicas o bases en forma sólida',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y36: {
    codigo: 'Y36',
    nombre: 'Asbesto',
    descripcion: 'Asbesto (polvo y fibras)',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y37: {
    codigo: 'Y37',
    nombre: 'Compuestos organofosforados',
    descripcion: 'Compuestos orgánicos de fósforo',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y38: {
    codigo: 'Y38',
    nombre: 'Cianuros orgánicos',
    descripcion: 'Cianuros orgánicos',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y39: {
    codigo: 'Y39',
    nombre: 'Fenoles y compuestos fenólicos',
    descripcion: 'Fenoles, compuestos fenólicos, incluidos los clorofenoles',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y40: {
    codigo: 'Y40',
    nombre: 'Éteres',
    descripcion: 'Éteres',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y41: {
    codigo: 'Y41',
    nombre: 'Solventes orgánicos halogenados',
    descripcion: 'Solventes orgánicos halogenados',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y42: {
    codigo: 'Y42',
    nombre: 'Disolventes orgánicos',
    descripcion: 'Disolventes orgánicos, con exclusión de los disolventes halogenados',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },
  Y43: {
    codigo: 'Y43',
    nombre: 'Compuestos organohalogenados',
    descripcion: 'Cualquier congénere de las dibenzo-p-dioxinas policloradas y dibenzofuranos',
    peligrosidad: 'Alta',
    colorClass: 'badge-danger'
  },
  Y44: {
    codigo: 'Y44',
    nombre: 'Compuestos orgánicos no especificados',
    descripcion: 'Compuestos orgánicos de fósforo no especificados en otro lugar',
    peligrosidad: 'Variable',
    colorClass: 'badge-info'
  },
  Y45: {
    codigo: 'Y45',
    nombre: 'Compuestos organohalogenados',
    descripcion: 'Compuestos organohalogenados no especificados en otro lugar',
    peligrosidad: 'Variable',
    colorClass: 'badge-info'
  },

  // Categorías adicionales (Y46-Y47)
  Y46: {
    codigo: 'Y46',
    nombre: 'Desechos domésticos',
    descripcion: 'Desechos recogidos de los hogares',
    peligrosidad: 'Baja',
    colorClass: 'badge-success'
  },
  Y47: {
    codigo: 'Y47',
    nombre: 'Residuos de incineración',
    descripcion: 'Residuos de la incineración de desechos de los hogares',
    peligrosidad: 'Media',
    colorClass: 'badge-warning'
  },

  // Categoría general
  Y48: {
    codigo: 'Y48',
    nombre: 'Otros residuos',
    descripcion: 'Residuos peligrosos no especificados en otras categorías',
    peligrosidad: 'Variable',
    colorClass: 'badge-info'
  }
};

// Categorías de tamaño de generador (existentes en el sistema)
export const CATEGORIAS_GENERADOR = {
  GRAN_GENERADOR: {
    nombre: 'Gran Generador',
    descripcion: 'Genera más de 1000 kg/año de residuos peligrosos',
    colorClass: 'badge-danger'
  },
  MEDIANO_GENERADOR: {
    nombre: 'Mediano Generador',
    descripcion: 'Genera entre 100 y 1000 kg/año de residuos peligrosos',
    colorClass: 'badge-warning'
  },
  PEQUENO_GENERADOR: {
    nombre: 'Pequeño Generador',
    descripcion: 'Genera menos de 100 kg/año de residuos peligrosos',
    colorClass: 'badge-info'
  }
};

// Lista ordenada de Y-codes para selects y filtros
export const Y_CODES_LIST = Object.values(CATEGORIAS_Y_CODES).sort((a, b) => {
  const numA = parseInt(a.codigo.replace('Y', ''));
  const numB = parseInt(b.codigo.replace('Y', ''));
  return numA - numB;
});

// Obtener información de un Y-code específico
export function getYCodeInfo(codigo: string): CategoriaYCode | undefined {
  const normalizedCode = codigo.toUpperCase().trim();
  return CATEGORIAS_Y_CODES[normalizedCode];
}

// Obtener color CSS para un Y-code
export function getYCodeColor(codigo: string): string {
  const info = getYCodeInfo(codigo);
  return info?.colorClass || 'badge-neutral';
}

// Obtener nivel de peligrosidad
export function getYCodePeligrosidad(codigo: string): string {
  const info = getYCodeInfo(codigo);
  return info?.peligrosidad || 'Variable';
}
