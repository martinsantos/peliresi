# Capacitación — avisos, coordinación y certificaciones

## Pedido y alcance

El dueño probó operador, generador y transporte en teléfonos reales y encontró un circuito pasivo: debía buscar avisos, no distinguía aprobar de iniciar y encontraba descargas oficiales deshabilitadas junto a certificados escolares que volvían a pedir datos ya registrados. Autorizó corregir, probar y publicar en capacitación, sin main ni datos operativos.

Fuente única `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`. Cambios de flujo limitados a sesiones CAP autenticadas. Flags operativos, correos y push permanecen apagados. Sin migraciones, semillas, borrados, cambios de contraseñas ni workflows.

## Comportamiento nuevo

- **Avisos en vivo:** el aviso nuevo aparece sin abrir la bandeja, con enlace al manifiesto. Consulta cada cuatro segundos con la app visible. Queda hasta abrirlo o descartarlo; descartar no lo marca leído. Los avisos previos no suenan al ingresar. No se cambia de rol. Cada teléfono habilita sonido mediante «Activar sonido»; el navegador exige ese gesto. No promete entrega con pantalla bloqueada, app cerrada ni push externo. No reproduce alertas por los propios actos.
- **Pendientes actuales:** Inicio muestra «Tu próximo paso» con número íntegro y explicación de lo que falta. Es independiente del contador de avisos históricos. Consulta hasta cien casos recientes y muestra cinco inicialmente; el listado conserva el resto.
- **Aprobaciones:** tres columnas con iconos, confirmación y contador. Indica qué partes faltan y cuándo te toca actuar. Rechazar con motivo detiene la propuesta y no permite retirar.
- **Inicio:** después de las tres aprobaciones, cualquiera de las tres partes vinculadas puede pulsar «Iniciar coordinación». Se registra una sola vez y notifica a los demás. Empieza el reloj de coordinación. Generador prepara la carga y operador coordina la recepción. El manifiesto sigue Aprobado: sólo el transportista confirma el retiro físico, que inicia viaje/GPS. El administrador no suplanta a ninguna parte. Propuestas nuevas o previas con marcador de tres partes requieren este paso antes de retirar; los casos históricos sin marcador conservan su circuito.
- **Programados:** sección desplegable dentro de Manifiestos, con los mismos expedientes ordenados por fecha. No es otra clase de manifiesto ni exige duplicar un alta. El recorrido de cuatro partes probado utiliza destino fijo; no se cambian las reglas del circuito in situ.
- **Certificaciones:** títulos «Certificación parcial» y «Certificación final total», marca C3 en PDF, datos de las partes y método registrado incorporados. Observaciones opcionales; firma explícita del operador conservada. Parcial solicita la cantidad certificada; final precarga el total recibido e incluye parciales. El destinatario recibe aviso y descarga el documento del mismo caso. Se retiran los botones deshabilitados de documentos oficiales de la vista CAP.
- **Controles conservados:** no exceder peso recibido, no certificar antes del tratamiento, final sólo después de Tratado y adendas aprobadas; sin nuevas adendas tras final. Documentos claramente identificados como capacitación, sin validez oficial. Eventuales y adendas conservan sus rutas y revisiones independientes.

## Manual y hojas

Manual existente actualizado sin cambiar su diseño. Sigue teniendo siete pasos. Antes de empezar: cuatro cuentas, banda CAP, activar sonido y permitir GPS al transporte. Las dos hojas privadas mantienen QR, usuarios y contraseñas simples; no se incorporan claves a Git ni al manual público.

## Punto de partida conservado

Lectura previa con principal `sitrep_training_role`, esquema escolar, transacción de sólo lectura y permiso SELECT público denegado: 62 manifiestos CAP. El dueño ya había llevado `CAP-1-ENTREGADO` a Tratado; se conserva ese cambio. Las pruebas sólo crean/modifican sus casos nuevos y comparan contra esta instantánea, sin exigir ni restaurar estados históricos preparados.

Release anterior exacto: backend y web/app `20261018-circuito-930d3e6`. `.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`; vencimiento de accesos `2026-10-20T03:00:00Z`. UPLOADS_DIR y flags sin cambios. Rollback de la nueva publicación: volver ambos enlaces a ese release y recargar sólo backend conservando ese vencimiento; no restaurar base ni credenciales.

## Validación en curso

Primera suite backend: 1.117 pruebas pasaron; el archivo de propuestas no pudo importarse por una llave faltante en la consulta nueva de pendientes. Se corrigió el código y se repite completa, conservando la evidencia del fallo. No se publicó esa versión.

Los resultados finales de preview, build y dominio publicado se agregan al cierre. No equivalen a certificación de Android, sonido físico, GPS físico, segundo plano o concurrencia masiva.


## Resultados previos al ensayo de navegador

Backend completo repetido: 1.132/1.132 y build correcto. Frontend completo: 1.570/1.572; dos expectativas antiguas sobre versión del manual y botones oficiales deshabilitados se actualizaron al comportamiento solicitado. La primera repetición acotada detectó una carrera en la preparación del test nuevo de avisos: intentaba enviar la novedad antes de confirmar la carga inicial. Se sincronizó con la finalización observable de esa carga, manteniendo la expectativa de aparición del aviso. Repetición: 59/59, incluidos permisos/acciones, avisos, bandeja y manual. Manual estático: 16/16. No se presenta como una suite completa final de frontend.
