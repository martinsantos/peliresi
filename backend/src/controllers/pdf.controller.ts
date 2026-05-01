import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { canAccessManifiesto } from '../utils/roleFilter';

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

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    const pageW = doc.page.width;
    // Green header bar
    doc.save();
    doc.rect(0, 0, pageW, 85).fillColor(COLORS.primary).fill();
    doc.rect(0, 85, pageW, 3).fillColor(COLORS.primaryDark).fill();
    doc.restore();

    // Logo text
    doc.fontSize(22).font('Helvetica-Bold')
       .fillColor(COLORS.white)
       .text('SITREP', 50, 18, { continued: true });
    doc.fontSize(14).font('Helvetica')
       .text('  Mendoza', { continued: false });

    // Title
    doc.fontSize(11).font('Helvetica-Bold')
       .fillColor(COLORS.white)
       .text(title, 50, 48);

    // Subtitle
    doc.fontSize(8).font('Helvetica')
       .fillColor('#C6F6D5')
       .text(subtitle, 50, 63);

    doc.y = 100;
    doc.fillColor(COLORS.dark);
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
                transportista: { include: { vehiculos: true, choferes: true } },
                operador: true,
                residuos: { include: { tipoResiduo: true } },
                eventos: { orderBy: { createdAt: 'asc' } },
            },
        });

        if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
        if (!canAccessManifiesto(req.user, manifiesto)) throw new AppError('Manifiesto no encontrado', 404);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=manifiesto_${manifiesto.numero}.pdf`);
        doc.pipe(res);

        // ── Header ──
        drawHeader(doc, 'MANIFIESTO DE TRANSPORTE DE RESIDUOS PELIGROSOS', 'Ley Nacional 24.051 \u00B7 Decreto 831/93 \u00B7 Provincia de Mendoza');

        // ── Manifest number + status ──
        const statusColors: Record<string, string> = {
            BORRADOR: '#9CA3AF', APROBADO: '#2563EB', EN_TRANSITO: '#D97706',
            ENTREGADO: '#7C3AED', RECIBIDO: '#0891B2', EN_TRATAMIENTO: '#EA580C',
            TRATADO: '#059669', RECHAZADO: '#DC2626', CANCELADO: '#6B7280',
        };
        const stColor = statusColors[manifiesto.estado] || COLORS.gray;

        const numY = doc.y + 5;
        doc.fontSize(16).font('Helvetica-Bold')
           .fillColor(COLORS.dark)
           .text(`N\u00BA ${manifiesto.numero}`, 50, numY, { lineBreak: false });

        // Status badge (positioned after the number)
        const numW = doc.widthOfString(`N\u00BA ${manifiesto.numero}`);
        doc.save();
        doc.fontSize(8).font('Helvetica-Bold');
        const badgeW = doc.widthOfString(manifiesto.estado) + 16;
        const badgeX = 50 + numW + 15;
        doc.roundedRect(badgeX, numY + 1, badgeW, 18, 9)
           .fillColor(stColor).fill();
        doc.restore();
        doc.fontSize(8).font('Helvetica-Bold')
           .fillColor(COLORS.white)
           .text(manifiesto.estado, badgeX + 8, numY + 5, { lineBreak: false });

        doc.fontSize(9).font('Helvetica')
           .fillColor(COLORS.gray)
           .text(`Creado el ${new Date(manifiesto.createdAt).toLocaleDateString('es-AR')}`, 50, numY + 22);

        doc.y = numY + 40;
        doc.fillColor(COLORS.dark);

        // ── 1. Generador ──
        drawSectionTitle(doc, '01', 'GENERADOR DE RESIDUOS');
        const gY = doc.y;
        drawField(doc, 'Razon Social', manifiesto.generador.razonSocial, 58, gY, 220);
        drawField(doc, 'CUIT', manifiesto.generador.cuit, 290, gY, 100);
        drawField(doc, 'N\u00BA Inscripcion', manifiesto.generador.numeroInscripcion || 'N/A', 400, gY, 140);
        doc.y = gY + 28;
        drawField(doc, 'Domicilio', manifiesto.generador.domicilio, 58, doc.y, 350);
        doc.y += 30;

        // ── 2. Transportista ──
        if (manifiesto.transportista) {
            drawSectionTitle(doc, '02', 'TRANSPORTISTA HABILITADO');
            const tY = doc.y;
            drawField(doc, 'Razon Social', manifiesto.transportista.razonSocial, 58, tY, 220);
            drawField(doc, 'CUIT', manifiesto.transportista.cuit, 290, tY, 100);
            drawField(doc, 'N\u00BA Habilitacion', manifiesto.transportista.numeroHabilitacion || 'N/A', 400, tY, 140);
            doc.y = tY + 28;
            if (manifiesto.transportista.vehiculos?.[0]) {
                const v = manifiesto.transportista.vehiculos[0];
                drawField(doc, 'Vehiculo', `${v.marca} ${v.modelo} \u2014 ${v.patente}`, 58, doc.y, 220);
            }
            if (manifiesto.transportista.choferes?.[0]) {
                const c = manifiesto.transportista.choferes[0];
                drawField(doc, 'Chofer', `${c.nombre} \u2014 DNI ${c.dni}`, 290, doc.y, 250);
            }
            doc.y += 30;
        } else {
            drawSectionTitle(doc, '02', 'MODALIDAD IN SITU');
            drawField(doc, 'Modalidad', 'Tratamiento in situ — sin transporte', 58, doc.y, 400);
            doc.y += 30;
        }

        // ── 3. Operador ──
        drawSectionTitle(doc, '03', 'OPERADOR DE TRATAMIENTO');
        const oY = doc.y;
        drawField(doc, 'Razon Social', manifiesto.operador.razonSocial, 58, oY, 220);
        drawField(doc, 'CUIT', manifiesto.operador.cuit, 290, oY, 100);
        drawField(doc, 'N\u00BA Habilitacion', manifiesto.operador.numeroHabilitacion || 'N/A', 400, oY, 140);
        doc.y = oY + 28;
        drawField(doc, 'Domicilio', manifiesto.operador.domicilio, 58, doc.y, 350);
        doc.y += 30;

        // ── 4. Residuos table ──
        drawSectionTitle(doc, '04', 'RESIDUOS PELIGROSOS');

        // Table header
        const cols = [58, 140, 360, 440];
        const colW = [80, 218, 78, 60];
        const thY = doc.y;
        doc.save();
        doc.rect(50, thY, doc.page.width - 100, 18).fillColor(COLORS.primaryDark).fill();
        doc.restore();
        doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.white);
        doc.text('CODIGO', cols[0], thY + 5, { width: colW[0] });
        doc.text('DESCRIPCION', cols[1], thY + 5, { width: colW[1] });
        doc.text('CANTIDAD', cols[2], thY + 5, { width: colW[2], align: 'right' });
        doc.text('UNIDAD', cols[3], thY + 5, { width: colW[3] });
        doc.fillColor(COLORS.dark);

        let rY = thY + 22;
        for (let i = 0; i < manifiesto.residuos.length; i++) {
            const r = manifiesto.residuos[i];
            if (i % 2 === 0) {
                doc.save();
                doc.rect(50, rY - 3, doc.page.width - 100, 18).fillColor('#F9FAFB').fill();
                doc.restore();
            }
            doc.fontSize(8).font('Courier').fillColor(COLORS.primary)
               .text(r.tipoResiduo.codigo, cols[0], rY, { width: colW[0] });
            doc.font('Helvetica').fillColor(COLORS.dark)
               .text(r.tipoResiduo.nombre, cols[1], rY, { width: colW[1] });
            doc.font('Helvetica-Bold')
               .text(r.cantidad.toString(), cols[2], rY, { width: colW[2], align: 'right' });
            doc.font('Helvetica').fillColor(COLORS.gray)
               .text(r.unidad, cols[3], rY, { width: colW[3] });
            rY += 18;
        }
        // Bottom border
        doc.save();
        doc.moveTo(50, rY).lineTo(doc.page.width - 50, rY)
           .lineWidth(0.5).strokeColor(COLORS.border).stroke();
        doc.restore();
        doc.y = rY + 10;
        doc.fillColor(COLORS.dark);

        // ── 5. Observaciones ──
        if (manifiesto.observaciones) {
            drawSectionTitle(doc, '05', 'OBSERVACIONES');
            doc.fontSize(9).font('Helvetica').fillColor(COLORS.dark)
               .text(manifiesto.observaciones, 58, doc.y, { width: doc.page.width - 116 });
            doc.moveDown(0.8);
        }

        // ── 6. Fechas grid ──
        drawSectionTitle(doc, '06', 'FECHAS Y FIRMAS');
        const dates = [
            ['Creacion', manifiesto.createdAt],
            ['Firma', manifiesto.fechaFirma],
            ['Retiro', manifiesto.fechaRetiro],
            ['Entrega', manifiesto.fechaEntrega],
            ['Recepcion', manifiesto.fechaRecepcion],
            ['Cierre', manifiesto.fechaCierre],
        ].filter(([, v]) => v) as [string, string][];

        const fY = doc.y;
        const fColW = 125;
        dates.forEach(([label, val], i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            drawField(doc, label, new Date(val).toLocaleDateString('es-AR'), 58 + col * fColW, fY + row * 28, fColW - 10);
        });
        doc.y = fY + (Math.ceil(dates.length / 4)) * 28 + 8;

        // ── QR + Blockchain side by side ──
        if (manifiesto.qrCode || (manifiesto.blockchainStatus === 'CONFIRMADO' && manifiesto.blockchainHash)) {
            // Check if we need a new page
            if (doc.y > 620) doc.addPage();

            const sectionY = doc.y + 5;

            // QR code on the left
            if (manifiesto.qrCode) {
                try {
                    const qrImage = Buffer.from(manifiesto.qrCode.split(',')[1], 'base64');
                    doc.image(qrImage, 58, sectionY, { width: 80, height: 80 });
                    doc.fontSize(7).font('Helvetica').fillColor(COLORS.gray)
                       .text('Codigo QR de Verificacion', 58, sectionY + 84, { width: 80, align: 'center' });
                } catch { /* QR decode failed, skip */ }
            }

            // Blockchain seal on the right (or full width if no QR)
            if (manifiesto.blockchainStatus === 'CONFIRMADO' && manifiesto.blockchainHash) {
                const bcX = manifiesto.qrCode ? 160 : 50;
                const bcW = manifiesto.qrCode ? doc.page.width - 210 : doc.page.width - 100;
                const bcH = 78;

                doc.save();
                doc.roundedRect(bcX, sectionY, bcW, bcH, 5)
                   .lineWidth(1.5)
                   .strokeColor(COLORS.primary)
                   .fillAndStroke(COLORS.primaryLight, COLORS.primary);
                doc.restore();

                doc.save();
                doc.circle(bcX + 22, sectionY + 20, 10)
                   .fillColor(COLORS.primary).fill();
                doc.fontSize(12).font('Helvetica-Bold')
                   .fillColor(COLORS.white)
                   .text('\u2713', bcX + 16, sectionY + 14, { width: 12, align: 'center' });
                doc.restore();

                doc.fontSize(10).font('Helvetica-Bold')
                   .fillColor(COLORS.primary)
                   .text('CERTIFICADO EN BLOCKCHAIN', bcX + 40, sectionY + 10);
                doc.fontSize(6.5).font('Helvetica')
                   .fillColor(COLORS.primaryDark)
                   .text('Ethereum Sepolia \u00B7 Inmutable', bcX + 40, sectionY + 23);

                doc.fontSize(6.5).font('Courier').fillColor(COLORS.dark)
                   .text(`SHA-256: ${manifiesto.blockchainHash}`, bcX + 10, sectionY + 38, { width: bcW - 20 });
                if (manifiesto.blockchainTxHash) {
                    doc.text(`TX: ${manifiesto.blockchainTxHash}`, bcX + 10, sectionY + 50, { width: bcW - 20 });
                    doc.fontSize(6.5).font('Helvetica').fillColor(COLORS.primary)
                       .text(`Verificar: https://sepolia.etherscan.io/tx/${manifiesto.blockchainTxHash}`, bcX + 10, sectionY + 62, { width: bcW - 20 });
                }
            }

            doc.y = sectionY + 100;
        }

        drawFooter(doc, manifiesto.numero);
        doc.end();
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
        if (manifiesto.estado !== 'TRATADO') {
            throw new AppError('Solo se pueden generar certificados de manifiestos tratados', 400);
        }

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificado_${manifiesto.numero}.pdf`);
        doc.pipe(res);

        // ── Header ──
        drawHeader(doc, 'CERTIFICADO DE TRATAMIENTO Y DISPOSICION FINAL', 'Ley Nacional 24.051 \u00B7 Provincia de Mendoza');

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
        doc.y = gY2 + 32;

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
