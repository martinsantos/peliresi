# Especificación — Manifiesto eventual (17/10/2026, versión 2)

**Estado:** **aprobada por el dueño el 17/10/2026, tal cual, con C sí.** Implementada en commits locales y validada en el preview aislado (ver [Implementación](#implementación-17102026)).

No entra en la publicación a producción del lunes: queda detrás de `MANIFEST_EXCEPTIONAL_ENABLED` (cerrado por defecto) y se valida sólo en el preview aislado.

En pantalla se llama «Eventual»; internamente sigue siendo «baja intensidad» (rutas `/manifiestos/baja-intensidad`, tabla `registros_manifiesto_excepcional`). No se renombran rutas ni tablas.

## Regla pedida

Un eventual es un manifiesto en el que **al menos uno** de generador, transportista u operador **no está dado de alta** en SITREP.

Respuestas del dueño, textuales:

> **A.** «registra el operador o el transportista o un admin o un generador pueden iniciar el manifiesto, los que tienen usuario en SITREP deben aprobarlo para poder avanzar, sino los que estan por ej si un generador hace un MANIFIESTO EVENTUAL sin actores registrados en sitrep los define con lo que pueda y avanza y ese lo debe aprobar sólo él en este caso, etc.»
>
> **B.** «para quien lo creo y los que tengan usuario en SITREP»

## Hoy (código leído)

- Sólo `OPERADOR` crea: `createExceptional` responde 403 «El operador registra su propia operación».
- El formulario y el esquema sólo admiten generador y transportista externos; el operador sale siempre de la sesión.
- La tabla guarda `operadorId` obligatorio y toda la autoría cuelga de él: alcance, avance, seguimiento y conciliación.
- No existe una aprobación de las partes que frene el avance. Hoy la «revisión» del revisor designado es posterior y nunca frena hechos operativos.

## 1. Quién crea y con qué rol

| Rol en sesión | Puede crear | Su lugar en el eventual |
|---|---|---|
| `GENERADOR` con ficha vinculada | Sí | generador (sale de la sesión) |
| `TRANSPORTISTA` con ficha vinculada | Sí | transportista (sale de la sesión) |
| `OPERADOR` con ficha vinculada | Sí, como hoy | operador (sale de la sesión) |
| `ADMIN` sin suplantar | **Sí** | Ninguno. Carga los tres lugares, del padrón o externos |
| `ADMIN_GENERADOR/TRANSPORTISTA/OPERADOR`, sesión restringida, rol de parte sin ficha | No | — |

- **El lugar propio lo pone el servidor desde la sesión**, nunca el cuerpo del pedido. Si un generador manda el `padronId` de un generador ajeno, recibe 400. Nadie se atribuye una empresa ajena.
- Con empresa multirol (`ACTOR_MULTIROLE_ENABLED`) cuenta el rol activo de la sesión, como en el resto del sistema.
- Si un ADMIN crea, después no puede actuar como revisor designado de ese registro. Esa regla ya existe: el revisor tiene que ser distinto del autor.
- La suplantación se sigue registrando en `impersonadoPorId`.

## 2. Qué participante puede ser externo y con qué datos

- Cada lugar que no es el propio puede ser:
  - **de padrón:** se elige del buscador y se guarda una copia fija de razón social, CUIT y domicilio;
  - **externo:** se carga a mano.
- Regla de validez: de los tres lugares, **al menos uno tiene que estar sin `padronId`**. Si los tres tienen alta, se rechaza y se indica usar el manifiesto ordinario.
- Datos del externo: **ninguno es obligatorio**. Ya está decidido en `DECISIONES-MANIFIESTOS-V2-20261015.md §2`, y coincide con «los define con lo que pueda».
  - Se sugieren razón social, CUIT, nombre de fantasía, domicilio y teléfono.
  - Los faltantes aparecen como advertencia recuperable, no como error.
  - No se inventan CUIT, domicilios, cuentas ni firmas.
- No cambian los demás datos: patente, motivo obligatorio y de 1 a 50 residuos con corriente Y, cantidad y unidad.
- Buscador de padrón: se abre a quienes pueden crear y a los tres tipos. **No es exposición nueva:** `GET /api/actores/generadores`, `/transportistas` y `/operadores` ya listan para cualquier usuario autenticado. Se mantienen los límites de 20 resultados y 100 caracteres de búsqueda.

## 3. Aprobación para avanzar (respuesta A)

**Aprobadores requeridos.** Se fijan al crear el registro y se guardan en `datos.aprobaciones`; no cambian después:

- quien lo creó, como persona y en el rol con que lo creó;
- cada lugar de padrón cuya ficha tenga al menos un usuario activo en SITREP en ese momento. Un lugar externo, o una ficha sin usuario activo, no aprueba.

Ejemplos:

| Caso | Tiene que aprobar |
|---|---|
| Generador crea y los otros dos son externos | Sólo él |
| Generador crea; transportista externo; operador de padrón con usuario | Generador y operador |
| ADMIN crea; los tres son externos | Sólo el ADMIN |
| ADMIN crea; generador de padrón con usuario | ADMIN y generador |

**Cómo se aprueba:**

- Hay una acción nueva, **Aprobar** o **Rechazar**, sobre la declaración original. Se registra como evento agregado al final (`APROBAR_PARTE` / `RECHAZAR_PARTE`) con persona, empresa, rol representado, versión y fecha (`DECISIONES §1`).
- Crear el registro **no equivale** a aprobarlo: quien lo creó toca «Aprobar», aunque sea en el mismo momento.
- La aprueba un usuario de esa empresa con el rol que corresponde a su lugar, sin sesión suplantada. Un clic aprueba **un solo** lugar, aunque la empresa ocupe dos.

**Qué bloquea:**

- El **primer hecho (RETIRADO) se rechaza (409)** hasta que todos los aprobadores requeridos aprueben.
- Si alguno rechaza, el registro queda **rechazado por parte**: se conserva completo, como antecedente, y no avanza. Para continuar se crea otro eventual; no se edita ni se borra el rechazado.

**Después de aprobado:**

- Registran hechos (RETIRADO → RECIBIDO → TRATADO, diferencias y pedido de revisión) quien lo creó y los participantes con usuario de ese registro, siempre en orden.
- Cada hecho guarda autor y rol. Si dos partes escriben a la vez, `version` responde 409.
- Registrar un hecho **nunca** implica la aprobación del revisor.

**Revisión posterior: sin cambios.** El revisor designado (`MANIFEST_EXCEPTIONAL_REVIEWERS`, ADMIN, sin suplantar y distinto del autor), y la contraparte con `MANIFEST_PARTY_REVIEW_ENABLED`, siguen resolviendo el original y las diferencias como hoy. Son dos cosas distintas:

- la aprobación de partes habilita el avance;
- la revisión posterior no lo frena.

## 4. Autoría y conciliación

- `creadoPorId` sigue siendo la persona que lo creó.
- `autorRol` (nuevo): `GENERADOR`, `TRANSPORTISTA`, `OPERADOR` o `ADMIN`.
- `autorActorId` (nuevo): la ficha de esa parte. Queda `NULL` si quien crea es ADMIN.
- `operadorId` pasa a ser opcional:
  - tiene valor **sólo si el operador es de padrón**, lo haya cargado quien sea;
  - si el operador es externo, queda `NULL` y sus datos van en `datos.operador`.
- Con esto siguen funcionando el alcance del operador, el `LEFT JOIN operadores` del seguimiento («Operador no disponible» si es externo) y la revisión de la contraparte.
- **Conciliación** de externos:
  - el `rol` se amplía a `operador`, con candidatos buscados por CUIT en `operadores`;
  - **confirmar o desvincular sigue siendo exclusivo del revisor designado**;
  - no fusiona por nombre, no da permisos, no asigna número oficial y no notifica.

## 5. Permisos de lectura (respuesta B)

Ven un registro, su seguimiento de externos y su historial de conciliación (este último **sólo en lectura**):

| Quién | Ve |
|---|---|
| Revisor designado | Todos (sin cambio) |
| Quien lo creó | Los que creó (`creadoPorId = su usuario`). Incluye al ADMIN que creó, aunque no sea revisor |
| `OPERADOR` | `operadorId = su ficha` (sin cambio) |
| `GENERADOR` | `datos.generador.padronId = su ficha` (sin cambio) |
| `TRANSPORTISTA` | `datos.transportista.padronId = su ficha` (sin cambio) |
| ADMIN no revisor que no lo creó, otros | 403 (sin cambio) |

- **Cambia `externalTrackingScope`.** Hoy sólo deja pasar al operador y al revisor. Pasará a filtrar con la misma regla de la tabla: cada uno ve el seguimiento **de sus registros**, no el de todo el sistema.
- Un externo no tiene cuenta, así que no ve nada.

## 6. Migración del esquema (aditiva)

```sql
ALTER TABLE registros_manifiesto_excepcional ALTER COLUMN "operadorId" DROP NOT NULL;
ALTER TABLE registros_manifiesto_excepcional ADD COLUMN "autorRol" TEXT;
ALTER TABLE registros_manifiesto_excepcional ADD COLUMN "autorActorId" TEXT;
CREATE INDEX ... ON registros_manifiesto_excepcional ("creadoPorId", "createdAt");
```

- No hay `UPDATE` ni columnas borradas.
- No se reescriben `datos`, `eventos` ni `huellaSolicitud`.
- Aprobadores y aprobaciones se guardan en los JSON existentes (`datos`, `eventos`), así que no hace falta otra tabla.
- Para revertir, alcanza con dejar de usar las columnas nuevas. Volver a poner `NOT NULL` sólo es posible si no hay filas con operador externo.

## 7. Registros existentes

- Quedan intactos: misma referencia `BI-<id>`, y mismos datos, eventos, huella y etapa.
- Si `autorRol IS NULL`, el código lo lee como creado por el operador `operadorId`, que es lo que fueron. Las columnas nuevas no se completan en filas viejas.
- **La aprobación para avanzar no se aplica a los registros viejos.** No tienen `datos.aprobaciones` y siguen avanzando como hoy; bloquearlos ahora los dejaría trabados sin culpa de nadie.
- Además del operador, pueden registrar hechos los generadores y transportistas con usuario que figuren en ellos.
- No tienen `datos.operador`: la pantalla muestra el operador desde su ficha, como hoy.

## Fuera de alcance

- **Número oficial:** sigue en `null`. Una aprobación de parte en un eventual **no** es todavía el acto de `DECISIONES §3`, que exige que el generador cargue los datos del operador y apruebe. Conectarla con la numeración es trabajo aparte: rango, titular e idempotencia siguen sin definir.
- Recorridos con varias entregas y cierre documental V2.
- Cambiar rutas, tablas o el nombre interno «baja intensidad».

## Pruebas (rojo → verde, sin debilitar)

**Backend:**

- `manifiestoExcepcionalGuard.test.ts` y `manifiestoExcepcional.test.ts`.
  - Se conserva «OPERADOR crea».
  - El 403 a GENERADOR, TRANSPORTISTA y ADMIN se **reemplaza** por casos que crean.
  - Se **agregan** rechazos: `ADMIN_*`, rol de parte sin ficha, sesión restringida, `padronId` propio ajeno y tres lugares con alta.
- Aprobación:
  - aprobadores calculados según los ejemplos de §3;
  - RETIRADO devuelve 409 hasta la última aprobación;
  - un rechazo bloquea y conserva el registro;
  - un clic no aprueba dos lugares;
  - no se puede aprobar con sesión suplantada ni desde otra empresa;
  - reintentar es idempotente.
- Operador externo deja `operadorId NULL`, y el alcance por rol y para quien creó es el correcto.
- Un registro viejo sin `autorRol` sigue avanzando sin aprobación.
- Conciliación con rol `operador`. Seguimiento: quien creó ve lo suyo y no lo ajeno.

**Frontend:**

- `BajaIntensidadPage.test.tsx`: formulario según el rol (el ADMIN carga los tres lugares), operador externo, advertencias y botones Aprobar/Rechazar sólo para quien corresponde.
- `SeguimientoExterno.test.tsx`.

**Preview aislado:** según `CIERRE-PARCIAL-20261016.md` (1 CPU, 2 GiB, una corrida por vez). E2E de dos recorridos:

- el generador crea con los otros dos externos, aprueba solo y avanza;
- el generador crea con un operador con usuario, que aprueba antes de avanzar.

## Pendiente del dueño

**C — Mensaje de error del backend.** «Baja intensidad requiere al menos un participante sin alta» pasa a «Un eventual requiere al menos un participante sin alta». Ya figura en `HALLAZGOS-UIUX-20261016.md:183`. ¿Sí o no?

---

SUPOSICIONES:

1. «Un admin» es el rol `ADMIN` sin suplantar, no los `ADMIN_*` de sector.
2. «Los que tienen usuario en SITREP» son los lugares de padrón cuya ficha tiene al menos un usuario activo **al crear**. Se fija en ese momento para que nadie quede esperando a una cuenta inexistente.
3. Quien crea también aprueba con una acción explícita: crear no es aprobar.
4. Una vez aprobado, registran hechos quien creó y los participantes con usuario.
5. Un rechazo de parte conserva el registro bloqueado; se sigue con otro eventual.
6. Los registros viejos no exigen aprobación y no se modifican.
7. La revisión posterior del revisor designado no cambia.

→ Corregime o procedo. Para aprobar, responder por ejemplo: **«Especificación aprobada, C sí»**.

## Implementación (17/10/2026)

Commits locales en `codex/sitrep-uiux-review-20261016`, todos con `[skip ci]`. Sin push, merge ni deploy.

| Commit | Qué |
|---|---|
| `d00ed3b` | Dominio (`manifiestoExcepcional.ts`): quién crea, lugar propio desde la sesión, aprobadores, aprobación por lugar, bloqueo de hechos, registros viejos sin bloqueo |
| `4f097c3` | Migración aditiva `20261017140000_exceptional_any_party`, API, alcance de lectura, seguimiento y conciliación con rol `operador` |
| `c7d01d8` | Pantalla: formulario según el rol, tarjeta «Aprobación de las partes», botones Aprobar/Rechazar por lugar, seguimiento de operadores |
| `cc597f6` | Pruebas HTTP, de migración y E2E del preview |

**Decisiones de implementación** (dentro de la especificación):

- «Ficha con usuario activo» se toma de `usuario.activo` de la cuenta titular de la ficha (`usuarioId`). Los delegados de empresa no cuentan para decidir si se requiere aprobación.
- Las aprobaciones se guardan en `datos.aprobaciones` (aprobadores) y en `eventos` (`APROBAR_PARTE` / `RECHAZAR_PARTE` con `parte`, autor, versión y fecha). Rechazar exige nota; aprobar no.
- Los campos `generador`, `transportista` y `operador` del pedido son opcionales y no tienen valor por defecto, así que la huella de un pedido con la forma anterior no cambia.
- C aplicado: el mensaje dice «Un eventual requiere al menos un participante sin alta».
- En el seguimiento, el operador externo se muestra con el nombre declarado (si falta, «Operador no disponible»).

**Pruebas que cambian por la especificación** (no se borró ninguna negativa; cada cambio tiene una negativa equivalente):

| Antes | Ahora | § | Negativa que la reemplaza |
|---|---|---|---|
| ADMIN crea → 403 | ADMIN crea → 201 | 1 | `ADMIN_*` (jefe de sector) crea → 403; el ADMIN creador no puede revisar su propio registro |
| Generador con alta en un registro mixto: `puedeRegistrar` falso | Verdadero, y `puedeAprobar` = su lugar | 3 | Operador, transportista y generador ajenos → 404 |
| El operador avanza sin aprobación | RETIRADO → 409 hasta aprobar | 3 | Aprobación con sesión ajena → 403/404; segunda decisión → 409; rechazo bloquea |
| `datos` = pedido | `datos` = lo que se creó (suma `operador` y `aprobaciones`) y cada campo declarado igual al pedido | 6 | Inmutabilidad tras hechos, sin cambios |
| Seguimiento: generador y transportista → 403 | 200, sólo sus registros | 5 | Jefe de sector → 403; transportista no parte → 0; operador no ve al operador externo de otro |
| Conciliación: generador no parte → 403 | 404 | 5 | Sigue sin acceso; confirmar sigue exclusivo del revisor |
| Exportación: generador → 403 | Sólo encabezado (ningún registro propio) | 5 | Jefe de sector → 403 |
| Rol `operador` en seguimiento → 400 | Aceptado | 4 | Rol desconocido → 400 |
| E2E: el transportista vinculado no ve «Registrar retirado» | Lo ve deshabilitado y aprueba su lugar | 3 | Sigue sin «Aprobar post facto»; no puede aprobar como creador |
| Seed del seguimiento: registro del operador 2 creado por el usuario del operador 1 | Creado por el usuario del operador 2, como lo hace la API | 5 | Sin cambio en los totales esperados (21 y 1) |

**Evidencia hasta ahora:**

- **Backend:** en una copia temporal dentro del contenedor (`/tmp/evt`), sin tocar `/work/sitrep`, y sólo con el lock de QA libre.
  - Rojo: 15 fallidas / 15 aprobadas en 4 archivos.
  - Verde: 34/34 en 5 archivos (`manifiestoExcepcional`, `manifiestoExcepcionalGuard`, `seguimientoExterno`, `conciliacionExterna` y `partyReview`).
  - `prisma generate` con el esquema nuevo, en un `node_modules/.prisma` propio de la copia (el cliente compartido del preview quedó intacto), y `tsc -p tsconfig.build.json --noEmit` sin errores.
- **Frontend (Mac):**
  - rojo: 6 fallidas / 9 aprobadas;
  - verde: 25/25 en `BajaIntensidadPage`, `SeguimientoExterno` y `manifestListReleaseRecovery`;
  - `tsc -b` sin errores.
- **Preview aislado** (`sitrep-qa-live-20261017`: 1 CPU, 2 GiB, swap 0, red interna), con turno cedido por la sesión principal y una corrida a la vez. Fuente final `9b3b71c`; env `preview-evt-5e461d3.env`; artefactos en `/work/sitrep/.qa-evt-5e461d3`.
  - **`prisma generate` y build:** backend, web y app aprobados.
  - **Base nueva** (intento 4) **aprobada**, con la prueba de migración: `legacyExceptionalUnchanged: true`, `operadorId` admite NULL y la fila del contrato anterior queda igual salvo las dos columnas nuevas en NULL.
  - **HTTP 7/7 integraciones:** manifiestos, eventuales, adendas, multirol, seguimiento, conciliación y empresas. Además, `own-profile-push-http.ts` 4/4.
  - **E2E 45/45** en 11,2 min (escritorio 1440, web 360 y app 390): 0 omitidas, 0 inestables, sin reintentos. Incluye los 2 recorridos nuevos con el generador como autor.
  - **Pantallas UI/UX:** 20/20, más 1 omitida a propósito (como en corridas anteriores).
  - **Memoria:** `oom 0`, `oom_kill 0`. El contador acumulado `memory.events max` pasó de 3815 a 4935: el contenedor tocó el límite y se recuperó sin matar procesos. `memory.peak` es el de toda la vida del contenedor (2 GiB) y ya estaba en ese valor antes de esta corrida.
- **Fallas encontradas en el preview y corregidas, todas en las pruebas, no en el producto:**
  - **`534bee4`:** la prueba de migración releía con el mismo `SELECT *` y PostgreSQL rechazaba el plan cacheado («cached plan must not change result type»). Ahora relee con otra sentencia.
  - **`c55f44f`:** la prueba HTTP nueva usaba la variable `other` en vez de `outsider`.
  - **`9b3b71c`:** `party-multirole-integration` pedía revisión sobre un eventual nuevo sin aprobación de partes, y la regla aprobada lo bloquea (409). Se agregaron la aprobación de quien lo creó, la del transportista vinculado y la negativa 409 previa; la revisión de la contraparte se mantiene igual.
  - En cada caso la base se rehízo desde cero antes de repetir.
- **Preview vivo restaurado** con env `preview-live7.env` (base nueva, fuente `9b3b71c`) y las cuentas fáciles (`rol@sitrep.test`). Login y `/app` responden 200. **El preview vivo ahora muestra esta funcionalidad.**
