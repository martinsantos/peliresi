# Checklist de aceptación física PWA — SITREP

Esta verificación se realiza en el espejo antes de habilitar el mismo cambio en el dominio gubernamental. No requiere modificar credenciales ni enviar correos.

## Preparación

- Usar un teléfono Android y un iPhone reales, con la PWA instalada desde `https://sitrep.ultimamilla.com.ar/app/`.
- Iniciar sesión con una cuenta de capacitación autorizada y un manifiesto QA o de capacitación asignado.
- Verificar que el navegador tenga permisos de cámara, ubicación y notificaciones. Desactivar el ahorro agresivo de batería sólo durante la prueba.

## Cámara y QR

1. Abrir `https://sitrep.ultimamilla.com.ar/app/escaner`.
2. Conceder el permiso de cámara y leer un QR de manifiesto válido.
3. Confirmar que muestra la verificación o el detalle correspondiente; repetir con un QR inválido y confirmar un error claro.
4. Cerrar y volver a abrir la PWA: el permiso no debe pedir credenciales de nuevo ni dejar la cámara encendida.

## GPS y segundo plano

1. Como transportista, abrir el viaje aprobado y confirmar el retiro.
2. Validar el estado de GPS activo y un punto visible en el centro de control.
3. Bloquear el teléfono durante al menos dos intervalos de actualización y luego desbloquearlo.
4. Confirmar que el viaje continúa activo, que no duplica incidentes y que recupera puntos pendientes al volver la conectividad.
5. Finalizar la entrega desde el flujo normal y comprobar que no hay más captura activa.

## Push con teléfono bloqueado

1. Con la PWA instalada, aceptar notificaciones y dejar el teléfono bloqueado.
2. Generar una alerta únicamente en QA o con una cuenta de capacitación.
3. Comprobar recepción, apertura de la notificación y navegación al destino correcto.
4. Repetir con notificaciones denegadas: la aplicación debe seguir operando y explicar cómo habilitarlas.

## Evidencia y criterio

Registrar para cada plataforma: modelo, SO, navegador/PWA, hora, resultado, captura y cualquier permiso denegado. La aceptación requiere los tres bloques aprobados en al menos un Android y un iPhone; una limitación de segundo plano documentada por el SO se clasifica como restricción de plataforma, no como aprobación.

## Recuperación operativa

El respaldo diario se verifica con integridad gzip y debe restaurarse en una base temporal aislada por un operador con acceso a PostgreSQL. Nunca se restaura sobre `trazabilidad_rrpp`. El script [qa-restore-drill.sh](../scripts/qa-restore-drill.sh) rechaza ese destino, exige un nombre temporal y elimina la base de verificación al terminar. Tras restaurar: comprobar esquema Prisma, conteos de tablas, login QA y una consulta de manifiestos.
