# Baseline metrics pre-stress test — 2026-04-09 21:43 UTC

## Produccion: sitrep.ultimamilla.com.ar (23.105.176.45)

### API health
```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 74281.26
}
```

### Server resources
```
Uptime:      21:43:55 up 20:38
Load avg:    0.18, 0.06, 0.01
Memory:      3.6Gi total, 2.9Gi used, 201Mi free, 687Mi available
Disk /:      80G total, 73G used, 7.2G free, 91% used
```

### PM2 state
```
sgi                | fork    | online | 20h uptime | 0 restarts | 70.0mb
sitrep-backend x1  | cluster | online | 20h uptime | 0 restarts | 85.5mb
sitrep-backend x2  | cluster | online | 20h uptime | 0 restarts | 72.3mb
```

### Nginx: active

### Docker containers
```
directus-admin-directus-app-1  Up 21 hours
directus-admin-database-1      Up 21 hours
remnanode                      Up 21 hours
```

## Alertas pre-existentes

- **Disco al 91%** (7.2G libres) — capacidad critica, monitorear durante stress
- **Memoria: 201Mi free** — apretada, puede haber pressure durante carga alta
- **Load avg bajo** (0.18) — condiciones normales para iniciar stress

## Criterios de aceptacion para el stress test

- 0 errores 500 en endpoints con inputs validos
- 0 nuevos 500 en endpoints con inputs invalidos (deben devolver 400)
- p95 no aumenta mas de 20% vs run historico de mundo-real-stress-test
- PM2 restart count debe permanecer en 0 (no crashes)
- Disco no debe aumentar mas de 500MB durante stress
- Docker DB debe permanecer Up durante todo el test
