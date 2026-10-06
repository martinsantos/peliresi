import { describe, expect, it } from 'vitest';
import { supportCreateInput, supportMutationInput, supportContext, supportFingerprint, supportCanManage } from '../../services/supportPolicy.service';

describe('native support contract', () => {
  it('requires a useful subject and description, and rejects forged identity', () => {
    expect(supportCreateInput.safeParse({ asunto: 'GPS no responde', descripcion: 'No muestra mi posición después de habilitar el permiso.', categoria: 'GPS' }).success).toBe(true);
    expect(supportCreateInput.safeParse({ asunto: 'a', descripcion: '' }).success).toBe(false);
    expect(supportCreateInput.safeParse({ asunto: 'GPS no responde', descripcion: 'No muestra mi posición.', usuarioId: 'another-user' }).success).toBe(false);
  });
  it('requires a version and a reason when handing off or closing', () => {
    expect(supportMutationInput.safeParse({ accion: 'DERIVAR', version: 1, responsableId: 'agent', cuerpo: 'Revisar los permisos del dispositivo.' }).success).toBe(true);
    expect(supportMutationInput.safeParse({ accion: 'DERIVAR', version: 1, responsableId: 'agent', cuerpo: '' }).success).toBe(false);
    expect(supportMutationInput.safeParse({ accion: 'CERRAR', version: 1, cuerpo: 'Resuelto con autorización del usuario.' }).success).toBe(true);
    expect(supportMutationInput.safeParse({ accion: 'CERRAR', version: 0, cuerpo: '' }).success).toBe(false);
    expect(supportMutationInput.safeParse({ accion: 'RESPONDER', version: 1, cuerpo: 'Respuesta', interno: true, usuarioId: 'admin' }).success).toBe(false);
  });
  it('keeps only local path and bounded diagnostics; no query, fragment or secrets', () => {
    expect(supportContext({ ruta: '/app/inspecciones/case?token=secret#evidencia', ancho: 360, alto: 740, online: false, token: 'secret', rol: 'ADMIN' }))
      .toEqual({ ruta: '/app/inspecciones/case', ancho: 360, alto: 740, online: false });
    expect(supportContext({ ruta: '//evil.test/path' }).ruta).toBeNull();
    expect(supportContext({ ruta: '/reset-password?token=secret' }).ruta).toBeNull();
    expect(supportContext({ ruta: 'https://evil.test/', ancho: -1, alto: Infinity })).toEqual({ ruta: null });
  });
  it('hashes exactly the payload, including attachments and privacy', () => {
    const body = { cuerpo: 'No permite leer QR', interno: false };
    expect(supportFingerprint(body, [{ nombre: 'foto.png', sha256: 'a' }])).toBe(supportFingerprint(body, [{ nombre: 'foto.png', sha256: 'a' }]));
    expect(supportFingerprint(body, [])).not.toBe(supportFingerprint({ ...body, interno: true }, []));
    expect(supportFingerprint(body, [{ nombre: 'foto.png', sha256: 'a' }])).not.toBe(supportFingerprint(body, [{ nombre: 'foto.png', sha256: 'b' }]));
  });
  it('does not confuse support access with legal administration or inspection roles', () => {
    expect(supportCanManage({ rol: 'ADMIN', activo: true, restricted: false }, false)).toBe(true);
    expect(supportCanManage({ rol: 'OPERADOR', activo: true }, true)).toBe(true);
    expect(supportCanManage({ rol: 'ADMIN_GENERADOR', esInspector: true, activo: true }, false)).toBe(false);
    expect(supportCanManage({ rol: 'ADMIN', activo: true, restricted: true }, true)).toBe(false);
    expect(supportCanManage({ rol: 'OPERADOR', activo: false }, true)).toBe(false);
  });
});
