# Cuatro accesos directos para la capacitación del 19/10/2026

El dueño pidió cuatro accesos que puedan anotarse en una pizarra, sin ingresar con su administrador personal en cada teléfono. Se mantienen el aula artificial, los roles y las reglas del circuito. Las contraseñas se entregan al dueño por separado; no se publican en el manual ni se versionan.

## Entrada para los participantes

Abrir `https://sitrep.ultimamilla.com.ar/app/` (o la web raíz) y usar el acceso de su rol:

| Rol | Correo de ingreso | Cuenta del aula |
| --- | --- | --- |
| Administrador / C3 | admin@capacitacion.invalid | CAP · ADMIN 1 |
| Generador | generador@capacitacion.invalid | CAP · GENERADOR 1 |
| Transporte | transporte@capacitacion.invalid | CAP · TRANSPORTE 1 |
| Operador | operador@capacitacion.invalid | CAP · OPERADOR 1 |

La contraseña se distingue por mayúsculas. No son buzones de correo. Cada participante debe ver «Capacitación · sin validez oficial». No hay una sesión administradora personal guardada ni un botón para volver a ella. Al terminar, cada uno cierra su sesión.

Los cuatro accesos directos se habilitan con `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z`: hasta finalizar el lunes 19 en Mendoza. La falta de configuración, una fecha inválida o el vencimiento bloquean tanto el ingreso como las sesiones existentes y su renovación. Los accesos anteriores del instructor siguen disponibles con sus controles actuales.

## Machete del relevo

1. Generador: crear y firmar un manifiesto nuevo con Y-CAP, 10 kg, Transporte 1, CAP001, Chofer ficticio 1 y Operador 1. Avisar «Firmé» y compartir el número nuevo CAP-2026-….
2. Transporte: abrir ese número, confirmar retiro y permitir ubicación. Esperar «GPS activo» y «Sync» con hora. Avisar «Retiré» y dejar la pantalla de viaje abierta, desbloqueada y con Internet.
3. Administrador: Control → Hoy → Viajes Activos → el mismo número. Ver llegar la ubicación, realizar un desplazamiento corto y seguro del teléfono del transporte y esperar aproximadamente un minuto. Avisar «Lo veo en C3» sólo si llegó la ubicación del teléfono. El origen del viaje o un ejemplo preparado no prueban GPS.
4. Transporte: confirmar entrega y avisar «Entregué».
5. Operador: confirmar recepción, registrar 10 kg, tratamiento y cierre. Avisar «Recibí» y luego «Cerré».
6. Todos: comprobar el mismo número en estado Tratado. Para repetir, crear un caso nuevo.

Guía publicada: `/manual/tutorial.html?guide=capacitacion-cuatro-telefonos`. Eventuales y adendas conservan su guía de novedades y la revisión por la parte correspondiente, ahora también coordinada entre teléfonos.

## Aislamiento y cambios

- Sólo cuatro alias explícitos resuelven las cuatro identidades sintéticas existentes del equipo 1; no se crean usuarios operativos ni se cambian sus permisos.
- Login, contraseña y auditoría de esos alias se procesan en `sitrep_training`. Nunca se busca una identidad operativa como alternativa ante credenciales equivocadas.
- JWT firmado con realm escolar y marcador de acceso directo; sin `impersonatedBy` ni credenciales personales. El perfil y refresh conservan el ámbito; se comprueban actividad, identidad, rol y ventana temporal.
- Continúan los bloqueos de documentos oficiales, correos, push, jobs, creación de cuentas y cambio a otras identidades desde CAP. Los flags operativos permanecen apagados.
- Banda de capacitación visible también sin impersonación; se oculta el cambio de usuario dentro del aula. Manual actualizado manteniendo su diseño. SW raíz v119.
- Sólo se reemplazan los hashes de contraseña de las cuatro cuentas CAP. Sus IDs, correos internos, actores, permisos y casos anteriores se conservan. Antes se guardan y verifican las cuatro filas mínimas en un archivo privado.

## Evidencia y despliegue

En preparación. Este documento se completa con el SHA publicado, las pruebas finales y el rollback después de verificarlos. No equivale a certificación de GPS físico, segundo plano, Android ni concurrencia masiva.
