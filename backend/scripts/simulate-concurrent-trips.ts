/**
 * SIMULATE CONCURRENT TRIPS
 * Simula 20 viajes concurrentes con diferentes comportamientos
 *
 * Ejecutar: npx ts-node scripts/simulate-concurrent-trips.ts
 *
 * Comportamientos:
 * - NORMAL (5): Solo GPS, finaliza al final
 * - PAUSER (5): Pausa en min 2-5, reanuda después de 30-60s
 * - INCIDENT (3): Registra incidente en min 3-7
 * - EARLY_FINISH (4): Finaliza temprano en min 5-8
 * - REVERTER (3): Entrega, revierte a EN_TRANSITO, continúa
 */

import axios, { AxiosInstance } from 'axios';
import { RUTAS_MENDOZA, PuntoGPS } from './routes-mendoza';

// ========== CONFIGURACIÓN ==========
const CONFIG = {
  NUM_TRIPS: 20,
  GPS_INTERVAL_MS: 7000,           // 7 segundos entre GPS
  DURATION_MINUTES: 10,            // Duración total
  API_URL: process.env.API_URL || 'http://localhost:3010/api',

  // Distribución de comportamientos (total = 20)
  BEHAVIORS: {
    NORMAL: 5,
    PAUSER: 5,
    INCIDENT: 3,
    EARLY_FINISH: 4,
    REVERTER: 3,
  },
};

type Behavior = 'NORMAL' | 'PAUSER' | 'INCIDENT' | 'EARLY_FINISH' | 'REVERTER';

interface TripSimulator {
  id: number;
  email: string;
  token: string;
  api: AxiosInstance;
  manifiestoId: string;
  manifiestoNumero: string;
  viajeId: string | null;
  behavior: Behavior;
  estado: 'pending' | 'running' | 'paused' | 'delivered' | 'finished';
  rutaIndex: number;
  gpsIndex: number;

  // Eventos programados (en segundos desde inicio)
  eventoPausa?: number;
  eventoReanuda?: number;
  eventoIncidente?: number;
  eventoEntrega?: number;
  eventoReversion?: number;
  eventoFinalizacion: number;
}

// ========== UTILIDADES ==========
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ========== FUNCIONES PRINCIPALES ==========

/**
 * Login de un transportista y obtiene su manifiesto asignado
 */
async function loginTransportista(numStr: string): Promise<TripSimulator | null> {
  const email = `transportista${numStr}@demo.com`;

  try {
    // Login
    const loginRes = await axios.post(`${CONFIG.API_URL}/auth/login`, {
      email,
      password: 'password',
    });

    const token = loginRes.data.data?.tokens?.accessToken || loginRes.data.data?.token || loginRes.data.token;
    if (!token) {
      console.error(`   ❌ No se obtuvo token para ${email}`, JSON.stringify(loginRes.data));
      return null;
    }

    // Crear instancia de axios con token
    const api = axios.create({
      baseURL: CONFIG.API_URL,
      headers: { Authorization: `Bearer ${token}` },
    });

    // Obtener manifiesto asignado
    const manifestosRes = await api.get('/manifiestos', {
      params: { estado: 'APROBADO', limit: 1 },
    });

    const manifiestos = manifestosRes.data.data?.manifiestos || [];
    if (manifiestos.length === 0) {
      console.error(`   ⚠️ ${email} no tiene manifiestos APROBADOS`);
      return null;
    }

    const manifiesto = manifiestos[0];

    return {
      id: parseInt(numStr),
      email,
      token,
      api,
      manifiestoId: manifiesto.id,
      manifiestoNumero: manifiesto.numero,
      viajeId: null,
      behavior: 'NORMAL',
      estado: 'pending',
      rutaIndex: parseInt(numStr) - 1,
      gpsIndex: 0,
      eventoFinalizacion: CONFIG.DURATION_MINUTES * 60,
    };
  } catch (error: any) {
    console.error(`   ❌ Error login ${email}:`, error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Asigna comportamientos a los simuladores
 */
function asignarBehaviors(simulators: TripSimulator[]): void {
  const behaviors: Behavior[] = [];

  // Crear array de comportamientos según distribución
  for (let i = 0; i < CONFIG.BEHAVIORS.NORMAL; i++) behaviors.push('NORMAL');
  for (let i = 0; i < CONFIG.BEHAVIORS.PAUSER; i++) behaviors.push('PAUSER');
  for (let i = 0; i < CONFIG.BEHAVIORS.INCIDENT; i++) behaviors.push('INCIDENT');
  for (let i = 0; i < CONFIG.BEHAVIORS.EARLY_FINISH; i++) behaviors.push('EARLY_FINISH');
  for (let i = 0; i < CONFIG.BEHAVIORS.REVERTER; i++) behaviors.push('REVERTER');

  // Mezclar aleatoriamente
  for (let i = behaviors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [behaviors[i], behaviors[j]] = [behaviors[j], behaviors[i]];
  }

  // Asignar a cada simulador
  simulators.forEach((sim, idx) => {
    sim.behavior = behaviors[idx] || 'NORMAL';

    const duracionTotal = CONFIG.DURATION_MINUTES * 60;

    switch (sim.behavior) {
      case 'PAUSER':
        sim.eventoPausa = randomBetween(120, 300);        // Min 2-5
        sim.eventoReanuda = sim.eventoPausa + randomBetween(30, 60);
        break;

      case 'INCIDENT':
        sim.eventoIncidente = randomBetween(180, 420);    // Min 3-7
        break;

      case 'EARLY_FINISH':
        sim.eventoFinalizacion = randomBetween(300, 480); // Min 5-8
        break;

      case 'REVERTER':
        sim.eventoEntrega = randomBetween(240, 300);      // Min 4-5
        sim.eventoReversion = sim.eventoEntrega + randomBetween(20, 40);
        sim.eventoFinalizacion = duracionTotal;
        break;

      default: // NORMAL
        sim.eventoFinalizacion = duracionTotal;
    }
  });
}

/**
 * Inicia un viaje
 */
async function iniciarViaje(sim: TripSimulator): Promise<boolean> {
  try {
    const ruta = RUTAS_MENDOZA[sim.rutaIndex % RUTAS_MENDOZA.length];
    const puntoInicial = ruta.puntos[0];

    const res = await sim.api.post('/viajes', {
      manifiestoId: sim.manifiestoId,
      ubicacionInicial: {
        latitud: puntoInicial.lat,
        longitud: puntoInicial.lng,
      },
    });

    sim.viajeId = res.data.data?.viaje?.id || res.data.data?.id;
    sim.estado = 'running';
    return true;
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('en curso')) {
      // Ya hay un viaje en curso, intentar obtenerlo
      try {
        const viajeRes = await sim.api.get(`/manifiestos/${sim.manifiestoId}/viaje-actual`);
        sim.viajeId = viajeRes.data.data?.id;
        sim.estado = 'running';
        return true;
      } catch {
        return false;
      }
    }
    console.error(`   ❌ Error iniciando viaje ${sim.manifiestoNumero}:`, error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Envía actualización GPS
 */
async function enviarGPS(sim: TripSimulator): Promise<void> {
  if (!sim.viajeId || sim.estado === 'finished' || sim.estado === 'paused') return;

  const ruta = RUTAS_MENDOZA[sim.rutaIndex % RUTAS_MENDOZA.length];

  // Avanzar en la ruta
  if (sim.gpsIndex < ruta.puntos.length - 1) {
    sim.gpsIndex++;
  }

  const punto = ruta.puntos[sim.gpsIndex];

  try {
    await sim.api.post(`/viajes/${sim.viajeId}/ruta`, {
      puntos: [{
        latitud: punto.lat,
        longitud: punto.lng,
        timestamp: new Date().toISOString(),
        velocidad: randomBetween(30, 70),
        direccion: randomBetween(0, 360),
        precision: randomBetween(5, 15),
      }],
    });
  } catch (error: any) {
    // Ignorar errores de GPS silenciosamente
  }
}

/**
 * Pausa un viaje
 */
async function pausarViaje(sim: TripSimulator): Promise<void> {
  if (!sim.viajeId || sim.estado !== 'running') return;

  try {
    await sim.api.post(`/viajes/${sim.viajeId}/pausar`);
    sim.estado = 'paused';
    console.log(`⏸️  Viaje ${sim.id.toString().padStart(2, '0')} (${sim.manifiestoNumero}) PAUSADO`);
  } catch (error: any) {
    console.error(`   Error pausando viaje ${sim.id}:`, error.response?.data?.message || error.message);
  }
}

/**
 * Reanuda un viaje
 */
async function reanudarViaje(sim: TripSimulator): Promise<void> {
  if (!sim.viajeId || sim.estado !== 'paused') return;

  try {
    await sim.api.post(`/viajes/${sim.viajeId}/reanudar`);
    sim.estado = 'running';
    console.log(`▶️  Viaje ${sim.id.toString().padStart(2, '0')} (${sim.manifiestoNumero}) REANUDADO`);
  } catch (error: any) {
    console.error(`   Error reanudando viaje ${sim.id}:`, error.response?.data?.message || error.message);
  }
}

/**
 * Registra un incidente
 */
async function registrarIncidente(sim: TripSimulator): Promise<void> {
  if (!sim.viajeId) return;

  const tiposIncidente = ['DESVIO_RUTA', 'AVERIA_VEHICULO', 'ACCIDENTE_TRANSITO', 'CONDICIONES_CLIMATICAS'];
  const tipo = tiposIncidente[randomBetween(0, tiposIncidente.length - 1)];

  try {
    await sim.api.post(`/viajes/${sim.viajeId}/incidente`, {
      tipo,
      descripcion: `Incidente de prueba: ${tipo}`,
      ubicacion: RUTAS_MENDOZA[sim.rutaIndex % RUTAS_MENDOZA.length].puntos[sim.gpsIndex],
    });
    console.log(`🚨 Viaje ${sim.id.toString().padStart(2, '0')} (${sim.manifiestoNumero}) INCIDENTE: ${tipo}`);
  } catch (error: any) {
    console.error(`   Error registrando incidente:`, error.response?.data?.message || error.message);
  }
}

/**
 * Marca viaje como entregado (para REVERTER)
 */
async function entregarViaje(sim: TripSimulator): Promise<void> {
  if (!sim.viajeId || sim.estado === 'finished') return;

  try {
    await sim.api.put(`/viajes/${sim.viajeId}/finalizar`, {
      ubicacionFinal: RUTAS_MENDOZA[sim.rutaIndex % RUTAS_MENDOZA.length].puntos[sim.gpsIndex],
      observaciones: 'Entrega temporal para prueba de reversión',
    });
    sim.estado = 'delivered';
    console.log(`📦 Viaje ${sim.id.toString().padStart(2, '0')} (${sim.manifiestoNumero}) ENTREGADO (REVERTER)`);
  } catch (error: any) {
    console.error(`   Error entregando viaje:`, error.response?.data?.message || error.message);
  }
}

/**
 * Revierte un viaje entregado
 */
async function revertirViaje(sim: TripSimulator): Promise<void> {
  if (sim.estado !== 'delivered') return;

  try {
    await sim.api.post(`/manifiestos/${sim.manifiestoId}/revertir-entrega`, {
      motivo: 'Reversión de prueba para simulación - Se requiere re-entrega del residuo peligroso',
    });

    // Reiniciar viaje
    const ruta = RUTAS_MENDOZA[sim.rutaIndex % RUTAS_MENDOZA.length];
    const punto = ruta.puntos[sim.gpsIndex];

    const res = await sim.api.post('/viajes', {
      manifiestoId: sim.manifiestoId,
      ubicacionInicial: {
        latitud: punto.lat,
        longitud: punto.lng,
      },
    });

    sim.viajeId = res.data.data?.viaje?.id || res.data.data?.id;
    sim.estado = 'running';
    console.log(`🔄 Viaje ${sim.id.toString().padStart(2, '0')} (${sim.manifiestoNumero}) REVERTIDO → EN_TRANSITO`);
  } catch (error: any) {
    console.error(`   Error revirtiendo viaje:`, error.response?.data?.message || error.message);
  }
}

/**
 * Finaliza un viaje
 */
async function finalizarViaje(sim: TripSimulator): Promise<void> {
  if (!sim.viajeId || sim.estado === 'finished') return;

  try {
    const ruta = RUTAS_MENDOZA[sim.rutaIndex % RUTAS_MENDOZA.length];
    const puntoFinal = ruta.puntos[ruta.puntos.length - 1];

    await sim.api.put(`/viajes/${sim.viajeId}/finalizar`, {
      ubicacionFinal: {
        latitud: puntoFinal.lat,
        longitud: puntoFinal.lng,
      },
      observaciones: `Viaje ${sim.behavior} completado exitosamente`,
    });
    sim.estado = 'finished';
    console.log(`🏁 Viaje ${sim.id.toString().padStart(2, '0')} (${sim.manifiestoNumero}) FINALIZADO (${sim.behavior})`);
  } catch (error: any) {
    // Puede que ya esté finalizado
    sim.estado = 'finished';
  }
}

/**
 * Procesa eventos programados para un simulador
 */
async function procesarEventos(sim: TripSimulator, segundosTranscurridos: number): Promise<void> {
  // PAUSER: Pausar
  if (sim.behavior === 'PAUSER' && sim.eventoPausa && segundosTranscurridos >= sim.eventoPausa && sim.estado === 'running') {
    await pausarViaje(sim);
    sim.eventoPausa = undefined; // Solo una vez
  }

  // PAUSER: Reanudar
  if (sim.behavior === 'PAUSER' && sim.eventoReanuda && segundosTranscurridos >= sim.eventoReanuda && sim.estado === 'paused') {
    await reanudarViaje(sim);
    sim.eventoReanuda = undefined;
  }

  // INCIDENT: Registrar incidente
  if (sim.behavior === 'INCIDENT' && sim.eventoIncidente && segundosTranscurridos >= sim.eventoIncidente) {
    await registrarIncidente(sim);
    sim.eventoIncidente = undefined;
  }

  // REVERTER: Entregar
  if (sim.behavior === 'REVERTER' && sim.eventoEntrega && segundosTranscurridos >= sim.eventoEntrega && sim.estado === 'running') {
    await entregarViaje(sim);
    sim.eventoEntrega = undefined;
  }

  // REVERTER: Revertir
  if (sim.behavior === 'REVERTER' && sim.eventoReversion && segundosTranscurridos >= sim.eventoReversion && sim.estado === 'delivered') {
    await revertirViaje(sim);
    sim.eventoReversion = undefined;
  }

  // EARLY_FINISH y todos: Finalizar
  if (segundosTranscurridos >= sim.eventoFinalizacion && sim.estado !== 'finished' && sim.estado !== 'delivered') {
    await finalizarViaje(sim);
  }
}

// ========== MAIN ==========
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('          SIMULACIÓN DE 20 VIAJES CONCURRENTES                  ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`API URL: ${CONFIG.API_URL}`);
  console.log(`Duración: ${CONFIG.DURATION_MINUTES} minutos`);
  console.log(`Intervalo GPS: ${CONFIG.GPS_INTERVAL_MS / 1000}s`);
  console.log('');

  // 1. Login de todos los transportistas
  console.log('🔐 Iniciando sesión de transportistas...');
  const simulators: TripSimulator[] = [];

  for (let i = 1; i <= CONFIG.NUM_TRIPS; i++) {
    const numStr = String(i).padStart(2, '0');
    const sim = await loginTransportista(numStr);
    if (sim) {
      simulators.push(sim);
    }
    process.stdout.write(`   Login: ${simulators.length}/${CONFIG.NUM_TRIPS}\r`);
  }
  console.log(`\n   ✅ Login exitoso: ${simulators.length}/${CONFIG.NUM_TRIPS} transportistas\n`);

  if (simulators.length === 0) {
    console.error('❌ No se pudo iniciar sesión con ningún transportista');
    console.error('   Ejecuta primero: npx ts-node prisma/seed-concurrent-demo.ts');
    process.exit(1);
  }

  // 2. Asignar comportamientos
  console.log('🎭 Asignando comportamientos...');
  asignarBehaviors(simulators);

  const comportamientos = simulators.reduce((acc, s) => {
    acc[s.behavior] = (acc[s.behavior] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(comportamientos).forEach(([behavior, count]) => {
    console.log(`   ${behavior}: ${count}`);
  });
  console.log('');

  // 3. Iniciar todos los viajes
  console.log('🚗 Iniciando viajes...');
  let viajesIniciados = 0;

  for (const sim of simulators) {
    const exito = await iniciarViaje(sim);
    if (exito) viajesIniciados++;
    process.stdout.write(`   Viajes iniciados: ${viajesIniciados}/${simulators.length}\r`);
    await sleep(200); // Pequeña pausa para no saturar
  }
  console.log(`\n   ✅ ${viajesIniciados} viajes iniciados\n`);

  // 4. Loop principal
  console.log('📍 Iniciando simulación GPS...');
  console.log('   (Presiona Ctrl+C para detener)\n');

  const inicio = Date.now();
  const duracionMs = CONFIG.DURATION_MINUTES * 60 * 1000;
  let iteracion = 0;

  while (Date.now() - inicio < duracionMs) {
    iteracion++;
    const segundosTranscurridos = Math.floor((Date.now() - inicio) / 1000);
    const viajesActivos = simulators.filter(s => s.estado === 'running').length;
    const viajesPausados = simulators.filter(s => s.estado === 'paused').length;
    const viajesFinalizados = simulators.filter(s => s.estado === 'finished').length;

    // Enviar GPS a todos los viajes activos
    await Promise.all(simulators.map(sim => enviarGPS(sim)));

    // Procesar eventos programados
    await Promise.all(simulators.map(sim => procesarEventos(sim, segundosTranscurridos)));

    // Mostrar estado
    console.log(
      `📍 GPS #${String(iteracion).padStart(3, '0')} [${formatTime(segundosTranscurridos)}] ` +
      `Activos: ${viajesActivos} | Pausados: ${viajesPausados} | Finalizados: ${viajesFinalizados}`
    );

    // Esperar intervalo
    await sleep(CONFIG.GPS_INTERVAL_MS);

    // Salir si todos terminaron
    if (viajesFinalizados >= simulators.length) {
      break;
    }
  }

  // 5. Finalizar viajes restantes
  console.log('\n🏁 Finalizando viajes restantes...');
  const pendientes = simulators.filter(s => s.estado !== 'finished');

  for (const sim of pendientes) {
    await finalizarViaje(sim);
  }

  // 6. Resumen final
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    SIMULACIÓN COMPLETADA                        ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ ${simulators.filter(s => s.estado === 'finished').length}/${simulators.length} viajes finalizados`);
  console.log(`⏱️  Duración: ${formatTime(Math.floor((Date.now() - inicio) / 1000))}`);
  console.log(`📍 Total iteraciones GPS: ${iteracion}`);
  console.log('');
  console.log('Para ver los viajes, accede al Centro de Control:');
  console.log('   Admin: admin@dgfa.mendoza.gov.ar / password');
  console.log('');
}

// Ejecutar
main().catch(console.error);
