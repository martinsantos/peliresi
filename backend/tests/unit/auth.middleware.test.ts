import { mockRequest, mockResponse, mockNext, mockUsuario } from '../helpers';
import { isAuthenticated, hasRole, hasPermission, hasAnyPermission } from '../../src/middlewares/auth.middleware';
import jwt from 'jsonwebtoken';

// Mock de jwt
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock de PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    usuario: {
      findUnique: jest.fn()
    }
  }))
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAuthenticated', () => {
    it('should return 401 if no token provided', async () => {
      const req = mockRequest({ headers: {} });
      const res = mockResponse();
      
      await isAuthenticated(req as any, res as any, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Token no proporcionado');
    });

    it('should return 401 if token is invalid', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });
      
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      });
      const res = mockResponse();
      
      await isAuthenticated(req as any, res as any, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('hasRole', () => {
    it('should call next if user has required role', () => {
      const req = mockRequest({
        user: { ...mockUsuario, rol: 'ADMIN' }
      });
      const res = mockResponse();
      
      const middleware = hasRole('ADMIN');
      middleware(req as any, res as any, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 403 if user does not have required role', () => {
      const req = mockRequest({
        user: { ...mockUsuario, rol: 'GENERADOR' }
      });
      const res = mockResponse();
      
      const middleware = hasRole('ADMIN');
      middleware(req as any, res as any, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });

  describe('hasPermission', () => {
    it('should allow ADMIN to access any permission', () => {
      const req = mockRequest({
        user: { ...mockUsuario, rol: 'ADMIN' }
      });
      const res = mockResponse();
      
      const middleware = hasPermission('manifiestos:write');
      middleware(req as any, res as any, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny GENERADOR access to auditoria:read', () => {
      const req = mockRequest({
        user: { ...mockUsuario, rol: 'GENERADOR' }
      });
      const res = mockResponse();
      
      const middleware = hasPermission('auditoria:read');
      middleware(req as any, res as any, mockNext);
      
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });

  describe('hasAnyPermission', () => {
    it('should allow if user has at least one permission', () => {
      const req = mockRequest({
        user: { ...mockUsuario, rol: 'GENERADOR' }
      });
      const res = mockResponse();
      
      const middleware = hasAnyPermission('manifiestos:read', 'auditoria:read');
      middleware(req as any, res as any, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
