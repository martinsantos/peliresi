# 📋 Tareas Paralelas para Claude Code

## Estado de Implementación (Actualizado: 2026-01-04)

---

## 🔴 Track A: Backend - **95% COMPLETADO**

| Item | Requerimiento | Estado | Archivo |
|------|---------------|--------|---------|
| A1 | BD Producción | ✅ | `.env.production`, `.env.sitrep-prod` |
| A2 | Sync Offline (CU-S05) | ✅ | `sync.controller.ts` (225 líneas, 3 endpoints) |
| A3 | Permisos Granulares (CU-A04) | ✅ | `auth.middleware.ts` (hasPermission, PERMISSIONS_BY_ROLE) |
| A4 | Emails Reales | ✅ | `email.service.ts` (nodemailer funcional) |
| A5 | Firma Digital | ✅ | `signature.service.ts` (demo PKI con interface) |
| A6 | Backups | ✅ | `backup.sh` |

**Pendiente funcional: NINGUNO**

---

## 🟢 Track B: Frontend - **100% COMPLETADO**

| Item | Requerimiento | Estado | Archivo |
|------|---------------|--------|---------|
| B1 | PWA/VitePWA | ✅ | `vite.config.ts` |
| B2 | Offline Storage | ✅ | `offlineStorage.ts` (IndexedDB, 300+ líneas) |
| B3 | Env Producción | ✅ | `.env.production` |
| B4 | UX Móvil | ✅ | `MobileApp.tsx` (GPS tracking, touch targets) |
| B5 | Push Notifications | ✅ | `pushNotifications.ts` |
| B6 | Tests Accesibilidad | ✅ | `a11y.spec.ts` (9 tests axe-core) |

**Pendiente funcional: NINGUNO**

---

## 🟡 Track C: DevOps - **100% COMPLETADO**

| Item | Requerimiento | Estado | Ubicación |
|------|---------------|--------|-----------|
| C1 | Nginx SITREP | ✅ | `/etc/nginx/sites-enabled/sitrep.*` |
| C2 | SSL | ✅ | Let's Encrypt activo |
| C3 | PM2 | ✅ | `ecosystem.config.js`, sitrep-api running |
| C4 | fail2ban | ✅ | nginx-limit-req jail activo |
| C5 | Security Audit | ✅ | `security-audit.sh` |
| C6 | Recovery Docs | ✅ | `RECOVERY.md` (6 procedimientos) |

**Pendiente funcional: NINGUNO**

---

## 🔵 Track D: Testing - **70% COMPLETADO**

| Item | Requerimiento | Estado | Archivo |
|------|---------------|--------|---------|
| D1 | Jest Backend | ✅ | `jest.config.js`, 11 tests pasando |
| D2 | Playwright E2E | ✅ | `playwright.config.ts`, `main.spec.ts` (24 tests) |
| D3 | API Integration | ✅ | `api.test.ts` |
| D4 | Load Tests | ❌ | **FALTA: `artillery.yml`** |
| D5 | Checklist CU | ✅ | `CHECKLIST_CU.md` existe |
| D6 | UAT Plan | ✅ | `UAT_PLAN.md` existe |

### Pendiente funcional:
- **D4**: Crear `backend/tests/load/artillery.yml` - Tests de carga

---

## 🟣 Track E: Migración - **75% COMPLETADO**

| Item | Requerimiento | Estado | Archivo |
|------|---------------|--------|---------|
| E1 | Estrategia | ❌ | **FALTA: `ESTRATEGIA.md`** |
| E2 | Import Generadores | ✅ | `import-generadores.ts` |
| E3 | Import Transportistas | ✅ | `import-transportistas.ts` |
| E4 | Import Operadores | ✅ | `import-operadores.ts` |
| E5 | Catálogo Residuos | ✅ | `seed.ts` |
| E6 | Validación Migración | ❌ | **FALTA: `validate-migration.ts`** |

### Pendiente funcional:
- **E1**: Crear `backend/src/scripts/migration/ESTRATEGIA.md`
- **E6**: Crear `backend/src/scripts/migration/validate-migration.ts`

---

## ⚠️ RESUMEN DE PENDIENTES FUNCIONALES

| Track | Item | Descripción | Prioridad |
|-------|------|-------------|-----------|
| D | D4 | Load tests con Artillery | MEDIA |
| E | E1 | Documento estrategia migración | BAJA |
| E | E6 | Script validación datos migrados | ALTA (cuando haya datos reales) |

---

## Verificación Rápida

```bash
# Backend tests (11 passed)
cd backend && npm test

# Frontend E2E (24 tests definidos)
cd frontend && npx playwright test --list

# Servidor
curl https://sitrep.ultimamilla.com.ar/api/health
```

---

Creado: 2026-01-02
Actualizado: 2026-01-04
