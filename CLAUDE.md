# SITREP - Sistema de Trazabilidad RRPP

## Production Server

- **Server IP**: 23.105.176.45
- **SSH**: `root@23.105.176.45`
- **Domain**: sitrep.ultimamilla.com.ar

## Production URLs

| Component | URL |
|-----------|-----|
| **Frontend** | https://sitrep.ultimamilla.com.ar/ |
| **PWA App** | https://sitrep.ultimamilla.com.ar/app/ |
| **API** | https://sitrep.ultimamilla.com.ar/api/ |
| **Health Check** | https://sitrep.ultimamilla.com.ar/api/health |

## Server Paths

| Component | Server Path |
|-----------|-------------|
| Frontend (main) | `/var/www/sitrep/` |
| PWA App | `/var/www/sitrep/app/` |
| Backend | `/home/demoambiente/` |
| Backend .env | `/home/demoambiente/.env` |
| Nginx config | `/etc/nginx/sites-available/sitrep.ultimamilla.com.ar` |

## Deployment - Frontend

```bash
# 1. Build main frontend
cd frontend
npm run build

# 2. Build PWA app
npx vite build --config vite.config.app.ts

# 3. Create tarballs
cd dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ..
cd dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ..

# 4. Upload to server
scp /tmp/sitrep-frontend.tar.gz /tmp/sitrep-app.tar.gz root@23.105.176.45:/tmp/

# 5. Deploy on server
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
ssh root@23.105.176.45 "cd /var/www/sitrep/app && rm -rf * && tar xzf /tmp/sitrep-app.tar.gz && chmod -R 755 ."
```

## Deployment - Backend

```bash
cd backend
npm run build
scp -r dist package.json package-lock.json prisma root@23.105.176.45:/home/demoambiente/
ssh root@23.105.176.45 "cd /home/demoambiente && npm ci --production && pm2 restart demo-backend"
```

## Vite Build Configs

| Config | Base Path | Output Dir | Entry Point |
|--------|-----------|------------|-------------|
| `vite.config.ts` | `/` | `dist/` | `index.html` |
| `vite.config.v6.ts` | `/v6/` | `dist-v6/` | `src-v6/main.tsx` (dev only) |
| `vite.config.app.ts` | `/app/` | `dist-app/` | `app.html` |

## PM2 Management

```bash
ssh root@23.105.176.45 "pm2 list"
ssh root@23.105.176.45 "pm2 restart demo-backend"
ssh root@23.105.176.45 "pm2 logs demo-backend"
```

## Database

```bash
ssh root@23.105.176.45 "docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_demo"
```

## Key Notes

- Backend runs on port 3010 via PM2 (process name: `demo-backend`)
- Nginx proxies `/api/` to `http://127.0.0.1:3010`
- PostgreSQL runs in Docker container `directus-admin-database-1`
- Frontend uses SPA fallback (`try_files $uri $uri/ /index.html`)
- App uses SPA fallback to `/app/app.html`
- SSL via Let's Encrypt (auto-renewal)
