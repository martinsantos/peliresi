import { describe, expect, it } from 'vitest';
import { getInspectionDossierReadiness } from '../../pages/inspecciones/inspectionDossierReadiness';
import type { InspectionActData, InspectionTechnicalReport } from '../../types/inspection';

const act: InspectionActData = {
  area: 'Fiscalización Ambiental',
  motivoInspeccion: 'Control programado',
  lugarAfectacion: 'Depósito transitorio',
  danosEstado: 'NO_OBSERVADOS',
  tercerosTestigosEstado: 'NO_IDENTIFICADOS',
  libroOperacionesEstado: 'EXHIBIDO',
  libroOperacionesDetalle: 'Libro RP-2026 verificado, fojas 1 a 48.',
  firmaIntervinienteEstado: 'FIRMADA',
  copiaActaEstado: 'ENTREGADA',
  copiaActaDetalle: 'Copia entregada a la persona responsable a las 13:00.',
  domicilioLegal: 'Calle Demo 100, Mendoza',
  notificacionEstado: 'COMUNICADA_EN_ACTA',
  notificacionDetalle: 'Se informó lo actuado, el plazo y el derecho a ofrecer prueba.',
};

const report: InspectionTechnicalReport = {
  expedienteElectronico: 'EX-2026-000001',
  objetivo: 'Verificar condiciones declaradas.',
  antecedentes: 'Antecedentes documentados.',
  evaluacion: 'Evaluación técnica fundada.',
  conclusion: 'Conclusión técnica fundada.',
  recomendacion: 'Remitir para revisión.',
};

const inspection = {
  cerradaCampoAt: '2026-09-22T13:00:00.000Z',
};

const baseDraft = {
  numeroActa: 'ACTA-2026-001',
  plazoRespuestaAt: '2026-10-01T12:00',
  observaciones: 'Constatación documentada en campo.',
  datosActa: act,
  informeTecnico: report,
  items: [{
    id: 'item-1', codigo: 'DOC-01', categoria: 'Documentación', etiqueta: 'Documentación vigente',
    orden: 1, obligatorio: true, resultado: 'CUMPLE' as const, evidencias: [],
  }],
  comparaciones: [{
    id: 'comparison-1', codigo: 'DOM-01', categoria: 'Registro', etiqueta: 'Domicilio', origen: 'Padrón',
    resultado: 'COINCIDE' as const, orden: 1, evidencias: [],
  }],
};

describe('inspection dossier readiness', () => {
  it('uses the same six article 44 documentary controls as the server guard', () => {
    expect(getInspectionDossierReadiness(inspection, baseDraft)).toMatchObject({
      ready: true,
      total: 21,
      missing: [],
    });
  });

  it('does not treat pending values or undocumented exceptions as complete', () => {
    const incompleteAct: InspectionActData = {
      ...act,
      danosEstado: 'OBSERVADOS',
      danosDetalle: '',
      libroOperacionesEstado: 'NO_VERIFICADO',
      firmaIntervinienteEstado: 'NEGATIVA',
      firmaIntervinienteDetalle: '',
      copiaActaEstado: 'NO_ENTREGADA',
      copiaActaDetalle: '',
      domicilioLegal: '',
    };
    const readiness = getInspectionDossierReadiness(inspection, {
      ...baseDraft,
      datosActa: incompleteAct,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(expect.arrayContaining([
      'Daños a personas o bienes',
      'Libro de Registro de Operaciones',
      'Firma o constancia de negativa/imposibilidad',
      'Entrega de copia del acta',
      'Notificación y domicilio legal',
    ]));
  });
});
