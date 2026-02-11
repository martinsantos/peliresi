/**
 * Catálogo Completo de Tratamientos de Residuos Peligrosos — Provincia de Mendoza
 * ================================================================================
 * 10 categorías, 58 métodos únicos, derivados del análisis exhaustivo de los 45 operadores
 * habilitados y sus tecnologías autorizadas (CSV DPA/SAyOT).
 *
 * Cada método referencia operadores por CUIT (lookup en OPERADORES_DATA).
 * Cada método indica qué corrientes Y puede procesar.
 */

import { OPERADORES_DATA, type OperadorEnriched } from './operadores-enrichment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CategoriaId =
  | 'biologico'
  | 'fisicoquimico'
  | 'termico'
  | 'extraccion_vapores'
  | 'extraccion_liquidos'
  | 'remediacion'
  | 'asbesto'
  | 'almacenamiento'
  | 'reciclaje'
  | 'industrial';

export interface OperadorRef {
  cuit: string;
  tipo: 'FIJO' | 'IN SITU' | 'AMBOS';
}

export interface MetodoTratamiento {
  id: string;
  nombre: string;
  nombreCorto: string;
  descripcion: string;
  corrientesY: string[];
  operadores: OperadorRef[];
}

export interface CategoriaTratamiento {
  id: CategoriaId;
  nombre: string;
  descripcion: string;
  icono: string; // lucide icon name
  color: string; // tailwind color prefix
  metodos: MetodoTratamiento[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const F = 'FIJO' as const;
const I = 'IN SITU' as const;
const A = 'AMBOS' as const;

const op = (cuit: string, tipo: 'FIJO' | 'IN SITU' | 'AMBOS'): OperadorRef => ({ cuit, tipo });

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const CATEGORIAS_TRATAMIENTO: CategoriaTratamiento[] = [
  // =========================================================================
  // 1. BIOLÓGICO
  // =========================================================================
  {
    id: 'biologico',
    nombre: 'Tratamientos Biológicos',
    descripcion: 'Uso de microorganismos, enzimas o plantas para degradar contaminantes orgánicos en suelo y agua.',
    icono: 'Leaf',
    color: 'green',
    metodos: [
      {
        id: 'biopilas',
        nombre: 'Biorremediación mediante Biopilas',
        nombreCorto: 'Biopilas',
        descripcion: 'Apilamiento de suelo contaminado con aireación para degradación microbiana aeróbica de hidrocarburos.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y48'],
        operadores: [
          op('30-68350853-1', I), op('30-70395365-0', I), op('30-70446353-3', I),
          op('30-71427257-4', I), op('30-70337051-5', A), op('30-71034059-1', I),
          op('30-71488764-1', I), op('30-70779684-3', I), op('30-69319923-5', I),
          op('30-71620690-0', I), op('30-70748677-1', I), op('30-71681604-0', I),
          op('30-71809158-2', I), op('30-62231778-4', I), op('33-71154607-9', F),
          op('30-70781092-7', I), op('30-70971362-7', I),
        ],
      },
      {
        id: 'biopilas_mecanicas',
        nombre: 'Biopilas Aireadas Mecánicamente',
        nombreCorto: 'Biopilas Mecánicas',
        descripcion: 'Biopilas con sistema de aireación forzada mecánica para mayor eficiencia de degradación.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y48'],
        operadores: [
          op('30-71427257-4', I), op('30-54668997-9', I), op('30-70781092-7', I),
          op('30-70337051-5', A),
        ],
      },
      {
        id: 'landfarming',
        nombre: 'Landfarming',
        nombreCorto: 'Landfarming',
        descripcion: 'Tratamiento del suelo contaminado esparcido en capa delgada, con arado y volteo periódico para favorecer biodegradación.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('33-70805056-9', I), op('30-70985859-5', I),
          op('30-71243204-3', F), op('33-71154607-9', F),
        ],
      },
      {
        id: 'biorremediacion_enzimatica',
        nombre: 'Biorremediación Enzimática',
        nombreCorto: 'Enzimática',
        descripcion: 'Aplicación de enzimas específicas para catalizar la degradación de contaminantes orgánicos.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [op('30-68350853-1', I)],
      },
      {
        id: 'biorremediacion_bacteriana',
        nombre: 'Biorremediación Bacteriana',
        nombreCorto: 'Bacteriana',
        descripcion: 'Inoculación de bacterias especializadas para degradar hidrocarburos y compuestos orgánicos.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [op('30-68350853-1', I)],
      },
      {
        id: 'biorremediacion_fungica',
        nombre: 'Biorremediación con Estimulación Fúngica',
        nombreCorto: 'Fúngica',
        descripcion: 'Uso de hongos (micorremediación) para degradar contaminantes orgánicos recalcitrantes.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y48'],
        operadores: [op('30-71427257-4', I)],
      },
      {
        id: 'fitorremediacion',
        nombre: 'Fitorremediación',
        nombreCorto: 'Fitorremediación',
        descripcion: 'Uso de plantas para absorber, acumular o degradar contaminantes del suelo.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [op('30-68350853-1', I)],
      },
      {
        id: 'bioventilacion',
        nombre: 'Bioventilación',
        nombreCorto: 'Bioventilación',
        descripcion: 'Inyección de aire en zona no saturada del suelo para estimular biodegradación aeróbica in situ.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y48'],
        operadores: [op('30-70337051-5', A)],
      },
      {
        id: 'tratamiento_biologico_secundario',
        nombre: 'Tratamiento Biológico Secundario (Pileta API)',
        nombreCorto: 'Biológico Secundario',
        descripcion: 'Sistema de piletas separadoras API con tratamiento biológico para efluentes oleosos.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y18', 'Y34', 'Y35'],
        operadores: [op('30-71123596-1', F)],
      },
    ],
  },

  // =========================================================================
  // 2. FÍSICO-QUÍMICO
  // =========================================================================
  {
    id: 'fisicoquimico',
    nombre: 'Tratamientos Físico-Químicos',
    descripcion: 'Procesos de separación, neutralización y transformación química de residuos peligrosos.',
    icono: 'FlaskConical',
    color: 'blue',
    metodos: [
      {
        id: 'decantacion_filtrado',
        nombre: 'Decantación y Filtrado',
        nombreCorto: 'Decantación',
        descripcion: 'Separación de fases por gravedad y posterior filtración de sólidos suspendidos.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y12'],
        operadores: [
          op('30-71123596-1', F), op('30-65316669-5', F), op('30-71243204-3', F),
        ],
      },
      {
        id: 'centrifugacion',
        nombre: 'Centrifugación y Separación de Fases',
        nombreCorto: 'Centrifugación',
        descripcion: 'Separación centrífuga en dos o tres fases para lodos de petróleo y emulsiones.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y18', 'Y48'],
        operadores: [
          op('30-71123596-1', F), op('30-70446353-3', I),
          op('30-71034059-1', I), op('30-67817276-2', I),
        ],
      },
      {
        id: 'solidificacion_estabilizacion',
        nombre: 'Solidificación y Estabilización',
        nombreCorto: 'Solidificación',
        descripcion: 'Inmovilización de contaminantes mediante encapsulamiento en matriz sólida (cemento, polímeros).',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('30-68350853-1', I), op('30-68485575-8', I),
          op('30-71427257-4', I), op('30-54668997-9', I),
        ],
      },
      {
        id: 'oxidacion_quimica',
        nombre: 'Oxidación Química en Reactor',
        nombreCorto: 'Oxidación Química',
        descripcion: 'Oxidación química avanzada en reactor tanque agitado con sistemas filtrantes para destrucción de contaminantes.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y12', 'Y16', 'Y18', 'Y29', 'Y31', 'Y34', 'Y35', 'Y48'],
        operadores: [op('30-71144900-7', A)],
      },
      {
        id: 'neutralizacion',
        nombre: 'Neutralización Ácido-Base',
        nombreCorto: 'Neutralización',
        descripcion: 'Ajuste de pH mediante adición de álcalis o ácidos para neutralizar soluciones extremas.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y34', 'Y35', 'Y48'],
        operadores: [op('30-70803437-8', I)],
      },
      {
        id: 'adsorcion',
        nombre: 'Adsorción por Contacto con Tierras',
        nombreCorto: 'Adsorción',
        descripcion: 'Remoción de contaminantes mediante contacto con tierras adsorbentes específicas.',
        corrientesY: ['Y8', 'Y9'],
        operadores: [op('30-65316669-5', F)],
      },
      {
        id: 'declorinacion',
        nombre: 'Declorinación (APEG / Sodio Metálico)',
        nombreCorto: 'Declorinación',
        descripcion: 'Tratamiento especializado de PCBs: Método APEG para altas concentraciones y Sodio Metálico hasta 5000 ppm.',
        corrientesY: ['Y10'],
        operadores: [op('33-70805056-9', I)],
      },
      {
        id: 'lavado',
        nombre: 'Lavado de Suelos y Elementos',
        nombreCorto: 'Lavado',
        descripcion: 'Lavado con agua/solventes a presión de suelos, envases, piezas metálicas y plásticas contaminadas.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('30-71123596-1', F), op('33-71196520-9', I), op('30-70985859-5', I),
          op('30-71034059-1', I), op('30-71144900-7', A), op('30-54668997-9', I),
          op('30-63857243-1', I),
        ],
      },
      {
        id: 'filtrado_separacion',
        nombre: 'Filtrado y Separación Física',
        nombreCorto: 'Filtrado',
        descripcion: 'Separación física de componentes mediante sistemas de filtrado para acondicionamiento y reutilización.',
        corrientesY: ['Y8', 'Y9', 'Y12', 'Y48'],
        operadores: [
          op('30-71123596-1', F), op('30-71243204-3', F), op('30-71144900-7', A),
        ],
      },
    ],
  },

  // =========================================================================
  // 3. TÉRMICO
  // =========================================================================
  {
    id: 'termico',
    nombre: 'Tratamientos Térmicos',
    descripcion: 'Aplicación de calor para destruir, volatilizar o transformar contaminantes orgánicos.',
    icono: 'Flame',
    color: 'red',
    metodos: [
      {
        id: 'desorcion_termica',
        nombre: 'Desorción Térmica',
        nombreCorto: 'Desorción Térmica',
        descripcion: 'Calentamiento del suelo a 200-600°C para volatilizar contaminantes orgánicos sin combustión.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('30-71137143-3', I), op('30-71488764-1', I), op('30-70337051-5', A),
        ],
      },
      {
        id: 'desorcion_termica_anaerobica',
        nombre: 'Desorción Térmica Anaeróbica (ATDU)',
        nombreCorto: 'ATDU',
        descripcion: 'Desorción térmica en atmósfera inerte (anaeróbica) para suelos con alta carga orgánica.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y48'],
        operadores: [op('30-70337051-5', A)],
      },
      {
        id: 'incineracion',
        nombre: 'Incineración / Termodestrucción',
        nombreCorto: 'Incineración',
        descripcion: 'Combustión controlada a alta temperatura en horno rotativo o pirolítico móvil de múltiples cámaras.',
        corrientesY: ['Y8', 'Y11', 'Y13', 'Y18', 'Y48'],
        operadores: [
          op('30-70446353-3', I), op('20-24882046-3', I),
        ],
      },
      {
        id: 'destilacion',
        nombre: 'Destilación',
        nombreCorto: 'Destilación',
        descripcion: 'Separación de componentes de aceites usados y solventes mediante destilación fraccionada.',
        corrientesY: ['Y8', 'Y9', 'Y11'],
        operadores: [
          op('30-71611995-1', F), op('30-71677412-7', F),
        ],
      },
      {
        id: 'coprocesamiento',
        nombre: 'Co-procesamiento en Horno Cementero',
        nombreCorto: 'Co-procesamiento',
        descripcion: 'Valorización energética de residuos como combustible alternativo en hornos de cemite a 1450°C.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y12', 'Y18', 'Y35', 'Y48'],
        operadores: [op('30-50111112-7', F)],
      },
      {
        id: 'combustible_alternativo',
        nombre: 'Uso como Combustible Alternativo',
        nombreCorto: 'Combustible Alt.',
        descripcion: 'Aprovechamiento de aceites usados y residuos orgánicos como combustible industrial.',
        corrientesY: ['Y8', 'Y31', 'Y34', 'Y48'],
        operadores: [
          op('30-71123596-1', F), op('30-71250073-1', F),
        ],
      },
    ],
  },

  // =========================================================================
  // 4. EXTRACCIÓN DE VAPORES / VACÍO
  // =========================================================================
  {
    id: 'extraccion_vapores',
    nombre: 'Extracción de Vapores y Vacío',
    descripcion: 'Tecnologías de remediación de suelos y aguas subterráneas basadas en extracción por vacío y flujo de aire.',
    icono: 'Wind',
    color: 'cyan',
    metodos: [
      {
        id: 'sve',
        nombre: 'Extracción de Vapores del Suelo (SVE)',
        nombreCorto: 'SVE',
        descripcion: 'Aplicación de vacío al suelo para extraer compuestos orgánicos volátiles (COVs) de la zona no saturada.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('30-68350853-1', I), op('30-70822853-9', I),
          op('30-71422823-0', I), op('30-68485575-8', I),
        ],
      },
      {
        id: 'dpe',
        nombre: 'Extracción en Fase Doble (DPE)',
        nombreCorto: 'DPE',
        descripcion: 'Extracción simultánea de vapores y líquidos contaminados del suelo mediante vacío.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('30-68350853-1', I), op('30-70822853-9', I),
          op('30-71422823-0', I), op('30-70337051-5', A),
        ],
      },
      {
        id: 'dpve',
        nombre: 'Extracción de Fase Dual por Alto Vacío (DPVE)',
        nombreCorto: 'DPVE',
        descripcion: 'Variante de alta potencia de DPE para suelos de baja permeabilidad o alta contaminación.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('30-68350853-1', I), op('30-70395365-0', I), op('30-68485575-8', I),
        ],
      },
      {
        id: 'air_sparging',
        nombre: 'Air Sparging',
        nombreCorto: 'Air Sparging',
        descripcion: 'Inyección de aire comprimido bajo el nivel freático para volatilizar y biodegradar contaminantes disueltos.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [op('30-68485575-8', I)],
      },
      {
        id: 'bombeo_tratamiento',
        nombre: 'Bombeo y Tratamiento (Pump & Treat)',
        nombreCorto: 'Pump & Treat',
        descripcion: 'Extracción de agua subterránea contaminada para tratamiento en superficie y reinyección.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [
          op('30-70395365-0', I), op('30-70822853-9', I), op('30-68485575-8', I),
        ],
      },
    ],
  },

  // =========================================================================
  // 5. EXTRACCIÓN DE FASES LÍQUIDAS
  // =========================================================================
  {
    id: 'extraccion_liquidos',
    nombre: 'Extracción y Separación de Líquidos',
    descripcion: 'Tecnologías para separación y tratamiento de fases líquidas contaminadas.',
    icono: 'Droplets',
    color: 'indigo',
    metodos: [
      {
        id: 'extraccion_fase_liquida',
        nombre: 'Extracción de Fase Líquida y Gaseosa con Soluciones Degradantes',
        nombreCorto: 'Extracción Líq./Gas',
        descripcion: 'Uso de peróxido de hidrógeno y/o agua saturada con ozono para degradar contaminantes en fase líquida y gaseosa.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [op('30-68350853-1', I)],
      },
      {
        id: 'placas_coalescentes',
        nombre: 'Separación por Placas Coalescentes',
        nombreCorto: 'Placas Coalescentes',
        descripcion: 'Separación de hidrocarburos de agua contaminada mediante placas coalescentes que agrupan gotas de aceite.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [op('30-68350853-1', I)],
      },
      {
        id: 'separacion_bifasica',
        nombre: 'Separación Bifásica',
        nombreCorto: 'Sep. Bifásica',
        descripcion: 'Separación de dos fases inmiscibles (agua-hidrocarburo) por diferencia de densidad.',
        corrientesY: ['Y9', 'Y48'],
        operadores: [op('30-70971362-7', I)],
      },
      {
        id: 'reinyeccion',
        nombre: 'Reinyección de Fluidos en Formaciones Profundas',
        nombreCorto: 'Reinyección',
        descripcion: 'Disposición final de lodos y fluidos de perforación mediante inyección en formaciones geológicas profundas.',
        corrientesY: ['Y9', 'Y48'],
        operadores: [
          op('30-54668997-9', I), op('30-67822401-0', I),
        ],
      },
    ],
  },

  // =========================================================================
  // 6. REMEDIACIÓN DE SITIOS
  // =========================================================================
  {
    id: 'remediacion',
    nombre: 'Remediación de Sitios y Limpiezas',
    descripcion: 'Intervenciones integrales de saneamiento de suelos, napas y sitios contaminados.',
    icono: 'HardHat',
    color: 'amber',
    metodos: [
      {
        id: 'remediacion_sitios',
        nombre: 'Remediación Integral de Sitios Contaminados',
        nombreCorto: 'Remediación Sitios',
        descripcion: 'Saneamiento completo de sitios contaminados con múltiples técnicas combinadas.',
        corrientesY: ['Y4', 'Y6', 'Y8', 'Y9', 'Y11', 'Y12', 'Y17', 'Y18', 'Y21', 'Y22', 'Y23', 'Y24', 'Y25', 'Y26', 'Y27', 'Y29', 'Y31', 'Y33', 'Y34', 'Y35', 'Y36', 'Y37', 'Y39', 'Y41', 'Y42', 'Y48'],
        operadores: [op('30-67817276-2', I)],
      },
      {
        id: 'limpiezas_industriales',
        nombre: 'Limpiezas Industriales de Tanques y Recipientes',
        nombreCorto: 'Limpiezas Indust.',
        descripcion: 'Limpieza de tanques, piletas, reactores y otros recipientes contaminados, incluyendo extracción de sólidos/semisólidos.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y12', 'Y16', 'Y18', 'Y29', 'Y31', 'Y34', 'Y35', 'Y48'],
        operadores: [
          op('30-67817276-2', I), op('30-71144900-7', A),
        ],
      },
      {
        id: 'limpieza_tanques_subterraneos',
        nombre: 'Limpieza y Extracción de Tanques Subterráneos',
        nombreCorto: 'Tanques Subterr.',
        descripcion: 'Extracción y limpieza de tanques enterrados (estaciones de servicio, depósitos industriales).',
        corrientesY: ['Y6', 'Y8', 'Y9', 'Y36', 'Y48'],
        operadores: [op('30-68225261-4', I)],
      },
      {
        id: 'remediacion_zeolitas',
        nombre: 'Remediación con Zeolitas',
        nombreCorto: 'Zeolitas',
        descripcion: 'Tratamiento de suelo contaminado mediante contacto con zeolitas como agente adsorbente y estabilizador.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y34', 'Y35', 'Y48'],
        operadores: [op('30-70803437-8', I)],
      },
      {
        id: 'remediacion_derrames',
        nombre: 'Remediación de Derrames y Vuelcos',
        nombreCorto: 'Rem. Derrames',
        descripcion: 'Respuesta rápida ante derrames de residuos peligrosos en empresas y vía pública.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y12', 'Y16', 'Y18', 'Y29', 'Y31', 'Y34', 'Y35', 'Y48'],
        operadores: [op('30-71144900-7', A)],
      },
      {
        id: 'deshidratacion_lodos',
        nombre: 'Deshidratación y Centrifugación de Lodos',
        nombreCorto: 'Deshidrat. Lodos',
        descripcion: 'Reducción del contenido de agua en lodos industriales mediante centrifugación y deshidratación mecánica.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y18', 'Y48'],
        operadores: [op('30-67817276-2', I)],
      },
    ],
  },

  // =========================================================================
  // 7. ASBESTO
  // =========================================================================
  {
    id: 'asbesto',
    nombre: 'Tratamiento de Asbesto',
    descripcion: 'Técnicas especializadas para manipulación, remoción y disposición segura de materiales con asbesto.',
    icono: 'ShieldAlert',
    color: 'orange',
    metodos: [
      {
        id: 'descontaminacion_asbestos',
        nombre: 'Descontaminación de Asbestos',
        nombreCorto: 'Descontam. Asbesto',
        descripcion: 'Remoción controlada de materiales con asbesto en edificaciones e instalaciones industriales.',
        corrientesY: ['Y36', 'Y48'],
        operadores: [
          op('30-68225261-4', I), op('30-71458792-3', I), op('30-67817276-2', I),
        ],
      },
      {
        id: 'manipulacion_asbestos',
        nombre: 'Manipulación y Gestión Integral de Asbestos',
        nombreCorto: 'Manip. Asbesto',
        descripcion: 'Manejo seguro de materiales con asbesto: encapsulamiento, retiro, embalaje, transporte y disposición final.',
        corrientesY: ['Y36', 'Y48'],
        operadores: [op('30-67817276-2', I)],
      },
      {
        id: 'macro_encapsulado',
        nombre: 'Macro Encapsulado',
        nombreCorto: 'Macro Encaps.',
        descripcion: 'Confinamiento de residuos con plomo y asbesto en celdas de encapsulamiento de gran volumen.',
        corrientesY: ['Y31', 'Y36', 'Y48'],
        operadores: [op('30-71123596-1', F)],
      },
    ],
  },

  // =========================================================================
  // 8. ALMACENAMIENTO TRANSITORIO
  // =========================================================================
  {
    id: 'almacenamiento',
    nombre: 'Almacenamiento y Acopio Transitorio',
    descripcion: 'Recepción, acopio temporal y acondicionamiento de residuos peligrosos previo a su tratamiento final.',
    icono: 'Warehouse',
    color: 'slate',
    metodos: [
      {
        id: 'acopio_transitorio',
        nombre: 'Acopio Transitorio de Residuos Peligrosos',
        nombreCorto: 'Acopio Transitorio',
        descripcion: 'Almacenamiento temporal de residuos peligrosos en instalaciones habilitadas, previo a tratamiento o disposición.',
        corrientesY: ['Y8', 'Y9', 'Y11', 'Y12', 'Y29', 'Y31', 'Y48'],
        operadores: [
          op('30-71123596-1', F), op('30-71677412-7', F),
          op('30-71144900-7', A),
        ],
      },
      {
        id: 'destruccion_lamparas',
        nombre: 'Destrucción de Lámparas con Equipo Móvil',
        nombreCorto: 'Destruc. Lámparas',
        descripcion: 'Trituración controlada de lámparas fluorescentes y mercuriales con equipo móvil y captura de vapores.',
        corrientesY: ['Y29', 'Y48'],
        operadores: [op('30-71730334-9', F)],
      },
    ],
  },

  // =========================================================================
  // 9. RECICLAJE Y RECUPERACIÓN
  // =========================================================================
  {
    id: 'reciclaje',
    nombre: 'Reciclaje y Recuperación de Materiales',
    descripcion: 'Recuperación, reacondicionamiento y valorización de materiales y componentes de residuos peligrosos.',
    icono: 'Recycle',
    color: 'teal',
    metodos: [
      {
        id: 'reciclado_electronico',
        nombre: 'Reciclado y Reacondicionamiento de Electrónicos',
        nombreCorto: 'Reciclaje RAEE',
        descripcion: 'Desarmado, clasificación y recuperación de componentes de residuos de aparatos eléctricos y electrónicos (RAEE).',
        corrientesY: ['Y12', 'Y20', 'Y21', 'Y22', 'Y23', 'Y25', 'Y26', 'Y27', 'Y29', 'Y31', 'Y35', 'Y37', 'Y48'],
        operadores: [
          op('30-71147333-1', F), op('30-71037284-1', F), op('30-70899703-6', F),
        ],
      },
      {
        id: 'reciclado_baterias',
        nombre: 'Reciclado de Baterías Plomo-Ácido',
        nombreCorto: 'Baterías Pb-Ácido',
        descripcion: 'Proceso de fundición y recuperación de plomo y ácido sulfúrico de baterías usadas.',
        corrientesY: ['Y8', 'Y31', 'Y34'],
        operadores: [op('30-71250073-1', F)],
      },
      {
        id: 'disposicion_relleno_seguridad',
        nombre: 'Disposición Final en Relleno de Seguridad',
        nombreCorto: 'Relleno Seguridad',
        descripcion: 'Confinamiento definitivo de residuos no reciclables ni tratables en celda impermeabilizada con monitoreo ambiental.',
        corrientesY: ['Y12', 'Y20', 'Y21', 'Y22', 'Y23', 'Y25', 'Y26', 'Y27', 'Y29', 'Y31', 'Y35', 'Y48'],
        operadores: [op('30-70899703-6', F)],
      },
    ],
  },

  // =========================================================================
  // 10. INDUSTRIAL ESPECIALIZADO
  // =========================================================================
  {
    id: 'industrial',
    nombre: 'Procesos Industriales Especializados',
    descripcion: 'Tratamientos de alta especialización ligados a procesos industriales específicos.',
    icono: 'Factory',
    color: 'purple',
    metodos: [
      {
        id: 'secado_acondicionamiento',
        nombre: 'Secado, Filtrado y Acondicionamiento para Reutilización',
        nombreCorto: 'Secado/Acond.',
        descripcion: 'Procesamiento de aceites y emulsiones para recuperación y reuso industrial.',
        corrientesY: ['Y8', 'Y9', 'Y48'],
        operadores: [op('30-71243204-3', F)],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived indexes (computed once at module load)
// ---------------------------------------------------------------------------

/** Flat list of all treatment methods */
export const TODOS_LOS_METODOS: MetodoTratamiento[] = CATEGORIAS_TRATAMIENTO.flatMap(c => c.metodos);

/** Lookup: metodo.id → MetodoTratamiento */
export const METODOS_POR_ID: Record<string, MetodoTratamiento> = Object.fromEntries(
  TODOS_LOS_METODOS.map(m => [m.id, m]),
);

/** Lookup: metodo.id → CategoriaId */
export const CATEGORIA_DE_METODO: Record<string, CategoriaId> = Object.fromEntries(
  CATEGORIAS_TRATAMIENTO.flatMap(c => c.metodos.map(m => [m.id, c.id])),
);

/** Lookup: categoriaId → CategoriaTratamiento */
export const CATEGORIAS_POR_ID: Record<CategoriaId, CategoriaTratamiento> = Object.fromEntries(
  CATEGORIAS_TRATAMIENTO.map(c => [c.id, c]),
) as Record<CategoriaId, CategoriaTratamiento>;

/** Inverse mapping: Y-code → treatment method ids */
export const METODOS_POR_CORRIENTE: Record<string, string[]> = {};
for (const m of TODOS_LOS_METODOS) {
  for (const y of m.corrientesY) {
    (METODOS_POR_CORRIENTE[y] ??= []).push(m.id);
  }
}

/** Inverse mapping: CUIT → treatment method ids */
export const METODOS_POR_OPERADOR: Record<string, string[]> = {};
for (const m of TODOS_LOS_METODOS) {
  for (const o of m.operadores) {
    (METODOS_POR_OPERADOR[o.cuit] ??= []).push(m.id);
  }
}

/** Risk level for a treatment method based on operator count */
export function getRiesgoMetodo(m: MetodoTratamiento): 'critico' | 'alto' | 'medio' | 'bajo' {
  const n = m.operadores.length;
  if (n <= 1) return 'critico';
  if (n <= 2) return 'alto';
  if (n <= 4) return 'medio';
  return 'bajo';
}

/** Get enriched operator data from CUIT */
export function getOperadorEnriched(cuit: string): OperadorEnriched | null {
  return OPERADORES_DATA[cuit] || null;
}

// ---------------------------------------------------------------------------
// Summary stats (computed once)
// ---------------------------------------------------------------------------

export const STATS_TRATAMIENTOS = {
  totalCategorias: CATEGORIAS_TRATAMIENTO.length,
  totalMetodos: TODOS_LOS_METODOS.length,
  totalOperadores: new Set(TODOS_LOS_METODOS.flatMap(m => m.operadores.map(o => o.cuit))).size,
  metodosCriticos: TODOS_LOS_METODOS.filter(m => getRiesgoMetodo(m) === 'critico').length,
  metodosAltoRiesgo: TODOS_LOS_METODOS.filter(m => getRiesgoMetodo(m) === 'alto').length,
  corrientesYCubiertas: new Set(TODOS_LOS_METODOS.flatMap(m => m.corrientesY)).size,
};
