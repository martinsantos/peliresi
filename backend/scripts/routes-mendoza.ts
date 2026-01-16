/**
 * ROUTES MENDOZA
 * Define 20 rutas GPS diferentes en la zona de Mendoza para simulación de viajes
 *
 * Cada ruta tiene:
 * - Punto de origen (cerca de un generador)
 * - Puntos intermedios (simulan el recorrido)
 * - Punto destino (cerca de un operador)
 */

export interface PuntoGPS {
  lat: number;
  lng: number;
}

export interface RutaMendoza {
  id: number;
  nombre: string;
  descripcion: string;
  puntos: PuntoGPS[];
}

// Puntos de referencia en Mendoza
const PUNTOS = {
  // Orígenes (Generadores)
  CENTRO: { lat: -32.8908, lng: -68.8272 },
  LAS_HERAS_NORTE: { lat: -32.8456, lng: -68.8456 },
  GODOY_CRUZ: { lat: -32.9312, lng: -68.8756 },
  LUJAN_SUR: { lat: -33.0100, lng: -68.8500 },
  GUAYMALLEN_ESTE: { lat: -32.8700, lng: -68.7900 },

  // Destinos (Operadores)
  MAIPU_INDUSTRIAL: { lat: -32.9834, lng: -68.7934 },
  LUJAN_PLANTA: { lat: -33.0400, lng: -68.8200 },
  MAIPU_ESTE: { lat: -32.9200, lng: -68.7600 },

  // Puntos intermedios
  ACCESO_ESTE: { lat: -32.8850, lng: -68.8100 },
  RUTA_7_KM5: { lat: -32.8600, lng: -68.8300 },
  CIRCUNVALACION_SUR: { lat: -32.9500, lng: -68.8400 },
  RUTA_40_NORTE: { lat: -32.8200, lng: -68.8600 },
  CHACRAS_CORIA: { lat: -33.0000, lng: -68.8700 },
  SAN_MARTIN: { lat: -32.9100, lng: -68.8150 },
  DORREGO: { lat: -32.9400, lng: -68.8100 },
  BERMEJO: { lat: -32.8500, lng: -68.7800 },
  FRAY_LUIS_BELTRAN: { lat: -32.9000, lng: -68.7700 },
  RODEO_MEDIO: { lat: -32.9600, lng: -68.8050 },
};

/**
 * Genera un punto intermedio entre dos puntos con variación aleatoria
 */
function interpolarPunto(p1: PuntoGPS, p2: PuntoGPS, t: number, variacion: number = 0.003): PuntoGPS {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * t + (Math.random() - 0.5) * variacion,
    lng: p1.lng + (p2.lng - p1.lng) * t + (Math.random() - 0.5) * variacion,
  };
}

/**
 * Genera una ruta con puntos intermedios
 */
function generarRuta(
  origen: PuntoGPS,
  destino: PuntoGPS,
  intermedios: PuntoGPS[],
  numPuntos: number = 15
): PuntoGPS[] {
  const ruta: PuntoGPS[] = [origen];

  // Agregar puntos hacia el primer intermedio
  if (intermedios.length > 0) {
    for (let i = 1; i <= 3; i++) {
      ruta.push(interpolarPunto(origen, intermedios[0], i / 4));
    }

    // Agregar puntos entre intermedios
    for (let i = 0; i < intermedios.length - 1; i++) {
      ruta.push(intermedios[i]);
      for (let j = 1; j <= 2; j++) {
        ruta.push(interpolarPunto(intermedios[i], intermedios[i + 1], j / 3));
      }
    }

    // Agregar último intermedio
    ruta.push(intermedios[intermedios.length - 1]);

    // Puntos hacia destino
    for (let i = 1; i <= 3; i++) {
      ruta.push(interpolarPunto(intermedios[intermedios.length - 1], destino, i / 4));
    }
  } else {
    // Sin intermedios, interpolación directa
    for (let i = 1; i < numPuntos - 1; i++) {
      ruta.push(interpolarPunto(origen, destino, i / (numPuntos - 1)));
    }
  }

  ruta.push(destino);
  return ruta;
}

// ========== 20 RUTAS PREDEFINIDAS ==========
export const RUTAS_MENDOZA: RutaMendoza[] = [
  // Rutas desde Centro
  {
    id: 1,
    nombre: 'Centro → Maipú Industrial',
    descripcion: 'Ruta directa por Av. San Martín',
    puntos: generarRuta(PUNTOS.CENTRO, PUNTOS.MAIPU_INDUSTRIAL, [PUNTOS.SAN_MARTIN, PUNTOS.DORREGO]),
  },
  {
    id: 2,
    nombre: 'Centro → Luján Planta',
    descripcion: 'Ruta por Circunvalación Sur',
    puntos: generarRuta(PUNTOS.CENTRO, PUNTOS.LUJAN_PLANTA, [PUNTOS.CIRCUNVALACION_SUR, PUNTOS.CHACRAS_CORIA]),
  },
  {
    id: 3,
    nombre: 'Centro → Maipú Este',
    descripcion: 'Ruta por Acceso Este',
    puntos: generarRuta(PUNTOS.CENTRO, PUNTOS.MAIPU_ESTE, [PUNTOS.ACCESO_ESTE, PUNTOS.FRAY_LUIS_BELTRAN]),
  },

  // Rutas desde Las Heras Norte
  {
    id: 4,
    nombre: 'Las Heras → Maipú Industrial',
    descripcion: 'Ruta por Ruta 7',
    puntos: generarRuta(PUNTOS.LAS_HERAS_NORTE, PUNTOS.MAIPU_INDUSTRIAL, [PUNTOS.RUTA_7_KM5, PUNTOS.ACCESO_ESTE]),
  },
  {
    id: 5,
    nombre: 'Las Heras → Luján Planta',
    descripcion: 'Ruta larga por Ruta 40',
    puntos: generarRuta(PUNTOS.LAS_HERAS_NORTE, PUNTOS.LUJAN_PLANTA, [PUNTOS.RUTA_40_NORTE, PUNTOS.CENTRO, PUNTOS.CIRCUNVALACION_SUR]),
  },
  {
    id: 6,
    nombre: 'Las Heras → Maipú Este',
    descripcion: 'Ruta por Bermejo',
    puntos: generarRuta(PUNTOS.LAS_HERAS_NORTE, PUNTOS.MAIPU_ESTE, [PUNTOS.BERMEJO]),
  },

  // Rutas desde Godoy Cruz
  {
    id: 7,
    nombre: 'Godoy Cruz → Maipú Industrial',
    descripcion: 'Ruta corta',
    puntos: generarRuta(PUNTOS.GODOY_CRUZ, PUNTOS.MAIPU_INDUSTRIAL, [PUNTOS.DORREGO]),
  },
  {
    id: 8,
    nombre: 'Godoy Cruz → Luján Planta',
    descripcion: 'Ruta por Chacras',
    puntos: generarRuta(PUNTOS.GODOY_CRUZ, PUNTOS.LUJAN_PLANTA, [PUNTOS.CHACRAS_CORIA]),
  },
  {
    id: 9,
    nombre: 'Godoy Cruz → Maipú Este',
    descripcion: 'Ruta por San Martín',
    puntos: generarRuta(PUNTOS.GODOY_CRUZ, PUNTOS.MAIPU_ESTE, [PUNTOS.SAN_MARTIN, PUNTOS.FRAY_LUIS_BELTRAN]),
  },

  // Rutas desde Luján Sur
  {
    id: 10,
    nombre: 'Luján Sur → Maipú Industrial',
    descripcion: 'Ruta por Circunvalación',
    puntos: generarRuta(PUNTOS.LUJAN_SUR, PUNTOS.MAIPU_INDUSTRIAL, [PUNTOS.CHACRAS_CORIA, PUNTOS.RODEO_MEDIO]),
  },
  {
    id: 11,
    nombre: 'Luján Sur → Luján Planta',
    descripcion: 'Ruta corta local',
    puntos: generarRuta(PUNTOS.LUJAN_SUR, PUNTOS.LUJAN_PLANTA, []),
  },
  {
    id: 12,
    nombre: 'Luján Sur → Maipú Este',
    descripcion: 'Ruta larga por Centro',
    puntos: generarRuta(PUNTOS.LUJAN_SUR, PUNTOS.MAIPU_ESTE, [PUNTOS.CIRCUNVALACION_SUR, PUNTOS.SAN_MARTIN]),
  },

  // Rutas desde Guaymallén Este
  {
    id: 13,
    nombre: 'Guaymallén → Maipú Industrial',
    descripcion: 'Ruta por Fray Luis Beltrán',
    puntos: generarRuta(PUNTOS.GUAYMALLEN_ESTE, PUNTOS.MAIPU_INDUSTRIAL, [PUNTOS.FRAY_LUIS_BELTRAN]),
  },
  {
    id: 14,
    nombre: 'Guaymallén → Luján Planta',
    descripcion: 'Ruta larga por Centro',
    puntos: generarRuta(PUNTOS.GUAYMALLEN_ESTE, PUNTOS.LUJAN_PLANTA, [PUNTOS.ACCESO_ESTE, PUNTOS.CENTRO, PUNTOS.GODOY_CRUZ]),
  },
  {
    id: 15,
    nombre: 'Guaymallén → Maipú Este',
    descripcion: 'Ruta corta directa',
    puntos: generarRuta(PUNTOS.GUAYMALLEN_ESTE, PUNTOS.MAIPU_ESTE, []),
  },

  // Rutas adicionales con variaciones
  {
    id: 16,
    nombre: 'Centro → Maipú (variante)',
    descripcion: 'Ruta alternativa por Dorrego',
    puntos: generarRuta(PUNTOS.CENTRO, PUNTOS.MAIPU_INDUSTRIAL, [PUNTOS.ACCESO_ESTE, PUNTOS.DORREGO, PUNTOS.RODEO_MEDIO]),
  },
  {
    id: 17,
    nombre: 'Las Heras → Luján (variante)',
    descripcion: 'Ruta por Centro y Godoy Cruz',
    puntos: generarRuta(PUNTOS.LAS_HERAS_NORTE, PUNTOS.LUJAN_PLANTA, [PUNTOS.CENTRO, PUNTOS.GODOY_CRUZ, PUNTOS.CHACRAS_CORIA]),
  },
  {
    id: 18,
    nombre: 'Godoy Cruz → Maipú (larga)',
    descripcion: 'Ruta larga por circunvalación',
    puntos: generarRuta(PUNTOS.GODOY_CRUZ, PUNTOS.MAIPU_INDUSTRIAL, [PUNTOS.CIRCUNVALACION_SUR, PUNTOS.CHACRAS_CORIA, PUNTOS.RODEO_MEDIO]),
  },
  {
    id: 19,
    nombre: 'Luján → Maipú Este (variante)',
    descripcion: 'Ruta alternativa por Dorrego',
    puntos: generarRuta(PUNTOS.LUJAN_SUR, PUNTOS.MAIPU_ESTE, [PUNTOS.CHACRAS_CORIA, PUNTOS.DORREGO, PUNTOS.FRAY_LUIS_BELTRAN]),
  },
  {
    id: 20,
    nombre: 'Guaymallén → Luján (directa)',
    descripcion: 'Ruta directa sin rodeos',
    puntos: generarRuta(PUNTOS.GUAYMALLEN_ESTE, PUNTOS.LUJAN_PLANTA, [PUNTOS.SAN_MARTIN, PUNTOS.GODOY_CRUZ]),
  },
];

/**
 * Obtiene un punto de la ruta basado en el progreso (0.0 a 1.0)
 */
export function getPuntoEnRuta(ruta: RutaMendoza, progreso: number): PuntoGPS {
  const index = Math.min(
    Math.floor(progreso * (ruta.puntos.length - 1)),
    ruta.puntos.length - 1
  );
  return ruta.puntos[index];
}

/**
 * Obtiene el siguiente punto de la ruta
 */
export function getSiguientePunto(ruta: RutaMendoza, indexActual: number): PuntoGPS | null {
  if (indexActual >= ruta.puntos.length - 1) {
    return null;
  }
  return ruta.puntos[indexActual + 1];
}

/**
 * Calcula la distancia aproximada entre dos puntos GPS (en km)
 */
export function calcularDistancia(p1: PuntoGPS, p2: PuntoGPS): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLon = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Exportar puntos de referencia para uso externo
export { PUNTOS };
