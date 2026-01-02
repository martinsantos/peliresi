# Configuración DNS para SITREP

## Proveedor DNS Actual
**Cloudflare** (NS: jeremy.ns.cloudflare.com, rita.ns.cloudflare.com)

---

## Pasos para Configurar en Cloudflare

### 1. Acceder al Panel
1. Ir a https://dash.cloudflare.com
2. Seleccionar dominio `ultimamilla.com.ar`
3. Ir a **DNS** → **Records**

### 2. Agregar Registro A
```
Type: A
Name: sitrep
IPv4 address: 23.105.176.45
Proxy status: DNS only (gris) ← IMPORTANTE para SSL correcto
TTL: Auto
```

### 3. Verificar Propagación
```bash
# Esperar 5-10 minutos y verificar
dig +short sitrep.ultimamilla.com.ar

# Debería devolver:
# 23.105.176.45
```

---

## Después de Configurar DNS

### Generar Certificado SSL
```bash
ssh root@23.105.176.45
certbot certonly --nginx -d sitrep.ultimamilla.com.ar
```

### Actualizar Nginx
```bash
# Editar configuración para usar el nuevo certificado
nano /etc/nginx/sites-available/sitrep.ultimamilla.com.ar

# Cambiar:
# ssl_certificate /etc/letsencrypt/live/sitrep.ultimamilla.com.ar/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/sitrep.ultimamilla.com.ar/privkey.pem;

nginx -t && systemctl reload nginx
```

---

## Acceso Temporal (Sin DNS)

Mientras tanto, puedes probar el sistema editando el archivo hosts local:

### macOS/Linux
```bash
sudo nano /etc/hosts
# Agregar:
23.105.176.45 sitrep.ultimamilla.com.ar
```

### Windows
```
C:\Windows\System32\drivers\etc\hosts
# Agregar:
23.105.176.45 sitrep.ultimamilla.com.ar
```

### Luego probar:
```
https://sitrep.ultimamilla.com.ar
```

---

## URL de Prueba Directa (API)
```
curl http://23.105.176.45:3011/api/health
```

---

*Creado: 2026-01-02*
