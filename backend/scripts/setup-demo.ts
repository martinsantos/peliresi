import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setupDemoEnvironment() {
  console.log('🚀 Configurando Ambiente Demo para SITREP...\n');

  // 1. CREAR USUARIOS DEMO CON CREDENCIALES FÁCILES
  console.log('📋 Creando usuarios demo...');
  
  const demoUsers = [
    { email: 'admin@demo.com', password: 'demo123', rol: 'ADMIN', nombre: 'Admin', apellido: 'Demo' },
    { email: 'generador@demo.com', password: 'demo123', rol: 'GENERADOR', nombre: 'Generador', apellido: 'Demo' },
    { email: 'transportista@demo.com', password: 'demo123', rol: 'TRANSPORTISTA', nombre: 'Transportista', apellido: 'Demo' },
    { email: 'operador@demo.com', password: 'demo123', rol: 'OPERADOR', nombre: 'Operador', apellido: 'Demo' },
  ];

  const hashedPassword = await bcrypt.hash('demo123', 10);

  for (const user of demoUsers) {
    await prisma.usuario.upsert({
      where: { email: user.email },
      update: { password: hashedPassword },
      create: {
        email: user.email,
        password: hashedPassword,
        rol: user.rol as any,
        nombre: user.nombre,
        apellido: user.apellido,
        activo: true,
      },
    });
    console.log(`  ✅ ${user.rol}: ${user.email} / demo123`);
  }

  // 2. LIMPIAR ANOMALÍAS INVÁLIDAS (velocidades absurdas)
  console.log('\n🧹 Limpiando anomalías con datos inválidos...');
  const deleted = await prisma.anomaliaTransporte.deleteMany({
    where: {
      valorDetectado: { gt: 500 } // Eliminar cualquier velocidad > 500 km/h que es claramente error
    }
  });
  console.log(`  ✅ Eliminadas ${deleted.count} anomalías con valores inválidos`);

  // 3. LIMPIAR NOTIFICACIONES VIEJAS CON DATOS INCORRECTOS
  console.log('\n🧹 Limpiando notificaciones con datos incorrectos...');
  const deletedNotifs = await prisma.notificacion.deleteMany({
    where: {
      mensaje: { contains: 'km/h' },
      OR: [
        { mensaje: { contains: '1000' } },
        { mensaje: { contains: '2000' } },
        { mensaje: { contains: '20000' } },
        { mensaje: { contains: '21000' } },
        { mensaje: { contains: '22000' } },
      ]
    }
  });
  console.log(`  ✅ Eliminadas ${deletedNotifs.count} notificaciones incorrectas`);

  // 4. CREAR NOTIFICACIONES DEMO REALISTAS
  console.log('\n📬 Creando notificaciones demo realistas...');

  // Obtener usuarios para asociar notificaciones
  const adminUser = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } });
  const genUser = await prisma.usuario.findFirst({ where: { rol: 'GENERADOR' } });
  const transUser = await prisma.usuario.findFirst({ where: { rol: 'TRANSPORTISTA' } });
  const opUser = await prisma.usuario.findFirst({ where: { rol: 'OPERADOR' } });

  // Obtener un manifiesto para referenciar
  const manifiesto = await prisma.manifiesto.findFirst({ orderBy: { fechaCreacion: 'desc' } });

  const notificacionesDemo = [
    // Para Admin
    {
      usuarioId: adminUser?.id,
      tipo: 'MANIFIESTO_FIRMADO',
      titulo: '✅ Nuevo Manifiesto Firmado',
      mensaje: `El manifiesto ${manifiesto?.numero || '2026-000001'} ha sido firmado por Química Mendoza S.A.`,
      prioridad: 'NORMAL',
      leida: false,
      manifiestoId: manifiesto?.id,
    },
    {
      usuarioId: adminUser?.id,
      tipo: 'ANOMALIA_DETECTADA',
      titulo: '⚠️ Alerta: Parada Prolongada',
      mensaje: 'El vehículo AB123CD ha permanecido detenido por 45 minutos en Ruta 40 km 85.',
      prioridad: 'ALTA',
      leida: false,
      manifiestoId: manifiesto?.id,
    },
    {
      usuarioId: adminUser?.id,
      tipo: 'INFO_GENERAL',
      titulo: '📊 Reporte Diario Disponible',
      mensaje: 'Se generó el reporte automático de manifiestos del día. Total procesados: 8.',
      prioridad: 'BAJA',
      leida: true,
    },
    // Para Generador
    {
      usuarioId: genUser?.id,
      tipo: 'MANIFIESTO_EN_TRANSITO',
      titulo: '🚛 Retiro Confirmado',
      mensaje: `Transportes Andes S.R.L. ha retirado los residuos del manifiesto ${manifiesto?.numero || '2026-000001'}.`,
      prioridad: 'NORMAL',
      leida: false,
      manifiestoId: manifiesto?.id,
    },
    {
      usuarioId: genUser?.id,
      tipo: 'MANIFIESTO_TRATADO',
      titulo: '✅ Tratamiento Completado',
      mensaje: 'Tratamiento de Residuos Mendoza S.A. ha confirmado el tratamiento final de su residuo.',
      prioridad: 'NORMAL',
      leida: true,
    },
    // Para Transportista
    {
      usuarioId: transUser?.id,
      tipo: 'ALERTA_SISTEMA',
      titulo: '📦 Nuevo Viaje Asignado',
      mensaje: 'Se le ha asignado un nuevo manifiesto. Origen: Química Mendoza S.A., Destino: Planta de Tratamiento Luján.',
      prioridad: 'ALTA',
      leida: false,
      manifiestoId: manifiesto?.id,
    },
    {
      usuarioId: transUser?.id,
      tipo: 'VENCIMIENTO_PROXIMO',
      titulo: '⏰ Recordatorio de Retiro',
      mensaje: 'Tiene un retiro programado para mañana a las 09:00 en Petroquímica Andes.',
      prioridad: 'NORMAL',
      leida: false,
    },
    // Para Operador
    {
      usuarioId: opUser?.id,
      tipo: 'MANIFIESTO_EN_TRANSITO',
      titulo: '🚛 Residuos en Camino',
      mensaje: 'El manifiesto está en tránsito. ETA: ~45 minutos. Prepárese para recepción.',
      prioridad: 'NORMAL',
      leida: false,
      manifiestoId: manifiesto?.id,
    },
    {
      usuarioId: opUser?.id,
      tipo: 'INFO_GENERAL',
      titulo: '📋 Actualización de Normativa',
      mensaje: 'Se ha actualizado la Resolución 234/26 sobre tiempos máximos de tratamiento.',
      prioridad: 'BAJA',
      leida: true,
    },
  ];

  for (const notif of notificacionesDemo) {
    if (notif.usuarioId) {
      await prisma.notificacion.create({
        data: notif as any
      });
    }
  }
  console.log(`  ✅ Creadas ${notificacionesDemo.length} notificaciones demo realistas`);

  // 5. RESUMEN FINAL
  console.log('\n' + '='.repeat(60));
  console.log('🎉 AMBIENTE DEMO CONFIGURADO EXITOSAMENTE');
  console.log('='.repeat(60));
  console.log('\n📋 CREDENCIALES DE ACCESO DEMO:');
  console.log('┌─────────────────┬───────────────────────────┬──────────┐');
  console.log('│ ROL             │ EMAIL                     │ PASSWORD │');
  console.log('├─────────────────┼───────────────────────────┼──────────┤');
  console.log('│ Administrador   │ admin@demo.com            │ demo123  │');
  console.log('│ Generador       │ generador@demo.com        │ demo123  │');
  console.log('│ Transportista   │ transportista@demo.com    │ demo123  │');
  console.log('│ Operador        │ operador@demo.com         │ demo123  │');
  console.log('└─────────────────┴───────────────────────────┴──────────┘');
  console.log('\n🌐 URL: https://sitrep.ultimamilla.com.ar\n');
}

setupDemoEnvironment()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
