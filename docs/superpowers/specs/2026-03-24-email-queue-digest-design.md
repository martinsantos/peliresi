# Email Queue + Digest System — Design Spec

**Date**: 2026-03-24
**Status**: Approved
**Author**: Claude + santosma

## Problem

The system sends individual emails for every workflow event (state changes, incidents, alerts). With ~100 manifiestos/day, each traversing 7 states, plus alert rules with email destinations, this produces 500+ emails/day — saturating the Gmail SMTP quota and flooding recipients.

## Solution

Replace direct SMTP sends with a **DB-backed email queue** that:
- Sends **transactional** emails (verification, password reset) immediately with fallback to queue on failure
- Batches **alert** emails into periodic **digests** (1 email per recipient per flush window)
- Enforces **per-recipient daily rate limits**
- Stores all email attempts in DB for visibility and retry

## Architecture

```
emailService.enqueue*(...)
    |
    v
[email_queue table]  <-- INSERT with tipo + estado
    |
    |-- TRANSACCIONAL: attempt immediate send
    |     success -> ENVIADO
    |     failure -> FALLIDO (retry on next flush)
    |
    |-- ALERTA: estado=DIGEST_PENDIENTE
          (waits for flush)

Timer (every 5 min):
  flushEmailQueue()
    |
    |-- 1. Retry FALLIDO (intentos < max, nextRetryAt <= now)
    |-- 2. Group DIGEST_PENDIENTE by digestKey
    |     -> render 1 digest email per group
    |     -> send
    |     -> mark all in group as ENVIADO or FALLIDO
    |-- 3. Mark FALLIDO with intentos >= max as SUPRIMIDO
```

## Database Schema

### Enums

```prisma
enum EmailTipo {
  TRANSACCIONAL
  ALERTA
}

enum EmailPrioridad {
  CRITICA    // password reset, email verification
  NORMAL     // account approved, solicitud notifications
  BAJA       // alert digests
}

enum EmailEstado {
  PENDIENTE         // transactional waiting for immediate send
  ENVIADO           // successfully sent
  FALLIDO           // send failed, will retry
  DIGEST_PENDIENTE  // alert waiting for digest flush
  SUPRIMIDO         // rate-limited or max retries exceeded
}
```

### Table

```prisma
model EmailQueue {
  id          String         @id @default(cuid())
  to          String         // recipient email
  subject     String         // subject line (for transactional) or alert summary (for digest source)
  html        String         @db.Text  // full HTML body (transactional) or alert snippet (digest)
  tipo        EmailTipo
  prioridad   EmailPrioridad @default(NORMAL)
  estado      EmailEstado    @default(PENDIENTE)
  intentos    Int            @default(0)
  maxIntentos Int            @default(3)
  error       String?        // last error message
  digestKey   String?        // grouping key: "alerta:{email}:{YYYY-MM-DD}:{HH-block}"
  createdAt   DateTime       @default(now())
  sentAt      DateTime?
  nextRetryAt DateTime?

  @@index([estado, nextRetryAt])
  @@index([to, createdAt])
  @@index([digestKey])
  @@map("email_queue")
}
```

### digestKey format

`alerta:{to}:{YYYY-MM-DD}:{HH}` where HH is the hour. This groups all alerts to the same recipient within the same clock hour into one digest.

Example: `alerta:admin@dgfa.mendoza.gov.ar:2026-03-24:14` groups all alerts to that email between 14:00 and 14:59.

## Email Classification

| emailService method | tipo | prioridad | Send behavior |
|---|---|---|---|
| sendEmailVerification | TRANSACCIONAL | CRITICA | Immediate |
| sendPasswordResetEmail | TRANSACCIONAL | CRITICA | Immediate |
| sendRegistroPendienteEmail | TRANSACCIONAL | NORMAL | Immediate |
| sendCuentaAprobadaEmail | TRANSACCIONAL | NORMAL | Immediate |
| sendNuevoRegistroAdminEmail | TRANSACCIONAL | NORMAL | Immediate |
| sendSolicitudEnviadaAdmin | TRANSACCIONAL | NORMAL | Immediate |
| sendSolicitudObservadaEmail | TRANSACCIONAL | NORMAL | Immediate |
| sendSolicitudRechazadaEmail | TRANSACCIONAL | NORMAL | Immediate |
| sendRespuestaCandidatoAdmin | TRANSACCIONAL | NORMAL | Immediate |
| sendModificacionSolicitadaAdmin | TRANSACCIONAL | NORMAL | Immediate |
| sendModificacionAprobadaEmail | TRANSACCIONAL | NORMAL | Immediate |
| sendModificacionRechazadaEmail | TRANSACCIONAL | NORMAL | Immediate |
| sendAlertEmail | ALERTA | BAJA | Digest (batched) |

## Rate Limits (per recipient per day)

| Tipo | Max/day/recipient |
|---|---|
| TRANSACCIONAL | 10 |
| ALERTA (digests) | 6 |

When exceeded: email is inserted with `estado = SUPRIMIDO`, `error = "daily limit: {count}/{max} for {to}"`.

Check query:
```sql
SELECT COUNT(*) FROM email_queue
WHERE "to" = $1
  AND tipo = $2
  AND estado = 'ENVIADO'
  AND "sentAt" >= CURRENT_DATE
```

## Flush Logic (flushEmailQueue)

Runs every 5 minutes via `setInterval`. Cluster-safe via `FOR UPDATE SKIP LOCKED`.

### Step 1: Retry failed transactional emails

```sql
SELECT * FROM email_queue
WHERE estado = 'FALLIDO'
  AND intentos < "maxIntentos"
  AND (nextRetryAt IS NULL OR nextRetryAt <= NOW())
ORDER BY prioridad ASC, createdAt ASC
LIMIT 20
FOR UPDATE SKIP LOCKED
```

For each: attempt send. Success -> ENVIADO + sentAt. Failure -> intentos++, nextRetryAt = now + (intentos * 5min).

### Step 2: Digest alert emails

```sql
SELECT DISTINCT "digestKey" FROM email_queue
WHERE estado = 'DIGEST_PENDIENTE'
  AND "digestKey" IS NOT NULL
```

For each digestKey:
1. Fetch all rows with that digestKey (`FOR UPDATE SKIP LOCKED`)
2. Extract `to` from digestKey
3. Check daily rate limit for ALERTA to that recipient
4. If within limit: render digest HTML, send 1 email
5. Success: mark all rows ENVIADO, set sentAt
6. Failure: mark all rows FALLIDO, intentos++
7. If rate exceeded: mark all rows SUPRIMIDO

### Step 3: Expire stuck failures

```sql
UPDATE email_queue
SET estado = 'SUPRIMIDO', error = 'max retries exceeded'
WHERE estado = 'FALLIDO' AND intentos >= "maxIntentos"
```

## Digest Email Template

Subject: `[SITREP] Resumen de alertas — {DD Mon YYYY HH}:00`

```html
<h3>Resumen de alertas</h3>
<p>{count} alertas entre las {HH}:00 y {HH}:59:</p>
<ul>
  <li><b>MAN-2026-0042</b>: Estado cambio a EN_TRANSITO</li>
  <li><b>MAN-2026-0043</b>: Incidente reportado (averia)</li>
  <li><b>MAN-2026-0041</b>: Tiempo excesivo (52 horas)</li>
</ul>
<p style="font-size:12px;color:#6b7280">
  Para configurar tus preferencias de notificacion, ingresa a SITREP.
</p>
```

Uses the existing `baseTemplate()` wrapper.

## Admin Endpoint

`GET /api/admin/email-queue`

Query params:
- `estado`: filter by EmailEstado
- `to`: filter by recipient (partial match)
- `fechaDesde`, `fechaHasta`: date range on createdAt
- `page`, `limit`: pagination (default limit=20, max=100)

Response:
```json
{
  "data": [...],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

Auth: ADMIN only.

## Cluster Safety

PM2 runs 2 instances. Both run `setInterval(flushEmailQueue, 5min)` independently.

`FOR UPDATE SKIP LOCKED` in PostgreSQL ensures:
- If instance 1 locks row X, instance 2 skips it
- No duplicate sends, no coordination needed
- If one instance is restarting, the other handles the queue

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| DISABLE_EMAILS | false | Kill switch — suppresses all sends, still queues to DB |
| EMAIL_DAILY_LIMIT_TRANSACCIONAL | 10 | Max transactional emails/day/recipient |
| EMAIL_DAILY_LIMIT_ALERTA | 6 | Max digest emails/day/recipient |
| EMAIL_FLUSH_INTERVAL_MS | 300000 | Flush interval (5 min default) |
| EMAIL_MAX_RETRIES | 3 | Max send attempts before SUPRIMIDO |

## Migration Path to Brevo (Future)

When ready to switch from Postfix to Brevo (free tier: 300 emails/day):

1. Sign up at brevo.com, get API key
2. Add to server `.env`:
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=xkeysib-your-api-key-here
   ```
3. `pm2 restart sitrep-backend`
4. Verify: check `email_queue` for estado=ENVIADO after next flush
5. Optional: set `EMAIL_DAILY_LIMIT_TRANSACCIONAL=20` and `EMAIL_DAILY_LIMIT_ALERTA=10` since Brevo has higher deliverability

**No code changes required.** The nodemailer transporter picks up SMTP_HOST/SMTP_USER automatically. The queue, digest, and rate limiting logic remains unchanged.

## Data Retention

Emails in ENVIADO or SUPRIMIDO estado accumulate. Cleanup policy:
- ENVIADO older than 30 days: delete (cron or manual)
- SUPRIMIDO: keep indefinitely for audit (small volume)

Optional: add to the existing backup cron, or add a `cleanupEmailQueue()` that runs daily.

## Files Changed

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add EmailQueue model + 3 enums |
| `backend/src/services/email.service.ts` | Rewrite: queue insertion, immediate send for transactional, flushEmailQueue, digest rendering, rate limiting |
| `backend/src/index.ts` | Add setInterval for flushEmailQueue |
| `backend/src/controllers/admin.controller.ts` | Add getEmailQueue endpoint |
| `backend/src/routes/admin.routes.ts` | Add GET /email-queue route |
| `backend/.env.production` | Document new env vars |
