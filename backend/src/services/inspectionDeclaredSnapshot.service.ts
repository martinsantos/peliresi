import { EstadoInspeccion, Prisma, PrismaClient, TipoActorInspeccion } from '@prisma/client';

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface DeclaredComparisonSeed {
  codigo: string;
  categoria: string;
  etiqueta: string;
  origen: string;
  valorDeclarado: string | null;
  orden: number;
}

export interface DeclaredInspectionSnapshot {
  schemaVersion: 2;
  capturedAt: string;
  actorType: TipoActorInspeccion;
  actorId: string;
  fields: DeclaredComparisonSeed[];
}

const date = (value?: Date | null) => value ? value.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }) : null;
const text = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || null;
  return String(value);
};

function field(
  codigo: string,
  categoria: string,
  etiqueta: string,
  origen: string,
  valor: unknown,
  orden: number,
): DeclaredComparisonSeed {
  return { codigo, categoria, etiqueta, origen, valorDeclarado: text(valor), orden };
}

/**
 * Extracts and normalises the Basel Y stream codes stored in the historical
 * actor registries. Those fields have been entered with several separators
 * ("/", comma, semicolon and line breaks), so matching the code itself is
 * safer than relying on a particular delimiter.
 */
export function splitDeclaredWasteStreams(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  const matches = raw.toUpperCase().match(/\bY\s*[-–]?\s*\d+[A-Z]?\b/g) || [];
  return Array.from(new Set(matches.map((item) => item.replace(/[\s\-–]/g, ''))));
}

function wasteStreamFields(
  value: unknown,
  origin: string,
  order: number,
  fallbackLabel: string,
): DeclaredComparisonSeed[] {
  const streams = splitDeclaredWasteStreams(value);
  if (streams.length === 0) return [field('RES-CORRIENTES', 'Residuos', fallbackLabel, origin, value, order)];
  return streams.map((stream, index) => field(
    `RES-${stream}`,
    'Residuos',
    `Corriente ${stream}`,
    `${origin}:${stream}`,
    stream,
    order + index,
  ));
}

export async function buildDeclaredInspectionSnapshot(
  db: DbClient,
  tipoActor: TipoActorInspeccion,
  actorId: string,
): Promise<DeclaredInspectionSnapshot> {
  let fields: DeclaredComparisonSeed[];

  if (tipoActor === 'GENERADOR') {
    const actor = await db.generador.findUniqueOrThrow({
      where: { id: actorId },
      include: { documentos: { select: { estado: true } } },
    });
    fields = [
      field('ID-RAZON', 'Identidad', 'Razón social', 'generador.razonSocial', actor.razonSocial, 10),
      field('ID-CUIT', 'Identidad', 'CUIT', 'generador.cuit', actor.cuit, 20),
      field('CON-DOMICILIO', 'Establecimiento', 'Domicilio declarado', 'generador.domicilio', actor.domicilio, 30),
      field('CON-TELEFONO', 'Contacto', 'Teléfono', 'generador.telefono', actor.telefono, 40),
      field('REG-INSCRIPCION', 'Habilitación', 'Número de inscripción', 'generador.numeroInscripcion', actor.numeroInscripcion, 50),
      field('REG-EXPEDIENTE', 'Habilitación', 'Expediente de inscripción', 'generador.expedienteInscripcion', actor.expedienteInscripcion, 60),
      field('REG-RESOLUCION', 'Habilitación', 'Resolución de inscripción', 'generador.resolucionInscripcion', actor.resolucionInscripcion, 70),
      field('ACT-ACTIVIDAD', 'Actividad', 'Actividad declarada', 'generador.actividad', actor.actividad, 80),
      field('ACT-RUBRO', 'Actividad', 'Rubro', 'generador.rubro', actor.rubro, 90),
      ...wasteStreamFields(actor.corrientesControl, 'generador.corrientesControl', 100, 'Corrientes declaradas'),
      field('DOC-VIGENTES', 'Documentación', 'Documentos regulatorios aprobados', 'generador.documentos', actor.documentos.filter((d) => d.estado === 'APROBADO').length, 110),
    ];
  } else if (tipoActor === 'TRANSPORTISTA') {
    const actor = await db.transportista.findUniqueOrThrow({
      where: { id: actorId },
      include: {
        vehiculos: { where: { activo: true }, orderBy: { patente: 'asc' } },
        choferes: { where: { activo: true }, orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] },
      },
    });
    fields = [
      field('ID-RAZON', 'Identidad', 'Razón social', 'transportista.razonSocial', actor.razonSocial, 10),
      field('ID-CUIT', 'Identidad', 'CUIT', 'transportista.cuit', actor.cuit, 20),
      field('CON-DOMICILIO', 'Establecimiento', 'Domicilio declarado', 'transportista.domicilio', actor.domicilio, 30),
      field('REG-HABILITACION', 'Habilitación', 'Número de habilitación', 'transportista.numeroHabilitacion', actor.numeroHabilitacion, 40),
      field('REG-VENCIMIENTO', 'Habilitación', 'Vencimiento de habilitación', 'transportista.vencimientoHabilitacion', date(actor.vencimientoHabilitacion), 50),
      field('REG-EXPEDIENTE', 'Habilitación', 'Expediente DPA', 'transportista.expedienteDPA', actor.expedienteDPA, 60),
      field('REG-RESOLUCION', 'Habilitación', 'Resolución DPA', 'transportista.resolucionDPA', actor.resolucionDPA, 70),
      ...wasteStreamFields(actor.corrientesAutorizadas, 'transportista.corrientesAutorizadas', 80, 'Corrientes autorizadas'),
      field('FLO-VEHICULOS', 'Flota', 'Vehículos activos declarados', 'transportista.vehiculos', actor.vehiculos.map((v) => `${v.patente} · ${v.marca} ${v.modelo} · ${v.numeroHabilitacion} · vence ${date(v.vencimiento) || 's/d'}`).join('\n'), 90),
      field('FLO-CHOFERES', 'Flota', 'Conductores activos declarados', 'transportista.choferes', actor.choferes.map((c) => `${c.apellido}, ${c.nombre} · DNI ${c.dni} · licencia ${c.licencia} · vence ${date(c.vencimiento) || 's/d'}`).join('\n'), 100),
      // The current main schema does not expose transportista documents as a
      // relation. Report the value as unavailable instead of turning missing
      // integration into a misleading zero.
      field('DOC-VIGENTES', 'Documentación', 'Documentos regulatorios aprobados', 'transportista.documentos', null, 110),
    ];
  } else {
    const actor = await db.operador.findUniqueOrThrow({
      where: { id: actorId },
      include: {
        tratamientos: { where: { activo: true }, include: { tipoResiduo: { select: { codigo: true, nombre: true } } } },
        sedes: { where: { activo: true }, orderBy: { nombre: 'asc' } },
        documentos: { select: { estado: true } },
      },
    });
    fields = [
      field('ID-RAZON', 'Identidad', 'Razón social', 'operador.razonSocial', actor.razonSocial, 10),
      field('ID-CUIT', 'Identidad', 'CUIT', 'operador.cuit', actor.cuit, 20),
      field('CON-DOMICILIO', 'Establecimiento', 'Domicilio declarado', 'operador.domicilio', actor.domicilio, 30),
      field('REG-HABILITACION', 'Habilitación', 'Número de habilitación', 'operador.numeroHabilitacion', actor.numeroHabilitacion, 40),
      field('REG-VENCIMIENTO', 'Habilitación', 'Vencimiento de habilitación', 'operador.vencimientoHabilitacion', date(actor.vencimientoHabilitacion), 50),
      field('REG-EXPEDIENTE', 'Habilitación', 'Expediente de inscripción', 'operador.expedienteInscripcion', actor.expedienteInscripcion, 60),
      field('REG-RESOLUCION', 'Habilitación', 'Resolución DPA', 'operador.resolucionDPA', actor.resolucionDPA, 70),
      field('ACT-TECNOLOGIA', 'Operación', 'Tecnología declarada', 'operador.tecnologia', actor.tecnologia, 80),
      ...wasteStreamFields(actor.corrientesY, 'operador.corrientesY', 90, 'Corrientes Y autorizadas'),
      field('ACT-TRATAMIENTOS', 'Operación', 'Tratamientos autorizados', 'operador.tratamientos', actor.tratamientos.map((t) => `${t.tipoResiduo.codigo} · ${t.metodo}${t.numeroResolucion ? ` · Res. ${t.numeroResolucion}` : ''}`).join('\n'), 100),
      field('EST-SEDES', 'Establecimiento', 'Sedes operativas', 'operador.sedes', actor.sedes.map((s) => `${s.nombre} · ${s.tipo} · ${s.domicilio}`).join('\n'), 110),
      field('DOC-VIGENTES', 'Documentación', 'Documentos regulatorios aprobados', 'operador.documentos', actor.documentos.filter((d) => d.estado === 'APROBADO').length, 120),
    ];
  }

  return {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    actorType: tipoActor,
    actorId,
    fields,
  };
}

export async function ensureInspectionDeclaredComparisons(db: DbClient, inspection: {
  id: string;
  estado: EstadoInspeccion;
  tipoActor: TipoActorInspeccion;
  generadorId: string | null;
  transportistaId: string | null;
  operadorId: string | null;
  declaradoSnapshot: Prisma.JsonValue | null;
}): Promise<void> {
  const existing = await db.comparacionInspeccion.findMany({
    where: { inspeccionId: inspection.id },
    include: { _count: { select: { evidencias: true } } },
  });

  const editable = new Set<EstadoInspeccion>(['BORRADOR', 'PLANIFICADA', 'EN_CAMPO']).has(inspection.estado);
  const legacySummary = existing.find((row) => row.codigo === 'RES-CORRIENTES-RESUMEN');

  // A previous compatibility pass could split a reviewed, already-closed row
  // into fresh PENDIENTE children. Historical acts are immutable: when those
  // generated children are still pristine, collapse them back to the reviewed
  // summary instead of changing the meaning of the signed record.
  if (!editable && legacySummary) {
    const streamCodes = splitDeclaredWasteStreams(legacySummary.valorDeclarado).map((stream) => `RES-${stream}`);
    const generatedChildren = existing.filter((row) => streamCodes.includes(row.codigo));
    const allPristine = generatedChildren.length === streamCodes.length
      && generatedChildren.every((row) => row.resultado === 'PENDIENTE'
        && !row.valorObservado
        && !row.observacion
        && row._count.evidencias === 0);
    if (allPristine) {
      await db.comparacionInspeccion.deleteMany({ where: { id: { in: generatedChildren.map((row) => row.id) } } });
      await db.comparacionInspeccion.update({
        where: { id: legacySummary.id },
        data: {
          codigo: 'RES-CORRIENTES',
          etiqueta: inspection.tipoActor === 'OPERADOR' ? 'Corrientes Y autorizadas' : inspection.tipoActor === 'TRANSPORTISTA' ? 'Corrientes autorizadas' : 'Corrientes declaradas',
        },
      });
    }
    return;
  }

  const legacyStreams = existing.find((row) => row.codigo === 'RES-CORRIENTES');
  if (legacyStreams) {
    const streams = splitDeclaredWasteStreams(legacyStreams.valorDeclarado);
    if (editable && streams.length > 1) {
      await db.comparacionInspeccion.createMany({
        data: streams.map((stream, index) => ({
          inspeccionId: inspection.id,
          codigo: `RES-${stream}`,
          categoria: 'Residuos',
          etiqueta: `Corriente ${stream}`,
          origen: `${legacyStreams.origen}:${stream}`,
          valorDeclarado: stream,
          orden: legacyStreams.orden + index,
        })),
        skipDuplicates: true,
      });

      const hasReview = legacyStreams.resultado !== 'PENDIENTE'
        || Boolean(legacyStreams.valorObservado)
        || Boolean(legacyStreams.observacion)
        || legacyStreams._count.evidencias > 0;
      if (hasReview) {
        await db.comparacionInspeccion.update({
          where: { id: legacyStreams.id },
          data: {
            codigo: 'RES-CORRIENTES-RESUMEN',
            etiqueta: 'Resumen previo de corrientes',
            resultado: legacyStreams.resultado === 'PENDIENTE' ? 'NO_APLICA' : legacyStreams.resultado,
          },
        });
      } else {
        await db.comparacionInspeccion.delete({ where: { id: legacyStreams.id } });
      }

      const snapshotValue = inspection.declaradoSnapshot as Record<string, unknown> | null;
      const snapshotFields = Array.isArray(snapshotValue?.fields)
        ? snapshotValue.fields as DeclaredComparisonSeed[]
        : [];
      const upgradedFields = snapshotFields.flatMap((row) => row.codigo === 'RES-CORRIENTES'
        ? wasteStreamFields(row.valorDeclarado, row.origen, row.orden, row.etiqueta)
        : [row]);
      if (snapshotValue && upgradedFields.length > 0) {
        await db.inspeccion.update({
          where: { id: inspection.id },
          data: {
            declaradoSnapshot: {
              ...snapshotValue,
              schemaVersion: 2,
              fields: upgradedFields,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return;
    }
  }

  if (existing.length > 0 && inspection.declaradoSnapshot) return;
  const actorId = inspection.generadorId || inspection.transportistaId || inspection.operadorId;
  if (!actorId) return;
  const snapshot = await buildDeclaredInspectionSnapshot(db, inspection.tipoActor, actorId);
  await db.inspeccion.update({ where: { id: inspection.id }, data: { declaradoSnapshot: snapshot as unknown as Prisma.InputJsonValue } });
  await db.comparacionInspeccion.createMany({
    data: snapshot.fields.map((row) => ({ ...row, inspeccionId: inspection.id })),
    skipDuplicates: true,
  });
}
