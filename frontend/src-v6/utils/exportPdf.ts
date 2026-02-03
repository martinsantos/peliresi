/**
 * SITREP v6 - PDF Export Utility
 * ===============================
 * Genera reportes PDF profesionales con jsPDF + autoTable
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export function exportReportePDF(config: ExportConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Header bar ──
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SITREP', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Trazabilidad de Residuos Peligrosos', 14, 18);
  doc.text('Provincia de Mendoza', 14, 23);

  // Date on right side
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }), pageWidth - 14, 12, { align: 'right' });
  doc.text(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), pageWidth - 14, 18, { align: 'right' });

  y = 38;

  // ── Report Title ──
  doc.setTextColor(...DARK_COLOR);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(config.titulo, 14, y);
  y += 6;

  if (config.subtitulo) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_COLOR);
    doc.text(config.subtitulo, 14, y);
    y += 5;
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
      margin: { left: 14, right: 14 },
    });
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();

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
