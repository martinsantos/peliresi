# Incidente RPTRAZAR — nodo productivo inaccesible tras reinicio

**Fecha del diagnóstico:** 2026-08-09 (America/Argentina/Mendoza)
**Dominio:** `https://rptrazar.mendoza.gov.ar/`
**VIP interno:** `192.168.204.228`
**Nodo productivo:** `192.168.205.197` (`sitrepprd1.mendoza.gov.ar`)
**Alcance:** diagnóstico read-only posterior al incidente. No contiene credenciales ni secretos.

## Resumen ejecutivo

RPTRAZAR continúa fuera de servicio. El VIP y la VPN responden, pero el balanceador devuelve HTTP 503 con el mensaje `No server is available to handle this request`. El nodo `192.168.205.197` no responde a ICMP ni a los puertos 22, 80, 443 o 3002. El gateway de red devuelve `Destination Host Unreachable` para ese destino, mientras hosts vecinos y el VIP sí son alcanzables.

La evidencia sitúa la falla en la VM, su arranque o su interfaz de red después del reinicio. No apunta primariamente a Prisma, la aplicación, las credenciales, DNS ni TLS. Antes del reinicio, backend, PostgreSQL, Nginx, health checks y pruebas de autenticación estaban operativos.

## Estado observado

| Componente | Resultado | Evidencia |
|---|---:|---|
| VPN | OK | interfaz `utun4`, cliente `172.30.64.4` |
| DNS interno | OK | `rptrazar` → `diclblan.mendoza.gov.ar` → `192.168.204.228` |
| VIP / balanceador | Disponible | acepta HTTPS y devuelve HTTP 503 |
| Nodo `.197` ICMP | FAIL | 100% pérdida; gateway `192.168.62.10` informa `Destination Host Unreachable` |
| Nodo `.197` SSH | FAIL | timeout; actualmente ni siquiera se completa TCP |
| Nodo `.197` HTTP/HTTPS/API | FAIL | 80, 443 y 3002 inaccesibles |
| Hosts vecinos | Disponibles | `.195`, `.196` y el VIP responden en TCP/22 |
| Espejo público | OK | `sitrep.ultimamilla.com.ar/api/health` devuelve 200 y DB conectada |

Esto descarta una caída general de la VPN o de la subred. La indisponibilidad está aislada al nodo productivo gubernamental.

## Últimas acciones realizadas antes de la caída

1. Se generaron respaldos de DB, configuración, frontend, PWA, backend y certificado.
2. Se desplegaron frontend, PWA y backend en el nodo gubernamental.
3. Prisma aplicó dos migraciones aditivas y reversibles en la práctica:
   - columna nullable `usuarios.passwordChangedAt`;
   - columna nullable `usuarios.emailVerificationExpires`.
4. Se verificó `prisma migrate status`: esquema actualizado.
5. El backend quedó activo en `127.0.0.1:3002`; Nginx proxy a loopback.
6. Se instaló hardening de systemd (`NoNewPrivileges`, `PrivateTmp`, `ProtectHome=read-only`, `ProtectSystem=full`).
7. Se corrigieron permisos estáticos de `/var/www/sitrep`; web y E2E volvieron a responder.
8. Se habilitó UFW con política de entrada restrictiva y allowlists para VPN, VIP/subred interna y SSH.
9. Se reemplazó el certificado del origen por uno self-signed con SAN correctos. El certificado público del VIP no cambió.
10. Antes del reinicio: servicios activos, health local/remoto OK, API de demo/impersonación 14/14 y E2E web 2/2.
11. Se ejecutó un reinicio para activar kernel/libc pendientes. Desde ese reinicio, el nodo no volvió a estar saludable.

Respaldos disponibles en el nodo, cuando sea recuperado:

- `/var/backups/sitrep/predeploy-20260808-183320-db.dump.gz`
- `/var/backups/sitrep/predeploy-20260808-183320-configs.tar.gz`
- `/var/backups/sitrep/predeploy-20260808-183444-web.tar.gz`
- `/var/backups/sitrep/predeploy-20260808-183444-app.tar.gz`
- `/var/backups/sitrep/predeploy-20260808-183444-backend-code.tar.gz`
- `/var/backups/sitrep/predeploy-20260808-183444-origin.crt`
- `/var/backups/sitrep/predeploy-20260808-183444-origin.key`

## Hipótesis ordenadas

### 1. Falla de boot/kernel o VM detenida — probabilidad alta

El nodo funcionaba antes del reboot y dejó de responder inmediatamente después. Había varios kernels pendientes; estaba ejecutando `7.0.0-14-generic` y existían paquetes más recientes hasta `7.0.0-29`. Una falla del kernel nuevo, GRUB, initramfs, filesystem o la VM apagada explica simultáneamente la falta de ICMP, SSH, Nginx y API.

### 2. Interfaz virtual o red del guest no levantó — probabilidad alta/media

El gateway informa `Destination Host Unreachable` específicamente para `.197`, mientras vecinos responden. Verificar estado de vNIC, bridge/VLAN, netplan/cloud-init y la presencia de la IP `192.168.205.197` dentro del guest.

### 3. UFW persistente bloqueando health/administración — probabilidad media para el 503, baja para toda la evidencia

UFW fue habilitado antes del reinicio. Un origen real del health check no incluido en la allowlist puede provocar 503. Sin embargo, la IP VPN actual `172.30.64.4` pertenece al rango permitido `172.30.64.0/24`, y un bloqueo de aplicación no explica por sí solo el `Destination Host Unreachable`. Revisar igualmente las reglas y el origen efectivo del HAProxy.

### 4. Servicios systemd no iniciados — probabilidad media/baja como causa parcial

Una dependencia fallida de PostgreSQL o el hardening podría impedir `sitrep-backend`, pero no explica que también falten SSH, Nginx, ICMP y conectividad básica. Revisar después de recuperar boot/red.

### Poco compatibles con la caída total

- Las migraciones sólo agregan columnas nullable: podrían afectar al backend, no a SSH/red/Nginx.
- El certificado del origen podría afectar TLS interno, no SSH, ICMP ni HTTP directo.
- `HOST=127.0.0.1` es correcto detrás de Nginx y estaba funcionando antes del reboot.
- Las credenciales demo no intervienen en el arranque del sistema.

## Procedimiento solicitado al sysadmin

### A. Desde hipervisor o consola de VM

1. Confirmar que la VM esté encendida y que la vNIC esté conectada a la VLAN correcta.
2. Observar consola de arranque: GRUB, kernel panic, initramfs, filesystem check o emergency mode.
3. Si el kernel nuevo falla, arrancar una vez con `7.0.0-14-generic` desde **Advanced options for Ubuntu**.
4. No restaurar la base de datos inicialmente: no hay evidencia de corrupción de datos.

### B. Una vez obtenida una shell

Ejecutar y conservar salida:

```bash
uname -a
uptime
systemctl --failed --no-pager
journalctl -b -p err..alert --no-pager
journalctl -b -1 -p warning..alert --no-pager
ip -br address
ip route
networkctl status --no-pager
ss -ltnp
systemctl status ssh nginx postgresql sitrep-backend --no-pager
ufw status verbose
```

Comprobar la cadena local:

```bash
curl -v --max-time 5 http://127.0.0.1:3002/api/health
curl -v --max-time 5 http://127.0.0.1/api/health
nginx -t
journalctl -u sitrep-backend -n 200 --no-pager
journalctl -u nginx -n 100 --no-pager
```

### C. Recuperación mínima sugerida

1. Recuperar primero red y SSH.
2. Confirmar el origen real del health check del balanceador y añadirlo a UFW si falta.
3. Iniciar en orden PostgreSQL, backend y Nginx, verificando cada health local antes del siguiente paso.
4. Si el backend falla por la unidad endurecida, inspeccionar el backup de configuración y revertir sólo la unidad systemd; no restaurar DB ni frontend sin evidencia.
5. Una vez que el health local sea 200, validar el VIP y recién después ejecutar E2E.

Si la consola confirma que el host está arriba pero UFW impide todo acceso, infraestructura puede deshabilitarlo temporalmente desde consola para recuperar SSH y reconstruir una allowlist basada en las IP reales observadas. Esta decisión debe hacerla el sysadmin con acceso fuera de banda.

## Criterio de cierre

- `192.168.205.197` alcanzable por SSH desde VPN.
- `ssh`, `postgresql`, `sitrep-backend`, `nginx` y `ufw` activos.
- Health local de backend = 200.
- Health vía Nginx local = 200.
- `https://rptrazar.mendoza.gov.ar/api/health` = 200.
- Después: unit backend/frontend, E2E ADMIN/OPERADOR, impersonación, web y PWA.
