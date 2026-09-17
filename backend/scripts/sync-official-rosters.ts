/**
 * Synchronize the official dangerous-waste actor rosters with SITREP.
 *
 * The input is a normalized JSON payload produced from the three official
 * workbooks. The script is intentionally dry-run by default. Pass --apply to
 * write changes; every write is performed in one database transaction.
 *
 * Usage:
 *   ts-node scripts/sync-official-rosters.ts --payload /path/payload.json
 *   ts-node scripts/sync-official-rosters.ts --payload /path/payload.json --apply
 */

import { Prisma, PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

type Nullable<T> = T | null;

interface SourceReference {
  path: string;
  sha256: string;
}

interface GeneratorPayload {
  cuit: string;
  sourceRows: number[];
  certificates: string[];
  razonSocial: string;
  numeroInscripcion: string;
  domicilio: string;
  telefono: string;
  email: string;
  actividad: Nullable<string>;
  rubro: Nullable<string>;
  categoria: string;
  corrientesControl: Nullable<string>;
  expedienteInscripcion: Nullable<string>;
  domicilioLegalCalle: Nullable<string>;
  domicilioLegalLocalidad: Nullable<string>;
  domicilioLegalDepto: Nullable<string>;
  domicilioRealCalle: Nullable<string>;
  domicilioRealLocalidad: Nullable<string>;
  domicilioRealDepto: Nullable<string>;
  certificacionISO: Nullable<string>;
  resolucionInscripcion: Nullable<string>;
  factorR: Nullable<number>;
  montoMxR: Nullable<number>;
  categoriaIndividual: Nullable<string>;
  libroOperatoria: Nullable<boolean>;
  activo: boolean;
}

interface TransporterPayload {
  sourceRow: number;
  numeroHabilitacion: string;
  cuitPlaceholder: string;
  razonSocial: string;
  expedienteDPA: Nullable<string>;
  domicilio: string;
  localidad: Nullable<string>;
  corrientesAutorizadas: Nullable<string>;
  vencimientoHabilitacion: Nullable<string>;
  observacion: Nullable<string>;
  activo: boolean;
  latitud: Nullable<number>;
  longitud: Nullable<number>;
}

interface TreatmentPayload {
  codigo: string;
  metodo: string;
  certificado: string;
  sourceRow: number;
}

interface OperatorPayload {
  cuit: string;
  sourceRows: number[];
  certificates: string[];
  razonSocial: string;
  numeroHabilitacion: string;
  certificadoNumero: string;
  domicilio: string;
  telefono: string;
  email: string;
  categoria: string;
  tipoOperador: Nullable<string>;
  tecnologia: Nullable<string>;
  corrientesY: Nullable<string>;
  modalidades: string[];
  expedienteInscripcion: Nullable<string>;
  domicilioLegalCalle: Nullable<string>;
  domicilioLegalLocalidad: Nullable<string>;
  domicilioLegalDepto: Nullable<string>;
  domicilioRealCalle: Nullable<string>;
  domicilioRealLocalidad: Nullable<string>;
  domicilioRealDepto: Nullable<string>;
  representanteLegalNombre: Nullable<string>;
  representanteTecnicoNombre: Nullable<string>;
  resolucionDPA: Nullable<string>;
  treatments: TreatmentPayload[];
  activo: boolean;
}

interface RosterPayload {
  schemaVersion: number;
  generatedAt: string;
  reportingDate: string;
  sources: {
    generadores: SourceReference;
    transportistas: SourceReference;
    operadores: SourceReference;
  };
  sourceWarnings: Record<string, unknown>;
  generadores: GeneratorPayload[];
  transportistas: TransporterPayload[];
  operadores: OperatorPayload[];
}

interface EntityPlan {
  creates: string[];
  updates: Array<{ key: string; fields: string[] }>;
  reactivations: string[];
  inactivations: string[];
}

interface SyncPlan {
  mode: 'dry-run' | 'apply';
  runId: string;
  reportingDate: string;
  payloadSha256: string;
  entities: {
    generadores: EntityPlan;
    transportistas: EntityPlan;
    operadores: EntityPlan;
    tratamientos: {
      creates: string[];
      reactivations: string[];
      updates: Array<{ key: string; fields: string[] }>;
      inactivations: string[];
    };
  };
  users: {
    toCreate: number;
    crossRoleCuitConflicts: Array<{ cuit: string; currentRole: string; actor: string }>;
  };
  protections: {
    keptActiveTransportistas: string[];
  };
  sourceWarnings: Record<string, unknown>;
  counts: Record<string, number>;
}

const prisma = new PrismaClient();

function parseArgs(argv: string[]): {
  payloadPath: string;
  apply: boolean;
  outputPath?: string;
  envPath?: string;
  keepActiveTransportistas: string[];
} {
  const valueAfter = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const payloadPath = valueAfter('--payload');
  if (!payloadPath) {
    throw new Error('Falta --payload /ruta/official-rosters.payload.json');
  }

  const apply = argv.includes('--apply');
  if (apply && argv.includes('--dry-run')) {
    throw new Error('Use --apply o --dry-run, no ambos');
  }

  return {
    payloadPath: path.resolve(payloadPath),
    apply,
    outputPath: valueAfter('--output') ? path.resolve(valueAfter('--output')!) : undefined,
    envPath: valueAfter('--env') ? path.resolve(valueAfter('--env')!) : undefined,
    keepActiveTransportistas: argv
      .flatMap((value, index) => value === '--keep-active-transportista' ? (argv[index + 1] || '').split(',') : [])
      .map(normalizeKey)
      .filter(Boolean),
  };
}

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

function cuitDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function stringOrFallback(value: Nullable<string> | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function compactUpdate<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined)) as Partial<T>;
}

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return [...value].sort();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value ?? null;
}

function changedFields(existing: Record<string, unknown>, desired: Record<string, unknown>): string[] {
  return Object.entries(desired)
    .filter(([, value]) => value !== undefined)
    .filter(([key, value]) => JSON.stringify(comparable(existing[key])) !== JSON.stringify(comparable(value)))
    .map(([key]) => key);
}

function asDate(value: Nullable<string>): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Fecha inválida en payload: ${value}`);
  return parsed;
}

function firstValidEmail(raw: string): string | undefined {
  const candidates = raw
    .split(/[;,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return candidates.find((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item));
}

function emailSlug(kind: string, cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  return `${kind.toLowerCase()}.${digits || crypto.randomBytes(5).toString('hex')}@sitrep.local`;
}

function summarizePlan(plan: SyncPlan): SyncPlan {
  const { generadores, transportistas, operadores, tratamientos } = plan.entities;
  plan.counts = {
    generadoresCrear: generadores.creates.length,
    generadoresActualizar: generadores.updates.length,
    generadoresReactivar: generadores.reactivations.length,
    generadoresDesactivar: generadores.inactivations.length,
    transportistasCrear: transportistas.creates.length,
    transportistasActualizar: transportistas.updates.length,
    transportistasReactivar: transportistas.reactivations.length,
    transportistasDesactivar: transportistas.inactivations.length,
    operadoresCrear: operadores.creates.length,
    operadoresActualizar: operadores.updates.length,
    operadoresReactivar: operadores.reactivations.length,
    operadoresDesactivar: operadores.inactivations.length,
    tratamientosCrear: tratamientos.creates.length,
    tratamientosActualizar: tratamientos.updates.length,
    tratamientosReactivar: tratamientos.reactivations.length,
    tratamientosDesactivar: tratamientos.inactivations.length,
    usuariosCrear: plan.users.toCreate,
    usuariosCuitMultirol: plan.users.crossRoleCuitConflicts.length,
  };
  return plan;
}

function blankEntityPlan(): EntityPlan {
  return { creates: [], updates: [], reactivations: [], inactivations: [] };
}

async function buildPlan(
  payload: RosterPayload,
  payloadSha256: string,
  mode: SyncPlan['mode'],
  keepActiveTransportistas: Set<string>,
): Promise<SyncPlan> {
  const [generadores, transportistas, operadores, tiposResiduo, usuarios] = await Promise.all([
    prisma.generador.findMany({ include: { usuario: true } }),
    prisma.transportista.findMany({ include: { usuario: true } }),
    prisma.operador.findMany({ include: { usuario: true, tratamientos: { include: { tipoResiduo: true } } } }),
    prisma.tipoResiduo.findMany({ select: { id: true, codigo: true } }),
    prisma.usuario.findMany({ select: { id: true, cuit: true, rol: true, email: true } }),
  ]);

  const plan: SyncPlan = {
    mode,
    runId: `padrones-${payload.reportingDate}-${crypto.randomBytes(5).toString('hex')}`,
    reportingDate: payload.reportingDate,
    payloadSha256,
    entities: {
      generadores: blankEntityPlan(),
      transportistas: blankEntityPlan(),
      operadores: blankEntityPlan(),
      tratamientos: { creates: [], updates: [], reactivations: [], inactivations: [] },
    },
    users: { toCreate: 0, crossRoleCuitConflicts: [] },
    protections: { keptActiveTransportistas: [...keepActiveTransportistas].sort() },
    sourceWarnings: payload.sourceWarnings,
    counts: {},
  };

  const usersByCuit = new Map(usuarios.filter((u) => u.cuit).map((u) => [u.cuit!, u]));
  const genByCuit = new Map(generadores.map((item) => [item.cuit, item]));
  const genByDigits = new Map(generadores.map((item) => [cuitDigits(item.cuit), item]));
  const trpByNumber = new Map(transportistas.map((item) => [normalizeKey(item.numeroHabilitacion), item]));
  const opByCuit = new Map(operadores.map((item) => [item.cuit, item]));
  const opByDigits = new Map(operadores.map((item) => [cuitDigits(item.cuit), item]));
  const validCodes = new Set(tiposResiduo.map((item) => normalizeKey(item.codigo)));

  const unknownProtectedTransportistas = [...keepActiveTransportistas].filter((key) => !trpByNumber.has(key));
  if (unknownProtectedTransportistas.length) {
    throw new Error(`Transportistas protegidos inexistentes: ${unknownProtectedTransportistas.join(', ')}`);
  }

  const sourceGenCuits = new Set(payload.generadores.map((item) => cuitDigits(item.cuit)));
  const sourceTrpNumbers = new Set(payload.transportistas.map((item) => normalizeKey(item.numeroHabilitacion)));
  const sourceOpCuits = new Set(payload.operadores.map((item) => cuitDigits(item.cuit)));

  for (const item of payload.generadores) {
    const existing = genByCuit.get(item.cuit) || genByDigits.get(cuitDigits(item.cuit));
    if (!existing) {
      plan.entities.generadores.creates.push(item.cuit);
      const user = usersByCuit.get(item.cuit);
      if (!user) plan.users.toCreate += 1;
      else if (user.rol !== Rol.GENERADOR) {
        plan.users.toCreate += 1;
        plan.users.crossRoleCuitConflicts.push({ cuit: item.cuit, currentRole: user.rol, actor: 'GENERADOR' });
      }
      continue;
    }

    const desired = {
      ...generatorUpdate(item),
      ...(existing.cuit === item.cuit ? {} : { cuit: item.cuit }),
    };
    const fields = changedFields(existing as unknown as Record<string, unknown>, desired as Record<string, unknown>);
    if (fields.length) plan.entities.generadores.updates.push({ key: item.cuit, fields });
    if (!existing.activo && item.activo) plan.entities.generadores.reactivations.push(item.cuit);
  }

  for (const existing of generadores) {
    if (normalizeKey(existing.numeroInscripcion).startsWith('G-') && !sourceGenCuits.has(cuitDigits(existing.cuit)) && existing.activo) {
      plan.entities.generadores.inactivations.push(existing.cuit);
    }
  }

  for (const item of payload.transportistas) {
    const key = normalizeKey(item.numeroHabilitacion);
    const effectiveItem = keepActiveTransportistas.has(key) ? { ...item, activo: true } : item;
    const existing = trpByNumber.get(key);
    if (!existing) {
      plan.entities.transportistas.creates.push(key);
      const user = usersByCuit.get(item.cuitPlaceholder);
      if (!user) plan.users.toCreate += 1;
      else if (user.rol !== Rol.TRANSPORTISTA) {
        plan.users.toCreate += 1;
        plan.users.crossRoleCuitConflicts.push({ cuit: item.cuitPlaceholder, currentRole: user.rol, actor: 'TRANSPORTISTA' });
      }
      continue;
    }

    const desired = transporterUpdate(effectiveItem);
    const fields = changedFields(existing as unknown as Record<string, unknown>, desired as Record<string, unknown>);
    if (fields.length) plan.entities.transportistas.updates.push({ key, fields });
    if (!existing.activo && effectiveItem.activo) plan.entities.transportistas.reactivations.push(key);
  }

  for (const key of keepActiveTransportistas) {
    const existing = trpByNumber.get(key)!;
    if (!existing.activo && !plan.entities.transportistas.reactivations.includes(key)) {
      plan.entities.transportistas.reactivations.push(key);
    }
  }

  for (const existing of transportistas) {
    const key = normalizeKey(existing.numeroHabilitacion);
    if (key.startsWith('T-') && !sourceTrpNumbers.has(key) && existing.activo && !keepActiveTransportistas.has(key)) {
      plan.entities.transportistas.inactivations.push(key);
    }
  }

  for (const item of payload.operadores) {
    const unknownCodes = item.treatments.map((t) => normalizeKey(t.codigo)).filter((code) => !validCodes.has(code));
    if (unknownCodes.length) {
      throw new Error(`El operador ${item.cuit} contiene corrientes inexistentes: ${[...new Set(unknownCodes)].join(', ')}`);
    }

    const existing = opByCuit.get(item.cuit) || opByDigits.get(cuitDigits(item.cuit));
    if (!existing) {
      plan.entities.operadores.creates.push(item.cuit);
      const user = usersByCuit.get(item.cuit);
      if (!user) plan.users.toCreate += 1;
      else if (user.rol !== Rol.OPERADOR) {
        plan.users.toCreate += 1;
        plan.users.crossRoleCuitConflicts.push({ cuit: item.cuit, currentRole: user.rol, actor: 'OPERADOR' });
      }
      for (const treatment of item.treatments) {
        plan.entities.tratamientos.creates.push(treatmentKey(item.cuit, treatment.codigo, treatment.metodo));
      }
      continue;
    }

    const desired = {
      ...operatorUpdate(item),
      ...(existing.cuit === item.cuit ? {} : { cuit: item.cuit }),
    };
    const fields = changedFields(existing as unknown as Record<string, unknown>, desired as Record<string, unknown>);
    if (fields.length) plan.entities.operadores.updates.push({ key: item.cuit, fields });
    if (!existing.activo && item.activo) plan.entities.operadores.reactivations.push(item.cuit);

    const existingTreatments = new Map(existing.tratamientos.map((t) => [treatmentKey(item.cuit, t.tipoResiduo.codigo, t.metodo), t]));
    const desiredTreatmentKeys = new Set<string>();
    for (const treatment of item.treatments) {
      const key = treatmentKey(item.cuit, treatment.codigo, treatment.metodo);
      desiredTreatmentKeys.add(key);
      const current = existingTreatments.get(key);
      if (!current) plan.entities.tratamientos.creates.push(key);
      else if (!current.activo) plan.entities.tratamientos.reactivations.push(key);
    }
    for (const [key, treatment] of existingTreatments) {
      if (!desiredTreatmentKeys.has(key) && treatment.activo) plan.entities.tratamientos.inactivations.push(key);
    }
  }

  for (const existing of operadores) {
    if (normalizeKey(existing.numeroHabilitacion).startsWith('O-') && !sourceOpCuits.has(cuitDigits(existing.cuit)) && existing.activo) {
      plan.entities.operadores.inactivations.push(existing.cuit);
      for (const treatment of existing.tratamientos) {
        if (treatment.activo) {
          plan.entities.tratamientos.inactivations.push(treatmentKey(existing.cuit, treatment.tipoResiduo.codigo, treatment.metodo));
        }
      }
    }
  }

  plan.entities.tratamientos.inactivations = [...new Set(plan.entities.tratamientos.inactivations)];
  return summarizePlan(plan);
}

function generatorUpdate(item: GeneratorPayload): Prisma.GeneradorUpdateInput {
  return compactUpdate({
    razonSocial: item.razonSocial.trim(),
    domicilio: item.domicilio?.trim() || undefined,
    telefono: item.telefono?.trim() || undefined,
    email: item.email?.trim() || undefined,
    numeroInscripcion: item.numeroInscripcion.trim(),
    categoria: item.categoria?.trim() || undefined,
    actividad: item.actividad?.trim() || undefined,
    rubro: item.rubro?.trim() || undefined,
    corrientesControl: item.corrientesControl?.trim() || undefined,
    expedienteInscripcion: item.expedienteInscripcion?.trim() || undefined,
    domicilioLegalCalle: item.domicilioLegalCalle?.trim() || undefined,
    domicilioLegalLocalidad: item.domicilioLegalLocalidad?.trim() || undefined,
    domicilioLegalDepto: item.domicilioLegalDepto?.trim() || undefined,
    domicilioRealCalle: item.domicilioRealCalle?.trim() || undefined,
    domicilioRealLocalidad: item.domicilioRealLocalidad?.trim() || undefined,
    domicilioRealDepto: item.domicilioRealDepto?.trim() || undefined,
    certificacionISO: asDate(item.certificacionISO),
    resolucionInscripcion: item.resolucionInscripcion?.trim() || undefined,
    factorR: item.factorR ?? undefined,
    montoMxR: item.montoMxR ?? undefined,
    categoriaIndividual: item.categoriaIndividual?.trim() || undefined,
    libroOperatoria: item.libroOperatoria ?? undefined,
    activo: item.activo,
  }) as Prisma.GeneradorUpdateInput;
}

function generatorCreate(item: GeneratorPayload, usuarioId: string): Prisma.GeneradorUncheckedCreateInput {
  return {
    usuarioId,
    cuit: item.cuit,
    razonSocial: stringOrFallback(item.razonSocial, item.cuit),
    domicilio: stringOrFallback(item.domicilio, 'Sin informar'),
    telefono: stringOrFallback(item.telefono, 'Sin informar'),
    email: stringOrFallback(item.email, 'Sin informar'),
    numeroInscripcion: stringOrFallback(item.numeroInscripcion, 'Sin informar'),
    categoria: stringOrFallback(item.categoria, 'Sin informar'),
    actividad: item.actividad,
    rubro: item.rubro,
    corrientesControl: item.corrientesControl,
    expedienteInscripcion: item.expedienteInscripcion,
    domicilioLegalCalle: item.domicilioLegalCalle,
    domicilioLegalLocalidad: item.domicilioLegalLocalidad,
    domicilioLegalDepto: item.domicilioLegalDepto,
    domicilioRealCalle: item.domicilioRealCalle,
    domicilioRealLocalidad: item.domicilioRealLocalidad,
    domicilioRealDepto: item.domicilioRealDepto,
    certificacionISO: asDate(item.certificacionISO),
    resolucionInscripcion: item.resolucionInscripcion,
    factorR: item.factorR,
    montoMxR: item.montoMxR,
    categoriaIndividual: item.categoriaIndividual,
    libroOperatoria: item.libroOperatoria,
    activo: item.activo,
  };
}

function transporterUpdate(item: TransporterPayload): Prisma.TransportistaUpdateInput {
  return compactUpdate({
    razonSocial: item.razonSocial.trim(),
    domicilio: item.domicilio?.trim() || undefined,
    localidad: item.localidad?.trim() || undefined,
    corrientesAutorizadas: item.corrientesAutorizadas?.trim() || undefined,
    expedienteDPA: item.expedienteDPA?.trim() || undefined,
    vencimientoHabilitacion: asDate(item.vencimientoHabilitacion),
    latitud: item.latitud ?? undefined,
    longitud: item.longitud ?? undefined,
    activo: item.activo,
  }) as Prisma.TransportistaUpdateInput;
}

function transporterCreate(item: TransporterPayload, usuarioId: string): Prisma.TransportistaUncheckedCreateInput {
  return {
    usuarioId,
    cuit: item.cuitPlaceholder,
    razonSocial: stringOrFallback(item.razonSocial, item.numeroHabilitacion),
    domicilio: stringOrFallback(item.domicilio, 'Sin informar'),
    telefono: 'Sin informar',
    email: emailSlug('transportista', item.numeroHabilitacion),
    numeroHabilitacion: item.numeroHabilitacion,
    localidad: item.localidad,
    corrientesAutorizadas: item.corrientesAutorizadas,
    expedienteDPA: item.expedienteDPA,
    vencimientoHabilitacion: asDate(item.vencimientoHabilitacion),
    latitud: item.latitud,
    longitud: item.longitud,
    activo: item.activo,
  };
}

function operatorUpdate(item: OperatorPayload): Prisma.OperadorUpdateInput {
  return compactUpdate({
    razonSocial: item.razonSocial.trim(),
    domicilio: item.domicilio?.trim() || undefined,
    telefono: item.telefono?.trim() || undefined,
    email: item.email?.trim() || undefined,
    numeroHabilitacion: item.numeroHabilitacion.trim(),
    certificadoNumero: item.certificadoNumero.trim(),
    categoria: item.categoria?.trim() || undefined,
    tipoOperador: item.tipoOperador?.trim() || undefined,
    tecnologia: item.tecnologia?.trim() || undefined,
    corrientesY: item.corrientesY?.trim() || undefined,
    modalidades: item.modalidades,
    expedienteInscripcion: item.expedienteInscripcion?.trim() || undefined,
    domicilioLegalCalle: item.domicilioLegalCalle?.trim() || undefined,
    domicilioLegalLocalidad: item.domicilioLegalLocalidad?.trim() || undefined,
    domicilioLegalDepto: item.domicilioLegalDepto?.trim() || undefined,
    domicilioRealCalle: item.domicilioRealCalle?.trim() || undefined,
    domicilioRealLocalidad: item.domicilioRealLocalidad?.trim() || undefined,
    domicilioRealDepto: item.domicilioRealDepto?.trim() || undefined,
    representanteLegalNombre: item.representanteLegalNombre?.trim() || undefined,
    representanteTecnicoNombre: item.representanteTecnicoNombre?.trim() || undefined,
    resolucionDPA: item.resolucionDPA?.trim() || undefined,
    activo: item.activo,
  }) as Prisma.OperadorUpdateInput;
}

function operatorCreate(item: OperatorPayload, usuarioId: string): Prisma.OperadorUncheckedCreateInput {
  return {
    usuarioId,
    cuit: item.cuit,
    razonSocial: stringOrFallback(item.razonSocial, item.cuit),
    domicilio: stringOrFallback(item.domicilio, 'Sin informar'),
    telefono: stringOrFallback(item.telefono, 'Sin informar'),
    email: stringOrFallback(item.email, 'Sin informar'),
    numeroHabilitacion: stringOrFallback(item.numeroHabilitacion, 'Sin informar'),
    certificadoNumero: stringOrFallback(item.certificadoNumero, item.numeroHabilitacion),
    categoria: stringOrFallback(item.categoria, 'Sin informar'),
    tipoOperador: item.tipoOperador,
    tecnologia: item.tecnologia,
    corrientesY: item.corrientesY,
    modalidades: item.modalidades,
    expedienteInscripcion: item.expedienteInscripcion,
    domicilioLegalCalle: item.domicilioLegalCalle,
    domicilioLegalLocalidad: item.domicilioLegalLocalidad,
    domicilioLegalDepto: item.domicilioLegalDepto,
    domicilioRealCalle: item.domicilioRealCalle,
    domicilioRealLocalidad: item.domicilioRealLocalidad,
    domicilioRealDepto: item.domicilioRealDepto,
    representanteLegalNombre: item.representanteLegalNombre,
    representanteTecnicoNombre: item.representanteTecnicoNombre,
    resolucionDPA: item.resolucionDPA,
    activo: item.activo,
  };
}

function treatmentKey(cuit: string, code: string, method: string): string {
  return `${cuit}|${normalizeKey(code)}|${method.trim()}`;
}

async function ensureUser(
  tx: Prisma.TransactionClient,
  usedEmails: Set<string>,
  cuit: string,
  role: Rol,
  actorName: string,
  rawEmail: string,
  phone: string,
  active: boolean,
  passwordHash: string,
): Promise<string> {
  const existing = await tx.usuario.findUnique({ where: { cuit }, select: { id: true, rol: true } });
  if (existing?.rol === role) return existing.id;

  const candidate = firstValidEmail(rawEmail);
  let email = candidate && !usedEmails.has(candidate) ? candidate : emailSlug(role.toLowerCase(), cuit);
  let sequence = 1;
  while (usedEmails.has(email)) {
    const [local, domain] = email.split('@');
    email = `${local}.${sequence}@${domain}`;
    sequence += 1;
  }
  usedEmails.add(email);

  const created = await tx.usuario.create({
    data: {
      email,
      password: passwordHash,
      rol: role,
      // Usuario.cuit is unique and the current schema only permits one role per
      // user. A legal entity present in two rosters therefore receives a
      // separate role-specific login without duplicating the actor's CUIT.
      cuit: existing ? null : cuit,
      nombre: actorName,
      empresa: actorName,
      telefono: phone || null,
      activo: active,
      forcePasswordChange: true,
      emailVerified: false,
      notifEmail: false,
    },
    select: { id: true },
  });
  return created.id;
}

async function maybeDisableOrphanedUser(tx: Prisma.TransactionClient, usuarioId: string, actorRole: Rol): Promise<void> {
  const user = await tx.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      generador: { select: { activo: true } },
      transportista: { select: { activo: true } },
      operador: { select: { activo: true } },
    },
  });
  if (!user || user.rol !== actorRole) return;
  const hasActiveActor = Boolean(user.generador?.activo || user.transportista?.activo || user.operador?.activo);
  if (hasActiveActor) return;
  await tx.usuario.update({ where: { id: usuarioId }, data: { activo: false } });
  await tx.refreshToken.updateMany({ where: { usuarioId, revocado: false }, data: { revocado: true } });
}

async function applySync(payload: RosterPayload, plan: SyncPlan, keepActiveTransportistas: Set<string>): Promise<void> {
  const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12);

  await prisma.$transaction(
    async (tx) => {
      const existingEmails = await tx.usuario.findMany({ select: { email: true } });
      const usedEmails = new Set(existingEmails.map((item) => item.email.toLowerCase()));
      const types = await tx.tipoResiduo.findMany({ select: { id: true, codigo: true } });
      const typeByCode = new Map(types.map((item) => [normalizeKey(item.codigo), item.id]));

      const currentGenerators = await tx.generador.findMany();
      const generatorByCuit = new Map(currentGenerators.map((item) => [item.cuit, item]));
      const generatorByDigits = new Map(currentGenerators.map((item) => [cuitDigits(item.cuit), item]));

      const sourceGeneratorCuits = new Set(payload.generadores.map((item) => cuitDigits(item.cuit)));
      for (const item of payload.generadores) {
        const existing = generatorByCuit.get(item.cuit) || generatorByDigits.get(cuitDigits(item.cuit));
        if (existing) {
          const data = {
            ...generatorUpdate(item),
            ...(existing.cuit === item.cuit ? {} : { cuit: item.cuit }),
          };
          if (changedFields(existing as unknown as Record<string, unknown>, data as Record<string, unknown>).length) {
            await tx.generador.update({ where: { id: existing.id }, data });
            if (existing.cuit !== item.cuit) {
              const targetUser = await tx.usuario.findUnique({ where: { cuit: item.cuit }, select: { id: true } });
              if (!targetUser) {
                await tx.usuario.update({ where: { id: existing.usuarioId }, data: { cuit: item.cuit } });
              }
            }
          }
        } else {
          const usuarioId = await ensureUser(
            tx,
            usedEmails,
            item.cuit,
            Rol.GENERADOR,
            item.razonSocial,
            item.email,
            item.telefono,
            item.activo,
            passwordHash,
          );
          await tx.generador.create({ data: generatorCreate(item, usuarioId) });
        }
      }

      const officialGenerators = await tx.generador.findMany({
        where: { activo: true, numeroInscripcion: { startsWith: 'G-' } },
        select: { id: true, usuarioId: true },
      });
      const missingGenerators = officialGenerators.filter((item) => {
        const existing = currentGenerators.find((generator) => generator.id === item.id);
        return existing ? !sourceGeneratorCuits.has(cuitDigits(existing.cuit)) : false;
      });
      if (missingGenerators.length) {
        await tx.generador.updateMany({ where: { id: { in: missingGenerators.map((item) => item.id) } }, data: { activo: false } });
        for (const item of missingGenerators) await maybeDisableOrphanedUser(tx, item.usuarioId, Rol.GENERADOR);
      }

      const sourceTransportNumbers = new Set(payload.transportistas.map((item) => normalizeKey(item.numeroHabilitacion)));
      for (const item of payload.transportistas) {
        const key = normalizeKey(item.numeroHabilitacion);
        const effectiveItem = keepActiveTransportistas.has(key) ? { ...item, activo: true } : item;
        const existing = await tx.transportista.findFirst({ where: { numeroHabilitacion: { equals: item.numeroHabilitacion, mode: 'insensitive' } } });
        if (existing) {
          const data = transporterUpdate(effectiveItem);
          if (changedFields(existing as unknown as Record<string, unknown>, data as Record<string, unknown>).length) {
            await tx.transportista.update({ where: { id: existing.id }, data });
          }
          if (effectiveItem.activo && keepActiveTransportistas.has(key)) {
            await tx.usuario.update({ where: { id: existing.usuarioId }, data: { activo: true } });
          } else if (!effectiveItem.activo) {
            await maybeDisableOrphanedUser(tx, existing.usuarioId, Rol.TRANSPORTISTA);
          }
        } else {
          const usuarioId = await ensureUser(
            tx,
            usedEmails,
            item.cuitPlaceholder,
            Rol.TRANSPORTISTA,
            effectiveItem.razonSocial,
            '',
            '',
            effectiveItem.activo,
            passwordHash,
          );
          await tx.transportista.create({ data: transporterCreate(effectiveItem, usuarioId) });
        }
      }

      for (const key of keepActiveTransportistas) {
        const protectedTransportista = await tx.transportista.findFirst({
          where: { numeroHabilitacion: { equals: key, mode: 'insensitive' } },
          select: { id: true, usuarioId: true },
        });
        if (!protectedTransportista) throw new Error(`Transportista protegido inexistente durante la transacción: ${key}`);
        await tx.transportista.update({ where: { id: protectedTransportista.id }, data: { activo: true } });
        await tx.usuario.update({ where: { id: protectedTransportista.usuarioId }, data: { activo: true } });
      }

      const officialTransporters = await tx.transportista.findMany({
        where: { activo: true, numeroHabilitacion: { startsWith: 'T-', mode: 'insensitive' } },
        select: { id: true, usuarioId: true, numeroHabilitacion: true },
      });
      const missingTransporters = officialTransporters.filter((item) => {
        const key = normalizeKey(item.numeroHabilitacion);
        return !sourceTransportNumbers.has(key) && !keepActiveTransportistas.has(key);
      });
      if (missingTransporters.length) {
        await tx.transportista.updateMany({ where: { id: { in: missingTransporters.map((item) => item.id) } }, data: { activo: false } });
        for (const item of missingTransporters) await maybeDisableOrphanedUser(tx, item.usuarioId, Rol.TRANSPORTISTA);
      }

      const currentOperators = await tx.operador.findMany();
      const operatorByCuit = new Map(currentOperators.map((item) => [item.cuit, item]));
      const operatorByDigits = new Map(currentOperators.map((item) => [cuitDigits(item.cuit), item]));
      const sourceOperatorCuits = new Set(payload.operadores.map((item) => cuitDigits(item.cuit)));
      for (const item of payload.operadores) {
        let existing = operatorByCuit.get(item.cuit) || operatorByDigits.get(cuitDigits(item.cuit));
        if (existing) {
          const previousCuit = existing.cuit;
          const data = {
            ...operatorUpdate(item),
            ...(previousCuit === item.cuit ? {} : { cuit: item.cuit }),
          };
          if (changedFields(existing as unknown as Record<string, unknown>, data as Record<string, unknown>).length) {
            existing = await tx.operador.update({ where: { id: existing.id }, data });
            if (previousCuit !== item.cuit) {
              const targetUser = await tx.usuario.findUnique({ where: { cuit: item.cuit }, select: { id: true } });
              if (!targetUser) {
                await tx.usuario.update({ where: { id: existing.usuarioId }, data: { cuit: item.cuit } });
              }
            }
          }
        } else {
          const usuarioId = await ensureUser(
            tx,
            usedEmails,
            item.cuit,
            Rol.OPERADOR,
            item.razonSocial,
            item.email,
            item.telefono,
            item.activo,
            passwordHash,
          );
          existing = await tx.operador.create({ data: operatorCreate(item, usuarioId) });
        }

        const desiredKeys = new Set(item.treatments.map((t) => treatmentKey(item.cuit, t.codigo, t.metodo)));
        const currentTreatments = await tx.tratamientoAutorizado.findMany({
          where: { operadorId: existing.id },
          include: { tipoResiduo: { select: { codigo: true } } },
        });
        const currentTreatmentByKey = new Map(
          currentTreatments.map((t) => [treatmentKey(item.cuit, t.tipoResiduo.codigo, t.metodo), t]),
        );
        for (const treatment of item.treatments) {
          const tipoResiduoId = typeByCode.get(normalizeKey(treatment.codigo));
          if (!tipoResiduoId) throw new Error(`Corriente ${treatment.codigo} no encontrada durante la transacción`);
          const key = treatmentKey(item.cuit, treatment.codigo, treatment.metodo);
          const current = currentTreatmentByKey.get(key);
          if (!current) {
            await tx.tratamientoAutorizado.create({ data: {
              operadorId: existing.id,
              tipoResiduoId,
              metodo: treatment.metodo.trim(),
              descripcion: `Padrón oficial ${payload.reportingDate}; certificado ${treatment.certificado}`,
              activo: item.activo,
            } });
          } else if (current.activo !== item.activo) {
            await tx.tratamientoAutorizado.update({ where: { id: current.id }, data: { activo: item.activo } });
          }
        }
        const staleIds = currentTreatments
          .filter((t) => !desiredKeys.has(treatmentKey(item.cuit, t.tipoResiduo.codigo, t.metodo)) && t.activo)
          .map((t) => t.id);
        if (staleIds.length) {
          await tx.tratamientoAutorizado.updateMany({ where: { id: { in: staleIds } }, data: { activo: false } });
        }
        if (!item.activo) await maybeDisableOrphanedUser(tx, existing.usuarioId, Rol.OPERADOR);
      }

      const officialOperators = await tx.operador.findMany({
        where: { activo: true, numeroHabilitacion: { startsWith: 'O-', mode: 'insensitive' } },
        select: { id: true, usuarioId: true, cuit: true },
      });
      const missingOperators = officialOperators.filter((item) => !sourceOperatorCuits.has(cuitDigits(item.cuit)));
      if (missingOperators.length) {
        const ids = missingOperators.map((item) => item.id);
        await tx.operador.updateMany({ where: { id: { in: ids } }, data: { activo: false } });
        await tx.tratamientoAutorizado.updateMany({ where: { operadorId: { in: ids }, activo: true }, data: { activo: false } });
        for (const item of missingOperators) await maybeDisableOrphanedUser(tx, item.usuarioId, Rol.OPERADOR);
      }

      await tx.auditoria.create({
        data: {
          accion: 'SINCRONIZAR_PADRONES_OFICIALES',
          modulo: 'PADRONES',
          datosAntes: JSON.stringify({ runId: plan.runId, mode: plan.mode }),
          datosDespues: JSON.stringify({
            reportingDate: payload.reportingDate,
            sources: payload.sources,
            payloadSha256: plan.payloadSha256,
            counts: plan.counts,
            protections: plan.protections,
            sourceWarnings: payload.sourceWarnings,
          }),
          ip: 'LOCAL_MAINTENANCE',
          userAgent: 'sync-official-rosters.ts',
        },
      });
    },
    { maxWait: 60_000, timeout: 900_000 },
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.envPath) dotenv.config({ path: args.envPath });
  else dotenv.config();

  const payloadBuffer = fs.readFileSync(args.payloadPath);
  const payload = JSON.parse(payloadBuffer.toString('utf8')) as RosterPayload;
  if (payload.schemaVersion !== 1) throw new Error(`schemaVersion no soportada: ${payload.schemaVersion}`);
  if (!payload.reportingDate || !payload.sources || !Array.isArray(payload.generadores)) {
    throw new Error('Payload incompleto o inválido');
  }

  const digest = sha256(payloadBuffer);
  const keepActiveTransportistas = new Set(args.keepActiveTransportistas);
  const plan = await buildPlan(payload, digest, args.apply ? 'apply' : 'dry-run', keepActiveTransportistas);
  if (args.apply) await applySync(payload, plan, keepActiveTransportistas);

  const result = {
    status: args.apply ? 'applied' : 'dry-run',
    appliedAt: args.apply ? new Date().toISOString() : null,
    ...plan,
  };
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (args.outputPath) fs.writeFileSync(args.outputPath, serialized);
  process.stdout.write(serialized);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
