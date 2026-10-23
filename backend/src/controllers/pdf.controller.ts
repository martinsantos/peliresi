import { loadInspectionPdfBranding } from '../services/inspectionPdfBranding.service';
import { documentHeader } from '../services/institutionalPdf.service';
import { renderManifestPdf } from '../services/manifestPdf.service';
import { CERTIFICATE_MANAGED, CERTIFICATE_EVENT } from '../services/manifestCertificate.service';
import { sendStoredCertificate } from './manifest-certificate.controller';
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { canAccessManifiesto } from '../utils/roleFilter';
import { readTransportAssignment } from '../domain/manifiestoTransportAssignment';

// ── Shared PDF helpers ──

const COLORS = {
    primary: '#0D8A4F',
    primaryDark: '#1B5E3C',
    primaryLight: '#F0FDF4',
    dark: '#111827',
    gray: '#6B7280',
    grayLight: '#F3F4F6',
    border: '#D1D5DB',
    white: '#FFFFFF',
};

async function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    const branding = await loadInspectionPdfBranding();
    let page = 0;
    const header = () => { documentHeader(doc, title, subtitle, ++page, branding); doc.x = 50; doc.y = 110; doc.fillColor(COLORS.dark); };
    doc.on('pageAdded', header); header();
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.primaryDark).text(title, 50, 110, { width: doc.page.width - 100 });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray).text(subtitle, { width: doc.page.width - 100 });
}

function drawSectionTitle(doc: PDFKit.PDFDocument, num: string, title: string) {
    const y = doc.y;
    const boxW = doc.page.width - 100;
    doc.save();
    doc.roundedRect(50, y, boxW, 22, 3)
       .fillColor(COLORS.grayLight).fill();
    doc.restore();

    doc.fontSize(9).font('Helvetica-Bold')
       .fillColor(COLORS.primary)
       .text(num, 58, y + 6, { width: 22, lineBreak: false });
    doc.fontSize(9).font('Helvetica-Bold')
       .fillColor(COLORS.dark)
       .text(title, 82, y + 6, { width: boxW - 40, lineBreak: false });

    doc.y = y + 30;
    doc.fillColor(COLORS.dark);
}

function drawField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
    doc.fontSize(7).font('Helvetica')
       .fillColor(COLORS.gray)
       .text(label, x, y, { width });
    doc.fontSize(9).font('Helvetica-Bold')
       .fillColor(COLORS.dark)
       .text(value || 'N/A', x, y + 10, { width });
}

function drawBlockchainSeal(doc: PDFKit.PDFDocument, manifiesto: any) {
    if (manifiesto.blockchainStatus !== 'CONFIRMADO' || !manifiesto.blockchainHash) return;

    const boxX = 50;
    const boxW = doc.page.width - 100;
    const boxY = doc.y + 5;
    const boxH = 82;

    doc.save();
    doc.roundedRect(boxX, boxY, boxW, boxH, 6)
       .lineWidth(2)
       .strokeColor(COLORS.primary)
       .fillAndStroke(COLORS.primaryLight, COLORS.primary);
    doc.restore();

    // Checkmark circle
    doc.save();
    doc.circle(boxX + 28, boxY + 22, 11)
       .fillColor(COLORS.primary).fill();
    doc.fontSize(13).font('Helvetica-Bold')
       .fillColor(COLORS.white)
       .text('\u2713', boxX + 21.5, boxY + 15.5, { width: 13, align: 'center' });
    doc.restore();

    doc.fontSize(11).font('Helvetica-Bold')
       .fillColor(COLORS.primary)
       .text('CERTIFICADO EN BLOCKCHAIN', boxX + 48, boxY + 11);
    doc.fontSize(7).font('Helvetica')
       .fillColor(COLORS.primaryDark)
       .text('Ethereum Sepolia \u00B7 Registro inmutable verificable', boxX + 48, boxY + 25);

    doc.fontSize(7).font('Helvetica-Bold')
       .fillColor(COLORS.dark)
       .text('SHA-256: ', boxX + 14, boxY + 42, { continued: true });
    doc.font('Courier').text(manifiesto.blockchainHash);

    if (manifiesto.blockchainTxHash) {
        doc.fontSize(7).font('Helvetica-Bold')
           .fillColor(COLORS.dark)
           .text('TX: ', boxX + 14, boxY + 54, { continued: true });
        doc.font('Courier').text(manifiesto.blockchainTxHash);
        doc.fontSize(7).font('Helvetica')
           .fillColor(COLORS.primary)
           .text(`Verificar: https://sepolia.etherscan.io/tx/${manifiesto.blockchainTxHash}`, boxX + 14, boxY + 66);
    }

    doc.y = boxY + boxH + 8;
}

function drawFooter(doc: PDFKit.PDFDocument, manifiestoNumero: string) {
    doc.moveDown(1);
    const lineY = doc.y;
    doc.save();
    doc.moveTo(50, lineY).lineTo(doc.page.width - 50, lineY)
       .lineWidth(0.5).strokeColor(COLORS.border).stroke();
    doc.restore();

    doc.moveDown(0.5);
    doc.fontSize(7).font('Helvetica')
       .fillColor(COLORS.gray)
       .text(`Manifiesto ${manifiestoNumero} \u00B7 Generado el ${new Date().toLocaleString('es-AR')} \u00B7 SITREP Mendoza`, { align: 'center' });
    doc.text('Sistema de Trazabilidad de Residuos Peligrosos \u00B7 Ley 24.051', { align: 'center' });
}

// ── PDF Manifiesto (CU-G10) ──

export const generarPDFManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: true,
                transportista: true,
                operador: true,
                residuos: { include: { tipoResiduo: true } },
                eventos: { orderBy: { createdAt: 'asc' }, include: { usuario: { select: { nombre: true, apellido: true } } } },
            },
        });

        if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
        if (!canAccessManifiesto(req.user, manifiesto)) throw new AppError('Manifiesto no encontrado', 404);

        const pdf = await renderManifestPdf(manifiesto);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=manifiesto_${manifiesto.numero}.pdf`);
        res.send(pdf);
    } catch (error) {
        next(error);
    }
};

// ── Certificado de Disposicion (CU-O10) ──

export const generarCertificado = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: true,
                transportista: true,
                operador: true,
                residuos: { include: { tipoResiduo: true } },
                eventos: { orderBy: { createdAt: 'desc' } },
            },
        });

        if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
        if (!canAccessManifiesto(req.user, manifiesto)) throw new AppError('Manifiesto no encontrado', 404);
        if (manifiesto.eventos.some(e => [CERTIFICATE_MANAGED, CERTIFICATE_EVENT].includes(e.tipo))) {
            const issued = await prisma.certificadoManifiesto.findFirst({where:{manifiestoId:id,tipo:'FINAL'}});
            if (!issued) throw new AppError('El operador todavía no emitió la certificación final',409);
            sendStoredCertificate(res,issued); return;
        }
        if (manifiesto.estado !== 'TRATADO') {
            throw new AppError('Solo se pueden generar certificados de manifiestos tratados', 400);
        }

        const doc = new PDFDocument({ margins: {top: 110, bottom: 65, left: 50, right: 50}, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificado_${manifiesto.numero}.pdf`);
        doc.pipe(res);

        // ── Header ──
        await drawHeader(doc, 'Certificado de tratamiento y disposición final', 'Ley Nacional 24.051 \u00B7 Provincia de Mendoza');

        // Certificate number
        doc.fontSize(14).font('Helvetica-Bold')
           .fillColor(COLORS.dark)
           .text(`Certificado N\u00BA CERT-${manifiesto.numero}`, 50, doc.y + 8, { align: 'center' });
        doc.moveDown(1.5);

        // Body text
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.dark);
        doc.text('Por medio del presente se certifica que la empresa ', { continued: true });
        doc.font('Helvetica-Bold').text(manifiesto.operador.razonSocial, { continued: true });
        doc.font('Helvetica').text(`, identificada con CUIT ${manifiesto.operador.cuit}, habilitada como Operador de Tratamiento de Residuos Peligrosos, ha recibido y tratado los residuos detallados a continuacion:`);
        doc.moveDown(1.2);

        // Generador
        drawSectionTitle(doc, '01', 'GENERADOR');
        const gY2 = doc.y;
        drawField(doc, 'Razon Social', manifiesto.generador.razonSocial, 58, gY2, 240);
        drawField(doc, 'CUIT', manifiesto.generador.cuit, 310, gY2, 150);
        doc.y = Math.max(gY2 + 32, doc.y + 12);

        // Residuos
        drawSectionTitle(doc, '02', 'RESIDUOS TRATADOS');
        for (const r of manifiesto.residuos) {
            doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark)
               .text(`\u2022 ${r.tipoResiduo.codigo} \u2014 ${r.tipoResiduo.nombre}: `, 58, doc.y, { continued: true });
            doc.font('Helvetica-Bold').text(`${r.cantidad} ${r.unidad}`);
        }
        doc.moveDown(0.8);

        // Metodo
        drawSectionTitle(doc, '03', 'METODO DE TRATAMIENTO');
        const eventoTratamiento = manifiesto.eventos.find(e => e.tipo === 'TRATAMIENTO' || e.tipo === 'CIERRE');
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark)
           .text(eventoTratamiento?.descripcion || 'Tratamiento segun normas vigentes', 58, doc.y);
        doc.moveDown(0.8);

        // Fechas
        drawSectionTitle(doc, '04', 'FECHAS');
        const fY2 = doc.y;
        drawField(doc, 'Recepcion', manifiesto.fechaRecepcion ? new Date(manifiesto.fechaRecepcion).toLocaleDateString('es-AR') : 'N/A', 58, fY2, 200);
        drawField(doc, 'Tratamiento', manifiesto.fechaCierre ? new Date(manifiesto.fechaCierre).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR'), 270, fY2, 200);
        doc.y = fY2 + 32;

        // Declaracion
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark)
           .text('Se deja constancia que los residuos mencionados han sido tratados y/o dispuestos de acuerdo con la normativa ambiental vigente, cumpliendo con los requisitos establecidos por la Ley 24.051 y el Decreto 831/93.', 50, doc.y, { align: 'justify', width: doc.page.width - 100 });

        doc.moveDown(2.5);

        // Firma
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.dark)
           .text('_______________________________', { align: 'center' });
        doc.text('Firma y Sello del Operador', { align: 'center' });
        doc.font('Helvetica-Bold').text(manifiesto.operador.razonSocial, { align: 'center' });
        doc.moveDown(1.5);

        // Blockchain seal
        drawBlockchainSeal(doc, manifiesto);

        drawFooter(doc, manifiesto.numero);
        doc.end();
    } catch (error) {
        next(error);
    }
};
