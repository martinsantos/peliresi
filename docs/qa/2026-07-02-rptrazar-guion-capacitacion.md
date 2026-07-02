# Guion capacitacion RP Trazar - Produccion Gobierno

Fecha: 2026-07-02
Ambiente: `https://rptrazar.mendoza.gov.ar` y `https://rptrazar.mendoza.gov.ar/app/`
Objetivo: ejecutar capacitacion y pruebas E2E controladas sin notificar usuarios finales ni mutar datos reales.

Manual online de apoyo: `https://rptrazar.mendoza.gov.ar/manual/`.

## Regla operativa

- Usar exclusivamente usuarios y manifiestos de capacitacion.
- No crear ni modificar actores reales.
- No ejecutar suites historicas destructivas contra produccion real.
- Mantener `DISABLE_EMAILS=true` durante capacitacion.
- Resetear el dataset CAP al finalizar cada bloque de practica.

## Usuarios de capacitacion

- Generador: `capacitacion.generador@rptrazar.mendoza.gov.ar`.
- Transportista: `capacitacion.transportista@rptrazar.mendoza.gov.ar`.
- Operador: `capacitacion.operador@rptrazar.mendoza.gov.ar`.

La clave debe compartirse por canal seguro. Operativamente queda administrada por el seed de capacitacion (`TRAINING_DEFAULT_PASSWORD`) y puede rotarse antes de una sesion.

## Dataset base

Todos los registros siguientes deben tener `isDemoData=true`:

- `CAP-20260702-0001` - BORRADOR.
- `CAP-20260702-0002` - APROBADO.
- `CAP-20260702-0003` - EN_TRANSITO.
- `CAP-20260702-0004` - ENTREGADO.
- `CAP-20260702-0005` - RECIBIDO.
- `CAP-20260702-0006` - EN_TRATAMIENTO.
- `CAP-20260702-0007` - TRATADO.
- `CAP-20260702-0008` - RECHAZADO.
- `CAP-20260702-0009` - CANCELADO.

Actores escuela:

- Generador: `CAPACITACION RP - Generador Escuela`.
- Transportista: `CAPACITACION RP - Transporte Escuela`.
- Operador: `CAPACITACION RP - Operador Escuela`.
- Residuo: `Y-CAP-01`.

## Recorrido recomendado

1. Admin valida tablero, centro de control, reportes y busqueda con filtro `CAP-20260702`.
2. Instructor abre el manual online en la seccion `17. Capacitacion y QA Controlada`.
3. Generador ingresa a `/app/`, revisa sus manifiestos y firma `CAP-20260702-0001` solo dentro de una practica guiada.
4. Transportista toma el manifiesto aprobado, confirma retiro, revisa viaje activo, envia ubicacion/GPS e incidente simulado.
5. Transportista confirma entrega.
6. Operador confirma recepcion, registra tratamiento y cierra el manifiesto.
7. Admin descarga PDF de manifiesto y certificado.
8. Admin verifica que no aparezcan notificaciones o emails CAP.
9. Operador puede practicar rechazo usando `CAP-20260702-0004`, seguido siempre por reset.

Para mostrar estados sin mutar datos, usar directamente los manifiestos base `0002` a `0009`.

## Comandos permitidos

Perfil seguro idempotente:

```bash
RUN_PROFILE=produccion-seguro \
TARGET_URL=https://rptrazar.mendoza.gov.ar \
API_URL=https://rptrazar.mendoza.gov.ar/api \
bash scripts/certification/run-certification-suite.sh produccion-seguro
```

Smoke productivo con auth y cooldown:

```bash
RUN_PROFILE=production-smoke \
TARGET_URL=https://rptrazar.mendoza.gov.ar \
API_URL=https://rptrazar.mendoza.gov.ar/api \
NETWORK_TIMEOUT=12 \
NETWORK_RETRIES=1 \
CERT_AUTH_COOLDOWN_SECONDS=65 \
bash scripts/certification/run-certification-suite.sh production-smoke
```

E2E controlado demo-only:

```bash
RUN_PROFILE=produccion-capacitacion \
TARGET_URL=https://rptrazar.mendoza.gov.ar \
API_URL=https://rptrazar.mendoza.gov.ar/api \
ALLOW_PRODUCTION_TRAINING_E2E=true \
CERT_AUTH_COOLDOWN_SECONDS=65 \
PRODUCTION_TRAINING_RESET_COMMAND="ssh -i ~/.ssh/ambiente.pem ubuntu@192.168.205.197 'cd /home/ubuntu/sitrep-backend && node -r dotenv/config prisma/seed-production-training.js'" \
bash scripts/certification/run-certification-suite.sh produccion-capacitacion
```

Reset manual del dataset:

```bash
ssh -i ~/.ssh/ambiente.pem ubuntu@192.168.205.197 \
  "cd /home/ubuntu/sitrep-backend && node -r dotenv/config prisma/seed-production-training.js"
```

Verificacion SQL post-sesion:

```bash
ssh -i ~/.ssh/ambiente.pem ubuntu@192.168.205.197 \
  "sudo -u postgres psql -d sitrep_prod -F '|' -Atc \"SELECT numero, estado, \\\"isDemoData\\\" FROM manifiestos WHERE numero LIKE 'CAP-20260702-%' ORDER BY numero; SELECT 'email_cap_rows', count(*) FROM email_queue WHERE subject LIKE '%CAP-20260702%'; SELECT 'notificaciones_cap_rows', count(*) FROM notificaciones n JOIN manifiestos m ON m.id=n.\\\"manifiestoId\\\" WHERE m.numero LIKE 'CAP-20260702-%';\""
```

## Prohibido en produccion real

- `certification`.
- `workflow-e2e`.
- `data-integrity`.
- `stress`.
- `frontend/e2e/pwa-load.spec.ts`.
- Cualquier prueba que cree, apruebe, transporte, reciba, trate, rechace, cancele, borre o edite registros fuera de `CAP-20260702`.

## Cierre de cada sesion

1. Ejecutar reset manual o `produccion-capacitacion` con `PRODUCTION_TRAINING_RESET_COMMAND`.
2. Confirmar estados base `CAP-20260702-0001` a `0009`.
3. Confirmar `email_cap_rows|0`.
4. Confirmar `notificaciones_cap_rows|0`.
5. Registrar reporte de test-run en el informe de QA.
