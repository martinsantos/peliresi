import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { canAccessActor, type ActorType } from '../utils/authorization';
import { config } from '../config/config';
import { certificateSubjectHash, signCertificateToken, verifyCertificateToken, type CertificateTokenPayload } from '../utils/certificateToken';
import { sha256Buffer } from '../utils/documentNormalization';
import { getRequiredDocumentsFor } from './document-management.controller';
import { storageKeyPath } from '../services/documentStorage.service';
import { satisfiesDocumentRequirement } from '../utils/documentEligibility';
let ephemeralKeys: { privateKey: string; publicKey: string } | null = null;

function pem(value: string): string {
  return value.replace(/\\n/g, '\n');
}

function getSigningKeys(): { privateKey: string; publicKey: string } {
  if (config.CERTIFICATE_ED25519_PRIVATE_KEY && config.CERTIFICATE_ED25519_PUBLIC_KEY) {
    return { privateKey: pem(config.CERTIFICATE_ED25519_PRIVATE_KEY), publicKey: pem(config.CERTIFICATE_ED25519_PUBLIC_KEY) };
  }
  if (config.NODE_ENV === 'production') throw new AppError('Firma de certificados no configurada', 503);
  if (!ephemeralKeys) {
    const generated = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    ephemeralKeys = generated;
  }
  return ephemeralKeys;
}

function actorRelation(tipo: string): { field: 'generadorId' | 'transportistaId' | 'operadorId'; actorType: ActorType } {
  if (tipo === 'generador') return { field: 'generadorId', actorType: 'generador' };
  if (tipo === 'transportista') return { field: 'transportistaId', actorType: 'transportista' };
  if (tipo === 'operador') return { field: 'operadorId', actorType: 'operador' };
  throw new AppError('Tipo de actor invalido', 400);
}

async function loadActor(tipo: string, id: string) {
  const relation = actorRelation(tipo);
  if (relation.actorType === 'generador') return prisma.generador.findUnique({ where: { id }, select: { id: true, razonSocial: true, cuit: true, numeroInscripcion: true } });
  if (relation.actorType === 'transportista') return prisma.transportista.findUnique({ where: { id }, select: { id: true, razonSocial: true, cuit: true, numeroHabilitacion: true } });
  return prisma.operador.findUnique({ where: { id }, select: { id: true, razonSocial: true, cuit: true, numeroHabilitacion: true } });
}

function credentialWhere(tipo: string, id: string) {
  const relation = actorRelation(tipo);
  return { [relation.field]: id };
}

/**
 * A credential is only issuable when the actor's permanent regulatory
 * dossier contains every current required document in an approved, clean,
 * non-expired state.  This is deliberately checked both when creating the
 * credential and immediately before issuing a certificate so a later
 * rejection/expiry cannot be bypassed with an already-active credential.
 */
export async function assertActorDocumentationReady(tipo: string, id: string): Promise<void> {
  const relation = actorRelation(tipo);
  const requirements = await getRequiredDocumentsFor(relation.actorType.toUpperCase());
  const now = new Date();
  const documents = await prisma.documentoRegulatorio.findMany({
    where: { [relation.field]: id, estado: 'APROBADO' } as Prisma.DocumentoRegulatorioWhereInput,
    select: {
      tipo: true,
      estado: true,
      archivoId: true,
      cara: true,
      vigenteDesde: true,
      vigenteHasta: true,
      archivo: { select: { estadoScan: true } },
    },
  });

  const complete = requirements.every(requirement => satisfiesDocumentRequirement(requirement, documents.map(document => ({ ...document, estadoScan: document.archivo.estadoScan })), now));
  if (!complete) throw new AppError('Documentacion regulatoria incompleta o no vigente', 400);
}

function actorFromCredential(credential: { generadorId: string | null; transportistaId: string | null; operadorId: string | null }): { tipo: ActorType; id: string } | null {
  if (credential.generadorId) return { tipo: 'generador', id: credential.generadorId };
  if (credential.transportistaId) return { tipo: 'transportista', id: credential.transportistaId };
  if (credential.operadorId) return { tipo: 'operador', id: credential.operadorId };
  return null;
}

function toPdfBuffer(input: { snapshot: any; serial: string; token: string; qrUrl: string; pdfHashPlaceholder: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Certificado SITREP ${input.serial}`, Author: 'SITREP' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const actor = input.snapshot.actor;
    doc.fillColor('#1B5E3C').fontSize(22).text('SITREP', { align: 'center' });
    doc.fillColor('#222').fontSize(12).text('Certificado de autorización del actor', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(11).fillColor('#333');
    const rows: Array<[string, string]> = [
      ['Razón social', actor.razonSocial],
      ['Tipo de actor', actor.tipo.toUpperCase()],
      ['Serial', input.serial],
      ['Vigencia desde', input.snapshot.credential.vigenteDesde],
      ['Vigencia hasta', input.snapshot.credential.vigenteHasta],
      ['Alcance', input.snapshot.credential.alcance || 'Autorización registrada'],
      ['Política', input.snapshot.credential.politicaVersion],
      ['Hash del snapshot', input.pdfHashPlaceholder],
    ];
    for (const [label, value] of rows) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(String(value || '—'));
      doc.moveDown(0.25);
    }
    doc.moveDown(1);
    doc.fontSize(9).fillColor('#555').text('Verificación pública mediante QR firmado Ed25519:', { align: 'center' });
    void QRCode.toDataURL(input.qrUrl, { errorCorrectionLevel: 'M', margin: 1, width: 170 }).then((dataUrl) => {
      const image = Buffer.from(dataUrl.split(',')[1], 'base64');
      doc.image(image, (doc.page.width - 170) / 2, doc.y + 10, { width: 170 });
      doc.y += 195;
      doc.fontSize(8).fillColor('#666').text('El documento es inmutable. La vigencia se consulta siempre contra SITREP.', { align: 'center' });
      doc.end();
    }).catch(reject);
  });
}

/** POST /admin/actores/:tipo/:id/credenciales */
export const createCredential = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tipo, id } = req.params;
    const relation = actorRelation(tipo);
    if (!canAccessActor(req.user, relation.actorType, id, 'write')) throw new AppError('No tiene permisos sobre este actor', 403);
    const actor = await loadActor(tipo, id);
    if (!actor) throw new AppError('Actor no encontrado', 404);
    await assertActorDocumentationReady(tipo, id);
    const from = req.body?.vigenteDesde ? new Date(req.body.vigenteDesde) : new Date();
    const until = req.body?.vigenteHasta ? new Date(req.body.vigenteHasta) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()) || until <= from) throw new AppError('Vigencia invalida', 400);
    const credential = await prisma.credencialActor.create({ data: { ...credentialWhere(tipo, id), tipo: String(req.body?.tipo || `HABILITACION_${tipo.toUpperCase()}`), alcance: req.body?.alcance, vigenteDesde: from, vigenteHasta: until, estado: 'ACTIVA', politicaVersion: config.CERTIFICATE_POLICY_VERSION, snapshot: { actor: { ...actor, tipo }, createdAt: new Date().toISOString() } } });
    res.status(201).json({ success: true, data: { credencial: credential } });
  } catch (error) { next(error); }
};

/** POST /admin/credenciales/:id/emitir-certificado */
export const issueCertificate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const credential = await prisma.credencialActor.findUnique({ where: { id: req.params.id } });
    if (!credential) throw new AppError('Credencial no encontrada', 404);
    const actorRef = actorFromCredential(credential);
    if (!actorRef || !canAccessActor(req.user, actorRef.tipo, actorRef.id, 'write')) throw new AppError('No tiene permisos sobre esta credencial', 403);
    const now = new Date();
    if (credential.estado !== 'ACTIVA' || credential.vigenteHasta <= now || credential.vigenteDesde > now) throw new AppError('La credencial no esta vigente', 400);
    const actor = await loadActor(actorRef.tipo, actorRef.id);
    if (!actor) throw new AppError('Actor no encontrado', 404);
    await assertActorDocumentationReady(actorRef.tipo, actorRef.id);
    const serial = `SITREP-${now.getUTCFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const snapshot = { actor: { ...actor, tipo: actorRef.tipo }, credential: { id: credential.id, tipo: credential.tipo, alcance: credential.alcance, vigenteDesde: credential.vigenteDesde.toISOString(), vigenteHasta: credential.vigenteHasta.toISOString(), politicaVersion: credential.politicaVersion } };
    const snapshotHash = certificateSubjectHash(snapshot);
    const payload: CertificateTokenPayload = { v: 1, serial, credentialId: credential.id, subjectHash: snapshotHash, validFrom: credential.vigenteDesde.toISOString(), validUntil: credential.vigenteHasta.toISOString(), policyVersion: credential.politicaVersion };
    const keys = getSigningKeys();
    const token = signCertificateToken(payload, keys.privateKey);
    const baseUrl = config.FRONTEND_URL.replace(/\/$/, '');
    const qrUrl = `${baseUrl}/certificados/verificar/${token}`;
    const pdf = await toPdfBuffer({ snapshot, serial, token, qrUrl, pdfHashPlaceholder: snapshotHash });
    const pdfSha256 = sha256Buffer(pdf);
    const storageKey = `certificados/${crypto.randomUUID()}.pdf`;
    const fullPath = storageKeyPath(storageKey);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true, mode: 0o700 });
    await fs.promises.writeFile(fullPath, pdf, { mode: 0o600 });
    try {
      const emission = await prisma.emisionCertificado.create({ data: { credencialId: credential.id, serial, tokenFirmado: token, snapshot, snapshotHash, pdfStorageKey: storageKey, pdfSha256, politicaVersion: credential.politicaVersion, emitidoPorId: req.user!.id } });
      res.status(201).json({ success: true, data: { emision: { id: emission.id, serial: emission.serial, pdfSha256: emission.pdfSha256, tokenFirmado: emission.tokenFirmado } } });
    } catch (error) {
      await fs.promises.rm(fullPath, { force: true });
      throw error;
    }
  } catch (error) { next(error); }
};

/** PATCH /admin/credenciales/:id/revocar */
export const revokeCredential = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const credential = await prisma.credencialActor.findUnique({ where: { id: req.params.id } });
    if (!credential) throw new AppError('Credencial no encontrada', 404);
    const actorRef = actorFromCredential(credential);
    if (!actorRef || !canAccessActor(req.user, actorRef.tipo, actorRef.id, 'write')) throw new AppError('No tiene permisos sobre esta credencial', 403);
    const updated = await prisma.credencialActor.update({ where: { id: credential.id }, data: { estado: 'REVOCADA' } });
    res.json({ success: true, data: { credencial: updated } });
  } catch (error) { next(error); }
};

/** GET /certificados/:id/download */
export const downloadCertificate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const emission = await prisma.emisionCertificado.findUnique({ where: { id: req.params.id }, include: { credencial: true } });
    if (!emission) throw new AppError('Certificado no encontrado', 404);
    const actorRef = actorFromCredential(emission.credencial);
    if (!actorRef || !canAccessActor(req.user, actorRef.tipo, actorRef.id, 'read')) throw new AppError('No tiene permisos sobre este certificado', 403);
    const fullPath = storageKeyPath(emission.pdfStorageKey);
    if (!fs.existsSync(fullPath)) throw new AppError('Archivo no encontrado', 404);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${emission.serial}.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) { next(error); }
};

/** GET /certificados/verificar/:token (public, minimal disclosure) */
export const verifyCertificate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;
    const keys = getSigningKeys();
    const payload = verifyCertificateToken(token, keys.publicKey);
    if (!payload) throw new AppError('Certificado invalido', 404);
    const emission = await prisma.emisionCertificado.findUnique({ where: { tokenFirmado: token }, include: { credencial: true } });
    if (!emission) throw new AppError('Certificado no encontrado', 404);
    const snapshot = emission.snapshot as any;
    // The signature authenticates the token, while this comparison detects a
    // database/storage snapshot mismatch before any public data is rendered.
    if (certificateSubjectHash(snapshot) !== payload.subjectHash || emission.snapshotHash !== payload.subjectHash) {
      throw new AppError('Certificado invalido', 404);
    }
    const now = new Date();
    const estado = emission.credencial.estado === 'REVOCADA' ? 'REVOCADO' : (new Date(payload.validUntil) < now ? 'VENCIDO' : emission.credencial.estado);
    res.json({ success: true, data: { razonSocial: snapshot.actor.razonSocial, tipoActor: snapshot.actor.tipo, serial: emission.serial, vigenteDesde: payload.validFrom, vigenteHasta: payload.validUntil, estado, alcance: snapshot.credential.alcance || null } });
  } catch (error) { next(error); }
};
