# 🟡 Track C: DevOps & Seguridad

## Contexto
Sistema de Trazabilidad de Residuos Peligrosos (SITREP) para DGFA Mendoza.
- **Servidor actual**: 23.105.176.45
- **Demo en**: /var/www/demoambiente/ y /home/demoambiente/
- **Producción en**: /var/www/trazabilidad-prod/ y /home/trazabilidad-prod/

---

## Tareas a Ejecutar

### C1: Configurar Nginx para Producción
Crear `/etc/nginx/sites-available/trazabilidad-prod`:
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ambiente.mendoza.gov.ar;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name ambiente.mendoza.gov.ar;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/ambiente.mendoza.gov.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ambiente.mendoza.gov.ar/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=3r/m;
    
    # Frontend (static files)
    location / {
        root /var/www/trazabilidad-prod;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout for long operations
        proxy_read_timeout 120s;
    }
    
    # Login rate limiting
    location /api/auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:3011;
    }
    
    # Health check (no auth)
    location /api/health {
        proxy_pass http://127.0.0.1:3011;
    }
}
```

```bash
# Habilitar sitio
ln -s /etc/nginx/sites-available/trazabilidad-prod /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### C2: Certificado SSL
```bash
# Opción 1: Let's Encrypt
certbot certonly --nginx -d ambiente.mendoza.gov.ar

# Opción 2: Certificado gubernamental (copiar archivos proporcionados)
# cp gobierno-cert.pem /etc/ssl/certs/
# cp gobierno-key.pem /etc/ssl/private/
```

### C3: Configurar PM2 para Producción
Crear `/home/trazabilidad-prod/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'trazabilidad-prod',
    script: './dist/index.js',
    cwd: '/home/trazabilidad-prod',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3011
    },
    error_file: '/var/log/pm2/trazabilidad-error.log',
    out_file: '/var/log/pm2/trazabilidad-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

```bash
# Iniciar
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### C4: Protección DDoS y Rate Limiting
Ya incluido en nginx config. Adicional:
```bash
# Instalar fail2ban
apt install fail2ban

# Crear jail para nginx
cat > /etc/fail2ban/jail.d/nginx-limit-req.conf << EOF
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https"]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
EOF

systemctl restart fail2ban
```

### C5: Auditoría de Seguridad
```bash
# Escaneo de dependencias
cd /home/trazabilidad-prod && npm audit --production

# Verificar permisos de archivos
find /var/www/trazabilidad-prod -type f -perm /o+w
find /home/trazabilidad-prod -type f -perm /o+w

# Verificar puertos expuestos
netstat -tlnp | grep LISTEN
```

Checklist de seguridad:
- [ ] No hay credenciales en código
- [ ] .env no está en git
- [ ] JWT secrets son únicos y fuertes
- [ ] CORS configurado correctamente
- [ ] Rate limiting activo
- [ ] Logs no exponen datos sensibles

### C6: Procedimientos de Recuperación
Crear `/home/trazabilidad-prod/scripts/RECOVERY.md`:
```markdown
# Procedimientos de Recuperación

## Backend caído
1. `pm2 restart trazabilidad-prod`
2. Si persiste: `pm2 logs trazabilidad-prod --lines 100`
3. Verificar DB: `docker exec directus-admin-database-1 pg_isready`

## Base de datos corrupta
1. `docker stop directus-admin-database-1`
2. Restaurar backup: `docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_prod < /backups/trazabilidad/backup_YYYYMMDD.sql`
3. `docker start directus-admin-database-1`
4. `pm2 restart trazabilidad-prod`

## Frontend con errores
1. `cd /var/www/trazabilidad-prod && ls -la`
2. Si vacío, re-deploy desde backup
3. Limpiar cache: `rm -rf /var/www/trazabilidad-prod/* && tar xzf /backups/frontend-latest.tar.gz`

## Rollback completo
1. Detener servicios: `pm2 stop trazabilidad-prod`
2. Restaurar DB del día anterior
3. Restaurar frontend del día anterior
4. `pm2 start trazabilidad-prod`
```

---

## Verificación
```bash
# Test SSL
curl -I https://ambiente.mendoza.gov.ar

# Test headers de seguridad
curl -I https://ambiente.mendoza.gov.ar | grep -E "(X-Frame|X-Content|Strict)"

# Test rate limiting (debería fallar después de varios intentos)
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" https://ambiente.mendoza.gov.ar/api/health; done

# Test PM2
pm2 list
pm2 monit
```

---

## Archivos a Crear
- [ ] `/etc/nginx/sites-available/trazabilidad-prod`
- [ ] `/home/trazabilidad-prod/ecosystem.config.js`
- [ ] `/etc/fail2ban/jail.d/nginx-limit-req.conf`
- [ ] `/home/trazabilidad-prod/scripts/RECOVERY.md`
- [ ] `/home/trazabilidad-prod/scripts/deploy.sh`
