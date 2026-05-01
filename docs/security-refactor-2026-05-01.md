# Security refactor SITREP - 2026-05-01

## Objetivo

Cerrar accesos directos no autorizados a manifiestos sin afectar el modo demo ni la productividad operativa del ambiente de test.

## Alcance implementado

- Control centralizado de acceso por pertenencia de actor en `backend/src/utils/roleFilter.ts`.
- Respuesta `404 Manifiesto no encontrado` para manifiestos ajenos.
- Proteccion de:
  - detalle de manifiesto
  - PDF y certificado
  - estado y registro blockchain
  - viaje actual y GPS
  - update/delete
  - acciones de workflow
- Modo demo preservado mediante `PUBLIC_DEMO_MODE=true`.
- `docs.json` y catalogos enrichment quedan publicos solo en modo demo; fuera de demo requieren autenticacion.
- Se mantuvo la red blockchain actual.
- No se rotaron credenciales.

## Validacion

Comandos ejecutados en el repo fuente:

```bash
cd backend
npm run build
npm test
```

Resultado:

- Build TypeScript: OK.
- Tests: 6 archivos, 65 tests OK.

Tambien se valido previamente el hotfix desplegado en test con matriz de roles:

- Propietarios `GENERADOR`, `TRANSPORTISTA` y `OPERADOR`: acceso `200` al detalle propio.
- No propietarios: `404` en detalle, PDF, blockchain, viaje actual y acciones mutativas probadas.
- Modo demo: `/api/docs.json` y enrichment publicos con `PUBLIC_DEMO_MODE=true`.

## Pendientes

- Revisar el alcance amplio temporal de `ADMIN_GENERADOR`, `ADMIN_TRANSPORTISTA`, `ADMIN_OPERADOR` e inspectores.
- Corregir deuda existente de push notifications: `Push no configurado` genera `unhandledRejection`.
- Ejecutar regresion final en produccion/VPN con usuarios equivalentes a operadores gubernamentales.
