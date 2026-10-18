# SITREP — TLS saliente y DKIM exclusivo, 12/10/2026

## Resultado aplicado

Autorizaciones humanas separadas: reparar TLS/firma del servidor compartido con
respaldo y rollback; crear únicamente el TXT
`sitrep20261012._domainkey.ultimamilla.com.ar`, conservando el selector anterior.

- TLS saliente aplicado a las 09:25 UTC. `smtp_tls_security_level=may`, CA del
  sistema y logging nivel 1. Es TLS oportunista, no cifrado obligatorio para
  todos los destinos. Handshake STARTTLS con Gmail y cadena verificados sin
  `MAIL FROM`, `RCPT TO` ni `DATA`.
- TXT añadido en Cloudflare: RSA 2048, TTL Automático; registro número 32,
  antes 31. Clave privada generada y conservada exclusivamente en el servidor.
  Ambos servidores autoritativos y 1.1.1.1 devuelven la clave esperada.
  El TXT `default._domainkey` coincide exactamente con el valor anterior.
- DKIM conectado a las 09:42 UTC: servicio `sitrep-opendkim.service`, loopback
  8892, sólo `no-reply@ultimamilla.com.ar`. El OpenDKIM antiguo, puerto 8891,
  su configuración, claves y selectores no se modificaron ni conectaron.
- Postfix conserva `non_smtpd_milters` vacío y `milter_default_action=tempfail`.
  El nuevo firmador tiene exclusivamente `default_action=accept` y timeout de
  conexión 3 s: su caída no debe bloquear correo compartido. Eso también implica
  que una caída podría permitir correo sin firma; no es una garantía fail-closed.
- Sin cambios en master.cf, rutas por remitente ni overrides de otros servicios;
  `gestion-smtp` conserva su política `verify`.
- Final: Postfix y ambos OpenDKIM activos. Servicio nuevo habilitado, cero
  reinicios, 3 tareas, 2.445.312 bytes de memoria, límite 64 MiB.
- API pública `status=ok`, `db=connected`; dos workers SITREP online.
  `.env` idéntico por hash. `DISABLE_EMAILS=true`, push deshabilitado.
- **Cero mensajes enviados**, cero flush de cola, sin despliegue de producto,
  sin cambio del formulario ni sesión del usuario. Pestaña Cloudflare cerrada.

## Pruebas y límites

12/12 pruebas locales del orquestador (5 TLS + 7 DKIM), incluida restauración
ante fallos y rechazo de rollback sobre cambios posteriores de otro operador.
Sin dependencias nuevas, límite de heap local 128 MB.

Cuatro pruebas reales del protocolo milter directamente contra 127.0.0.1:8892,
sin pasar por SMTP, Postfix ni cola:

| Remitente / origen simulado | Resultado |
| --- | --- |
| no-reply@ultimamilla.com.ar / loopback | Firma generada; `opendkim-testmsg` verifica contra DNS |
| otro remitente de ultimamilla.com.ar / loopback | No firma |
| no-reply@example.invalid / loopback | No firma |
| no-reply@ultimamilla.com.ar / IP externa de documentación | No firma |

El primer intento r1 se detuvo antes de editar Postfix: `miltertest` instalado
aborta incluso con un script trivial. El rollback apagó sólo el servicio nuevo;
hash de main.cf intacto. No se reemplazó ni instaló ese binario. La alternativa
Node usa el protocolo documentado de libmilter y verificó la firma real.
Las pruebas offline iniciales de OpenDKIM ejecutadas como root rechazaron la
clave perteneciente a opendkim; no se relajaron permisos. El servicio corre como
opendkim y la prueba contra éste pasó.

`opendkim-testkey` informa `key OK` y `key not secure`: esta última advertencia
es de validación DNSSEC, no una discrepancia de claves. No se cambió DNSSEC.

No se ha entregado un correo después de esta reparación. No se certifican
Inbox, ausencia de Spam ni renderizado de CID/PNG en Gmail. Las muestras viejas
no cambian por reparar el servidor. El candidato de encabezado 20261012.3 sigue
sin publicar. El cliente SMTP automático de la aplicación continúa pendiente
según `MAIL-OPERACION-SEGURA.md`; **no habilitar avisos** por haber arreglado MTA.

## Evidencia y rollback

Herramientas en `ROOT/sitrep-cloud-qa-20261002/`:

- `repair-mail-outbound-tls.ts` / `.test.ts` / `repair-mail-outbound-tls-apply.json`
- `prepare-sitrep-dkim.ts`, `sitrep-dkim-public-record.json` (sólo clave pública)
- `connect-sitrep-dkim.ts` / `.test.ts` / `connect-sitrep-dkim-apply.json`
- `sitrep-milter-probe.ts` (protocolo directo, sin SMTP)

ROOT: `/Users/santosma/.codex/visualizations/2026/09/24/01a0d460-1c47-70f1-b7bf-4ea3463f0746`.
Captura: `ROOT/sitrep-correos-rotonda/dkim-cloudflare-20261012.jpg`.

Respaldos del servidor, conservados con directorio 700 y archivos 600:

1. `/opt/sitrep-backups/postfix-outbound-tls-20261012-r1`
2. `/opt/sitrep-backups/postfix-sitrep-dkim-20261012-r1` (intento abortado, sin conexión)
3. `/opt/sitrep-backups/postfix-sitrep-dkim-20261012-r2` (aplicado)

Desde la carpeta QA, primero revertir DKIM, y sólo después TLS si es necesario:

```sh
node --max-old-space-size=128 --experimental-strip-types connect-sitrep-dkim.ts rollback
node --max-old-space-size=128 --experimental-strip-types repair-mail-outbound-tls.ts rollback
```

No ejecutar ahora: queda como recuperación. Los scripts rechazan cambios
posteriores por hash. DKIM rollback restaura main.cf y apaga/deshabilita sólo el
firmador nuevo; conserva clave y TXT para no borrar evidencia ni rotar claves.
El TXT exclusivo puede mantenerse inerte si el firmador se desconecta.

Hashes main.cf: antes TLS `20de64d1a08ae67b9c2f9ada54cdcd56827f4119c96094bd7042d919633cec70`;
después TLS `4b23ca4720103e72c9e3105b071cd8d6bd831dfb271b3ab50ed76d5817e42c30`;
después DKIM `06da4543a1feb37da844cc52f4ca7b15dc1f5c5e36ae0ef25ad19bc286097075`.

Siguiente: autorizar un canario nuevo, limitado a santosma@gmail.com, revisar
Received/TLS, DKIM/SPF/DMARC y logos en el mensaje recibido. No reutilizar ni
reenviar el lote de diez muestras anterior. Mantener aparte validación de
cuentas de capacitación y publicación de recursos/plantilla candidata.
