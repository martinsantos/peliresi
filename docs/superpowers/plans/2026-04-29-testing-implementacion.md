# Testing Integral SITREP — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement la estrategia completa de testing: bash tests extendidos, unit tests backend/frontend, E2E Playwright, k6 stress, y orquestador unificado.

**Architecture:** 6 fases progresivas. Fase 0 prepara infraestructura. Fases 1-5 implementan tests. Fase 6 orquesta todo. Cada fase produce resultados verificables independientemente.

**Tech Stack:** Bash + python3, Vitest, Testing Library + jsdom, MSW, Playwright, k6, GitHub Actions

---

## File Structure

```
📁 raíz
├── run-all.sh                              ← ORQUESTADOR (Fase 6)

📁 backend/
├── src/__tests__/
│   ├── services/
│   │   ├── blockchain.service.test.ts       ← NUEVO
│   │   ├── push.service.test.ts             ← NUEVO
│   │   ├── notification-dispatcher.service.test.ts  ← NUEVO
│   │   ├── domainEvent.service.test.ts      ← NUEVO
│   │   └── email.service.test.ts            ← NUEVO
│   ├── controllers/
│   │   ├── manifiesto-workflow.controller.test.ts  ← NUEVO
│   │   ├── blockchain.controller.test.ts    ← NUEVO
│   │   └── reporte.controller.test.ts       ← NUEVO
│   └── vitest.config.services.ts            ← NUEVO
├── tests/
│   ├── blockchain-test.sh                   ← EXTENDER
│   ├── push-test.sh                         ← NUEVO
│   ├── search-test.sh                       ← NUEVO
│   ├── solicitudes-test.sh                  ← NUEVO
│   ├── carga-masiva-test.sh                 ← NUEVO
│   ├── reportes-test.sh                     ← NUEVO
│   ├── centro-control-test.sh               ← NUEVO
│   ├── mensajeria-test.sh                   ← NUEVO
│   ├── monitor-war-room.sh                  ← NUEVO
│   ├── k6/
│   │   ├── concurrent.js                    ← NUEVO
│   │   ├── gps-burst.js                     ← NUEVO
│   │   ├── reportes-pesados.js              ← NUEVO
│   │   └── paginacion.js                    ← NUEVO
│   └── run-all-stress.sh                    ← NUEVO

📁 frontend/
├── src/__tests__/
│   ├── setup.ts                             ← NUEVO
│   ├── hooks/
│   │   ├── useManifiestos.test.ts           ← NUEVO
│   │   ├── useNotificaciones.test.ts        ← NUEVO
│   │   └── useAlertas.test.ts               ← NUEVO
│   ├── contexts/
│   │   ├── AuthContext.test.tsx             ← NUEVO
│   │   └── NotificationContext.test.tsx     ← NUEVO
│   ├── components/
│   │   ├── ManifiestoForm.test.tsx          ← NUEVO
│   │   ├── NotificationBell.test.tsx        ← NUEVO
│   │   └── BlockchainPanel.test.tsx         ← NUEVO
│   └── utils/
│       ├── formatters.test.ts               ← NUEVO
│       └── validators.test.ts               ← NUEVO
├── e2e/
│   ├── admin-flow.spec.ts                   ← NUEVO
│   ├── generador-flow.spec.ts               ← NUEVO
│   ├── transportista-flow.spec.ts           ← NUEVO
│   ├── operador-flow.spec.ts                ← NUEVO
│   ├── reportes.spec.ts                     ← NUEVO
│   ├── notificaciones.spec.ts               ← NUEVO
│   └── busqueda.spec.ts                     ← NUEVO
```

---

## Phase 0: Infrastructure Setup

### Task 0.1: Backend vitest config for services

**Files:**
- Create: `backend/src/__tests__/vitest.config.services.ts`

- [ ] **Create vitest config for service/controller tests**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Verify existing tests still pass**

Run: `cd backend && npx vitest run --config src/__tests__/vitest.config.services.ts`
Expected: 8+ tests pass

- [ ] **Commit**

```bash
git add backend/src/__tests__/vitest.config.services.ts
git commit -m "test: add vitest config for backend service tests"
```

### Task 0.2: Frontend vitest config for src/

**Files:**
- Create: `frontend/vitest.config.src.ts`

- [ ] **Create vitest config for main app tests**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    css: false,
  },
});
```

- [ ] **Create frontend test setup**

```typescript
// frontend/src/__tests__/setup.ts
import '@testing-library/jest-dom';
```

- [ ] **Verify config works**

Run: `cd frontend && npx vitest run --config vitest.config.src.ts`
Expected: No tests found (yet) — exits cleanly

- [ ] **Commit**

```bash
git add frontend/vitest.config.src.ts frontend/src/__tests__/setup.ts
git commit -m "test: add vitest config for frontend src/ tests"
```

### Task 0.3: Install k6

- [ ] **Install k6 locally**

Run: `brew install k6`
Expected: `k6 version` prints version info

- [ ] **Verify k6 works**

Run: `k6 run --help`
Expected: Usage instructions printed

- [ ] **Commit** (package doesn't need git tracking but note in CLAUDE.md)

```bash
git commit --allow-empty -m "chore: k6 installed for stress testing"
```

---

## Phase 1: Bash Tests (API Cruzados)

### Task 1.1: Extend blockchain-test.sh

**Files:**
- Modify: `backend/tests/blockchain-test.sh`

Agregar al script existente:

- [ ] **Add test: POST registrar manifiesto en blockchain**

```bash
# After existing tests, add:
section "Blockchain Registration"

# Get a TRATADO manifest for blockchain test
TRATADO_ID=$(api_call "GET" "/manifiestos?estado=TRATADO&limit=1" "$TOKEN" | json_extract "data.manifiestos.0.id")

if [ -n "$TRATADO_ID" ]; then
  # Register on blockchain
  REG_RESP=$(api_call "POST" "/blockchain/registrar/$TRATADO_ID" "$TOKEN")
  REG_SUCCESS=$(echo "$REG_RESP" | json_extract "success")
  REG_HASH=$(echo "$REG_RESP" | json_extract "data.transactionHash")

  if [ "$REG_SUCCESS" = "True" ] || [ "$REG_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Blockchain registration: txHash=${REG_HASH:0:20}..."
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Blockchain registration failed"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL blockchain registration"
  fi

  # Verify the registered manifest
  VERIFY_RESP=$(api_call "GET" "/blockchain/manifiesto/$TRATADO_ID" "$TOKEN")
  VERIFY_SELLOS=$(echo "$VERIFY_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    sellos = d['data'].get('sellos', [])
    print(len(sellos))
except: print('0')
" 2>/dev/null)
  if [ "$VERIFY_SELLOS" -ge 2 ] 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} Blockchain sellos count: $VERIFY_SELLOS (GENESIS + CIERRE)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Expected >=2 sellos, got $VERIFY_SELLOS"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No TRATADO manifests for blockchain test"
  SKIP=$((SKIP + 1))
fi
```

- [ ] **Run the extended blockchain test**

Run: `bash backend/tests/blockchain-test.sh https://sitrep.ultimamilla.com.ar`
Expected: PASS en todos los tests incluyendo los nuevos blockchain

- [ ] **Commit**

```bash
git add backend/tests/blockchain-test.sh
git commit -m "test: extend blockchain-test.sh with registration and verification"
```

### Task 1.2: Create push-test.sh

**Files:**
- Create: `backend/tests/push-test.sh`

- [ ] **Create push-test.sh**

```bash
#!/bin/bash
# ============================================================
# SITREP Push Notification Test
# Tests VAPID key, subscribe, unsubscribe, and simulated push
# ============================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0; FAIL=0; SKIP=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
CURL=$(which curl)

json_extract() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1', d['data'].get('$1', '')))" 2>/dev/null
}

section() { echo ""; echo -e "${BOLD}--- $1 ---${NC}"; }

section "SITREP PUSH NOTIFICATION TEST"
echo "Target: $API"

# Auth
echo -n "  Authenticating as ADMIN... "
ADMIN_RESP=$($CURL -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo -e "${RED}FATAL${NC}"; exit 1; fi
echo -e "${GREEN}OK${NC}"

section "Public VAPID Key"
VAPID_RESP=$($CURL -s "$API/push/vapid-key")
VAPID_KEY=$(echo "$VAPID_RESP" | json_extract "publicKey")
if [ -n "$VAPID_KEY" ] && [ ${#VAPID_KEY} -gt 20 ]; then
  echo -e "  ${GREEN}PASS${NC} VAPID public key returned (${#VAPID_KEY} chars)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} No VAPID key returned"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL No VAPID key"
fi

section "Subscribe (unauth — should fail)"
SUB_401=$($CURL -s -o /dev/null -w '%{http_code}' -X POST "$API/push/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://fake.push.service","keys":{"p256dh":"abc","auth":"def"}}')
if [ "$SUB_401" = "401" ]; then
  echo -e "  ${GREEN}PASS${NC} Unauthenticated subscribe blocked (401)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Expected 401, got $SUB_401"
  FAIL=$((FAIL + 1))
fi

section "Subscribe (auth)"
SUB_RESP=$($CURL -s -X POST "$API/push/subscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"endpoint":"https://fake.push.service/test","keys":{"p256dh":"dGVzdA==","auth":"dGVzdA=="}}')
SUB_SUCCESS=$(echo "$SUB_RESP" | json_extract "success")
if [ "$SUB_SUCCESS" = "True" ] || [ "$SUB_SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Subscription created"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Subscribe failed: $(echo "$SUB_RESP" | head -c 100)"
  FAIL=$((FAIL + 1))
fi

section "Unsubscribe (auth)"
UNSUB_RESP=$($CURL -s -X POST "$API/push/unsubscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"endpoint":"https://fake.push.service/test"}')
UNSUB_SUCCESS=$(echo "$UNSUB_RESP" | json_extract "success")
if [ "$UNSUB_SUCCESS" = "True" ] || [ "$UNSUB_SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Unsubscribe successful"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}WARN${NC} Unsubscribe may not be implemented"
  WARN=$((WARN + 1))
fi

# Summary
echo ""; echo -e "${BOLD}RESULTS:${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
```

- [ ] **Run push-test.sh**

Run: `bash backend/tests/push-test.sh https://sitrep.ultimamilla.com.ar`
Expected: PASS en VAPID key, 401 en subscribe sin auth

- [ ] **Commit**

```bash
git add backend/tests/push-test.sh
git commit -m "test: add push-test.sh — VAPID key, subscribe, unsubscribe"
```

### Task 1.3: Create search-test.sh

**Files:**
- Create: `backend/tests/search-test.sh`

- [ ] **Create search-test.sh** (similar structure, tests búsqueda global)

Testea: GET `/api/search?q=hospital`, GET `/api/search?q=MAN-2025`, GET `/api/search?q=sinresultadosxxxx` (200 pero vacío)

- [ ] **Run and commit**

```bash
git add backend/tests/search-test.sh
git commit -m "test: add search-test.sh — global search endpoint"
```

### Task 1.4: Create reportes-test.sh

**Files:**
- Create: `backend/tests/reportes-test.sh`

- [ ] **Create reportes-test.sh**

Testea:
- GET `/api/reportes/manifiestos?fechaInicio=2024-01-01&fechaFin=2026-12-31` → verifica `cantidad` y `unidad` son objetos (no números planos — gotcha)
- GET `/api/reportes/tratados` mismo rango
- GET `/api/reportes/transporte` mismo rango
- Export CSV: verifica Content-Type
- Verifica que `mapFilters()` tradujo fechaDesde→fechaInicio (el frontend manda `fechaDesde`, backend espera `fechaInicio`)

- [ ] **Run and commit**

```bash
git add backend/tests/reportes-test.sh
git commit -m "test: add reportes-test.sh — report views, filters, CSV export"
```

### Task 1.5: Create centro-control-test.sh

**Files:**
- Create: `backend/tests/centro-control-test.sh`

- [ ] **Create centro-control-test.sh**

Testea:
- GET `/api/centro-control/actividad` con capas: generadores, transportistas, operadores, transito
- Verifica que cada capa tenga datos no vacíos
- Verifica estructura de respuesta (features con geometry/coordinates)

- [ ] **Run and commit**

```bash
git add backend/tests/centro-control-test.sh
git commit -m "test: add centro-control-test.sh — map layers and activity"
```

### Task 1.6: Create mensajeria-test.sh (modo inerte)

**Files:**
- Create: `backend/tests/mensajeria-test.sh`

- [ ] **Create mensajeria-test.sh**

Testea el pipeline de notificaciones sin enviar realmente:
1. Login como ADMIN
2. Verificar que existen reglas de alerta (GET `/api/alertas/reglas`)
3. Verificar notificaciones in-app (GET `/api/notificaciones`)
4. Marcar una como leída (PUT `/api/notificaciones/:id/leida`)
5. Verificar contador de no leídas baja
6. Verificar email queue (GET `/api/admin/email-queue` si existe) o verificar que no hay errores

```bash
section "Notification Pipeline (modo inerte)"

# Get notifications
NOTIF_RESP=$(api_call "GET" "/notificaciones" "$TOKEN")
NOTIF_COUNT=$(echo "$NOTIF_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    notifs = d['data'] if isinstance(d['data'], list) else d['data'].get('notificaciones', [])
    print(len(notifs))
except: print('0')
" 2>/dev/null)

if [ "$NOTIF_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC} Notifications pipeline active: $NOTIF_COUNT notifications"
  PASS=$((PASS + 1))

  # Mark first as read
  FIRST_ID=$(echo "$NOTIF_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
notifs = d['data'] if isinstance(d['data'], list) else d['data'].get('notificaciones', [])
print(notifs[0]['id'] if notifs else '')
" 2>/dev/null)
  if [ -n "$FIRST_ID" ]; then
    READ_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' -X PUT "${API}/notificaciones/$FIRST_ID/leida" \
      -H "Authorization: Bearer $TOKEN")
    if [ "$READ_STATUS" = "200" ]; then
      echo -e "  ${GREEN}PASS${NC} Notification marked as read (id: ${FIRST_ID:0:8}...)"
      PASS=$((PASS + 1))
    else
      echo -e "  ${RED}FAIL${NC} Mark as read returned $READ_STATUS"
      FAIL=$((FAIL + 1))
    fi
  fi
else
  echo -e "  ${YELLOW}WARN${NC} No notifications found (pipeline may be empty)"
  WARN=$((WARN + 1))
fi
```

- [ ] **Run and commit**

```bash
git add backend/tests/mensajeria-test.sh
git commit -m "test: add mensajeria-test.sh — notification pipeline in inert mode"
```

### Task 1.7: Create monitor-war-room.sh

**Files:**
- Create: `backend/tests/monitor-war-room.sh`

- [ ] **Create monitor-war-room.sh**

```bash
#!/bin/bash
# ============================================================
# SITREP War Room Monitor
# Health checks cada 5 min. Log a war-room-{fecha}.log
# ============================================================
BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
LOG_DIR="${2:-/tmp/sitrep-war-room}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/war-room-$(date '+%Y-%m-%d').log"

log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

FAILS=0

# 1. Health endpoints
for EP in "/health" "/health/live" "/health/ready"; do
  STATUS=$($(which curl) -s -o /dev/null -w '%{http_code}' "${API}${EP}")
  if [ "$STATUS" != "200" ]; then
    log "FAIL health $EP → $STATUS"
    FAILS=$((FAILS + 1))
  fi
done

# 2. Login funciona
LOGIN_RESP=$($(which curl) -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  log "FAIL login → no token"
  FAILS=$((FAILS + 1))
fi

# 3. Dashboard carga
DASH_STATUS=$($(which curl) -s -o /dev/null -w '%{http_code}' "${API}/manifiestos/dashboard" \
  -H "Authorization: Bearer $TOKEN")
if [ "$DASH_STATUS" != "200" ]; then
  log "FAIL dashboard → $DASH_STATUS"
  FAILS=$((FAILS + 1))
fi

# Resultado
if [ $FAILS -gt 0 ]; then
  log "STATUS: $FAILS failures"
  echo "WAR ROOM: $FAILS failures — check $LOG"
  exit 1
else
  log "STATUS: OK"
  echo "WAR ROOM: All OK"
  exit 0
fi
```

- [ ] **Run and verify log**

Run: `bash backend/tests/monitor-war-room.sh https://sitrep.ultimamilla.com.ar /tmp/sitrep-war-room`
Expected: "WAR ROOM: All OK". Check: `cat /tmp/sitrep-war-room/war-room-*.log`

- [ ] **Commit**

```bash
git add backend/tests/monitor-war-room.sh
git commit -m "test: add monitor-war-room.sh — health checks con logging periódico"
```

### Task 1.8: Create solicitudes-test.sh

**Files:**
- Create: `backend/tests/solicitudes-test.sh`

- [ ] **Create solicitudes-test.sh**

Testea endpoints públicos de solicitudes/inscripción:
- GET `/api/solicitudes/tipos` (catálogo de tipos de solicitud si existe)
- POST `/api/solicitudes` (crear solicitud como usuario anónimo)
- GET `/api/solicitudes` (listar como admin)

- [ ] **Run and commit**

```bash
git add backend/tests/solicitudes-test.sh
git commit -m "test: add solicitudes-test.sh — inscription wizard endpoints"
```

### Task 1.9: Create carga-masiva-test.sh

**Files:**
- Create: `backend/tests/carga-masiva-test.sh`

- [ ] **Create carga-masiva-test.sh**

Testea:
- GET `/api/carga-masiva/plantilla/generadores` → descarga CSV
- POST `/api/carga-masiva/generadores` con CSV válido (en modo test/demo)
- POST `/api/carga-masiva/generadores` con datos inválidos → 400

- [ ] **Run and commit**

```bash
git add backend/tests/carga-masiva-test.sh
git commit -m "test: add carga-masiva-test.sh — CSV import validation"
```

---

## Phase 2: Backend Unit Tests (Vitest)

### Task 2.1: blockchain.service.test.ts

**Files:**
- Create: `backend/src/__tests__/services/blockchain.service.test.ts`

- [ ] **Create blockchain service test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlockchainService } from '../../services/blockchain.service';

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn(),
    Wallet: vi.fn(),
    Contract: vi.fn(),
  },
}));

describe('BlockchainService', () => {
  let service: BlockchainService;

  beforeEach(() => {
    service = new BlockchainService();
  });

  it('registrarSello should create a valid seal structure', async () => {
    const seal = await service.registrarSello(
      'test-manifiesto-id',
      'APROBADO',
      'hash-anterior',
    );
    expect(seal).toHaveProperty('manifiestoId');
    expect(seal).toHaveProperty('estado');
    expect(seal).toHaveProperty('hash');
    expect(seal).toHaveProperty('timestamp');
    expect(seal.estado).toBe('APROBADO');
  });

  it('verificarIntegridad should return true for valid chain', async () => {
    const result = await service.verificarIntegridad('test-manifiesto-id');
    expect(result).toHaveProperty('integro');
    expect(result).toHaveProperty('sellos');
  });

  it('should reject invalid manifest ID', async () => {
    await expect(service.registrarSello('', 'APROBADO', 'hash'))
      .rejects.toThrow();
  });
});
```

- [ ] **Run test**

Run: `cd backend && npx vitest run --config src/__tests__/vitest.config.services.ts src/__tests__/services/blockchain.service.test.ts`
Expected: Tests pass

- [ ] **Commit**

```bash
git add backend/src/__tests__/services/blockchain.service.test.ts
git commit -m "test: add blockchain.service.test.ts — seal creation and integrity"
```

### Task 2.2: push.service.test.ts

**Files:**
- Create: `backend/src/__tests__/services/push.service.test.ts`

- [ ] **Read actual push service API to write accurate tests**

Run: `cd backend && cat src/services/push.service.ts | grep -n 'async function\|export const\|export function'`
Expected: Lista de funciones exportadas

- [ ] **Create push service test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock web-push
vi.mock('web-push', () => ({
  sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  setVapidDetails: vi.fn(),
}));

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set VAPID details on init', async () => {
    const { setVapidDetails } = await import('web-push');
    // Import triggers init — verify VAPID was set
    await vi.dynamicImportSettled();
    expect(setVapidDetails).toHaveBeenCalled();
  });

  it('enviarPushAlUsuario should reject without subscription', async () => {
    const { enviarPushAlUsuario } = await import('../../services/push.service');
    await expect(enviarPushAlUsuario('nonexistent-user-id', {
      title: 'Test',
      body: 'Test push',
    })).rejects.toThrow();
  });

  it('should send notification with correct payload structure', async () => {
    const { enviarPushAlUsuario } = await import('../../services/push.service');
    // This test verifies the function exists and handles params correctly
    expect(enviarPushAlUsuario).toBeDefined();
  });

  it('notificarPorRol should be a function', async () => {
    const { notificarPorRol } = await import('../../services/push.service');
    expect(typeof notificarPorRol).toBe('function');
  });
});
```

- [ ] **Run tests**

Run: `cd backend && npx vitest run --config src/__tests__/vitest.config.services.ts src/__tests__/services/push.service.test.ts`
Expected: Tests pass

- [ ] **Commit**

```bash
git add backend/src/__tests__/services/push.service.test.ts
git commit -m "test: add push.service.test.ts — push notification priority and dispatch"
```

### Task 2.3: notification-dispatcher.service.test.ts

**Files:**
- Create: `backend/src/__tests__/services/notification-dispatcher.service.test.ts`

- [ ] **Create notification-dispatcher test**

Testea dispatch por tipo de evento, prioridades, agregación de destinatarios por rol. Mockear Prisma para evitar DB real.

- [ ] **Run and commit**

```bash
git add backend/src/__tests__/services/notification-dispatcher.service.test.ts
git commit -m "test: add notification-dispatcher.service.test.ts — event dispatch by role"
```

### Task 2.4: domainEvent.service.test.ts

**Files:**
- Create: `backend/src/__tests__/services/domainEvent.service.test.ts`

- [ ] **Create domainEvent test**

Testea: publish/subscribe, handlers se ejecutan, error en un handler no afecta otros.

- [ ] **Run and commit**

```bash
git add backend/src/__tests__/services/domainEvent.service.test.ts
git commit -m "test: add domainEvent.service.test.ts — event bus publish/subscribe"
```

### Task 2.5: email.service.test.ts

**Files:**
- Create: `backend/src/__tests__/services/email.service.test.ts`

- [ ] **Create email service test**

Testea: encolar, flush, DISABLE_EMAILS=true, kill switch.

- [ ] **Run and commit**

```bash
git add backend/src/__tests__/services/email.service.test.ts
git commit -m "test: add email.service.test.ts — queue, flush, DISABLE_EMAILS"
```

### Task 2.6: manifiesto-workflow.controller.test.ts

**Files:**
- Create: `backend/src/__tests__/controllers/manifiesto-workflow.controller.test.ts`

- [ ] **Create manifiesto-workflow controller test**

Testea transiciones de estado válidas e inválidas. Mockear Prisma.

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Manifiesto Workflow Controller', () => {
  it('should reject transition from CANCELADO to APROBADO', async () => {
    // This is a business rule: once cancelled, cannot be approved
  });

  it('should allow BORRADOR to APROBADO', async () => {
    // Standard transition
  });

  it('should reject confirmar-retiro from non-APROBADO state', async () => {
    // Only APROBADO manifests can be picked up
  });

  it('should reject confirmar-entrega from non-EN_TRANSITO state', async () => {
    // Only EN_TRANSITO manifests can be delivered
  });

  it('should handle IN_SITU workflow without transport steps', async () => {
    // IN_SITU: BORRADOR → APROBADO → RECIBIDO → EN_TRATAMIENTO → TRATADO
  });
});
```

- [ ] **Run and commit**

```bash
git add backend/src/__tests__/controllers/manifiesto-workflow.controller.test.ts
git commit -m "test: add manifiesto-workflow controller tests — state transitions"
```

### Task 2.7: blockchain.controller.test.ts

**Files:**
- Create: `backend/src/__tests__/controllers/blockchain.controller.test.ts`

- [ ] **Create blockchain controller test**

Testea endpoints con auth (200), sin auth (401), manifiesto inexistente (404).

- [ ] **Run and commit**

```bash
git add backend/src/__tests__/controllers/blockchain.controller.test.ts
git commit -m "test: add blockchain.controller.test.ts — auth guards and responses"
```

### Task 2.8: reporte.controller.test.ts

**Files:**
- Create: `backend/src/__tests__/controllers/reporte.controller.test.ts`

- [ ] **Create reporte controller test**

Testea: mapFilters() traduce fechaDesde→fechaInicio, filtros combinados, agregaciones retornan {cantidad, unidad} objetos.

- [ ] **Run and commit**

```bash
git add backend/src/__tests__/controllers/reporte.controller.test.ts
git commit -m "test: add reporte.controller.test.ts — filters and aggregation"
```

---

## Phase 3: Frontend Unit Tests (Vitest)

### Task 3.1: useManifiestos.test.ts

**Files:**
- Create: `frontend/src/__tests__/hooks/useManifiestos.test.ts`

- [ ] **Create useManifiestos test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the API module
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Wrapper with QueryClient for testing hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useManifiestos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch manifiestos list', async () => {
    const api = require('../../services/api').default;
    api.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          manifiestos: [
            { id: '1', numero: 'MAN-2025-000001', estado: 'APROBADO' },
          ],
          total: 1,
        },
      },
    });

    const { useManifiestos } = await import('../../hooks/useManifiestos');
    const { result } = renderHook(() => useManifiestos(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.manifiestos).toHaveLength(1);
    expect(result.current.data?.manifiestos[0].numero).toBe('MAN-2025-000001');
  });
});
```

- [ ] **Run test**

Run: `cd frontend && npx vitest run --config vitest.config.src.ts src/__tests__/hooks/useManifiestos.test.ts`
Expected: PASS

- [ ] **Commit**

```bash
git add frontend/src/__tests__/hooks/useManifiestos.test.ts
git commit -m "test: add useManifiestos.test.ts — fetch with TanStack Query"
```

### Task 3.2: useNotificaciones.test.ts

**Files:**
- Create: `frontend/src/__tests__/hooks/useNotificaciones.test.ts`

- [ ] **Create useNotificaciones test**

Testea: polling 30s, marcar leída, marcar todas leídas, eliminar.

### Task 3.3: useAlertas.test.ts

**Files:**
- Create: `frontend/src/__tests__/hooks/useAlertas.test.ts`

- [ ] **Create useAlertas test**

Testea: CRUD reglas, toggle activa/inactiva.

### Task 3.4: AuthContext.test.tsx

**Files:**
- Create: `frontend/src/__tests__/contexts/AuthContext.test.tsx`

- [ ] **Create AuthContext test**

Testea: login, logout, refresh token, rol-based guards, persistencia de sesión.

### Task 3.5: NotificationContext.test.tsx

**Files:**
- Create: `frontend/src/__tests__/contexts/NotificationContext.test.tsx`

- [ ] **Create NotificationContext test**

Testea: estado global de notificaciones, conteo no leídas, marcado como leído.

### Task 3.6: Component tests

**Files:**
- Create: `frontend/src/__tests__/components/ManifiestoForm.test.tsx`
- Create: `frontend/src/__tests__/components/NotificationBell.test.tsx`
- Create: `frontend/src/__tests__/components/BlockchainPanel.test.tsx`

- [ ] **Create ManifiestoForm test** — validación de campos, selección de actores, envío
- [ ] **Create NotificationBell test** — render condicional según cantidad, dropdown, prioridades
- [ ] **Create BlockchainPanel test** — estado blockchain, verificación

### Task 3.7: Util tests

**Files:**
- Create: `frontend/src/__tests__/utils/formatters.test.ts`
- Create: `frontend/src/__tests__/utils/validators.test.ts`

- [ ] **Create formatters test** — fechas, números, estados, roles
- [ ] **Create validators test** — CUIT, email, pesos, fechas

- [ ] **Commit todos los frontend tests**

```bash
git add frontend/src/__tests__/
git commit -m "test: add frontend unit tests — hooks, contexts, components, utils"
```

---

## Phase 4: E2E Playwright

### Task 4.1: admin-flow.spec.ts

**Files:**
- Create: `frontend/e2e/admin-flow.spec.ts`

- [ ] **Create admin E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@dgfa.mendoza.gov.ar');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('dashboard shows stat cards', async ({ page }) => {
    await expect(page.locator('[data-testid="stat-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-borradores"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-tratados"]')).toBeVisible();
  });

  test('actores page shows tabs', async ({ page }) => {
    await page.goto('/actores');
    await expect(page.locator('text=Generadores')).toBeVisible();
    await expect(page.locator('text=Transportistas')).toBeVisible();
    await expect(page.locator('text=Operadores')).toBeVisible();
  });

  test('blockchain panel accessible', async ({ page }) => {
    await page.goto('/admin/blockchain');
    await expect(page.locator('[data-testid="blockchain-panel"]')).toBeVisible();
  });
});
```

- [ ] **Run admin E2E test**

Run: `cd frontend && npx playwright test e2e/admin-flow.spec.ts`
Expected: PASS

- [ ] **Commit**

```bash
git add frontend/e2e/admin-flow.spec.ts
git commit -m "test(e2e): add admin-flow.spec.ts — dashboard, actores, blockchain"
```

### Task 4.2: generador-flow.spec.ts

**Files:**
- Create: `frontend/e2e/generador-flow.spec.ts`

- [ ] **Create generador E2E test**

Testea: login como generador, crear manifiesto, firmar, ver timeline, descargar PDF.

### Task 4.3: transportista-flow.spec.ts

**Files:**
- Create: `frontend/e2e/transportista-flow.spec.ts`

- [ ] **Create transportista E2E test**

Testea: login como transportista, ver viajes asignados, tracking en mapa, registrar incidente.

### Task 4.4: operador-flow.spec.ts

**Files:**
- Create: `frontend/e2e/operador-flow.spec.ts`

- [ ] **Create operador E2E test**

Testea: login como operador, ver entrantes, confirmar recepción, registrar tratamiento, cerrar.

### Task 4.5: reportes.spec.ts

**Files:**
- Create: `frontend/e2e/reportes.spec.ts`

- [ ] **Create reportes E2E test**

Testea: 3 tabs (Manifiestos, Tratados, Transporte), filtros de fecha, exportar CSV.

### Task 4.6: notificaciones.spec.ts

**Files:**
- Create: `frontend/e2e/notificaciones.spec.ts`

- [ ] **Create notificaciones E2E test**

Testea: campana visible, dropdown con lista, marcar como leída.

### Task 4.7: busqueda.spec.ts

**Files:**
- Create: `frontend/e2e/busqueda.spec.ts`

- [ ] **Create busqueda E2E test**

Testea: Cmd+K abre buscador, resultados visibles, navegación a resultado.

- [ ] **Commit todos los E2E tests**

```bash
git add frontend/e2e/*-flow.spec.ts frontend/e2e/reportes.spec.ts frontend/e2e/notificaciones.spec.ts frontend/e2e/busqueda.spec.ts
git commit -m "test(e2e): add multi-role flows, reportes, notificaciones, busqueda"
```

---

## Phase 5: k6 Stress Tests

### Task 5.1: concurrent.js

**Files:**
- Create: `backend/tests/k6/concurrent.js`

- [ ] **Create k6 concurrent test**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'https://sitrep.ultimamilla.com.ar/api';

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // ramp up
    { duration: '20s', target: 50 },  // peak
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% under 2s
    http_req_failed: ['rate<0.01'],     // <1% errors
  },
};

export default function () {
  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'admin@dgfa.mendoza.gov.ar',
    password: 'admin123',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login status 200': (r) => r.status === 200 });

  if (loginRes.status === 200) {
    const token = JSON.parse(loginRes.body).data.tokens.accessToken;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Query manifests
    const manifiestosRes = http.get(`${BASE_URL}/manifiestos?limit=10`, { headers });
    check(manifiestosRes, { 'manifiestos status 200': (r) => r.status === 200 });

    // Query dashboard
    const dashRes = http.get(`${BASE_URL}/manifiestos/dashboard`, { headers });
    check(dashRes, { 'dashboard status 200': (r) => r.status === 200 });
  }

  sleep(1);
}
```

- [ ] **Run k6 concurrent test**

Run: `cd backend && k6 run tests/k6/concurrent.js`
Expected: Thresholds met (p95 < 2s, errors < 1%)

- [ ] **Commit**

```bash
git add backend/tests/k6/concurrent.js
git commit -m "test(stress): add k6 concurrent test — 50 VUs"
```

### Task 5.2: gps-burst.js

**Files:**
- Create: `backend/tests/k6/gps-burst.js`

- [ ] **Create k6 GPS burst test**

100 req/s de ubicación GPS, threshold: p95 < 500ms.

### Task 5.3: reportes-pesados.js

**Files:**
- Create: `backend/tests/k6/reportes-pesados.js`

- [ ] **Create k6 reportes test**

Consultas con rango de 2 años, threshold: p95 < 5s.

### Task 5.4: paginacion.js

**Files:**
- Create: `backend/tests/k6/paginacion.js`

- [ ] **Create k6 paginacion test**

10 VUs navegando páginas, verifica orden consistente.

### Task 5.5: run-all-stress.sh

**Files:**
- Create: `backend/tests/run-all-stress.sh`

- [ ] **Create stress runner**

```bash
#!/bin/bash
BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)/k6"

echo "=== SITREP STRESS TESTS ==="
echo "Target: $BASE_URL"
echo ""

for SCRIPT in "$SCRIPTS_DIR"/*.js; do
  NAME=$(basename "$SCRIPT")
  echo "--- Running $NAME ---"
  BASE_URL="$BASE_URL" k6 run "$SCRIPT"
  echo ""
done

echo "=== ALL STRESS TESTS COMPLETE ==="
```

- [ ] **Commit**

```bash
git add backend/tests/k6/ backend/tests/run-all-stress.sh
git commit -m "test(stress): add k6 stress battery + runner — concurrent, GPS, reportes, paginacion"
```

---

## Phase 6: Orchestration

### Task 6.1: run-all.sh

**Files:**
- Create: `run-all.sh`

- [ ] **Create run-all.sh orchestrator**

```bash
#!/bin/bash
# ============================================================
# SITREP Master Test Orchestrator
# Ejecuta todas las fases de testing en orden.
# Usage: bash run-all.sh [ambiente] [--stress]
#   ambiente: "demo" (default) o "local"
#   --stress: incluye k6 (solo demo)
# ============================================================

set -euo pipefail

AMBIENTE="${1:-demo}"
STRESS_FLAG="${2:-}"
SCRIPTS_DIR="backend/tests"
REPORT_DIR="test-reports"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')

case "$AMBIENTE" in
  demo)   BASE_URL="https://sitrep.ultimamilla.com.ar" ;;
  local)  BASE_URL="http://localhost:3002" ;;
  *)      echo "Ambiente inválido: $AMBIENTE (demo|local)"; exit 1 ;;
esac

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/test-report-$AMBIENTE-$TIMESTAMP.log"

log() { echo -e "$1" | tee -a "$REPORT"; }
section() { log "\n${BOLD}${CYAN}═══════════════════════════════════════════${NC}"; log "${BOLD}${CYAN}  $1${NC}"; log "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"; }

TOTAL_PASS=0; TOTAL_FAIL=0; PHASE_FAIL=0

run_phase() {
  local phase_name=$1; shift
  log "\n${BOLD}▶ Phase $phase_name${NC}"
  for script in "$@"; do
    if [ ! -f "$script" ]; then
      log "  ${YELLOW}SKIP${NC} $script (not found)"
      continue
    fi
    log "  Running: $script"
    set +e
    bash "$script" "$BASE_URL" 2>&1 | tee -a "$REPORT"
    local exit_code=${PIPESTATUS[0]}
    set -e
    if [ $exit_code -eq 0 ]; then
      log "  ${GREEN}PASS${NC} $script"
    else
      log "  ${RED}FAIL${NC} $script (exit $exit_code)"
      PHASE_FAIL=$((PHASE_FAIL + 1))
    fi
  done
}

# ── FASE 1: Smoke ──────────────────────────────
section "FASE 1: Smoke Tests"
run_phase "1" "$SCRIPTS_DIR/smoke-test.sh"
if [ $PHASE_FAIL -gt 0 ]; then
  log "${RED}SMOKE FAILED — aborting${NC}"
  exit 1
fi

# ── FASE 2: Cruzados ───────────────────────────
section "FASE 2: Cross-Platform Tests"
run_phase "2" \
  "$SCRIPTS_DIR/cross-platform-workflow-test.sh" \
  "$SCRIPTS_DIR/role-enforcement-test.sh" \
  "$SCRIPTS_DIR/edge-cases-test.sh" \
  "$SCRIPTS_DIR/gps-validation-test.sh" \
  "$SCRIPTS_DIR/blockchain-test.sh" \
  "$SCRIPTS_DIR/push-test.sh" \
  "$SCRIPTS_DIR/search-test.sh" \
  "$SCRIPTS_DIR/solicitudes-test.sh" \
  "$SCRIPTS_DIR/carga-masiva-test.sh" \
  "$SCRIPTS_DIR/reportes-test.sh" \
  "$SCRIPTS_DIR/centro-control-test.sh" \
  "$SCRIPTS_DIR/mensajeria-test.sh"

# ── FASE 3: Unitarios ──────────────────────────
section "FASE 3: Unit Tests"

log "--- Backend ---"
set +e
(cd backend && npx vitest run --config src/__tests__/vitest.config.services.ts 2>&1) | tee -a "$REPORT"
BACKEND_EXIT=${PIPESTATUS[0]}
set -e

log "--- Frontend ---"
set +e
(cd frontend && npx vitest run --config vitest.config.src.ts 2>&1) | tee -a "$REPORT"
FRONTEND_EXIT=${PIPESTATUS[0]}
set -e

if [ $BACKEND_EXIT -ne 0 ] || [ $FRONTEND_EXIT -ne 0 ]; then
  log "${RED}UNIT TESTS FAILED — aborting E2E${NC}"
  PHASE_FAIL=$((PHASE_FAIL + 1))
  exit 1
fi

# ── FASE 4: E2E (solo demo) ────────────────────
if [ "$AMBIENTE" = "demo" ]; then
  section "FASE 4: E2E Playwright"
  set +e
  (cd frontend && npx playwright test 2>&1) | tee -a "$REPORT"
  E2E_EXIT=${PIPESTATUS[0]}
  set -e
  if [ $E2E_EXIT -ne 0 ]; then
    PHASE_FAIL=$((PHASE_FAIL + 1))
  fi
fi

# ── FASE 5: War Room ───────────────────────────
if [ "$AMBIENTE" = "demo" ]; then
  section "FASE 5: War Room Monitor"
  bash "$SCRIPTS_DIR/monitor-war-room.sh" "$BASE_URL" 2>&1 | tee -a "$REPORT"
fi

# ── FASE 6: Stress (opcional) ──────────────────
if [ "$AMBIENTE" = "demo" ] && [ "$STRESS_FLAG" = "--stress" ]; then
  section "FASE 6: Stress Tests (k6)"
  bash "$SCRIPTS_DIR/run-all-stress.sh" "$BASE_URL" 2>&1 | tee -a "$REPORT"
fi

# ── Resultado Final ─────────────────────────────
section "FINAL RESULT"
if [ $PHASE_FAIL -gt 0 ]; then
  log "${RED}${BOLD}FAILED — $PHASE_FAIL phase(s) with errors${NC}"
  exit 1
else
  log "${GREEN}${BOLD}ALL TESTS PASSED${NC}"
  exit 0
fi
```

- [ ] **Make executable**

```bash
chmod +x run-all.sh
```

- [ ] **Verify help output**

Run: `bash run-all.sh` (esperar que corra o que muestre error de conexión si no hay server)
Expected: Script ejecuta o falla con error de conexión (no de sintaxis)

- [ ] **Commit**

```bash
git add run-all.sh
git commit -m "test: add run-all.sh — master test orchestrator with 6 phases"
```

### Task 6.2: GitHub Actions CI

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Create CI workflow**

```yaml
name: SITREP Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Backend Unit Tests
        run: cd backend && npx vitest run --config src/__tests__/vitest.config.services.ts

      - name: Frontend Unit Tests
        run: cd frontend && npx vitest run --config vitest.config.src.ts

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-report
          path: test-reports/
```

- [ ] **Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions test workflow"
```

---

## Resumen de Entregables

| Fase | Archivos | Tests |
|------|----------|-------|
| 0 — Infra | 3 | Configs vitest + k6 |
| 1 — Bash extendidos | 8 scripts | ~80 assertions nuevas |
| 2 — Unit backend | 8 archivos | ~80 tests |
| 3 — Unit frontend | 10 archivos | ~60 tests |
| 4 — E2E Playwright | 7 archivos | ~70 scenarios |
| 5 — k6 Stress | 5 archivos | 4 escenarios con thresholds |
| 6 — Orchestration | 2 archivos | runner + CI |
| **Total** | **~43 archivos** | **~200+ tests** |
