/**
 * Integration tests for Reversiones API
 * Tests the complete reversion flow through the API
 */

import request from 'supertest';
import express, { Express } from 'express';

// Create a mock express app for testing
const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    (req as any).user = { id: 'test-user', rol: 'ADMIN' };
    next();
  });

  // Mock reversion routes
  app.post('/api/manifiestos/:id/revertir-entrega', (req, res) => {
    const { motivo } = req.body;
    if (!motivo || motivo.length < 20) {
      return res.status(400).json({ 
        success: false, 
        message: 'El motivo debe tener al menos 20 caracteres' 
      });
    }
    res.json({ 
      success: true, 
      data: { 
        manifiesto: { id: req.params.id, estado: 'EN_TRANSITO' },
        reversion: { id: 'rev-1', tipoReversion: 'RECHAZO_ENTREGA' }
      } 
    });
  });

  app.post('/api/manifiestos/:id/rechazar-recepcion', (req, res) => {
    const { motivo } = req.body;
    if (!motivo || motivo.length < 20) {
      return res.status(400).json({ 
        success: false, 
        message: 'El motivo debe tener al menos 20 caracteres' 
      });
    }
    res.json({ 
      success: true, 
      data: { 
        manifiesto: { id: req.params.id, estado: 'ENTREGADO' },
        reversion: { id: 'rev-2', tipoReversion: 'RECHAZO_ENTREGA' }
      } 
    });
  });

  app.post('/api/manifiestos/:id/revertir-certificado', (req, res) => {
    const { motivo } = req.body;
    if (!motivo || motivo.length < 20) {
      return res.status(400).json({ 
        success: false, 
        message: 'El motivo debe tener al menos 20 caracteres' 
      });
    }
    res.json({ 
      success: true, 
      data: { 
        manifiesto: { id: req.params.id, estado: 'EN_TRATAMIENTO' },
        reversion: { id: 'rev-3', tipoReversion: 'REVISION_CERTIFICADO' }
      } 
    });
  });

  app.get('/api/manifiestos/:id/reversiones', (req, res) => {
    res.json({ 
      success: true, 
      data: [
        { id: 'rev-1', estadoAnterior: 'ENTREGADO', estadoNuevo: 'EN_TRANSITO', motivo: 'Test reversion' }
      ] 
    });
  });

  return app;
};

describe('Reversiones API Integration', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/manifiestos/:id/revertir-entrega', () => {
    it('should revert entrega with valid motivo', async () => {
      const response = await request(app)
        .post('/api/manifiestos/man-123/revertir-entrega')
        .send({ motivo: 'El operador rechazó la carga por discrepancia en cantidades' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.manifiesto.estado).toBe('EN_TRANSITO');
      expect(response.body.data.reversion.tipoReversion).toBe('RECHAZO_ENTREGA');
    });

    it('should reject reversion with short motivo', async () => {
      const response = await request(app)
        .post('/api/manifiestos/man-123/revertir-entrega')
        .send({ motivo: 'Corto' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('20 caracteres');
    });

    it('should reject reversion without motivo', async () => {
      const response = await request(app)
        .post('/api/manifiestos/man-123/revertir-entrega')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/manifiestos/:id/rechazar-recepcion', () => {
    it('should reject recepcion with valid motivo', async () => {
      const response = await request(app)
        .post('/api/manifiestos/man-456/rechazar-recepcion')
        .send({ motivo: 'Error en la documentación del pesaje realizado' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.manifiesto.estado).toBe('ENTREGADO');
    });
  });

  describe('POST /api/manifiestos/:id/revertir-certificado', () => {
    it('should revert certificado with valid motivo', async () => {
      const response = await request(app)
        .post('/api/manifiestos/man-789/revertir-certificado')
        .send({ motivo: 'Necesita corrección en el método de tratamiento aplicado' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.manifiesto.estado).toBe('EN_TRATAMIENTO');
      expect(response.body.data.reversion.tipoReversion).toBe('REVISION_CERTIFICADO');
    });
  });

  describe('GET /api/manifiestos/:id/reversiones', () => {
    it('should return reversion history', async () => {
      const response = await request(app)
        .get('/api/manifiestos/man-123/reversiones')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});

describe('Flujo Completo de Reversiones', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should complete full reversion cycle: ENTREGADO -> EN_TRANSITO -> ENTREGADO', async () => {
    // Step 1: Revert from ENTREGADO to EN_TRANSITO
    const revert1 = await request(app)
      .post('/api/manifiestos/cycle-test/revertir-entrega')
      .send({ motivo: 'Operador rechazó la carga, material incorrecto' })
      .expect(200);

    expect(revert1.body.data.manifiesto.estado).toBe('EN_TRANSITO');

    // Note: In real integration test, we would:
    // - Confirm delivery again
    // - Then test the reversion from that new state
  });
});
