import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { inspectionFieldExtensions } from '../../domain/inspectionFieldModel';
import { inspectionSignatureHash, inspectionSignatureSnapshot, inspectionCurrentSignatures, signatureFieldErrors } from '../../domain/inspectionSignature';
const fixture = () => ({ id: 'i', numero: 'QA-01', numeroActa: 'QA-01', inspectorId: 'u', inspector: { id: 'u', nombre: 'Inspector' }, ubicacion: 'Punto de prueba', observaciones: 'Constatación de prueba', datosActa: { modeloCampo: 2, actividadObservada: 'Almacenamiento', medidas: [] }, items: [], comparaciones: [], evidencias: [], eventos: [], informeTecnico: { evaluacion: 'Privado' } });
describe('acta de campo simplificada', () => {
  it('conserva borradores incompletos sin bloquear la escritura', () => {
    const schema = z.object(inspectionFieldExtensions);
    expect(schema.safeParse({ contactoActa: 'persona@', medidas: [{ id: '1', detalle: '', responsable: '', finalidad: 'DESCARGO', tipoDias: 'HABILES' }] }).success).toBe(true);
    expect(signatureFieldErrors({ ...fixture(), datosActa: { contactoActa: 'persona@', medidas: [{ id: '1', detalle: '', responsable: '', tipoDias: 'HABILES' }] } })).toHaveLength(3);
  });
  it('acepta coordenadas cero y rechaza puntos fuera de rango', () => {
    const schema = z.object(inspectionFieldExtensions), point = { latitud: 0, longitud: 0, origen: 'MANUAL', registradaAt: '2026-11-03T15:00:00Z' };
    expect(schema.safeParse({ ubicacionCampo: point }).success).toBe(true);
    expect(schema.safeParse({ ubicacionCampo: { ...point, latitud: 91 } }).success).toBe(false);
  });
  it('no inventa días hábiles ni inicio del plazo al firmar', () => {
    const errors = signatureFieldErrors({ ...fixture(), datosActa: { medidas: [{ detalle: 'Aportar documento', responsable: 'Empresa', dias: 5 }] } });
    expect(errors).toHaveLength(2);
  });
  it('la copia firmada excluye el análisis interno y conserva campos e imágenes', () => {
    const i = { ...fixture(), datosActa: { contactoActa: 'p@example.invalid', ubicacionCampo: { latitud: -32, longitud: -68, mapaImagen: 'data:image/png;base64,abc' } }, evidencias: [{ id: 'p1', tipo: 'FOTO', descripcion: 'Depósito observado', sha256: 'photo', storageKey: 'foto' }, { id: 'p2', tipo: 'FOTO', intercambioId: 'interno', descripcion: 'No publicar' }] };
    const snapshot = inspectionSignatureSnapshot(i);
    expect(snapshot.informeTecnico).toBeUndefined(); expect(snapshot.evidencias).toHaveLength(1); expect(snapshot.datosActa.ubicacionCampo.mapaImagen).toContain('base64');
    expect(inspectionSignatureHash(snapshot)).toBe(inspectionSignatureHash(i));
  });
  it('un cambio de campo o de descripción invalida la firma vigente, no su copia histórica', () => {
    const i = fixture(), hash = inspectionSignatureHash(i), snapshot = inspectionSignatureSnapshot(i);
    i.eventos.push({ tipo: 'ACTA_FIRMADA', metadata: { contenidoSha256: hash, firma: { nombre: 'Persona' } } } as never);
    expect(inspectionCurrentSignatures(i)).toHaveLength(1);
    i.observaciones = 'Otra constatación'; expect(inspectionCurrentSignatures(i)).toHaveLength(0); expect(inspectionSignatureHash(snapshot)).toBe(hash);
  });
  it('los eventos, versión y respuesta posterior no alteran el contenido firmado', () => {
    const i = fixture(); expect(inspectionSignatureHash({ ...i, version: 45, eventos: [{ titulo: 'Respuesta' }], informeTecnico: { evaluacion: 'Nueva revisión' } })).toBe(inspectionSignatureHash(i));
  });
});
