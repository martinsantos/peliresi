/**
 * Utilidades para parsear y manejar categorías de residuos (Y-codes)
 * Soporta formatos: "Y8-Y9-Y12-Y48", "Y8,Y9,Y12", "Y8 Y9 Y12", etc.
 */

import { CATEGORIAS_Y_CODES, type CategoriaYCode } from '../data/categorias-residuos';

export interface CategoriaParseada {
  codigo: string;
  info: CategoriaYCode | null;
  valido: boolean;
}

/**
 * Parsea un string de categorías a un array de códigos Y
 * Soporta múltiples separadores: guión, coma, espacio, punto y coma
 * @param categoria String con formato "Y8-Y9-Y12-Y48" o similar
 * @returns Array de códigos Y normalizados
 */
export function parseCategorias(categoria: string | null | undefined): string[] {
  if (!categoria || categoria.trim() === '' || categoria === 'Sin categoría') {
    return [];
  }

  // Normalizar el string
  const normalizado = categoria
    .toUpperCase()
    .trim();

  // Separar por múltiples delimitadores: guión, coma, espacio, punto y coma, slash
  const partes = normalizado.split(/[-,\s;/]+/);

  // Filtrar solo códigos válidos (Y seguido de 1-2 dígitos)
  const codigos = partes
    .map(p => p.trim())
    .filter(p => /^Y\d{1,2}$/.test(p))
    .map(p => {
      // Normalizar formato (Y1 -> Y1, Y01 -> Y1)
      const num = parseInt(p.replace('Y', ''));
      return `Y${num}`;
    });

  // Eliminar duplicados manteniendo orden
  return [...new Set(codigos)];
}

/**
 * Obtiene información completa de cada código Y parseado
 * @param categoria String de categorías
 * @returns Array de objetos con código e información
 */
export function getCategoriasInfo(categoria: string | null | undefined): CategoriaParseada[] {
  const codigos = parseCategorias(categoria);

  return codigos.map(codigo => ({
    codigo,
    info: CATEGORIAS_Y_CODES[codigo] || null,
    valido: !!CATEGORIAS_Y_CODES[codigo]
  }));
}

/**
 * Obtiene solo las categorías válidas con su información completa
 * @param categoria String de categorías
 * @returns Array de CategoriaYCode
 */
export function getCategoriasValidas(categoria: string | null | undefined): CategoriaYCode[] {
  return getCategoriasInfo(categoria)
    .filter(c => c.valido && c.info)
    .map(c => c.info as CategoriaYCode);
}

/**
 * Cuenta el número de categorías en un string
 * @param categoria String de categorías
 * @returns Número de categorías
 */
export function contarCategorias(categoria: string | null | undefined): number {
  return parseCategorias(categoria).length;
}

/**
 * Verifica si una categoría específica está presente
 * @param categorias String de categorías
 * @param codigo Código a buscar (ej: "Y8")
 * @returns true si el código está presente
 */
export function tieneCategoría(categorias: string | null | undefined, codigo: string): boolean {
  const parsed = parseCategorias(categorias);
  return parsed.includes(codigo.toUpperCase());
}

/**
 * Formatea un array de códigos a string con separador
 * @param codigos Array de códigos Y
 * @param separador Separador a usar (default: "-")
 * @returns String formateado
 */
export function formatearCategorias(codigos: string[], separador: string = '-'): string {
  return codigos.join(separador);
}

/**
 * Obtiene el nivel de peligrosidad más alto de un conjunto de categorías
 * @param categoria String de categorías
 * @returns Nivel de peligrosidad más alto
 */
export function getPeligrosidadMaxima(categoria: string | null | undefined): 'Alta' | 'Media' | 'Baja' | 'Variable' | 'N/A' {
  const categorias = getCategoriasValidas(categoria);

  if (categorias.length === 0) return 'N/A';

  const prioridad: Record<string, number> = {
    'Alta': 4,
    'Media': 3,
    'Variable': 2,
    'Baja': 1
  };

  const maxPeligrosidad = categorias.reduce((max, cat) => {
    const currentPrioridad = prioridad[cat.peligrosidad] || 0;
    const maxPrioridad = prioridad[max] || 0;
    return currentPrioridad > maxPrioridad ? cat.peligrosidad : max;
  }, 'Baja' as 'Alta' | 'Media' | 'Baja' | 'Variable');

  return maxPeligrosidad;
}

/**
 * Agrupa categorías por nivel de peligrosidad
 * @param categoria String de categorías
 * @returns Objeto con categorías agrupadas por peligrosidad
 */
export function agruparPorPeligrosidad(categoria: string | null | undefined): Record<string, CategoriaYCode[]> {
  const categorias = getCategoriasValidas(categoria);

  return categorias.reduce((acc, cat) => {
    const nivel = cat.peligrosidad;
    if (!acc[nivel]) acc[nivel] = [];
    acc[nivel].push(cat);
    return acc;
  }, {} as Record<string, CategoriaYCode[]>);
}

/**
 * Detecta si la categoría es un tipo de generador (GRAN/MEDIANO/PEQUENO_GENERADOR)
 * en lugar de códigos Y
 * @param categoria String de categoría
 * @returns true si es categoría de tamaño de generador
 */
export function esCategoriaGenerador(categoria: string | null | undefined): boolean {
  if (!categoria) return false;
  const normalizado = categoria.toUpperCase().trim();
  return ['GRAN_GENERADOR', 'MEDIANO_GENERADOR', 'PEQUENO_GENERADOR'].includes(normalizado);
}

/**
 * Obtiene el label legible para una categoría de generador
 * @param categoria String de categoría de generador
 * @returns Label legible
 */
export function getLabelCategoriaGenerador(categoria: string | null | undefined): string {
  if (!categoria) return 'Sin categoría';

  switch (categoria.toUpperCase().trim()) {
    case 'GRAN_GENERADOR':
      return 'Gran Generador';
    case 'MEDIANO_GENERADOR':
      return 'Mediano Generador';
    case 'PEQUENO_GENERADOR':
      return 'Pequeño Generador';
    default:
      return categoria;
  }
}

/**
 * Detecta automáticamente el tipo de categoría y retorna información apropiada
 * @param categoria String de categoría
 * @returns Objeto con tipo y datos parseados
 */
export function detectarTipoCategoría(categoria: string | null | undefined): {
  tipo: 'ycodes' | 'generador' | 'vacio';
  datos: string[] | string;
  display: string;
} {
  if (!categoria || categoria.trim() === '' || categoria === 'Sin categoría') {
    return { tipo: 'vacio', datos: [], display: 'Sin categoría' };
  }

  if (esCategoriaGenerador(categoria)) {
    return {
      tipo: 'generador',
      datos: categoria,
      display: getLabelCategoriaGenerador(categoria)
    };
  }

  const ycodes = parseCategorias(categoria);
  if (ycodes.length > 0) {
    return {
      tipo: 'ycodes',
      datos: ycodes,
      display: ycodes.join(', ')
    };
  }

  // Fallback: mostrar el texto original
  return { tipo: 'vacio', datos: categoria, display: categoria };
}
