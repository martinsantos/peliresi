# 📋 Tareas Paralelas para Claude Code

## Uso
Cada archivo `TRACK_X_*.md` es una tarea independiente que puedes cargar en una instancia de Claude Code.

## Tracks Disponibles

| Track | Archivo | Descripción | Dependencias |
|-------|---------|-------------|--------------|
| 🔴 A | `TRACK_A_BACKEND.md` | Backend, BD, APIs | Ninguna |
| 🟢 B | `TRACK_B_FRONTEND.md` | Frontend, PWA, Offline | Ninguna |
| 🟡 C | `TRACK_C_DEVOPS.md` | Nginx, SSL, PM2, Seguridad | Requiere A1 completado |
| 🔵 D | `TRACK_D_TESTING.md` | Tests E2E, QA | Puede iniciar inmediatamente |
| 🟣 E | `TRACK_E_MIGRACION.md` | Scripts de migración de datos | Requiere datos de DGFA |

## Cómo Usar

1. Abre Claude Code en una nueva ventana
2. Copia el contenido de un archivo `TRACK_*.md`
3. Pégalo como prompt inicial
4. El agente ejecutará las tareas secuencialmente

## Ejecución Paralela Recomendada

```
Ventana 1: TRACK_A + TRACK_B (pueden correr juntos)
Ventana 2: TRACK_D (testing independiente)
Ventana 3: TRACK_E (cuando tengas datos)
Ventana 4: TRACK_C (después de A1)
```

## Estado

- [ ] Track A: Backend
- [ ] Track B: Frontend
- [ ] Track C: DevOps
- [ ] Track D: Testing
- [ ] Track E: Migración

---

Creado: 2026-01-02
