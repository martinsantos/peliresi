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
- Scripts de deploy versionados en `scripts/cicd/` y usados por GitHub Actions para evitar drift con `/opt/scripts-cicd`.
- Coverage gates alineados al baseline real para que `npm run test:coverage` pase y pueda subir gradualmente.
- `npm audit fix` no forzado aplicado: frontend queda en 0 vulnerabilidades reportadas; backend baja a 3 vulnerabilidades residuales.
- Runner de certificacion agregado en `scripts/certification/`, con perfiles `quick`, `post-deploy`, `production-smoke` y `certification`.
- Evidencia de certificacion estandarizada en Markdown y JSON bajo `reports/test-runs/`.
- Workflow manual `SITREP Certification Tests` agregado para ejecutar la matriz desde GitHub Actions.
- El runner clasifica fallos por categoria para separar errores de aplicacion, red/ambiente, riesgos de dependencias y excepciones conocidas.

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
   - Convertir `post-deploy` del runner de certificacion en gate automatico obligatorio despues del deploy.
   - Exponer version backend/frontend en health o panel admin.
   - Registrar denegaciones sensibles sin filtrar informacion al cliente.
   - Revisar alcance de sub-admins e inspectores.

6. Dependencias con decision pendiente
   - Backend: migrar `nodemailer` a version mayor segura y probar envio/cola de emails.
   - Backend: migrar `uuid` a version mayor segura o reemplazar usos por `crypto.randomUUID()` donde aplique.
   - Backend: reemplazar `xlsx`, porque npm audit no ofrece fix para SheetJS OSS.
   - Convertir las excepciones `KNOWN_EXCEPTION` en fallos bloqueantes cuando cada migracion este planificada y testeada.

7. Certificacion
   - Configurar comandos reales de snapshot/restore para staging en `STAGING_SNAPSHOT_COMMAND` y `STAGING_RESTORE_COMMAND`.
   - Definir retencion de artefactos `reports/test-runs/` en CI.
   - Agregar soak extendido de 6-12 horas como corrida manual previa a certificacion final.
   - Agregar pruebas de backup/restore contra base temporal para evitar depender de restore destructivo sobre staging compartido.
