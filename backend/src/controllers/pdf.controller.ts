import { Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// Colores del tema
const COLORS = {
    primary: '#10B981',
    primaryDark: '#059669',
    secondary: '#1E293B',
    accent: '#3B82F6',
    gray: '#64748B',
    lightGray: '#F1F5F9',
    text: '#1E293B',
    textLight: '#64748B',
    border: '#E2E8F0',
    white: '#FFFFFF',
    success: '#22C55E',
    warning: '#F59E0B',
};

// Helper para dibujar rectángulo
function drawRect(doc: any, x: number, y: number, w: number, h: number, color: string, radius = 0) {
    doc.save();
    doc.fillColor(color);
    if (radius > 0) {
        doc.roundedRect(x, y, w, h, radius).fill();
    } else {
        doc.rect(x, y, w, h).fill();
    }
    doc.restore();
}

// Helper para sección con título compacto
function drawSectionHeader(doc: any, title: string, x: number, y: number, width: number): number {
    drawRect(doc, x, y, width, 20, COLORS.secondary, 3);
    doc.save();
    doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold');
    doc.text(title, x + 8, y + 5);
    doc.restore();
    return y + 22;
}

// Helper para campo compacto - FIXED SPACING
function drawFieldCompact(doc: any, label: string, value: string, x: number, y: number): number {
    doc.save();
    // Label en posición fija
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight);
    doc.text(label, x, y, { width: 95, lineBreak: false });
    // Valor en posición separada
    doc.font('Helvetica').fillColor(COLORS.text);
    const displayValue = value || 'N/A';
    doc.text(displayValue, x + 100, y, { width: 380, lineBreak: false });
    doc.restore();
    return y + 16; // Aumentado de 12 a 16 para mejor espaciado
}


// Generar PDF del Manifiesto - DISEÑO COMPACTO UNA PÁGINA
export const generarPDFManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: true,
                transportista: {
                    include: { vehiculos: true, choferes: true }
                },
                operador: true,
                residuos: { include: { tipoResiduo: true } },
                eventos: { orderBy: { createdAt: 'asc' } }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=manifiesto_${manifiesto.numero}.pdf`);
        doc.pipe(res);

        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - 60;
        let y = 25;

        // ═══ ENCABEZADO COMPACTO ═══
        drawRect(doc, 0, 0, pageWidth, 6, COLORS.primary);
        
        // Header con número y estado
        drawRect(doc, 30, 15, contentWidth, 55, COLORS.lightGray, 6);
        
        doc.save();
        doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.secondary);
        doc.text('MANIFIESTO DE TRANSPORTE', 40, 22);
        doc.fontSize(10).fillColor(COLORS.gray);
        doc.text('RESIDUOS PELIGROSOS - Ley 24.051', 40, 40);
        doc.restore();

        // Badge número
        drawRect(doc, pageWidth - 145, 20, 110, 22, COLORS.primary, 4);
        doc.save();
        doc.fillColor(COLORS.white).fontSize(10).font('Helvetica-Bold');
        doc.text(manifiesto.numero, pageWidth - 140, 26, { width: 100, align: 'center' });
        doc.restore();

        // Badge estado
        const estadoColor = manifiesto.estado === 'TRATADO' ? COLORS.success : 
                           manifiesto.estado === 'EN_TRANSITO' ? COLORS.warning : COLORS.accent;
        drawRect(doc, pageWidth - 145, 45, 110, 18, estadoColor, 4);
        doc.save();
        doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold');
        doc.text(manifiesto.estado.replace('_', ' '), pageWidth - 140, 49, { width: 100, align: 'center' });
        doc.restore();

        y = 78;

        // ═══ SECCIÓN 1: GENERADOR ═══
        y = drawSectionHeader(doc, '1. GENERADOR', 30, y, contentWidth);
        y = drawFieldCompact(doc, 'Razón Social:', manifiesto.generador?.razonSocial || 'N/A', 35, y);
        y = drawFieldCompact(doc, 'CUIT:', manifiesto.generador?.cuit || 'N/A', 35, y);
        y = drawFieldCompact(doc, 'Domicilio:', manifiesto.generador?.domicilio || 'N/A', 35, y);
        y = drawFieldCompact(doc, 'N° Inscripción:', manifiesto.generador?.numeroInscripcion || 'N/A', 35, y);
        y += 5;

        // ═══ SECCIÓN 2: TRANSPORTISTA ═══
        y = drawSectionHeader(doc, '2. TRANSPORTISTA', 30, y, contentWidth);
        y = drawFieldCompact(doc, 'Razón Social:', manifiesto.transportista?.razonSocial || 'N/A', 35, y);
        y = drawFieldCompact(doc, 'CUIT:', manifiesto.transportista?.cuit || 'N/A', 35, y);
        if (manifiesto.transportista?.vehiculos?.[0]) {
            const v = manifiesto.transportista.vehiculos[0];
            y = drawFieldCompact(doc, 'Vehículo:', `${v.marca} ${v.modelo} - ${v.patente}`, 35, y);
        }
        if (manifiesto.transportista?.choferes?.[0]) {
            const c = manifiesto.transportista.choferes[0];
            y = drawFieldCompact(doc, 'Chofer:', `${c.nombre} - DNI: ${c.dni}`, 35, y);
        }
        y += 5;

        // ═══ SECCIÓN 3: OPERADOR ═══
        y = drawSectionHeader(doc, '3. OPERADOR', 30, y, contentWidth);
        y = drawFieldCompact(doc, 'Razón Social:', manifiesto.operador?.razonSocial || 'N/A', 35, y);
        y = drawFieldCompact(doc, 'CUIT:', manifiesto.operador?.cuit || 'N/A', 35, y);
        y = drawFieldCompact(doc, 'N° Habilitación:', manifiesto.operador?.numeroHabilitacion || 'N/A', 35, y);
        y += 5;

        // ═══ SECCIÓN 4: RESIDUOS (TABLA COMPACTA) ═══
        y = drawSectionHeader(doc, '4. RESIDUOS PELIGROSOS', 30, y, contentWidth);
        
        // Encabezado tabla
        const cols = [30, 100, 360, 430, 490];
        drawRect(doc, 30, y, contentWidth, 16, COLORS.secondary);
        doc.save();
        doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold');
        doc.text('CÓDIGO', cols[0] + 5, y + 4);
        doc.text('DESCRIPCIÓN', cols[1] + 5, y + 4);
        doc.text('CANTIDAD', cols[2] + 5, y + 4);
        doc.text('UND', cols[3] + 5, y + 4);
        doc.text('PELIGRO', cols[4] + 5, y + 4);
        doc.restore();
        y += 16;

        // Filas compactas
        for (let i = 0; i < Math.min(manifiesto.residuos.length, 5); i++) {
            const residuo = manifiesto.residuos[i];
            if (!residuo.tipoResiduo) continue;
            const bg = i % 2 === 0 ? COLORS.white : COLORS.lightGray;
            drawRect(doc, 30, y, contentWidth, 14, bg);
            doc.save();
            doc.fontSize(7).fillColor(COLORS.text);
            doc.text(residuo.tipoResiduo.codigo || 'N/A', cols[0] + 5, y + 4, { width: 65 });
            doc.text(residuo.tipoResiduo.nombre?.substring(0, 40) || '-', cols[1] + 5, y + 4, { width: 255 });
            doc.text(String(residuo.cantidad || 0), cols[2] + 5, y + 4, { width: 65 });
            doc.text(residuo.unidad || 'u', cols[3] + 5, y + 4, { width: 55 });
            doc.text(residuo.tipoResiduo.peligrosidad || '-', cols[4] + 5, y + 4, { width: 60 });
            doc.restore();
            y += 14;
        }
        y += 8;

        // ═══ SECCIÓN 5: FECHAS Y QR (LADO A LADO) ═══
        y = drawSectionHeader(doc, '5. TRAZABILIDAD Y VERIFICACIÓN', 30, y, contentWidth);
        
        const fechaFormat = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString('es-AR') : '---';
        
        // Columna izquierda: fechas
        const fechaY = y;
        doc.save();
        doc.fontSize(8).font('Helvetica').fillColor(COLORS.text);
        doc.text(`Creación: ${fechaFormat(manifiesto.createdAt)}`, 35, fechaY);
        doc.text(`Firma: ${fechaFormat(manifiesto.fechaFirma)}`, 35, fechaY + 12);
        doc.text(`Retiro: ${fechaFormat(manifiesto.fechaRetiro)}`, 35, fechaY + 24);
        doc.text(`Entrega: ${fechaFormat(manifiesto.fechaEntrega)}`, 180, fechaY);
        doc.text(`Recepción: ${fechaFormat(manifiesto.fechaRecepcion)}`, 180, fechaY + 12);
        doc.text(`Cierre: ${fechaFormat(manifiesto.fechaCierre)}`, 180, fechaY + 24);
        doc.restore();

        // Columna derecha: QR
        if (manifiesto.qrCode && manifiesto.qrCode.includes(',')) {
            try {
                const qrParts = manifiesto.qrCode.split(',');
                if (qrParts.length > 1) {
                    const qrImage = Buffer.from(qrParts[1], 'base64');
                    doc.image(qrImage, pageWidth - 130, fechaY - 5, { width: 70, height: 70 });
                    doc.save();
                    doc.fontSize(6).fillColor(COLORS.textLight);
                    doc.text('Escanear para verificar', pageWidth - 130, fechaY + 68, { width: 70, align: 'center' });
                    doc.restore();
                }
            } catch (e) {
                console.error('Error QR:', e);
            }
        }

        // Firma digital si existe
        const firmaDigital = manifiesto.firmaDigital as any;
        if (firmaDigital) {
            doc.save();
            doc.fontSize(7).fillColor(COLORS.textLight);
            doc.text(`Firma PKI: ${firmaDigital.certificadoSerial || 'N/A'}`, 320, fechaY);
            doc.text(`Firmante: ${firmaDigital.titular?.substring(0, 30) || 'N/A'}`, 320, fechaY + 10);
            doc.restore();
            
            // Badge validez
            drawRect(doc, 320, fechaY + 22, 50, 14, COLORS.success, 3);
            doc.save();
            doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold');
            doc.text('VÁLIDO', 325, fechaY + 26);
            doc.restore();
        }

        y = fechaY + 85;

        // ═══ PIE DE PÁGINA ═══
        doc.save();
        doc.moveTo(30, y).lineTo(pageWidth - 30, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor(COLORS.textLight);
        doc.text('Sistema de Trazabilidad SITREP - Ley 24.051 | Generado: ' + new Date().toLocaleString('es-AR'), 30, y + 5, { align: 'center', width: contentWidth });
        doc.restore();

        doc.end();

    } catch (error) {
        next(error);
    }
};

// Generar Certificado de Disposición - DISEÑO COMPACTO
export const generarCertificado = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: true,
                transportista: true,
                operador: true,
                residuos: { include: { tipoResiduo: true } }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        if (manifiesto.estado !== 'TRATADO') {
            throw new AppError('Solo se pueden generar certificados para manifiestos tratados', 400);
        }

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificado_${manifiesto.numero}.pdf`);
        doc.pipe(res);

        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - 80;
        let y = 40;

        // Borde decorativo
        doc.save();
        doc.strokeColor(COLORS.primary).lineWidth(2);
        doc.rect(25, 25, pageWidth - 50, doc.page.height - 50).stroke();
        doc.restore();

        // Encabezado
        doc.save();
        doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.secondary);
        doc.text('CERTIFICADO DE DISPOSICIÓN FINAL', 40, y, { align: 'center', width: contentWidth });
        y += 28;
        doc.fontSize(11).fillColor(COLORS.gray);
        doc.text('DE RESIDUOS PELIGROSOS', 40, y, { align: 'center', width: contentWidth });
        y += 20;
        
        drawRect(doc, pageWidth/2 - 60, y, 120, 25, COLORS.primary, 5);
        doc.fillColor(COLORS.white).fontSize(12).font('Helvetica-Bold');
        doc.text(`N° ${manifiesto.numero}`, pageWidth/2 - 55, y + 7, { width: 110, align: 'center' });
        doc.restore();
        
        y += 45;

        // Cuerpo
        drawRect(doc, 40, y, contentWidth, 180, COLORS.lightGray, 6);
        doc.save();
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);
        doc.text('Por medio del presente se certifica que:', 55, y + 15, { width: contentWidth - 30 });
        doc.text(
            `La empresa ${manifiesto.operador?.razonSocial || 'N/A'}, CUIT ${manifiesto.operador?.cuit || 'N/A'}, ` +
            `habilitada bajo N° ${manifiesto.operador?.numeroHabilitacion || 'N/A'}, ha recibido y tratado ` +
            `los residuos peligrosos del manifiesto de referencia, provenientes del generador ` +
            `${manifiesto.generador?.razonSocial || 'N/A'}, transportados por ${manifiesto.transportista?.razonSocial || 'N/A'}.`,
            55, y + 35, { width: contentWidth - 30, align: 'justify' }
        );

        doc.font('Helvetica-Bold').text('Residuos tratados:', 55, y + 95);
        doc.font('Helvetica');
        let residuoY = y + 110;
        for (const residuo of manifiesto.residuos.slice(0, 4)) {
            if (!residuo.tipoResiduo) continue;
            doc.text(`• ${residuo.tipoResiduo.nombre} - ${residuo.cantidad} ${residuo.unidad}`, 70, residuoY);
            residuoY += 14;
        }
        doc.restore();
        
        y += 195;

        // Fechas y QR
        doc.save();
        doc.fontSize(9).fillColor(COLORS.text);
        doc.text(`Fecha recepción: ${manifiesto.fechaRecepcion ? new Date(manifiesto.fechaRecepcion).toLocaleDateString('es-AR') : 'N/A'}`, 55, y);
        doc.text(`Fecha tratamiento: ${manifiesto.fechaCierre ? new Date(manifiesto.fechaCierre).toLocaleDateString('es-AR') : 'N/A'}`, 55, y + 14);
        doc.restore();

        // QR
        if (manifiesto.qrCode && manifiesto.qrCode.includes(',')) {
            try {
                const qrParts = manifiesto.qrCode.split(',');
                if (qrParts.length > 1) {
                    const qrImage = Buffer.from(qrParts[1], 'base64');
                    doc.image(qrImage, pageWidth - 130, y - 10, { width: 70, height: 70 });
                }
            } catch (e) { }
        }

        y += 55;

        // Firma
        doc.save();
        doc.strokeColor(COLORS.secondary).lineWidth(1);
        doc.moveTo(pageWidth/2 - 80, y).lineTo(pageWidth/2 + 80, y).stroke();
        doc.fontSize(8).fillColor(COLORS.text);
        doc.text('Firma y Sello del Operador', pageWidth/2 - 80, y + 8, { width: 160, align: 'center' });
        doc.restore();

        // Pie
        doc.save();
        doc.fontSize(7).fillColor(COLORS.textLight);
        doc.text('Sistema SITREP - Ley 24.051 | Generado: ' + new Date().toLocaleString('es-AR'), 40, doc.page.height - 50, { align: 'center', width: contentWidth });
        doc.restore();

        doc.end();

    } catch (error) {
        next(error);
    }
};
