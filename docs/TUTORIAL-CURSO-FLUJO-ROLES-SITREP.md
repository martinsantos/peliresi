# Tutorial de capacitación: flujo de manifiestos por rol

> **Actualización 16/09/2026.** Las instrucciones que mencionan manifiestos `CAP-*` son históricas y no deben ejecutarse: el padrón vigente no contiene esos fixtures. Sustituirlas por “filtrar un manifiesto existente en el estado indicado”, mantener el recorrido en lectura y seguir la [sección de capacitación del manual](https://sitrep.ultimamilla.com.ar/manual/#capacitacion).

## Alcance

Este tutorial valida el flujo operativo en SITREP con tres responsables reales:

| Responsable | Cuenta | Alcance operativo |
|---|---|---|
| Ivana | `ipintos@mendoza.gov.ar` | Administradora de generadores (`ADMIN_GENERADOR`) |
| Santiago Bracellis | `sbracelis@gmail.com` | `ADMIN` raíz + alcance funcional de transporte |
| Marcia | `mardengo@mendoza.gov.ar` | Administradora de operadores (`ADMIN_OPERADOR`) |

No se deben compartir contraseñas en este documento. El correo no se envía durante la prueba controlada.

## URLs completas

### Portal web

- Inicio: https://sitrep.ultimamilla.com.ar/
- Login: https://sitrep.ultimamilla.com.ar/login
- Dashboard: https://sitrep.ultimamilla.com.ar/dashboard
- Manifiestos: https://sitrep.ultimamilla.com.ar/manifiestos
- Centro de control: https://sitrep.ultimamilla.com.ar/centro-control
- Alertas: https://sitrep.ultimamilla.com.ar/alertas
- Notificaciones: https://sitrep.ultimamilla.com.ar/notificaciones
- Actores: https://sitrep.ultimamilla.com.ar/actores
- Administración de usuarios (Santiago): https://sitrep.ultimamilla.com.ar/admin/usuarios
- Manual publicado: https://sitrep.ultimamilla.com.ar/manual/

### Aplicación móvil/PWA

- Inicio de la app: https://sitrep.ultimamilla.com.ar/app/
- Login de la app: https://sitrep.ultimamilla.com.ar/app/login
- Dashboard móvil: https://sitrep.ultimamilla.com.ar/app/dashboard
- Manifiestos: https://sitrep.ultimamilla.com.ar/app/manifiestos
- Centro de control: https://sitrep.ultimamilla.com.ar/app/centro-control
- Perfil de transporte: https://sitrep.ultimamilla.com.ar/app/transporte/perfil
- Alertas: https://sitrep.ultimamilla.com.ar/app/alertas
- Ayuda: https://sitrep.ultimamilla.com.ar/app/ayuda

### API y salud

- Salud: https://sitrep.ultimamilla.com.ar/api/health
- Perfil autenticado: https://sitrep.ultimamilla.com.ar/api/auth/profile
- Dashboard: https://sitrep.ultimamilla.com.ar/api/manifiestos/dashboard
- Lista de manifiestos: https://sitrep.ultimamilla.com.ar/api/manifiestos
- Centro de control: https://sitrep.ultimamilla.com.ar/api/centro-control/actividad
- Verificación pública: https://sitrep.ultimamilla.com.ar/api/manifiestos/verificar/{numero}

## Secuencia de la demostración

### 1. Ivana — generadores

1. Ingresar por https://sitrep.ultimamilla.com.ar/login.
2. Abrir https://sitrep.ultimamilla.com.ar/manifiestos/nuevo.
3. Crear o seleccionar un manifiesto de capacitación `CAP-*`.
4. Completar generador, transportista, operador y residuo.
5. Guardar en `BORRADOR` y luego usar **Firmar/Aprobar**.
6. Comprobar que el estado queda `APROBADO` en el detalle y en el dashboard.

### 2. Santiago Bracellis — transporte

1. Ingresar con la cuenta de Santiago o iniciar una sesión de impersonación desde https://sitrep.ultimamilla.com.ar/admin/usuarios.
2. Abrir https://sitrep.ultimamilla.com.ar/manifiestos.
3. Abrir el manifiesto `CAP-*` en estado `APROBADO`.
4. Ejecutar **Confirmar retiro**; debe pasar a `EN_TRANSITO`.
5. Verificar https://sitrep.ultimamilla.com.ar/centro-control y el viaje activo.
6. En la PWA, abrir https://sitrep.ultimamilla.com.ar/app/transporte/perfil y comprobar el mismo viaje.
7. Finalizar con **Confirmar entrega**; debe pasar a `ENTREGADO`.

### 3. Marcia — operadores

1. Ingresar por https://sitrep.ultimamilla.com.ar/login.
2. Abrir el manifiesto `CAP-*` en estado `ENTREGADO`.
3. Ejecutar **Confirmar recepción**; debe pasar a `RECIBIDO`.
4. Registrar pesaje si el caso lo requiere.
5. Ejecutar **Registrar tratamiento** y luego **Cerrar manifiesto**.
6. Confirmar estado final `TRATADO` y descargar el certificado desde el detalle.

## Prueba segura sin correo

El smoke E2E incluido en el repositorio es no mutante:

```bash
SITREP_BASE_URL=https://sitrep.ultimamilla.com.ar \
SITREP_ADMIN_EMAIL='correo-del-admin-raiz' \
SITREP_ADMIN_PASSWORD='secreto-no-compartido' \
npx ts-node --transpile-only backend/tests/sector-admin-flow-smoke.ts
```

El script usa las tres cuentas reales mediante impersonación, verifica perfil, dashboard, manifiestos, alertas, notificaciones, centro de control y catálogos, y prueba una acción contra un manifiesto `CANCELADO`. Espera `400` por estado inválido: la autorización se evalúa, pero no se cambia ningún manifiesto.

Antes de ejecutar cualquier transición real del curso, el responsable técnico debe confirmar:

1. que el manifiesto seleccionado es exclusivamente `CAP-*`;
2. que existe una copia o registro de reversión aprobado;
3. que el envío SMTP está desactivado o aislado;
4. que se observarán las colas `email_queue`, notificaciones y auditoría antes y después.

## Criterios de aprobación

- Ivana puede crear y aprobar.
- Santiago puede retirar, visualizar tracking y entregar.
- Marcia puede recibir, tratar y cerrar.
- Cada perfil ve el dashboard y los manifiestos permitidos.
- Los administradores sectoriales no acceden a administración global de usuarios.
- No aparecen nuevas filas de correo, push o avisos no previstos.
- La misma secuencia se visualiza en web y en `/app`.

## Nota sobre Santiago

El modelo actual almacena un único `rol` primario. Santiago permanece como `ADMIN` raíz y recibe el alcance funcional de transporte mediante autorización; no debe cambiarse a `ADMIN_TRANSPORTISTA`, porque eso eliminaría sus privilegios de superadmin.
