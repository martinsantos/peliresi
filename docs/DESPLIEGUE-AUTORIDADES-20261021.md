# Autoridades de adendas: publicación de 66a1c29e — 21/10/2026

**Backend, web, `/app` y manual `66a1c29e7d813b9338f791ace1a49ef46fb3b22f` publicados** en `sitrep.ultimamilla.com.ar` el **21/10/2026 15:45:25 Mendoza**, con autorización expresa del dueño. Publicación terminada y smoke no mutante aprobado. Main, datos de negocio y workflows sin cambios.

## Alcance y configuración

El release incorpora el soporte probado para las cuatro funciones de autoridad de adendas ordinarias: **Super Admin (ADMIN), administración de Generadores, Operadores y Transporte**. La cuenta debe estar activa y designada por ID. Se conservan las protecciones contra autoaprobación, suplantación y sesión restringida. El manual explica el circuito y las revisiones individuales. [Implementación, pruebas y límites](AUTORIDADES-ADENDAS-20261021.md).

**Todos los flags conservados**, como pidió el dueño en esta autorización. **Adendas, revisión de partes y eventuales siguen apagados**; la publicación incorpora el código pero no activa esos circuitos. Propuestas de tres partes, relevos y GPS múltiple siguen habilitados. Enterprise/multirrol/demo false. `MANIFEST_EXCEPTIONAL_REVIEWERS` sigue vacío: la asignación de cuentas permanece diferida por decisión del dueño, sin seleccionar, crear, activar o cambiar roles de usuarios.

`.env` idéntico byte a byte, SHA-256 **`97ef23d52f52f0f9b17ce26e467880670f264671c5a14acc8750feb94835d28f`**, comprobado en el release previo, el nuevo, ambos workers y PM2 guardado. `UPLOADS_DIR=/var/lib/sitrep-uploads` y enlace histórico conservados. **CAP cerrado** (`TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`); **correos y push apagados** (`DISABLE_EMAILS=true`, push de manifiestos false, VAPID vacío, SMTP sin contraseña). Sin logins, proveedores, documentos o registros reales durante la validación.

## Preparación y respaldo

Build nuevo de **2.350 blobs exactos** en preview, secuencial, **un worker / 1 CPU / 2 GiB / swap cero**. Backend, tipos efectivos, web y app PASS. API final **`https://sitrep.ultimamilla.com.ar/api`**, mismos flags en ambos bundles, fuentes contrastadas antes/después. Paquetes QA con `/api` no utilizados.

Sin cambios en Prisma, migraciones, dependencias o workflows respecto de **47ea8470**. **No se ejecutó migración ni dump nuevo de base**: se respaldaron y verificaron aplicación/configuración, sin operaciones de base. Cliente Prisma generado contra esquema canónico; **230 dependencias runtime** verificadas en copia independiente, sin instalaciones productivas ni modificar el cliente anterior.

Respaldo/auditoría privada: **`/var/backups/sitrep/20261021-autoridades-66a1c29e/`**, root 0700. `.env` y PM2 anteriores en 0600, hashes comprobados antes de activar; release anterior conservado e inventariado. Verificados **390 archivos backend / 513 web-manual / 200 app / 14 cliente Prisma** antes de activar.

Backend: `/var/www/sitrep-backend-releases/20261021-autoridades-66a1c29e`. Web/app/manual: `/var/www/sitrep-releases/20261021-autoridades-66a1c29e`. Enlaces activos y metadatos de release apuntan al SHA autorizado. Manual **2026.21.3** exacto del commit; renderer **2026.20.6**, CSS **2026.20.5** y directorio conservados.

SW raíz **v146**, app **20261021184131**, assets anteriores y activación explícita conservados. La fuente raíz sigue v127; sólo el artefacto recibe una versión de release, con hashes registrados. Las versiones preparadas v144/v145 no se reutilizaron.

## Validación

| Control no mutante | Resultado |
| --- | ---: |
| HTTPS en servidor: shells, chunks, manual, salud y barreras de autenticación | **132/132** |
| HTTPS externo y hashes publicados | **9/9** |
| PWA: shell, assets/MIME, 404, asociación y service worker | **8/8** |
| Entorno, uploads, PM2 y Nginx | **PASS** |

Cero logins, cargas, consultas de negocio o mutaciones de validación. Se recargó sólo `sitrep-backend`; ambos workers estables a las **21/10/2026 15:45:47 Mendoza**. Otras aplicaciones y configuración Nginx intactas. No son recorridos autenticados productivos ni certificación de Android/iOS físicos.

La validación funcional previa del mismo producto pasó **1451/1451 backend, 1796/1796 frontend, 18/18 E2E únicos**, HTTP **10 + 5 grupos**, autoridad ausente y flags off. **415 tablas previas intactas**, 146 avisos de correo simulados, cero cola/intentos/envíos. No se repitieron esas suites en esta publicación; después de ellas sólo cambió documentación. El despliegue recompiló y comprobó sus artefactos finales.

El primer control de inactividad del preview apuntó a un archivo inexistente y no inició el build. Se cargó y ejecutó el control correcto antes de compilar; ninguna modificación de producto o negocio. Builds y comprobaciones posteriores pasaron; advertencias Vite conocidas de tamaño de chunks/salida externa. `memory.events max/oom/oom_kill=0/0/0`.

Preview detenido **21/10/2026 15:42:23 Mendoza** antes de activar producción, `Running=false/Pid=0/OOMKilled=false`; salida 143 normal. Sin iniciar API/PostgreSQL/servidores web/túneles para esta publicación. Imagen, base artificial y evidencias preservadas.

## Reversión vigente, preparada sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261021-autoridades-66a1c29e/publish-production.js rollback'
```

Restaura **web/app/manual de 47ea8470**; mantiene **backend 66a1c29e**, protecciones de aprobaciones, esquema y todos los flags actuales. SW de reversión **v147**, app **20261021184435**; assets compatibles de ambas versiones. No restaura base, no borra evidencias, no cambia cuentas ni reabre CAP/canales. Preparada y verificada por hash, **no ejecutada**. No ejecutar reversiones anteriores que deshabilitan propuestas o degradan sus guardas.

[Resumen verificable](deployment-66a1c29e-20261021.json). Evidencia local ignorada `test-results-deploy-66a1c29e/`; preview `/opt/sitrep-qa-enterprise-20261016/source/.qa-release-66a1c29e-20261021/`. Único checkout autorizado; rama `codex/sitrep-training-20261018`. Main permanece `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Cierre documental `[skip ci]`, sin push ni workflows; no modifica el producto publicado.
