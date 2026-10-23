/**
 * SITREP v6 - PDF Export Utility
 * ===============================
 * Genera reportes PDF profesionales con jsPDF + autoTable
 */

// Dynamic imports — jsPDF (407KB) + autoTable only load when user actually exports
// Saves ~500KB from initial bundle load
let _jsPDF: typeof import('jspdf').default | null = null;
let _autoTable: typeof import('jspdf-autotable').default | null = null;

async function loadPdfLibs() {
  if (!_jsPDF) {
    const [jspdfMod, autoTableMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    _jsPDF = jspdfMod.default;
    _autoTable = autoTableMod.default;
  }
  return { jsPDF: _jsPDF, autoTable: _autoTable! };
}

interface KPI {
  label: string;
  value: string | number;
}

interface ExportConfig {
  titulo: string;
  subtitulo?: string;
  periodo: string;
  kpis: KPI[];
  tabla: {
    headers: string[];
    rows: (string | number)[][];
  };
}

const PRIMARY_COLOR: [number, number, number] = [13, 138, 79]; // #0D8A4F
const DARK_COLOR: [number, number, number] = [18, 26, 38]; // #121A26
const GRAY_COLOR: [number, number, number] = [107, 114, 128];
const LIGHT_BG: [number, number, number] = [249, 250, 251];

export async function exportReportePDF(config: ExportConfig) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  const mark = new Image();
  mark.src = import.meta.env.BASE_URL + 'sitrep-mark-green.svg';
  await mark.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 150; canvas.height = 150;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la marca del documento. Reintentá la descarga.');
  context.drawImage(mark, 0, 0, 150, 150);
  const brand = canvas.toDataURL('image/png');
  const mendoza = new Image();
  mendoza.src = import.meta.env.BASE_URL + 'logo-mendoza.webp';
  await mendoza.decode();
  canvas.width = 600; canvas.height = Math.round(600 * mendoza.naturalHeight / mendoza.naturalWidth);
  context.drawImage(mendoza, 0, 0, canvas.width, canvas.height);
  const institution = canvas.toDataURL('image/png');

  y = 38;

  // ── Report Title ──
  doc.setTextColor(...DARK_COLOR);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(config.titulo, pageWidth - 28);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 7;

  if (config.subtitulo) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_COLOR);
    const subtitleLines = doc.splitTextToSize(config.subtitulo, pageWidth - 28);
    doc.text(subtitleLines, 14, y);
    y += subtitleLines.length * 5;
  }

  doc.setFontSize(9);
  doc.setTextColor(...GRAY_COLOR);
  doc.text(`Periodo: ${config.periodo}`, 14, y);
  y += 10;

  // ── KPI Cards ──
  if (config.kpis.length > 0) {
    const cardWidth = (pageWidth - 28 - (config.kpis.length - 1) * 4) / config.kpis.length;

    config.kpis.forEach((kpi, i) => {
      const x = 14 + i * (cardWidth + 4);

      // Card background
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(x, y, cardWidth, 20, 2, 2, 'F');

      // Top accent line
      doc.setFillColor(...PRIMARY_COLOR);
      doc.rect(x, y, cardWidth, 1.5, 'F');

      // Value
      doc.setTextColor(...DARK_COLOR);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(kpi.value), x + cardWidth / 2, y + 10, { align: 'center' });

      // Label
      doc.setTextColor(...GRAY_COLOR);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, x + cardWidth / 2, y + 16, { align: 'center' });
    });

    y += 28;
  }

  // ── Data Table ──
  if (config.tabla.headers.length > 0 && config.tabla.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [config.tabla.headers],
      body: config.tabla.rows.map(row => row.map(cell => String(cell))),
      theme: 'grid',
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: DARK_COLOR,
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      styles: {
        lineColor: [229, 231, 235],
        lineWidth: 0.3,
      },
      margin: { left: 14, right: 14, top: 38, bottom: 22 },
    });
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.addImage(institution, 'PNG', 14, 8, 42, 42 * mendoza.naturalHeight / mendoza.naturalWidth);
    const brandX = pageWidth - 91;
    doc.addImage(brand, 'PNG', brandX, 9, 13.4, 13.4);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(27,94,60);
    doc.text('SITREP', brandX + 17, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(94,107,127);
    doc.text(['Trazabilidad de residuos', 'peligrosos'], brandX + 17, 20, { lineHeightFactor: 1.3 });
    doc.setDrawColor(27,94,60);doc.line(14,32,pageWidth-14,32);

    doc.setDrawColor(229, 231, 235);
    doc.line(14, pageH - 15, pageWidth - 14, pageH - 15);

    doc.setFontSize(7);
    doc.setTextColor(...GRAY_COLOR);
    doc.text('SITREP - Sistema de Trazabilidad RRPP | Generado automáticamente', 14, pageH - 10);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageH - 10, { align: 'right' });
  }

  // Download
  const filename = `${config.titulo.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
