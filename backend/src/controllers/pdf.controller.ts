import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import PDFDocument from 'pdfkit';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// Generar PDF del Manifiesto (CU-G10)
export const generarPDFManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: true,
                transportista: {
                    include: {
                        vehiculos: true,
                        choferes: true
                    }
                },
                operador: true,
                residuos: {
                    include: {
                        tipoResiduo: true
                    }
                },
                eventos: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        // Crear documento PDF
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4'
        });

        // Configurar respuesta HTTP
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=manifiesto_${manifiesto.numero}.pdf`);
        doc.pipe(res);

        // --- ENCABEZADO ---
        doc.fontSize(18).font('Helvetica-Bold')
            .text('MANIFIESTO DE TRANSPORTE DE RESIDUOS PELIGROSOS', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica')
            .text('Ley Nacional 24.051 - Decreto Reglamentario 831/93', { align: 'center' });

        doc.moveDown(0.3);
        doc.fontSize(10)
            .text('Dirección de Gestión y Fiscalización Ambiental - Provincia de Mendoza', { align: 'center' });

        doc.moveDown();

        // Número y estado
        doc.fontSize(14).font('Helvetica-Bold')
            .text(`Manifiesto N°: ${manifiesto.numero}`, { align: 'center' });
        doc.fontSize(11).font('Helvetica')
            .text(`Estado: ${manifiesto.estado}`, { align: 'center' });

        doc.moveDown(1.5);

        // --- DATOS DEL GENERADOR ---
        doc.fontSize(12).font('Helvetica-Bold')
            .text('1. DATOS DEL GENERADOR', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Razón Social: ${manifiesto.generador.razonSocial}`);
        doc.text(`CUIT: ${manifiesto.generador.cuit}`);
        doc.text(`Domicilio: ${manifiesto.generador.domicilio}`);
        doc.text(`N° Inscripción: ${manifiesto.generador.numeroInscripcion || 'N/A'}`);
        doc.text(`Categoría: ${manifiesto.generador.categoria || 'N/A'}`);

        doc.moveDown();

        // --- DATOS DEL TRANSPORTISTA ---
        doc.fontSize(12).font('Helvetica-Bold')
            .text('2. DATOS DEL TRANSPORTISTA', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Razón Social: ${manifiesto.transportista.razonSocial}`);
        doc.text(`CUIT: ${manifiesto.transportista.cuit}`);
        doc.text(`N° Habilitación: ${manifiesto.transportista.numeroHabilitacion || 'N/A'}`);

        if (manifiesto.transportista.vehiculos && manifiesto.transportista.vehiculos.length > 0) {
            const vehiculo = manifiesto.transportista.vehiculos[0];
            doc.text(`Vehículo: ${vehiculo.marca} ${vehiculo.modelo} - Patente: ${vehiculo.patente}`);
        }

        if (manifiesto.transportista.choferes && manifiesto.transportista.choferes.length > 0) {
            const chofer = manifiesto.transportista.choferes[0];
            doc.text(`Chofer: ${chofer.nombre} - DNI: ${chofer.dni}`);
        }

        doc.moveDown();

        // --- DATOS DEL OPERADOR ---
        doc.fontSize(12).font('Helvetica-Bold')
            .text('3. DATOS DEL OPERADOR DE TRATAMIENTO', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Razón Social: ${manifiesto.operador.razonSocial}`);
        doc.text(`CUIT: ${manifiesto.operador.cuit}`);
        doc.text(`Domicilio: ${manifiesto.operador.domicilio}`);
        doc.text(`N° Habilitación: ${manifiesto.operador.numeroHabilitacion || 'N/A'}`);

        doc.moveDown();

        // --- RESIDUOS ---
        doc.fontSize(12).font('Helvetica-Bold')
            .text('4. DESCRIPCIÓN DE RESIDUOS PELIGROSOS', { underline: true });
        doc.moveDown(0.5);

        // Tabla de residuos
        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 150;
        const col3 = 350;
        const col4 = 450;

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Código', col1, tableTop);
        doc.text('Descripción', col2, tableTop);
        doc.text('Cantidad', col3, tableTop);
        doc.text('Unidad', col4, tableTop);

        doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let yPos = tableTop + 20;
        doc.font('Helvetica').fontSize(9);

        for (const residuo of manifiesto.residuos) {
            doc.text(residuo.tipoResiduo.codigo, col1, yPos, { width: 90 });
            doc.text(residuo.tipoResiduo.nombre, col2, yPos, { width: 190 });
            doc.text(residuo.cantidad.toString(), col3, yPos, { width: 90 });
            doc.text(residuo.unidad, col4, yPos, { width: 90 });
            yPos += 20;
        }

        doc.y = yPos + 10;
        doc.moveDown();

        // --- OBSERVACIONES ---
        if (manifiesto.observaciones) {
            doc.fontSize(12).font('Helvetica-Bold')
                .text('5. OBSERVACIONES', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica')
                .text(manifiesto.observaciones);
            doc.moveDown();
        }

        // --- FECHAS ---
        doc.fontSize(12).font('Helvetica-Bold')
            .text('6. FECHAS Y FIRMAS', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');

        doc.text(`Fecha de Creación: ${new Date(manifiesto.createdAt).toLocaleDateString('es-AR')}`);

        if (manifiesto.fechaFirma) {
            doc.text(`Fecha de Firma: ${new Date(manifiesto.fechaFirma).toLocaleDateString('es-AR')}`);
        }
        if (manifiesto.fechaRetiro) {
            doc.text(`Fecha de Retiro: ${new Date(manifiesto.fechaRetiro).toLocaleDateString('es-AR')}`);
        }
        if (manifiesto.fechaEntrega) {
            doc.text(`Fecha de Entrega: ${new Date(manifiesto.fechaEntrega).toLocaleDateString('es-AR')}`);
        }
        if (manifiesto.fechaRecepcion) {
            doc.text(`Fecha de Recepción: ${new Date(manifiesto.fechaRecepcion).toLocaleDateString('es-AR')}`);
        }
        if (manifiesto.fechaCierre) {
            doc.text(`Fecha de Cierre: ${new Date(manifiesto.fechaCierre).toLocaleDateString('es-AR')}`);
        }

        doc.moveDown();

        // --- CÓDIGO QR ---
        if (manifiesto.qrCode) {
            doc.fontSize(12).font('Helvetica-Bold')
                .text('CÓDIGO QR DE VERIFICACIÓN', { underline: true });
            doc.moveDown(0.5);

            // Convertir base64 a imagen
            const qrImage = Buffer.from(manifiesto.qrCode.split(',')[1], 'base64');
            doc.image(qrImage, { width: 100, height: 100 });
        }

        // --- PIE DE PÁGINA ---
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica')
            .text('Este documento ha sido generado electrónicamente por el Sistema de Trazabilidad de RRPP.', { align: 'center' });
        doc.text(`Generado el: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });

        // Finalizar documento
        doc.end();

    } catch (error) {
        next(error);
    }
};

// Generar Certificado de Disposición (CU-O10)
export const generarCertificado = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: true,
                transportista: true,
                operador: true,
                residuos: {
                    include: {
                        tipoResiduo: true
                    }
                },
                eventos: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        if (manifiesto.estado !== 'TRATADO') {
            throw new AppError('Solo se pueden generar certificados de manifiestos tratados', 400);
        }

        // Crear documento PDF
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4'
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificado_${manifiesto.numero}.pdf`);
        doc.pipe(res);

        // --- ENCABEZADO ---
        doc.fontSize(18).font('Helvetica-Bold')
            .text('CERTIFICADO DE TRATAMIENTO Y DISPOSICIÓN FINAL', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica')
            .text('DE RESIDUOS PELIGROSOS', { align: 'center' });

        doc.moveDown(0.3);
        doc.fontSize(10)
            .text('Ley Nacional 24.051 - Provincia de Mendoza', { align: 'center' });

        doc.moveDown(2);

        // --- NÚMERO DE CERTIFICADO ---
        doc.fontSize(14).font('Helvetica-Bold')
            .text(`Certificado N°: CERT-${manifiesto.numero}`, { align: 'center' });

        doc.moveDown(2);

        // --- CUERPO ---
        doc.fontSize(11).font('Helvetica');
        doc.text(`Por medio del presente se certifica que la empresa `, { continued: true });
        doc.font('Helvetica-Bold').text(`${manifiesto.operador.razonSocial}`, { continued: true });
        doc.font('Helvetica').text(`, identificada con CUIT ${manifiesto.operador.cuit}, habilitada como Operador de Tratamiento de Residuos Peligrosos, ha recibido y tratado los residuos detallados a continuación:`);

        doc.moveDown(1.5);

        // --- DATOS DEL GENERADOR ---
        doc.fontSize(12).font('Helvetica-Bold').text('GENERADOR:');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Razón Social: ${manifiesto.generador.razonSocial}`);
        doc.text(`CUIT: ${manifiesto.generador.cuit}`);

        doc.moveDown();

        // --- RESIDUOS TRATADOS ---
        doc.fontSize(12).font('Helvetica-Bold').text('RESIDUOS TRATADOS:');
        doc.moveDown(0.5);

        for (const residuo of manifiesto.residuos) {
            doc.fontSize(10).font('Helvetica');
            doc.text(`• ${residuo.tipoResiduo.codigo} - ${residuo.tipoResiduo.nombre}: ${residuo.cantidad} ${residuo.unidad}`);
        }

        doc.moveDown();

        // --- MÉTODO DE TRATAMIENTO ---
        const eventoTratamiento = manifiesto.eventos.find(e => e.tipo === 'TRATAMIENTO' || e.tipo === 'CIERRE');
        const metodoTratamiento = eventoTratamiento?.descripcion || 'Tratamiento según normas vigentes';

        doc.fontSize(12).font('Helvetica-Bold').text('MÉTODO DE TRATAMIENTO:');
        doc.fontSize(10).font('Helvetica').text(metodoTratamiento);

        doc.moveDown();

        // --- FECHAS ---
        doc.fontSize(12).font('Helvetica-Bold').text('FECHAS:');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Fecha de Recepción: ${manifiesto.fechaRecepcion ? new Date(manifiesto.fechaRecepcion).toLocaleDateString('es-AR') : 'N/A'}`);
        doc.text(`Fecha de Tratamiento: ${manifiesto.fechaCierre ? new Date(manifiesto.fechaCierre).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}`);

        doc.moveDown(2);

        // --- DECLARACIÓN ---
        doc.fontSize(10).font('Helvetica');
        doc.text('Se deja constancia que los residuos mencionados han sido tratados y/o dispuestos de acuerdo con la normativa ambiental vigente, cumpliendo con los requisitos establecidos por la Ley 24.051 y el Decreto 831/93.', { align: 'justify' });

        doc.moveDown(3);

        // --- FIRMA ---
        doc.fontSize(10).text('_______________________________', { align: 'center' });
        doc.text('Firma y Sello del Operador', { align: 'center' });
        doc.text(manifiesto.operador.razonSocial, { align: 'center' });

        doc.moveDown(2);

        // --- PIE ---
        doc.fontSize(8).font('Helvetica')
            .text(`Manifiesto de origen: ${manifiesto.numero}`, { align: 'center' });
        doc.text(`Certificado generado el: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });
        doc.text('Este documento ha sido generado electrónicamente por el Sistema de Trazabilidad de RRPP.', { align: 'center' });

        doc.end();

    } catch (error) {
        next(error);
    }
};
