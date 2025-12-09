#!/usr/bin/env node
/**
 * Script para generar PDF del Manual Tutorial
 * Sistema de Trazabilidad de Residuos Peligrosos - DGFA Mendoza
 * 
 * Uso: node generate-pdf.js
 * 
 * Requisitos:
 *   npm install md-to-pdf
 */

const { mdToPdf } = require('md-to-pdf');
const path = require('path');
const fs = require('fs');

// Configuración
const CONFIG = {
    inputFile: path.join(__dirname, 'MANUAL_TUTORIAL.md'),
    outputFile: path.join(__dirname, 'MANUAL_TUTORIAL_DGFA.pdf'),
    stylesheetFile: path.join(__dirname, 'pdf-styles.css'),

    // Configuración del PDF
    pdf_options: {
        format: 'A4',
        margin: {
            top: '22mm',
            right: '18mm',
            bottom: '22mm',
            left: '18mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
            <div style="width: 100%; font-size: 8px; padding: 8px 35px 0; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; font-family: system-ui, -apple-system, sans-serif;">
                <span style="font-weight: 500; text-transform: uppercase; font-size: 7px; letter-spacing: 1.5px; color: #64748b;">Sistema de Trazabilidad RRPP</span>
                <span style="display: flex; align-items: center; gap: 8px; font-size: 8px;">
                    <span style="font-weight: 700; letter-spacing: -0.3px;"><span style="color: #dc2626;">ú</span><span style="color: #1e3a8a;">ltimamilla</span></span>
                    <span style="color: #e2e8f0;">•</span>
                    <span style="color: #64748b; font-weight: 400; font-size: 7px;">DGFA Mendoza</span>
                </span>
            </div>
        `,
        footerTemplate: `
            <div style="width: 100%; font-size: 8px; padding: 0 35px 8px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; font-family: 'Inter', 'Helvetica Neue', sans-serif;">
                <span style="font-weight: 400; font-size: 7px; letter-spacing: 0.2px;">Diciembre 2025</span>
                <span style="font-weight: 500; font-size: 8px;"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
            </div>
        `
    }
};

// Función principal
async function generatePDF() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║  📘 GENERADOR DE PDF - Manual Tutorial DGFA                        ║');
    console.log('║  Sistema de Trazabilidad de Residuos Peligrosos                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Verificar que existe el archivo de entrada
    if (!fs.existsSync(CONFIG.inputFile)) {
        console.error('❌ Error: No se encontró el archivo MANUAL_TUTORIAL.md');
        console.error(`   Ruta esperada: ${CONFIG.inputFile}`);
        process.exit(1);
    }

    // Verificar que existe el archivo CSS
    if (!fs.existsSync(CONFIG.stylesheetFile)) {
        console.error('❌ Error: No se encontró el archivo pdf-styles.css');
        console.error(`   Ruta esperada: ${CONFIG.stylesheetFile}`);
        process.exit(1);
    }

    console.log(`📄 Archivo de entrada: ${path.basename(CONFIG.inputFile)}`);
    console.log(`🎨 Estilos CSS: ${path.basename(CONFIG.stylesheetFile)}`);
    console.log(`📁 Directorio: ${path.dirname(CONFIG.inputFile)}`);
    console.log('');

    // Leer contenido del Markdown
    let content = fs.readFileSync(CONFIG.inputFile, 'utf-8');

    // Contar imágenes referenciadas
    const imageMatches = content.match(/!\[.*?\]\(.*?\)/g) || [];
    console.log(`🖼️  Imágenes encontradas: ${imageMatches.length}`);

    // Verificar que las imágenes existen
    let imagensFaltantes = [];
    let imagenesOk = 0;
    imageMatches.forEach(match => {
        const imgPath = match.match(/\((.*?)\)/)?.[1];
        if (imgPath) {
            const fullPath = path.join(__dirname, imgPath);
            if (!fs.existsSync(fullPath)) {
                imagensFaltantes.push(imgPath);
            } else {
                imagenesOk++;
            }
        }
    });

    console.log(`✅ Imágenes verificadas: ${imagenesOk}`);

    if (imagensFaltantes.length > 0) {
        console.log('');
        console.log('⚠️  Advertencia: Algunas imágenes no se encontraron:');
        imagensFaltantes.slice(0, 5).forEach(img => console.log(`   - ${img}`));
        if (imagensFaltantes.length > 5) {
            console.log(`   ... y ${imagensFaltantes.length - 5} más`);
        }
    }

    console.log('');
    console.log('🔄 Generando PDF con diseño profesional...');
    console.log('   (esto puede tomar unos segundos)');
    console.log('');

    const startTime = Date.now();

    try {
        // Generar el PDF
        const pdf = await mdToPdf(
            { path: CONFIG.inputFile },
            {
                dest: CONFIG.outputFile,
                stylesheet: CONFIG.stylesheetFile,
                pdf_options: CONFIG.pdf_options,
                basedir: __dirname,
                launch_options: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            }
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (pdf) {
            // Obtener tamaño del archivo generado
            const stats = fs.statSync(CONFIG.outputFile);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            console.log('╔════════════════════════════════════════════════════════════════════╗');
            console.log('║  ✅ PDF GENERADO EXITOSAMENTE                                      ║');
            console.log('╚════════════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log(`📄 Archivo:    ${path.basename(CONFIG.outputFile)}`);
            console.log(`📁 Ubicación:  ${CONFIG.outputFile}`);
            console.log(`📊 Tamaño:     ${fileSizeMB} MB`);
            console.log(`⏱️  Tiempo:     ${elapsed} segundos`);
            console.log('');
            console.log('🎉 ¡Listo para presentar en la licitación!');
            console.log('');
        }

    } catch (error) {
        console.error('');
        console.error('❌ Error al generar el PDF:');
        console.error(error.message);
        console.error('');

        if (error.message.includes('md-to-pdf')) {
            console.log('💡 Instala las dependencias con:');
            console.log('   npm install md-to-pdf');
        }

        process.exit(1);
    }
}

// Ejecutar
generatePDF().catch(console.error);
