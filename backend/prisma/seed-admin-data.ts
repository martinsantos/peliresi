import { PrismaClient, SeveridadLog, TipoAlertaSeguridad, EventoAlerta, EstadoAlerta, TipoAnomalia, SeveridadAnomalia, TipoNotificacion, PrioridadNotificacion, EstadoManifiesto, TipoReversion, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'password';

async function main() {
  console.log('🔧 Seeding datos administrativos, auditoría, timeline y singles...\n');
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ============================================================
  // 1. USUARIOS ADMIN SECTORIALES
  // ============================================================
  console.log('👥 Creando administradores sectoriales...');

  const adminTransportistas = await prisma.usuario.upsert({
    where: { email: 'admin.transportistas@dgfa.mendoza.gov.ar' },
    update: { password: hashedPassword },
    create: {
      email: 'admin.transportistas@dgfa.mendoza.gov.ar',
      password: hashedPassword,
      rol: 'ADMIN_TRANSPORTISTAS',
      nombre: 'Sergio',
      apellido: 'Varas',
      empresa: 'DGFA - Sector Transporte',
      activo: true,
      aprobado: true,
      fechaAprobacion: new Date('2024-06-15'),
    },
  });
  console.log('  ✅ Admin Transportistas:', adminTransportistas.email);

  const adminOperadores = await prisma.usuario.upsert({
    where: { email: 'admin.operadores@dgfa.mendoza.gov.ar' },
    update: { password: hashedPassword },
    create: {
      email: 'admin.operadores@dgfa.mendoza.gov.ar',
      password: hashedPassword,
      rol: 'ADMIN_OPERADORES',
      nombre: 'Patricia',
      apellido: 'Molina',
      empresa: 'DGFA - Sector Operadores',
      activo: true,
      aprobado: true,
      fechaAprobacion: new Date('2024-06-15'),
    },
  });
  console.log('  ✅ Admin Operadores:', adminOperadores.email);

  const adminGeneradores = await prisma.usuario.upsert({
    where: { email: 'admin.generadores@dgfa.mendoza.gov.ar' },
    update: { password: hashedPassword },
    create: {
      email: 'admin.generadores@dgfa.mendoza.gov.ar',
      password: hashedPassword,
      rol: 'ADMIN_GENERADORES',
      nombre: 'Fernando',
      apellido: 'Bustamante',
      empresa: 'DGFA - Sector Generadores',
      activo: true,
      aprobado: true,
      fechaAprobacion: new Date('2024-07-01'),
    },
  });
  console.log('  ✅ Admin Generadores:', adminGeneradores.email);

  // ============================================================
  // 2. USUARIOS PENDIENTES DE APROBACIÓN
  // ============================================================
  console.log('\n⏳ Creando usuarios pendientes de aprobación...');

  const pendientes = [
    { email: 'solventes.cuyo@gmail.com', rol: 'GENERADOR' as const, nombre: 'Ricardo', apellido: 'Navarro', empresa: 'Solventes Cuyo S.R.L.', telefono: '2614882211', cuit: '30-41529876-4' },
    { email: 'metalurgica.san.rafael@industria.com', rol: 'GENERADOR' as const, nombre: 'Estela', apellido: 'Pacheco', empresa: 'Metalúrgica San Rafael S.A.', telefono: '2604451234', cuit: '30-78523614-0' },
    { email: 'transporte.rapido.mza@logistica.com', rol: 'TRANSPORTISTA' as const, nombre: 'Diego', apellido: 'Carmona', empresa: 'Transporte Rápido Mendoza', telefono: '2614993377', cuit: '30-66319852-7' },
    { email: 'fletes.ambientales@transporte.com', rol: 'TRANSPORTISTA' as const, nombre: 'Valeria', apellido: 'Segura', empresa: 'Fletes Ambientales del Oeste', telefono: '2634112233', cuit: '30-52187463-1' },
    { email: 'reciclados.lujan@planta.com', rol: 'OPERADOR' as const, nombre: 'Marcelo', apellido: 'Quiroga', empresa: 'Reciclados Luján S.A.', telefono: '2614778899', cuit: '30-39174625-8' },
  ];

  for (const p of pendientes) {
    await prisma.usuario.upsert({
      where: { email: p.email },
      update: {},
      create: { email: p.email, password: hashedPassword, rol: p.rol, nombre: p.nombre, apellido: p.apellido, empresa: p.empresa, telefono: p.telefono, cuit: p.cuit, activo: true, aprobado: false },
    });
    console.log(`  ⏳ Pendiente: ${p.nombre} ${p.apellido} (${p.rol})`);
  }

  await prisma.usuario.upsert({
    where: { email: 'irregular.transporte@test.com' },
    update: {},
    create: { email: 'irregular.transporte@test.com', password: hashedPassword, rol: 'TRANSPORTISTA', nombre: 'Héctor', apellido: 'Mendez', empresa: 'Transportes Irregulares', activo: false, aprobado: false, motivoRechazo: 'Documentación de habilitación vencida. CUIT no coincide con registros.' },
  });
  console.log('  ❌ Rechazado: Héctor Mendez (TRANSPORTISTA)');

  await prisma.usuario.upsert({
    where: { email: 'viejo.generador@desuso.com' },
    update: {},
    create: { email: 'viejo.generador@desuso.com', password: hashedPassword, rol: 'GENERADOR', nombre: 'Alberto', apellido: 'Funes', empresa: 'Química Desactivada S.A.', activo: false, aprobado: true, fechaAprobacion: new Date('2023-03-10') },
  });
  console.log('  🔒 Inactivo: Alberto Funes (GENERADOR)');

  // ============================================================
  // 3. AUDITORÍA
  // ============================================================
  console.log('\n📋 Creando registros de auditoría...');

  const admin = await prisma.usuario.findUnique({ where: { email: 'admin@dgfa.mendoza.gov.ar' } });
  const genUser = await prisma.usuario.findUnique({ where: { email: 'quimica.mendoza@industria.com' } });
  const transUser = await prisma.usuario.findUnique({ where: { email: 'transportes.andes@logistica.com' } });
  const opUser = await prisma.usuario.findUnique({ where: { email: 'tratamiento.residuos@planta.com' } });
  const manifiestos = await prisma.manifiesto.findMany({ take: 8, orderBy: { numero: 'asc' } });

  if (!admin || !genUser || !transUser || !opUser) {
    console.warn('⚠️ Faltan usuarios base. Ejecutá primero el seed principal.');
    return;
  }

  await prisma.auditoria.deleteMany({});

  const now = new Date();
  const daysAgo = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt; };
  const hoursAgo = (h: number) => { const dt = new Date(now); dt.setHours(dt.getHours() - h); return dt; };

  const ips = ['190.17.233.45', '181.228.112.78', '200.45.67.123', '186.155.44.210', '190.2.131.55'];
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/17.2',
    'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) Safari/17.2',
  ];

  const auditoriaData: { accion: string; modulo: string; usuarioId: string; manifiestoId?: string; ip: string; userAgent: string; createdAt: Date; datosAntes?: string; datosDespues?: string }[] = [
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: hoursAgo(1) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: genUser.id, ip: ips[1], userAgent: agents[1], createdAt: hoursAgo(2) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: transUser.id, ip: ips[2], userAgent: agents[2], createdAt: hoursAgo(3) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: opUser.id, ip: ips[3], userAgent: agents[3], createdAt: hoursAgo(4) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: adminTransportistas.id, ip: ips[4], userAgent: agents[0], createdAt: hoursAgo(5) },
    { accion: 'LOGIN_FALLIDO', modulo: 'AUTH', usuarioId: admin.id, ip: '45.33.22.11', userAgent: agents[2], createdAt: hoursAgo(8) },
    { accion: 'LOGIN_FALLIDO', modulo: 'AUTH', usuarioId: admin.id, ip: '45.33.22.11', userAgent: agents[2], createdAt: hoursAgo(7.9) },
    { accion: 'CREAR_MANIFIESTO', modulo: 'MANIFIESTOS', usuarioId: genUser.id, manifiestoId: manifiestos[0]?.id, ip: ips[1], userAgent: agents[1], createdAt: daysAgo(5) },
    { accion: 'FIRMAR_MANIFIESTO', modulo: 'MANIFIESTOS', usuarioId: genUser.id, manifiestoId: manifiestos[2]?.id, ip: ips[1], userAgent: agents[1], createdAt: daysAgo(4) },
    { accion: 'APROBAR_MANIFIESTO', modulo: 'MANIFIESTOS', usuarioId: admin.id, manifiestoId: manifiestos[2]?.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(4) },
    { accion: 'CONFIRMAR_RETIRO', modulo: 'MANIFIESTOS', usuarioId: transUser.id, manifiestoId: manifiestos[3]?.id, ip: ips[2], userAgent: agents[2], createdAt: daysAgo(3) },
    { accion: 'CONFIRMAR_ENTREGA', modulo: 'MANIFIESTOS', usuarioId: transUser.id, manifiestoId: manifiestos[5]?.id, ip: ips[2], userAgent: agents[2], createdAt: daysAgo(2) },
    { accion: 'CONFIRMAR_RECEPCION', modulo: 'MANIFIESTOS', usuarioId: opUser.id, manifiestoId: manifiestos[6]?.id, ip: ips[3], userAgent: agents[3], createdAt: daysAgo(2) },
    { accion: 'REGISTRAR_TRATAMIENTO', modulo: 'MANIFIESTOS', usuarioId: opUser.id, manifiestoId: manifiestos[7]?.id, ip: ips[3], userAgent: agents[3], createdAt: daysAgo(1) },
    { accion: 'EMITIR_CERTIFICADO', modulo: 'MANIFIESTOS', usuarioId: opUser.id, manifiestoId: manifiestos[7]?.id, ip: ips[3], userAgent: agents[3], createdAt: daysAgo(1) },
    { accion: 'APROBAR_USUARIO', modulo: 'USUARIOS', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(10), datosAntes: JSON.stringify({ aprobado: false }), datosDespues: JSON.stringify({ aprobado: true }) },
    { accion: 'APROBAR_USUARIO', modulo: 'USUARIOS', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(9) },
    { accion: 'RECHAZAR_USUARIO', modulo: 'USUARIOS', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(8) },
    { accion: 'DESACTIVAR_USUARIO', modulo: 'USUARIOS', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(7) },
    { accion: 'CAMBIO_CONFIG', modulo: 'SISTEMA', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(15), datosAntes: JSON.stringify({ tiempoMaxTransito: 48 }), datosDespues: JSON.stringify({ tiempoMaxTransito: 72 }) },
    { accion: 'EXPORTAR_REPORTE', modulo: 'REPORTES', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(3) },
    { accion: 'EXPORTAR_REPORTE', modulo: 'REPORTES', usuarioId: adminGeneradores.id, ip: ips[4], userAgent: agents[3], createdAt: daysAgo(2) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(1) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: genUser.id, ip: ips[1], userAgent: agents[1], createdAt: daysAgo(1) },
    { accion: 'LOGOUT', modulo: 'AUTH', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(1) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: admin.id, ip: ips[0], userAgent: agents[0], createdAt: daysAgo(2) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: transUser.id, ip: ips[2], userAgent: agents[2], createdAt: daysAgo(2) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: opUser.id, ip: ips[3], userAgent: agents[3], createdAt: daysAgo(3) },
    { accion: 'LOGIN', modulo: 'AUTH', usuarioId: adminOperadores.id, ip: ips[4], userAgent: agents[0], createdAt: daysAgo(3) },
    { accion: 'LOGOUT', modulo: 'AUTH', usuarioId: transUser.id, ip: ips[2], userAgent: agents[2], createdAt: daysAgo(2) },
    ...Array.from({ length: 15 }, (_, i) => ({
      accion: 'LOGIN', modulo: 'AUTH',
      usuarioId: [admin.id, genUser.id, transUser.id, opUser.id][i % 4],
      ip: ips[i % 5], userAgent: agents[i % 4], createdAt: daysAgo(4 + i),
    })),
  ];

  for (const a of auditoriaData) {
    await prisma.auditoria.create({ data: { accion: a.accion, modulo: a.modulo, usuarioId: a.usuarioId, manifiestoId: a.manifiestoId || null, ip: a.ip, userAgent: a.userAgent, createdAt: a.createdAt, datosAntes: a.datosAntes, datosDespues: a.datosDespues } });
  }
  console.log(`  ✅ ${auditoriaData.length} registros de auditoría creados`);

  // ============================================================
  // 4. LOG DE ACTIVIDAD (timeline)
  // ============================================================
  console.log('\n📊 Creando log de actividad (timeline)...');
  await prisma.logActividad.deleteMany({});

  const actividadData: { usuarioId: string; accion: string; modulo: string; entidadId?: string; detalles: any; timestamp: Date; severidad: SeveridadLog; resultadoExito: boolean; ip: string; userAgent: string }[] = [
    { usuarioId: admin.id, accion: 'LOGIN', modulo: 'AUTH', detalles: { metodo: 'email+password' }, timestamp: hoursAgo(1), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[0], userAgent: agents[0] },
    { usuarioId: admin.id, accion: 'VER_DASHBOARD', modulo: 'SISTEMA', detalles: { pagina: '/dashboard' }, timestamp: hoursAgo(0.9), severidad: SeveridadLog.DEBUG, resultadoExito: true, ip: ips[0], userAgent: agents[0] },
    { usuarioId: genUser.id, accion: 'LOGIN', modulo: 'AUTH', detalles: { metodo: 'email+password' }, timestamp: hoursAgo(2), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[1], userAgent: agents[1] },
    { usuarioId: genUser.id, accion: 'CREAR_MANIFIESTO', modulo: 'MANIFIESTOS', entidadId: manifiestos[0]?.id, detalles: { numero: 'MAN-2025-0001', residuos: 1 }, timestamp: hoursAgo(1.8), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[1], userAgent: agents[1] },
    { usuarioId: transUser.id, accion: 'LOGIN', modulo: 'AUTH', detalles: { metodo: 'email+password', dispositivo: 'mobile' }, timestamp: hoursAgo(3), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[2], userAgent: agents[2] },
    { usuarioId: transUser.id, accion: 'CONFIRMAR_RETIRO', modulo: 'MANIFIESTOS', entidadId: manifiestos[3]?.id, detalles: { numero: 'MAN-2025-0004', ubicacion: 'Mendoza Centro' }, timestamp: hoursAgo(2.5), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[2], userAgent: agents[2] },
    { usuarioId: opUser.id, accion: 'LOGIN', modulo: 'AUTH', detalles: { metodo: 'email+password' }, timestamp: hoursAgo(4), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[3], userAgent: agents[3] },
    { usuarioId: opUser.id, accion: 'CONFIRMAR_RECEPCION', modulo: 'MANIFIESTOS', entidadId: manifiestos[6]?.id, detalles: { numero: 'MAN-2025-0007', pesoVerificado: 450 }, timestamp: hoursAgo(3.5), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[3], userAgent: agents[3] },
    { usuarioId: admin.id, accion: 'APROBAR_MANIFIESTO', modulo: 'MANIFIESTOS', entidadId: manifiestos[2]?.id, detalles: { numero: 'MAN-2025-0003' }, timestamp: daysAgo(1), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[0], userAgent: agents[0] },
    { usuarioId: admin.id, accion: 'APROBAR_USUARIO', modulo: 'USUARIOS', detalles: { usuario: 'Roberto Gómez', rol: 'GENERADOR' }, timestamp: daysAgo(1), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[0], userAgent: agents[0] },
    { usuarioId: opUser.id, accion: 'REGISTRAR_TRATAMIENTO', modulo: 'MANIFIESTOS', entidadId: manifiestos[7]?.id, detalles: { numero: 'MAN-2025-0008', metodo: 'Incineración' }, timestamp: daysAgo(1), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[3], userAgent: agents[3] },
    { usuarioId: transUser.id, accion: 'CONFIRMAR_ENTREGA', modulo: 'MANIFIESTOS', entidadId: manifiestos[5]?.id, detalles: { numero: 'MAN-2025-0006', ubicacion: 'Planta Tratamiento' }, timestamp: daysAgo(1), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[2], userAgent: agents[2] },
    { usuarioId: genUser.id, accion: 'FIRMAR_MANIFIESTO', modulo: 'MANIFIESTOS', entidadId: manifiestos[2]?.id, detalles: { numero: 'MAN-2025-0003', firmaDigital: true }, timestamp: daysAgo(2), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[1], userAgent: agents[1] },
    { usuarioId: admin.id, accion: 'EXPORTAR_REPORTE', modulo: 'REPORTES', detalles: { tipo: 'manifiestos_mensual', formato: 'CSV' }, timestamp: daysAgo(2), severidad: SeveridadLog.INFO, resultadoExito: true, ip: ips[0], userAgent: agents[0] },
    { usuarioId: admin.id, accion: 'RECHAZAR_USUARIO', modulo: 'USUARIOS', detalles: { usuario: 'Héctor Mendez', motivo: 'Documentación vencida' }, timestamp: daysAgo(3), severidad: SeveridadLog.WARNING, resultadoExito: true, ip: ips[0], userAgent: agents[0] },
    { usuarioId: transUser.id, accion: 'INCIDENTE_TRANSPORTE', modulo: 'MANIFIESTOS', entidadId: manifiestos[4]?.id, detalles: { tipo: 'desvio_ruta', descripcion: 'Desvío por corte en Ruta 7' }, timestamp: daysAgo(4), severidad: SeveridadLog.WARNING, resultadoExito: true, ip: ips[2], userAgent: agents[2] },
    { usuarioId: admin.id, accion: 'LOGIN_FALLIDO', modulo: 'AUTH', detalles: { motivo: 'Contraseña incorrecta', intentos: 2 }, timestamp: daysAgo(5), severidad: SeveridadLog.WARNING, resultadoExito: false, ip: '45.33.22.11', userAgent: agents[2] },
    ...Array.from({ length: 20 }, (_, i) => ({
      usuarioId: [admin.id, genUser.id, transUser.id, opUser.id, adminTransportistas.id, adminOperadores.id, adminGeneradores.id][i % 7],
      accion: ['LOGIN', 'VER_MANIFIESTOS', 'VER_DASHBOARD', 'VER_REPORTES', 'BUSCAR'][i % 5],
      modulo: ['AUTH', 'MANIFIESTOS', 'SISTEMA', 'REPORTES', 'MANIFIESTOS'][i % 5],
      detalles: { pagina: ['/', '/manifiestos', '/dashboard', '/reportes', '/manifiestos'][i % 5] },
      timestamp: daysAgo(Math.floor(i / 3) + 1),
      severidad: SeveridadLog.INFO,
      resultadoExito: true,
      ip: ips[i % 5],
      userAgent: agents[i % 4],
    })),
  ];

  for (const a of actividadData) {
    await prisma.logActividad.create({ data: { usuarioId: a.usuarioId, accion: a.accion, modulo: a.modulo, entidadId: a.entidadId || null, detalles: a.detalles, timestamp: a.timestamp, severidad: a.severidad, resultadoExito: a.resultadoExito, ip: a.ip, userAgent: a.userAgent } });
  }
  console.log(`  ✅ ${actividadData.length} registros de actividad creados`);

  // ============================================================
  // 5. ALERTAS DE SEGURIDAD
  // ============================================================
  console.log('\n🔒 Creando alertas de seguridad...');
  await prisma.alertaSeguridad.deleteMany({});

  const alertasSeguridad = [
    { tipo: TipoAlertaSeguridad.MULTIPLES_LOGIN_FALLIDOS, descripcion: 'Se detectaron 3 intentos fallidos de login para admin@dgfa.mendoza.gov.ar desde IP 45.33.22.11', usuarioAfectadoId: admin.id, datos: { intentos: 3, ip: '45.33.22.11', periodo: '10 minutos' }, severidad: SeveridadLog.ERROR, resuelta: true, resueltaPorId: admin.id, fechaResolucion: daysAgo(4), notas: 'IP verificada como interna. Usuario cambió contraseña.', createdAt: daysAgo(5) },
    { tipo: TipoAlertaSeguridad.ACTIVIDAD_FUERA_HORARIO, descripcion: 'Actividad detectada fuera del horario laboral para usuario Transportes Andes', usuarioAfectadoId: transUser.id, datos: { hora: '02:35', accion: 'LOGIN', ip: ips[2] }, severidad: SeveridadLog.WARNING, resuelta: true, resueltaPorId: adminTransportistas.id, fechaResolucion: daysAgo(6), notas: 'Transporte nocturno programado. Sin anomalías.', createdAt: daysAgo(7) },
    { tipo: TipoAlertaSeguridad.IP_INUSUAL, descripcion: 'Login desde IP no registrada previamente para usuario Química Mendoza', usuarioAfectadoId: genUser.id, datos: { ipNueva: '201.235.44.88', ipUsual: ips[1], ubicacion: 'Buenos Aires, AR' }, severidad: SeveridadLog.WARNING, resuelta: false, createdAt: daysAgo(2) },
    { tipo: TipoAlertaSeguridad.PATRON_ANOMALO, descripcion: 'Patrón inusual: 15 consultas de manifiestos en 2 minutos', usuarioAfectadoId: genUser.id, datos: { consultas: 15, periodo: '2 minutos', endpoint: '/api/manifiestos' }, severidad: SeveridadLog.INFO, resuelta: false, createdAt: daysAgo(1) },
    { tipo: TipoAlertaSeguridad.REVERSIONES_FRECUENTES, descripcion: 'Se detectaron 3 reversiones de estado en las últimas 24 horas', usuarioAfectadoId: opUser.id, datos: { reversiones: 3, manifiestos: ['MAN-2025-0006', 'MAN-2025-0007'], periodo: '24 horas' }, severidad: SeveridadLog.ERROR, resuelta: false, createdAt: hoursAgo(6) },
  ];

  for (const a of alertasSeguridad) {
    await prisma.alertaSeguridad.create({ data: { tipo: a.tipo, descripcion: a.descripcion, usuarioAfectadoId: a.usuarioAfectadoId, datos: a.datos, severidad: a.severidad, resuelta: a.resuelta, resueltaPorId: a.resueltaPorId || null, fechaResolucion: a.fechaResolucion || null, notas: a.notas || null, createdAt: a.createdAt } });
  }
  console.log(`  ✅ ${alertasSeguridad.length} alertas de seguridad creadas`);

  // ============================================================
  // 6. REGLAS DE ALERTA + ALERTAS GENERADAS
  // ============================================================
  console.log('\n⚡ Creando reglas de alerta y alertas generadas...');
  await prisma.alertaGenerada.deleteMany({});
  await prisma.reglaAlerta.deleteMany({});

  const reglas = [
    { nombre: 'Tiempo excesivo en tránsito', descripcion: 'Alerta cuando un manifiesto lleva más de 48 horas en tránsito', evento: EventoAlerta.TIEMPO_EXCESIVO, condicion: JSON.stringify({ horasMaximo: 48 }), destinatarios: JSON.stringify(['admin@dgfa.mendoza.gov.ar']), activa: true, creadoPorId: admin.id },
    { nombre: 'Desvío de ruta detectado', descripcion: 'Alerta cuando el GPS detecta un desvío mayor a 5km', evento: EventoAlerta.DESVIO_RUTA, condicion: JSON.stringify({ distanciaMaxKm: 5 }), destinatarios: JSON.stringify(['admin@dgfa.mendoza.gov.ar', 'admin.transportistas@dgfa.mendoza.gov.ar']), activa: true, creadoPorId: admin.id },
    { nombre: 'Diferencia de peso significativa', descripcion: 'Alerta cuando la diferencia de peso supera el 10%', evento: EventoAlerta.DIFERENCIA_PESO, condicion: JSON.stringify({ porcentajeMaximo: 10 }), destinatarios: JSON.stringify(['admin@dgfa.mendoza.gov.ar']), activa: true, creadoPorId: admin.id },
    { nombre: 'Rechazo de carga', descripcion: 'Notificar inmediatamente cuando un operador rechaza una carga', evento: EventoAlerta.RECHAZO_CARGA, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['admin@dgfa.mendoza.gov.ar']), activa: true, creadoPorId: admin.id },
    { nombre: 'Vencimiento próximo de habilitación', descripcion: 'Alerta 30 días antes del vencimiento', evento: EventoAlerta.VENCIMIENTO, condicion: JSON.stringify({ diasAnticipacion: 30 }), destinatarios: JSON.stringify(['admin.transportistas@dgfa.mendoza.gov.ar']), activa: true, creadoPorId: adminTransportistas.id },
    { nombre: 'Anomalía GPS', descripcion: 'Alerta cuando se pierde señal GPS por más de 30 minutos', evento: EventoAlerta.ANOMALIA_GPS, condicion: JSON.stringify({ minutosMaxSinSenal: 30 }), destinatarios: JSON.stringify(['admin@dgfa.mendoza.gov.ar']), activa: false, creadoPorId: admin.id },
  ];

  const reglasCreadas = [];
  for (const r of reglas) {
    const regla = await prisma.reglaAlerta.create({ data: r });
    reglasCreadas.push(regla);
  }
  console.log(`  ✅ ${reglasCreadas.length} reglas de alerta creadas`);

  if (manifiestos.length >= 7) {
    const alertasGeneradas = [
      { reglaId: reglasCreadas[0].id, manifiestoId: manifiestos[3]?.id, datos: JSON.stringify({ horasEnTransito: 52, numero: 'MAN-2025-0004' }), estado: EstadoAlerta.PENDIENTE, createdAt: daysAgo(1) },
      { reglaId: reglasCreadas[1].id, manifiestoId: manifiestos[4]?.id, datos: JSON.stringify({ desvioKm: 8.3, numero: 'MAN-2025-0005' }), estado: EstadoAlerta.EN_REVISION, createdAt: daysAgo(3) },
      { reglaId: reglasCreadas[2].id, manifiestoId: manifiestos[6]?.id, datos: JSON.stringify({ pesoDeclarado: 500, pesoRecibido: 435, diferenciaPct: 13 }), estado: EstadoAlerta.RESUELTA, resueltaPor: opUser.id, fechaResolucion: daysAgo(1), notas: 'Diferencia justificada por evaporación de solventes.', createdAt: daysAgo(2) },
    ];
    for (const ag of alertasGeneradas) {
      await prisma.alertaGenerada.create({ data: { reglaId: ag.reglaId, manifiestoId: ag.manifiestoId, datos: ag.datos, estado: ag.estado, resueltaPor: (ag as any).resueltaPor || null, fechaResolucion: (ag as any).fechaResolucion || null, notas: (ag as any).notas || null, createdAt: ag.createdAt } });
    }
    console.log(`  ✅ ${alertasGeneradas.length} alertas generadas`);
  }

  // ============================================================
  // 7. ANOMALÍAS DE TRANSPORTE
  // ============================================================
  console.log('\n🚨 Creando anomalías de transporte...');
  await prisma.anomaliaTransporte.deleteMany({});

  if (manifiestos.length >= 5) {
    const anomalias = [
      { manifiestoId: manifiestos[3]?.id, tipo: TipoAnomalia.DESVIO_RUTA, descripcion: 'Vehículo se desvió 8.3 km de la ruta planificada a la altura de Godoy Cruz', latitud: -32.9271, longitud: -68.7536, valorDetectado: 8.3, valorEsperado: 5.0, severidad: SeveridadAnomalia.MEDIA, resuelta: true, resueltaPor: 'Desvío por obras en Ruta 40. Ruta alternativa verificada.', fechaResolucion: daysAgo(2), createdAt: daysAgo(3) },
      { manifiestoId: manifiestos[4]?.id, tipo: TipoAnomalia.PARADA_PROLONGADA, descripcion: 'Vehículo detenido por 45 minutos en ubicación no programada', latitud: -32.8654, longitud: -68.8123, valorDetectado: 45.0, valorEsperado: 15.0, severidad: SeveridadAnomalia.BAJA, resuelta: true, resueltaPor: 'Parada para repostaje de combustible. Sin irregularidades.', fechaResolucion: daysAgo(3), createdAt: daysAgo(4) },
      { manifiestoId: manifiestos[3]?.id, tipo: TipoAnomalia.VELOCIDAD_ANORMAL, descripcion: 'Velocidad registrada de 110 km/h en zona urbana (máx: 60 km/h)', latitud: -32.8908, longitud: -68.8272, valorDetectado: 110.0, valorEsperado: 60.0, severidad: SeveridadAnomalia.ALTA, resuelta: false, createdAt: daysAgo(1) },
      { manifiestoId: manifiestos[4]?.id, tipo: TipoAnomalia.GPS_PERDIDO, descripcion: 'Señal GPS perdida durante 35 minutos en tramo Luján de Cuyo', latitud: -33.0356, longitud: -68.8777, valorDetectado: 35.0, valorEsperado: 0.0, severidad: SeveridadAnomalia.MEDIA, resuelta: false, createdAt: hoursAgo(8) },
    ];
    for (const an of anomalias) {
      await prisma.anomaliaTransporte.create({ data: { manifiestoId: an.manifiestoId, tipo: an.tipo, descripcion: an.descripcion, latitud: an.latitud, longitud: an.longitud, valorDetectado: an.valorDetectado, valorEsperado: an.valorEsperado, severidad: an.severidad, resuelta: an.resuelta, resueltaPor: an.resueltaPor || null, fechaResolucion: an.fechaResolucion || null, createdAt: an.createdAt } });
    }
    console.log(`  ✅ ${anomalias.length} anomalías de transporte creadas`);
  }

  // ============================================================
  // 8. NOTIFICACIONES
  // ============================================================
  console.log('\n🔔 Creando notificaciones...');
  await prisma.notificacion.deleteMany({});

  const notificaciones: { usuarioId: string; tipo: TipoNotificacion; titulo: string; mensaje: string; manifiestoId?: string; prioridad: PrioridadNotificacion; leida: boolean; fechaLeida?: Date; createdAt: Date }[] = [
    { usuarioId: admin.id, tipo: TipoNotificacion.MANIFIESTO_PENDIENTE, titulo: 'Nuevo manifiesto pendiente de aprobación', mensaje: 'El manifiesto MAN-2025-0003 requiere aprobación de DGFA', manifiestoId: manifiestos[2]?.id, prioridad: PrioridadNotificacion.ALTA, leida: true, fechaLeida: daysAgo(4), createdAt: daysAgo(5) },
    { usuarioId: admin.id, tipo: TipoNotificacion.ALERTA_SISTEMA, titulo: 'Alerta: Intentos de login fallidos', mensaje: 'Se detectaron 3 intentos de login fallidos desde IP 45.33.22.11', prioridad: PrioridadNotificacion.URGENTE, leida: true, fechaLeida: daysAgo(4), createdAt: daysAgo(5) },
    { usuarioId: admin.id, tipo: TipoNotificacion.INFO_GENERAL, titulo: '5 usuarios pendientes de aprobación', mensaje: 'Hay 5 usuarios nuevos esperando aprobación en el sistema', prioridad: PrioridadNotificacion.NORMAL, leida: false, createdAt: daysAgo(1) },
    { usuarioId: admin.id, tipo: TipoNotificacion.ANOMALIA_DETECTADA, titulo: 'Anomalía: Velocidad excesiva', mensaje: 'Se detectó velocidad de 110 km/h en zona urbana durante transporte MAN-2025-0004', manifiestoId: manifiestos[3]?.id, prioridad: PrioridadNotificacion.ALTA, leida: false, createdAt: daysAgo(1) },
    { usuarioId: genUser.id, tipo: TipoNotificacion.MANIFIESTO_APROBADO, titulo: 'Manifiesto aprobado por DGFA', mensaje: 'MAN-2025-0003 fue aprobado y está listo para retiro', manifiestoId: manifiestos[2]?.id, prioridad: PrioridadNotificacion.ALTA, leida: true, fechaLeida: daysAgo(3), createdAt: daysAgo(4) },
    { usuarioId: genUser.id, tipo: TipoNotificacion.MANIFIESTO_EN_TRANSITO, titulo: 'Manifiesto en tránsito', mensaje: 'El transportista confirmó retiro de residuos - MAN-2025-0004', manifiestoId: manifiestos[3]?.id, prioridad: PrioridadNotificacion.NORMAL, leida: true, fechaLeida: daysAgo(2), createdAt: daysAgo(3) },
    { usuarioId: genUser.id, tipo: TipoNotificacion.MANIFIESTO_TRATADO, titulo: 'Tratamiento completado', mensaje: 'MAN-2025-0008 fue tratado exitosamente. Certificado disponible.', manifiestoId: manifiestos[7]?.id, prioridad: PrioridadNotificacion.NORMAL, leida: false, createdAt: daysAgo(1) },
    { usuarioId: transUser.id, tipo: TipoNotificacion.MANIFIESTO_APROBADO, titulo: 'Nuevo manifiesto listo para retiro', mensaje: 'MAN-2025-0003 aprobado. Coordinar retiro con generador.', manifiestoId: manifiestos[2]?.id, prioridad: PrioridadNotificacion.ALTA, leida: true, fechaLeida: daysAgo(3), createdAt: daysAgo(4) },
    { usuarioId: transUser.id, tipo: TipoNotificacion.MANIFIESTO_ENTREGADO, titulo: 'Entrega confirmada', mensaje: 'La entrega de MAN-2025-0006 fue confirmada exitosamente', manifiestoId: manifiestos[5]?.id, prioridad: PrioridadNotificacion.NORMAL, leida: true, fechaLeida: daysAgo(1), createdAt: daysAgo(2) },
    { usuarioId: transUser.id, tipo: TipoNotificacion.VENCIMIENTO_PROXIMO, titulo: 'Vencimiento de habilitación vehicular', mensaje: 'La habilitación del vehículo PE123CD vence en 28 días', prioridad: PrioridadNotificacion.ALTA, leida: false, createdAt: daysAgo(1) },
    { usuarioId: opUser.id, tipo: TipoNotificacion.MANIFIESTO_ENTREGADO, titulo: 'Carga entregada en planta', mensaje: 'El transportista entregó la carga de MAN-2025-0006', manifiestoId: manifiestos[5]?.id, prioridad: PrioridadNotificacion.ALTA, leida: true, fechaLeida: daysAgo(1), createdAt: daysAgo(2) },
    { usuarioId: opUser.id, tipo: TipoNotificacion.MANIFIESTO_RECIBIDO, titulo: 'Recepción confirmada', mensaje: 'Se confirmó recepción y pesaje de MAN-2025-0007', manifiestoId: manifiestos[6]?.id, prioridad: PrioridadNotificacion.NORMAL, leida: true, fechaLeida: daysAgo(1), createdAt: daysAgo(2) },
    { usuarioId: opUser.id, tipo: TipoNotificacion.INFO_GENERAL, titulo: 'Recordatorio: 2 manifiestos pendientes', mensaje: 'Hay 2 manifiestos en estado RECIBIDO esperando tratamiento', prioridad: PrioridadNotificacion.NORMAL, leida: false, createdAt: hoursAgo(6) },
    { usuarioId: adminTransportistas.id, tipo: TipoNotificacion.INFO_GENERAL, titulo: 'Nuevo transportista pendiente', mensaje: 'Diego Carmona solicitó alta como transportista', prioridad: PrioridadNotificacion.NORMAL, leida: false, createdAt: daysAgo(1) },
    { usuarioId: adminOperadores.id, tipo: TipoNotificacion.INFO_GENERAL, titulo: 'Nuevo operador pendiente', mensaje: 'Marcelo Quiroga solicitó alta como operador', prioridad: PrioridadNotificacion.NORMAL, leida: false, createdAt: daysAgo(1) },
    { usuarioId: adminGeneradores.id, tipo: TipoNotificacion.INFO_GENERAL, titulo: '2 generadores pendientes', mensaje: 'Solventes Cuyo y Metalúrgica San Rafael requieren aprobación', prioridad: PrioridadNotificacion.NORMAL, leida: false, createdAt: daysAgo(1) },
  ];

  for (const n of notificaciones) {
    await prisma.notificacion.create({ data: { usuarioId: n.usuarioId, tipo: n.tipo, titulo: n.titulo, mensaje: n.mensaje, manifiestoId: n.manifiestoId || null, prioridad: n.prioridad, leida: n.leida, fechaLeida: n.fechaLeida || null, createdAt: n.createdAt } });
  }
  console.log(`  ✅ ${notificaciones.length} notificaciones creadas`);

  // ============================================================
  // 9. REVERSIONES DE ESTADO
  // ============================================================
  console.log('\n🔄 Creando reversiones de estado...');
  await prisma.reversionEstado.deleteMany({});

  if (manifiestos.length >= 7) {
    const reversiones = [
      { manifiestoId: manifiestos[5]?.id, estadoAnterior: EstadoManifiesto.ENTREGADO, estadoNuevo: EstadoManifiesto.EN_TRANSITO, motivo: 'Error en confirmación de entrega. Dirección incorrecta.', tipoReversion: TipoReversion.ERROR_TRANSPORTISTA, usuarioId: transUser.id, rolUsuario: Rol.TRANSPORTISTA, ip: ips[2], userAgent: agents[2], createdAt: daysAgo(3) },
      { manifiestoId: manifiestos[6]?.id, estadoAnterior: EstadoManifiesto.RECIBIDO, estadoNuevo: EstadoManifiesto.ENTREGADO, motivo: 'Diferencia de peso no documentada. Se requiere nuevo pesaje.', tipoReversion: TipoReversion.REVISION_CERTIFICADO, usuarioId: opUser.id, rolUsuario: Rol.OPERADOR, ip: ips[3], userAgent: agents[3], createdAt: daysAgo(2) },
    ];
    for (const r of reversiones) {
      await prisma.reversionEstado.create({ data: r });
    }
    console.log(`  ✅ ${reversiones.length} reversiones de estado creadas`);
  }

  // ============================================================
  // RESUMEN
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Seed administrativo completado!\n');
  console.log('📋 Datos creados:');
  console.log('   👥 3 Admins sectoriales');
  console.log('   ⏳ 5 Usuarios pendientes + 1 rechazado + 1 inactivo');
  console.log(`   📋 ${auditoriaData.length} registros de auditoría`);
  console.log(`   📊 ${actividadData.length} registros de actividad (timeline)`);
  console.log(`   🔒 ${alertasSeguridad.length} alertas de seguridad`);
  console.log(`   ⚡ ${reglas.length} reglas de alerta + 3 alertas generadas`);
  console.log('   🚨 4 anomalías de transporte');
  console.log(`   🔔 ${notificaciones.length} notificaciones`);
  console.log('   🔄 2 reversiones de estado');
  console.log('\n🔐 Credenciales nuevas (contraseña: "password"):');
  console.log('   - Admin Transportistas: admin.transportistas@dgfa.mendoza.gov.ar');
  console.log('   - Admin Operadores:     admin.operadores@dgfa.mendoza.gov.ar');
  console.log('   - Admin Generadores:    admin.generadores@dgfa.mendoza.gov.ar');
  console.log('='.repeat(60));
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
