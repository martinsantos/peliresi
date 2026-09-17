import { canAccessSolicitudDocument, canReviewSolicitudType } from '../../controllers/document-management.controller';

describe('document review authorization', () => {
  const user = (rol: string) => ({ rol });

  it('keeps sector administrators inside their own application type', () => {
    expect(canReviewSolicitudType(user('ADMIN_GENERADOR'), 'GENERADOR')).toBe(true);
    expect(canReviewSolicitudType(user('ADMIN_GENERADOR'), 'OPERADOR')).toBe(false);
    expect(canReviewSolicitudType(user('ADMIN_TRANSPORTISTA'), 'TRANSPORTISTA')).toBe(true);
    expect(canReviewSolicitudType(user('ADMIN_TRANSPORTISTA'), 'GENERADOR')).toBe(false);
    expect(canReviewSolicitudType(user('ADMIN_OPERADOR'), 'OPERADOR')).toBe(true);
  });

  it('allows only the root admin across sectors', () => {
    expect(canReviewSolicitudType(user('ADMIN'), 'GENERADOR')).toBe(true);
    expect(canReviewSolicitudType(user('ADMIN'), 'TRANSPORTISTA')).toBe(true);
    expect(canReviewSolicitudType(user('ADMIN'), 'OPERADOR')).toBe(true);
    expect(canReviewSolicitudType(user('AUDITOR'), 'OPERADOR')).toBe(false);
  });

  it('allows the candidate owner but keeps sector scope on document ids', () => {
    expect(canAccessSolicitudDocument({ ...user('GENERADOR'), id: 'candidate-1' }, 'candidate-1', 'OPERADOR')).toBe(true);
    expect(canAccessSolicitudDocument(user('ADMIN_GENERADOR'), 'candidate-1', 'GENERADOR')).toBe(true);
    expect(canAccessSolicitudDocument(user('ADMIN_GENERADOR'), 'candidate-1', 'OPERADOR')).toBe(false);
    expect(canAccessSolicitudDocument(user('AUDITOR'), 'candidate-1', 'GENERADOR')).toBe(false);
  });
});
