# 🔵 Track D: Testing & QA

## Contexto
Sistema de Trazabilidad de Residuos Peligrosos (SITREP) para DGFA Mendoza.
- **Demo**: https://www.ultimamilla.com.ar/demoambiente/
- **61 Casos de Uso** definidos en especificación
- **Objetivo**: 100% cobertura de casos de uso críticos

---

## Tareas a Ejecutar

### D1: Tests Unitarios Backend (Jest)
Configurar `backend/jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70 }
  }
};
```

Crear `backend/tests/unit/manifiestos.test.ts`:
```typescript
import { crearManifiesto, firmarManifiesto, cambiarEstado } from '../../src/services/manifiestoService';

describe('ManifiestoService', () => {
  describe('crearManifiesto', () => {
    it('should generate unique numero YYYY-NNNNNN', async () => {
      // CU-S01
    });
    
    it('should validate required fields', async () => {
      // CU-S02
    });
    
    it('should create with estado BORRADOR', async () => {
      // CU-G03
    });
  });
  
  describe('firmarManifiesto', () => {
    it('should generate QR code on sign', async () => {
      // CU-S06
    });
    
    it('should change estado to FIRMADO', async () => {
      // CU-G07
    });
    
    it('should record in audit log', async () => {
      // CU-S04
    });
  });
});
```

### D2: Tests E2E Frontend (Playwright)
Instalar:
```bash
cd frontend
npm install -D @playwright/test
npx playwright install
```

Crear `frontend/playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  baseURL: 'https://www.ultimamilla.com.ar/demoambiente',
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
```

Crear `frontend/tests/e2e/flujo-completo.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Flujo Completo de Manifiesto', () => {
  test('CU-G03: Crear manifiesto como Generador', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="btn-nuevo-manifiesto"]');
    await page.fill('[name="tipoResiduo"]', 'Y1');
    await page.fill('[name="cantidad"]', '100');
    await page.click('[data-testid="btn-guardar"]');
    await expect(page.locator('.toast-success')).toBeVisible();
  });
  
  test('CU-G07: Firmar manifiesto', async ({ page }) => {
    // Navegar a manifiesto borrador
    // Click en Firmar
    // Verificar generación de QR
  });
  
  test('CU-T03: Transportista confirma retiro', async ({ page }) => {
    // Cambiar rol a Transportista
    // Seleccionar manifiesto asignado
    // Confirmar retiro con GPS mock
  });
  
  test('CU-O09: Operador cierra manifiesto', async ({ page }) => {
    // Cambiar rol a Operador
    // Seleccionar manifiesto entregado
    // Registrar recepción y tratamiento
    // Cerrar manifiesto
    // Verificar certificado generado
  });
});
```

### D3: Tests de Integración API
Crear `backend/tests/integration/api.test.ts`:
```typescript
import request from 'supertest';
import app from '../../src/app';

describe('API Integration Tests', () => {
  let authToken: string;
  let manifiestoId: string;
  
  beforeAll(async () => {
    // Login as admin
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'test123' });
    authToken = res.body.token;
  });
  
  describe('Manifiestos', () => {
    test('GET /api/manifiestos returns list', async () => {
      const res = await request(app)
        .get('/api/manifiestos')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
    
    test('POST /api/manifiestos creates new', async () => {
      const res = await request(app)
        .post('/api/manifiestos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoResiduoId: 'tipo-1',
          generadorId: 'gen-1',
          transportistaId: 'trans-1',
          operadorId: 'op-1',
          cantidad: 100,
          unidad: 'kg'
        });
      expect(res.status).toBe(201);
      manifiestoId = res.body.id;
    });
  });
});
```

### D4: Tests de Carga/Estrés
Crear `backend/tests/load/artillery.yml`:
```yaml
config:
  target: 'https://www.ultimamilla.com.ar'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 20
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      name: "Peak load"

scenarios:
  - name: "Browse manifiestos"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "generador@test.com"
            password: "mimi88"
          capture:
            json: "$.token"
            as: "token"
      - get:
          url: "/api/manifiestos"
          headers:
            Authorization: "Bearer {{ token }}"
      - get:
          url: "/api/dashboard/stats"
          headers:
            Authorization: "Bearer {{ token }}"
```

```bash
# Ejecutar
npx artillery run backend/tests/load/artillery.yml
```

### D5: Verificar 61 Casos de Uso
Crear `CHECKLIST_CU.md` con todos los casos:

```markdown
# Checklist de Casos de Uso

## Administrador (15)
- [ ] CU-A01: Login admin
- [ ] CU-A02: Dashboard ejecutivo
- [ ] CU-A03: Gestionar usuarios
... (todos los 15)

## Generador (12)
- [ ] CU-G01: Login generador
- [ ] CU-G02: Dashboard generador
... (todos los 12)

## Transportista (11)
- [ ] CU-T01: Login transportista
... (todos los 11)

## Operador (12)
- [ ] CU-O01: Login operador
... (todos los 12)

## Sistema (11)
- [ ] CU-S01: Generar número
... (todos los 11)
```

### D6: UAT con Usuarios Piloto
Preparar ambiente UAT:
```bash
# Crear usuarios de prueba para DGFA
node backend/prisma/seed-uat.ts
```

Crear guía para UAT:
- Casos de prueba paso a paso
- Formulario de feedback
- Contacto de soporte

---

## Verificación
```bash
# Backend tests
cd backend && npm test -- --coverage

# E2E tests
cd frontend && npx playwright test

# Load tests
npx artillery run tests/load/artillery.yml

# Generar reporte
npx playwright show-report
```

---

## Archivos a Crear
- [ ] `backend/jest.config.js`
- [ ] `backend/tests/unit/*.test.ts`
- [ ] `backend/tests/integration/api.test.ts`
- [ ] `backend/tests/load/artillery.yml`
- [ ] `frontend/playwright.config.ts`
- [ ] `frontend/tests/e2e/*.spec.ts`
- [ ] `CHECKLIST_CU.md`
- [ ] `UAT_GUIDE.md`
