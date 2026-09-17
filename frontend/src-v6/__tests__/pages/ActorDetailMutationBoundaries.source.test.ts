import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('actor detail mutation boundaries', () => {
  const operador = readSource('src-v6/pages/actores/OperadorDetallePage.tsx');
  const transportista = readSource('src-v6/pages/actores/TransportistaDetallePage.tsx');
  const generador = readSource('src-v6/pages/admin/GeneradorDetallePage.tsx');
  const actores = readSource('src-v6/pages/actores/ActoresPage.tsx');
  const operadores = readSource('src-v6/pages/actores/OperadoresPage.tsx');
  const transportistas = readSource('src-v6/pages/actores/TransportistasPage.tsx');
  const alta = readSource('src-v6/pages/public/inscripcion/steps/StepDocumentos.tsx');
  const revision = readSource('src-v6/pages/admin/SolicitudDetallePage.tsx');

  it('keeps the generic regulatory dossier out of operational actor details', () => {
    expect(operador).not.toContain('ActorDocumentPanel');
    expect(transportista).not.toContain('ActorDocumentPanel');
    expect(generador).not.toContain('ActorDocumentPanel');
    expect(transportista).not.toContain('id="documentos"');
  });

  it('keeps treatments focused on operator treatment information', () => {
    expect(operador).toContain('Tecnologías y Tratamientos Autorizados');
    expect(operador).not.toContain('Expediente documental y certificados');
  });

  it('does not mix onboarding calculations or duplicate upload systems into generator detail', () => {
    expect(generador).not.toContain('CalculadoraTEF');
    expect(generador).not.toContain('DocumentUpload');
    expect(generador).toContain('Registro de pagos TEF');
    expect(generador).toContain('Declaraciones Juradas');
  });

  it('explains the annual TEF authorization history without conflating it with actor status', () => {
    expect(generador).toContain('Habilitaciones TEF por año');
    expect(generador).toContain('Pago registrado; habilitación pendiente');
    expect(generador).toContain('Sin pago registrado');
    expect(generador).toContain('no se deduce automáticamente del importe ni de la fecha de pago');
    expect(generador).toContain('El estado general Activo/Inactivo del generador se administra por separado');
    expect(generador).toContain("timeZone: 'UTC'");
  });

  it('retains the canonical intake and administrative review surfaces', () => {
    expect(alta).toContain('Adjuntá los documentos requeridos');
    expect(revision).toContain('handleDocReview');
    expect(revision).toContain('useRevisarDocumento');
  });

  it('routes every new actor action to a complete canonical wizard', () => {
    expect(actores).toContain("navigate(mp(`/admin/actores/${tipo}/nuevo`))");
    expect(operadores).toContain("navigate('/admin/actores/operadores/nuevo')");
    expect(transportistas).toContain("navigate('/admin/actores/transportistas/nuevo')");
    expect(actores).not.toContain('useCreateGenerador');
    expect(operadores).not.toContain('useCreateOperador');
    expect(transportistas).not.toContain('useCreateTransportista');
  });

  it('does not ship a shared fallback password in actor administration pages', () => {
    expect(`${actores}\n${operadores}\n${transportistas}`).not.toContain('TempPass123!');
  });
});
