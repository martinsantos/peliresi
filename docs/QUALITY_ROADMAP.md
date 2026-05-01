# SITREP Quality Roadmap

Fecha: 2026-05-01

## Estado actual

SITREP esta en estado MVP avanzado / beta operativa. Backend, frontend web, PWA y blockchain compilan y tienen suites automatizadas basicas. El foco de mejora debe estar en confiabilidad, cobertura de integracion, deuda frontend y operacion offline movil.

## Mejoras implementadas

- CI/CD ahora valida backend, frontend y blockchain antes de desplegar.
- Backend corre tests unitarios y build TypeScript en CI.
- Frontend corre lint, tests unitarios y build en CI.
- Blockchain compila contrato Hardhat en CI.
- Frontend lint queda habilitado como baseline gradual: deuda heredada visible como warnings, errores reales siguen bloqueando.
- Push notifications ya no generan error cuando VAPID no esta configurado; el endpoint reporta `enabled:false`.
- Se agregaron tests unitarios para push y para el guard de acceso a manifiestos.

## Backlog recomendado

1. Integracion API/DB
   - Crear una base PostgreSQL efimera para tests.
   - Cubrir auth, manifiestos, workflow, GPS, PDF, blockchain y permisos por rol.
   - Automatizar matriz propietario/no propietario para prevenir IDOR.

2. E2E estable
   - Reemplazar IDs reales en Playwright por datos seed controlados.
   - Separar smoke critico de crawls largos.
   - Ejecutar smoke Playwright manual, nightly o post-deploy.

3. Deuda frontend
   - Reducir warnings de lint por modulo tocado.
   - Extraer componentes grandes de paginas administrativas.
   - Reemplazar `any` en servicios y tipos de API.
   - Corregir warnings React Compiler antes de subir reglas a error.

4. PWA/offline
   - Endurecer IndexedDB y cola de sincronizacion.
   - Probar reconexion, conflictos y operaciones pendientes.
   - Mejorar indicador online/offline y estado de sync.
   - Cubrir flujo transportista: iniciar viaje, pausar, incidente, entrega.
   - Cubrir flujo operador: QR, recepcion, pesaje, rechazo y cierre.

5. Operacion
   - Agregar smoke post-deploy obligatorio.
   - Exponer version backend/frontend en health o panel admin.
   - Registrar denegaciones sensibles sin filtrar informacion al cliente.
   - Revisar alcance de sub-admins e inspectores.
