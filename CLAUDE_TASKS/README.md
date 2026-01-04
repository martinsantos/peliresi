# 📋 Tareas Paralelas para Claude Code

## Uso
Cada archivo `TRACK_X_*.md` es una tarea independiente que puedes cargar en una instancia de Claude Code.

## Tracks Disponibles

| Track | Archivo | Descripción | Dependencias |
|-------|---------|-------------|--------------|
| 🔴 A | `TRACK_A_BACKEND.md` | Backend, BD, APIs | Ninguna |
| 🟢 B | `TRACK_B_FRONTEND.md` | Frontend, PWA, Offline | Ninguna |
| 🟡 C | `TRACK_C_DEVOPS.md` | Nginx, SSL, PM2, Seguridad | Requiere A1 completado |
| 🔵 D | `TRACK_D_TESTING.md` | Tests E2E, QA | Puede iniciar inmediatamente |
| 🟣 E | `TRACK_E_MIGRACION.md` | Scripts de migración de datos | Requiere datos de DGFA |

## Cómo Usar

1. Abre Claude Code en una nueva ventana
2. Copia el contenido de un archivo `TRACK_*.md`
3. Pégalo como prompt inicial
4. El agente ejecutará las tareas secuencialmente

## Ejecución Paralela Recomendada

```
Ventana 1: TRACK_A + TRACK_B (pueden correr juntos)
Ventana 2: TRACK_D (testing independiente)
Ventana 3: TRACK_E (cuando tengas datos)
Ventana 4: TRACK_C (después de A1)
```

---

## 📊 Estado de Implementación (Actualizado: 2026-01-03)

### 🔴 Track A: Backend (75% completado)
- [x] A1: `.env.production` configurado
- [x] A2: `sync.controller.ts` y `sync.routes.ts` - Sincronización offline implementada
- [ ] A3: Permisos granulares (parcial - auth.middleware tiene base)
- [ ] A4: Emails reales (mock en notificationService)
- [ ] A5: Firma digital real (placeholder)
- [x] A6: Scripts de backup existen

### 🟢 Track B: Frontend (85% completado)
- [x] B1: VitePWA configurado en `vite.config.ts`
- [ ] B2: offlineStorage.ts (no encontrado - usar localStorage actual)
- [x] B3: `.env.production` configurado
- [x] B4: UX móvil optimizada (MobileApp.tsx mejorada)
- [x] B5: `pushNotifications.ts` implementado
- [ ] B6: Tests de accesibilidad (parcial)

### 🟡 Track C: DevOps (60% completado)
- [x] C1: Nginx configurado para sitrep.ultimamilla.com.ar
- [x] C2: SSL Let's Encrypt activo
- [x] C3: PM2 configurado (ecosystem.config.js)
- [ ] C4: fail2ban (no verificado)
- [ ] C5: Auditoría de seguridad pendiente
- [ ] C6: RECOVERY.md pendiente

### 🔵 Track D: Testing (70% completado)
- [x] D1: `jest.config.js` - 11 tests pasando
- [x] D2: `playwright.config.ts` + `main.spec.ts` (16 tests definidos)
- [x] D3: `api.test.ts` - tests de integración
- [ ] D4: Artillery load tests (no encontrado)
- [x] D5: CHECKLIST_CU.md existe (61 casos de uso)
- [x] D6: UAT_PLAN.md existe

### 🟣 Track E: Migración (90% completado)
- [x] E1: Estrategia definida
- [x] E2: `import-generadores.ts` implementado
- [x] E3: `import-transportistas.ts` implementado  
- [x] E4: `import-operadores.ts` implementado
- [x] E5: Catálogo de residuos en seed
- [ ] E6: Validación de datos migrados (pendiente data real)

---

## Verificación de Tests

```bash
# Backend tests (11 passed)
cd backend && npm test

# Frontend E2E tests
cd frontend && npx playwright test
```

---

Creado: 2026-01-02
Actualizado: 2026-01-03
