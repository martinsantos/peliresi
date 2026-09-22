/** Persistent evidence IDs, not filtered array positions, identify every reference. */
export function inspectionEvidenceReference(evidence: { id?: string; nombreOriginal?: string }): string {
  return `E-${evidence.id || 'SIN-ID'} · ${evidence.nombreOriginal || 'Archivo sin nombre'}`;
}

export type InspectionPdfTextBlock = {
  text: string;
  font?: string;
  size: number;
  color: string;
  gap?: number;
};

export function inspectionPdfLines(doc: PDFKit.PDFDocument, text: string, width: number): string[] {
  return String(text).replace(/\r/g, '').split('\n').flatMap((paragraph) => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      // Filenames and persistent IDs can contain long unbroken tokens.
      let token = '';
      const tokens: string[] = [];
      for (const character of word) {
        if (token && doc.widthOfString(token + character) > width) {
          tokens.push(token);
          token = '';
        }
        token += character;
      }
      if (token) tokens.push(token);
      for (const part of tokens) {
        const candidate = line ? `${line} ${part}` : part;
        if (line && doc.widthOfString(candidate) > width) {
          lines.push(line);
          line = part;
        } else line = candidate;
      }
    }
    lines.push(line);
    return lines;
  });
}

export function measureInspectionPdfBlocks(doc: PDFKit.PDFDocument, blocks: InspectionPdfTextBlock[], width: number): number {
  return blocks.reduce((height, block) => {
    doc.font(block.font || 'Helvetica').fontSize(block.size);
    return height + inspectionPdfLines(doc, block.text, width).length * (doc.currentLineHeight(true) + 1.5) + (block.gap ?? 6);
  }, 0);
}

/** Flow full captions/metadata, repeating their evidence identity on overflow pages. */
export function drawInspectionPdfBlocks(
  doc: PDFKit.PDFDocument,
  blocks: InspectionPdfTextBlock[],
  options: { x: number; width: number; bottom: number; newPage: () => void; continuation: string },
): void {
  for (const block of blocks) {
    doc.font(block.font || 'Helvetica').fontSize(block.size);
    const lineHeight = doc.currentLineHeight(true) + 1.5;
    const nextPage = () => {
      options.newPage();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(block.color)
        .text(options.continuation, options.x, doc.y, { width: options.width });
      doc.y += 8;
      doc.font(block.font || 'Helvetica').fontSize(block.size).fillColor(block.color);
    };
    for (const paragraph of block.text.replace(/\r/g, '').split('\n')) {
      doc.font(block.font || 'Helvetica').fontSize(block.size);
      const lines = inspectionPdfLines(doc, paragraph, options.width);
      if (!paragraph.trim()) {
        if (doc.y + lineHeight <= options.bottom) doc.y += lineHeight;
        continue;
      }
      // Keep short paragraphs together; for longer ones preserve at least two
      // lines at either side of the break instead of a stranded final line.
      const initialLines = lines.length <= 8 ? lines.length : 2;
      if (doc.y + initialLines * lineHeight > options.bottom) nextPage();
      lines.forEach((line, index) => {
        const remaining = lines.length - index;
        if (doc.y + (remaining === 2 ? 2 : 1) * lineHeight > options.bottom) nextPage();
        doc.font(block.font || 'Helvetica').fontSize(block.size).fillColor(block.color);
        const y = doc.y;
        if (line) doc.text(line, options.x, y, { width: options.width, lineBreak: false });
        doc.y = y + lineHeight;
      });
    }
    doc.y += block.gap ?? 6;
  }
}
