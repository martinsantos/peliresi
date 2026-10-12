/** Explicit additive cohort seed. Never runs on public or copies real actors. */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { CHECKLIST_BY_ACTOR } from '../controllers/inspeccion.controller';
import { buildDeclaredInspectionSnapshot } from '../services/inspectionDeclaredSnapshot.service';

export async function seedTrainingCohort(db: PrismaClient) {
  const location = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
  if (location[0]?.schema !== 'sitrep_training') throw new Error('Refusing to seed outside the training schema');
  const unexpected = await db.usuario.count({ where: { NOT: { email: { endsWith: '@capacitacion.invalid' } } } });
  if (unexpected) throw new Error('Training schema contains an unrecognized user; no changes made');
  const prefix = 'cap-20261012';
  const roles = ['ADMIN', 'INSPECTOR', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] as const;
  // These users are impersonation-only. No default or shared classroom password.
  const password = await bcrypt.hash(randomBytes(48).toString('base64url'), 10);
  return db.$transaction(async tx => {
    const waste = await tx.tipoResiduo.upsert({ where: { codigo: 'Y-CAP' }, update: {},
      create: { codigo: 'Y-CAP', nombre: 'CAPACITACIÓN · Residuo ficticio', categoria: 'PRACTICA', peligrosidad: 'SIN VALIDEZ OFICIAL' } });
    const users: { id: string; category: string; name: string }[] = [];
    for (const category of roles) for (let index = 1; index <= 5; index++) {
      const id = `${prefix}-${category.toLowerCase()}-${index}`;
      const user = await tx.usuario.upsert({ where: { id }, update: {}, create: {
        id, email: id + '@capacitacion.invalid', password,
        nombre: `CAP · ${category} ${index}`, rol: category === 'INSPECTOR' ? 'ADMIN' : category,
        esInspector: category === 'INSPECTOR', activo: true, emailVerified: true,
        notifEmail: false, notifNuevoRegistro: false, notifWhatsapp: false, notifTelegram: false,
      } });
      if (user.email !== id + '@capacitacion.invalid') throw new Error('Conflicting training identity');
      users.push({ id, category, name: user.nombre });
    }
    for (let index = 1; index <= 5; index++) {
      const userId = (role: string) => `${prefix}-${role}-${index}`;
      const common = { domicilio: 'DOMICILIO FICTICIO · SOLO CAPACITACIÓN', telefono: '0000000000', activo: true,
        latitud: -32.89 + index * .003, longitud: -68.84 + index * .003 };
      const gen = await tx.generador.upsert({ where: { usuarioId: userId('generador') }, update: {},
        create: { ...common, usuarioId: userId('generador'), razonSocial: `CAP · Generador ${index}`, cuit: `99-0000000${index}-0`,
          email: userId('generador') + '@capacitacion.invalid', numeroInscripcion: `CAP-G-${index}`, categoria: 'GRAN_GENERADOR', corrientesControl: 'Y-CAP' } });
      const tra = await tx.transportista.upsert({ where: { usuarioId: userId('transportista') }, update: {},
        create: { ...common, usuarioId: userId('transportista'), razonSocial: `CAP · Transporte ${index}`, cuit: `99-1000000${index}-0`,
          email: userId('transportista') + '@capacitacion.invalid', numeroHabilitacion: `CAP-T-${index}`, corrientesAutorizadas: 'Y-CAP', vencimientoHabilitacion: new Date('2030-12-31') } });
      const ope = await tx.operador.upsert({ where: { usuarioId: userId('operador') }, update: {},
        create: { ...common, usuarioId: userId('operador'), razonSocial: `CAP · Operador ${index}`, cuit: `99-2000000${index}-0`,
          email: userId('operador') + '@capacitacion.invalid', numeroHabilitacion: `CAP-O-${index}`, categoria: 'TRATAMIENTO', corrientesY: 'Y-CAP',
          modalidades: ['FIJO', 'IN_SITU'], vencimientoHabilitacion: new Date('2030-12-31') } });
      await tx.tratamientoAutorizado.upsert({ where: { operadorId_tipoResiduoId_metodo: { operadorId: ope.id, tipoResiduoId: waste.id, metodo: 'CAP ESTABILIZACION' } }, update: {},
        create: { operadorId: ope.id, tipoResiduoId: waste.id, metodo: 'CAP ESTABILIZACION', activo: true } });
      await tx.vehiculo.upsert({ where: { id: `${prefix}-vehiculo-${index}` }, update: {},
        create: { id: `${prefix}-vehiculo-${index}`, transportistaId: tra.id, patente: `CAP00${index}`, marca: 'FICTICIA', modelo: 'CAPACITACIÓN', anio: 2026, capacidad: 1000, numeroHabilitacion: `CAP-V-${index}`, vencimiento: new Date('2030-12-31') } });
      await tx.chofer.upsert({ where: { id: `${prefix}-chofer-${index}` }, update: {},
        create: { id: `${prefix}-chofer-${index}`, transportistaId: tra.id, nombre: 'Chofer ficticio', apellido: String(index), dni: `0000000${index}`, licencia: `CAP-L-${index}`, telefono: '0000000000', vencimiento: new Date('2030-12-31') } });
      for (const [tipoActor, actorId, field] of [['GENERADOR', gen.id, 'generadorId'], ['TRANSPORTISTA', tra.id, 'transportistaId'], ['OPERADOR', ope.id, 'operadorId']] as const) {
        const id = `${prefix}-inspeccion-${index}-${tipoActor}`;
        const snapshot = await buildDeclaredInspectionSnapshot(tx, tipoActor, actorId);
        await tx.inspeccion.upsert({ where: { id }, update: {}, create: {
          id, numero: `CAP-I-${index}-${tipoActor}`, numeroActa: `DEMO-CAP-${index}-${tipoActor}`, tipoActor,
          [field]: actorId, inspectorId: userId('inspector'), estado: 'BORRADOR',
          ubicacion: 'LUGAR FICTICIO · SOLO CAPACITACIÓN', observaciones: 'SIN VALIDEZ OFICIAL',
          declaradoSnapshot: snapshot as any,
          items: { create: CHECKLIST_BY_ACTOR[tipoActor].map(item => ({ ...item, obligatorio: item.obligatorio ?? true })) },
          comparaciones: { create: snapshot.fields.map(row => ({ ...row })) },
        } });
      }
      await tx.agenteSoporte.upsert({ where: { usuarioId: userId('admin') }, update: {}, create: { usuarioId: userId('admin'), habilitado: true } });
      for (const role of ['generador', 'transportista', 'operador']) {
        const id = `${prefix}-ticket-${role}-${index}`;
        await tx.ticketSoporte.upsert({ where: { id }, update: {}, create: {
          id, autorId: userId(role), responsableId: userId('admin'), asunto: `CAP · Consulta de ${role} ${index}`,
          contexto: { capacitacion: true }, clienteId: id, huella: id, estado: 'ABIERTO',
          mensajes: { create: [{ autorId: userId(role), cuerpo: 'Ejercicio de soporte: necesito orientación para completar mi recorrido.', interno: false }] },
        } });
      }
      for (const estado of ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'] as const) {
        const id = `${prefix}-manifiesto-${index}-${estado}`;
        await tx.manifiesto.upsert({ where: { id }, update: {}, create: { id, numero: `CAP-${index}-${estado}`, estado,
          generadorId: gen.id, transportistaId: tra.id, operadorId: ope.id, creadoPorId: userId('generador'),
          isDemoData: true, modalidad: 'FIJO', observaciones: 'CAPACITACIÓN · Sin validez oficial',
          ...(estado === 'EN_TRANSITO' ? { fechaRetiro: new Date() } : {}),
          ...(estado === 'TRATADO' ? { fechaCierre: new Date() } : {}),
          residuos: { create: [{ tipoResiduoId: waste.id, cantidad: 100, unidad: 'kg', estado: 'SOLIDO' }] },
        } });
      }
    }
    return { users, accounts: 40, actors: 15, vehicles: 5, drivers: 5, manifests: 35, inspections: 15, tickets: 15, schema: 'sitrep_training', sentMail: 0 };
  }, { timeout: 30000 });
}
