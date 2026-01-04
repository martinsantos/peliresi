# 🚨 Procedimientos de Recuperación - SITREP

## Contactos de Emergencia
- **Soporte**: soporte@ultimamilla.com.ar
- **Servidor**: 23.105.176.45

---

## 1. Backend Caído

### Síntomas
- API no responde
- Frontend muestra errores de conexión
- `curl https://sitrep.ultimamilla.com.ar/api/health` falla

### Solución
```bash
# 1. Verificar estado de PM2
ssh root@23.105.176.45
pm2 status

# 2. Revisar logs
pm2 logs sitrep-api --lines 100

# 3. Reiniciar servicio
pm2 restart sitrep-api

# 4. Si persiste, verificar memoria/CPU
htop
df -h

# 5. Reinicio completo
pm2 stop sitrep-api
pm2 delete sitrep-api
cd /home/sitrep.ultimamilla.com.ar
pm2 start ecosystem.config.js
pm2 save
```

---

## 2. Base de Datos Corrupta

### Síntomas
- Errores "connection refused" en logs
- API retorna 500 en todas las consultas
- Docker container de PostgreSQL no responde

### Solución
```bash
# 1. Verificar estado del contenedor
docker ps | grep postgres

# 2. Si está caído, reiniciar
docker start directus-admin-database-1

# 3. Verificar conexión
docker exec directus-admin-database-1 pg_isready

# 4. Restaurar desde backup (si corrupto)
# Listar backups disponibles
ls -la /backups/trazabilidad/

# Restaurar último backup
docker exec -i directus-admin-database-1 \
  psql -U directus -d trazabilidad_prod < /backups/trazabilidad/backup_YYYYMMDD.sql

# 5. Reiniciar backend
pm2 restart sitrep-api
```

---

## 3. Frontend con Errores

### Síntomas
- Página en blanco
- Errores 404 en assets
- Cache corrupto

### Solución
```bash
# 1. Verificar archivos
ls -la /var/www/sitrep-prod/

# 2. Verificar permisos
chown -R nginx:nginx /var/www/sitrep-prod/
chmod -R 755 /var/www/sitrep-prod/

# 3. Limpiar cache nginx
nginx -s reload

# 4. Si archivos faltan, re-deploy
# Desde máquina local:
cd trazabilidad-rrpp-demo/frontend
npm run build
scp -r dist/* root@23.105.176.45:/var/www/sitrep-prod/
```

---

## 4. Nginx No Responde

### Síntomas
- Sitio no carga
- Error "Connection refused" en puerto 80/443
- `systemctl status nginx` muestra errores

### Solución
```bash
# 1. Verificar config
nginx -t

# 2. Si hay errores de sintaxis, revisar
nano /etc/nginx/sites-enabled/sitrep.ultimamilla.com.ar

# 3. Reiniciar nginx
systemctl restart nginx

# 4. Verificar SSL
ls -la /etc/letsencrypt/live/ultimamilla.com.ar/

# 5. Renovar SSL si expirado
certbot renew --nginx
```

---

## 5. Rollback Completo

### Cuando Usar
- Deploy corrupto
- Cambios que rompen funcionalidad crítica
- Migración de datos fallida

### Procedimiento
```bash
# 1. Detener servicios
pm2 stop sitrep-api

# 2. Restaurar base de datos del día anterior
docker exec -i directus-admin-database-1 \
  psql -U directus -d trazabilidad_prod < /backups/trazabilidad/backup_$(date -d "yesterday" +%Y%m%d).sql

# 3. Restaurar frontend del backup
tar xzf /backups/frontend/sitrep-prod-$(date -d "yesterday" +%Y%m%d).tar.gz \
  -C /var/www/sitrep-prod/

# 4. Restaurar backend del backup (si necesario)
cd /home/sitrep.ultimamilla.com.ar
git checkout HEAD~1  # Volver al commit anterior

# 5. Reiniciar servicios
pm2 start sitrep-api
nginx -s reload

# 6. Verificar
curl -I https://sitrep.ultimamilla.com.ar/api/health
```

---

## 6. Verificación Post-Recuperación

```bash
# Health checks
curl -I https://sitrep.ultimamilla.com.ar/
curl https://sitrep.ultimamilla.com.ar/api/health

# Verificar servicios
pm2 status
docker ps

# Verificar logs por errores
pm2 logs sitrep-api --lines 50 | grep -i error
tail -50 /var/log/nginx/error.log
```

---

## Backups

### Ubicación
- **Base de datos**: `/backups/trazabilidad/backup_YYYYMMDD_HHMM.sql`
- **Frontend**: `/backups/frontend/sitrep-prod-YYYYMMDD.tar.gz`

### Cron de Backup (3:00 AM diario)
```
0 3 * * * /home/sitrep.ultimamilla.com.ar/scripts/backup.sh
```

---

**Última actualización**: 2026-01-03
