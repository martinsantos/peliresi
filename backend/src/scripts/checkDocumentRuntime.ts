/** Native OCR smoke: artificial documents only; no database, accounts or messages. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { readReceipt } from '../services/documentAnalysis.service';
import { electricityReading } from '../domain/electricityReading';

const lines = ['EDEMSA', 'FACTURA ARTIFICIAL QA - SIN VALIDEZ', 'Tarifa: T2', 'Consumo: 1250 kWh', 'Potencia contratada: 25 kW', 'Suministro: 12345678', 'Periodo: 10/2026'];
export async function createOcrPracticeDocuments(directory: string): Promise<string[]> {
  const image = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/>${lines.map((text, i) => `<text x="60" y="${90 + i * 90}" font-family="DejaVu Sans" font-size="36" fill="black">${text}</text>`).join('')}</svg>`);
  const png = path.join(directory, 'electricidad-qa.png'); await sharp(image).png().toFile(png);
  const jpg = path.join(directory, 'electricidad-qa.jpg'); await sharp(png).jpeg({ quality: 95 }).toFile(jpg);
  const files = [png, jpg];
  for (const scanned of [false, true]) {
    const pdf = new PDFDocument({ size: 'A4', margin: 30 }); const chunks: Buffer[] = [];
    const completed = new Promise<Buffer>((resolve, reject) => { pdf.on('data', chunk => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject); });
    if (scanned) pdf.image(png, 30, 30, { width: 535 });
    else { pdf.font('Helvetica').fontSize(18); for (const line of lines) pdf.text(line).moveDown(); }
    pdf.end(); const file = path.join(directory, scanned ? 'electricidad-escaneada-qa.pdf' : 'electricidad-texto-qa.pdf');
    await writeFile(file, await completed); files.push(file);
  }
  return files;
}
export async function checkDocumentRuntime(): Promise<{ directory: string; cases: string[] }> {
  const env = { PATH: process.env.PATH, LANG: process.env.LANG, OMP_THREAD_LIMIT: '1' };
  for (const [command, args] of [['flock', ['--version']], ['pdftotext', ['-v']], ['pdftoppm', ['-v']], ['tesseract', ['--version']]] as const) execFileSync(command, [...args], { env, timeout: 5000, stdio: 'pipe' });
  const languages = execFileSync('tesseract', ['--list-langs'], { env, timeout: 5000, encoding: 'utf8' });
  assert.match(languages, /^spa\s*$/m, 'Spanish OCR model is required');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sitrep-ocr-smoke-'));
  const results: string[] = [];
  for (const file of await createOcrPracticeDocuments(directory)) {
    const before = createHash('sha256').update(await readFile(file)).digest('hex');
    const mimeType = file.endsWith('.pdf') ? 'application/pdf' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const result = await readReceipt({ path: file, mimeType }, 'FACTURA_ELECTRICA');
    assert.equal(result.lectura, 'LEIDO', `${path.basename(file)}: ${result.aviso}`);
    const reading = electricityReading(result.texto);
    assert.equal(reading.distribuidora, 'EDEMSA');
    assert.equal(reading.campos.categoriaTarifaria, 'T2');
    assert.equal(reading.campos.consumoKwh, '1250');
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), before, 'Original changed');
    results.push(`${path.basename(file)}: ${result.motor} PASS`);
  }
  return { directory, cases: results };
}
if (require.main === module) checkDocumentRuntime().then(result => console.log(JSON.stringify({ nativeOcr: 'PASS', ...result, databaseAccess: false, messagesSent: false }))).catch(error => { console.error('Native OCR check failed:', error.message); process.exitCode = 1; });
