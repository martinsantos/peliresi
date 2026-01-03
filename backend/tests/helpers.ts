import { Request, Response, NextFunction } from 'express';

// Tipo extendido para incluir user (como AuthRequest del middleware)
interface MockRequest extends Partial<Request> {
  user?: { id: string; rol: string; [key: string]: any };
}

// Mocks básicos
export const mockRequest = (options: MockRequest = {}): MockRequest => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: { id: 'test-user-id', rol: 'ADMIN' },
  ...options
});

export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

export const mockNext: NextFunction = jest.fn();

// Helper para tests de auth
export const createAuthToken = (userId: string, rol: string) => {
  // Este token es solo para tests - en producción usar JWT real
  return `mock-token-${userId}-${rol}`;
};

// Datos de prueba
export const mockUsuario = {
  id: 'test-user-id',
  email: 'test@example.com',
  nombre: 'Test',
  apellido: 'User',
  rol: 'ADMIN' as const,
  activo: true
};

export const mockGenerador = {
  id: 'gen-1',
  usuarioId: 'gen-user-1',
  razonSocial: 'Generador Test SA',
  cuit: '30-12345678-9',
  domicilio: 'Calle Test 123',
  telefono: '261-1234567',
  email: 'generador@test.com',
  numeroInscripcion: 'GEN-001',
  categoria: 'Grande',
  activo: true
};

export const mockTransportista = {
  id: 'trans-1',
  usuarioId: 'trans-user-1',
  razonSocial: 'Transporte Test SRL',
  cuit: '30-98765432-1',
  domicilio: 'Ruta 40 Km 5',
  telefono: '261-9876543',
  email: 'transporte@test.com',
  numeroHabilitacion: 'TRA-001',
  activo: true
};

export const mockOperador = {
  id: 'op-1',
  usuarioId: 'op-user-1',
  razonSocial: 'Operador Test SA',
  cuit: '30-55555555-5',
  domicilio: 'Zona Industrial',
  telefono: '261-5555555',
  email: 'operador@test.com',
  numeroHabilitacion: 'OPE-001',
  categoria: 'Grande',
  activo: true
};

export const mockManifiesto = {
  id: 'man-1',
  numero: '2026-000001',
  generadorId: 'gen-1',
  transportistaId: 'trans-1',
  operadorId: 'op-1',
  estado: 'BORRADOR',
  fechaCreacion: new Date(),
  creadoPorId: 'test-user-id'
};

export const mockTipoResiduo = {
  id: 'tipo-1',
  codigo: 'Y1',
  nombre: 'Desechos clínicos',
  descripcion: 'Desechos resultantes de la atención médica',
  categoria: 'Corrientes de desechos',
  caracteristicas: 'Infeccioso',
  peligrosidad: 'Alta',
  activo: true
};
