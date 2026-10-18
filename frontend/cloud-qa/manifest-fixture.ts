import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const fixture = await loadSeed().seedNightDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const output = process.env.QA_ARTIFACTS!;
await mkdir(output, { recursive: true });
try {
  const v = await db.vehiculo.findUniqueOrThrow({ where: { id: 'night-qa-vehicle-1' } });
  const c = await db.chofer.findUniqueOrThrow({ where: { id: 'night-qa-driver-1' } });
  await db.vehiculo.create({ data: { ...v, id: 'manifest-qa-second-vehicle', patente: 'QA002ZZ', modelo: 'Segundo' } });
  await db.chofer.create({ data: { ...c, id: 'manifest-qa-second-driver', nombre: 'QA', apellido: 'Segundo', dni: '00000012' } });
  await db.vehiculo.create({ data: { ...v, id: 'manifest-qa-inactive-vehicle', patente: 'QA-INACTIVO', activo: false } });
  await db.chofer.create({ data: { ...c, id: 'manifest-qa-inactive-driver', apellido: 'Inactivo', activo: false } });
  const historical = await db.manifiesto.create({ data: {
    id: 'manifest-qa-legacy', numero: 'QA-LEGACY-UNCHANGED', estado: 'TRATADO',
    generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista,
    operadorId: fixture.actors.operador, creadoPorId: fixture.users.admin, isDemoData: true,
    residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] },
  }, include: { residuos: true, eventos: true } });
  await writeFile(path.join(output, 'manifest-legacy-before.json'), JSON.stringify(historical));
  await writeFile(path.join(output, 'fixture.json'), JSON.stringify({ ...fixture, database: 'sitrep_night_qa_20260926', source: process.env.GITHUB_SHA }));
} finally { await db.$disconnect(); }
console.log('Only isolated synthetic manifest fixtures prepared');
