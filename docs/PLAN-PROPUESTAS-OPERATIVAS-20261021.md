# Plan de validación — propuestas de tres partes fuera de CAP

**Completado en preview el 21/10/2026.** [Resultados, correcciones y evidencia](PROPUESTAS-OPERATIVAS-20261021.md). Las suites completas preceden a los últimos ajustes; éstos tienen comprobaciones dirigidas y E2E de las superficies afectadas. No publicado.

Sólo esquema artificial `proposal_operations_20261021`, dentro del preview 76.13.234.213. CAP cerrado, sin proveedores externos. Una tarea/worker, 1 CPU/2 GiB/swap cero. Branch `codex/sitrep-training-20261018`; main y producción excluidos.

| Caso | Evidencia requerida |
| --- | --- |
| Generador, transporte y operador crean | Tres filas independientes, autor correcto, propia empresa fija, ninguna aprobación implícita |
| Firmar/decidir | Firma del generador, autor y huella de cada decisión, 0/3 → 3/3 |
| Concurrencia/reintento | Sin decisiones/avisos duplicados, unanimidad atómica, inicio único |
| Agenda entre sesiones | Creación primera, En espera después de aprobar, filtros y fecha futura, cambios sin recarga |
| Coordinar/retirar | Inicio por una parte avisa a las otras; botón del transporte se habilita en vivo; tiempo de preparación separado del retiro |
| Rechazo/cancelación | Motivo visible, sin retiro, decisiones/historial preservados |
| Permisos | Otra empresa, actor inexistente/inactivo, suplantación, recursos ajenos/inactivos y administración no sustituyen a una parte |
| Flag apagado | Rutas de decisión cerradas, marcador persistente impide atajos de firma/edición/borrado/reversión/retiro |
| Compatibilidad | In situ y legado sin marcador conservan su contrato; histórico inmutable por hash |
| Campana/correo | Avisos de las etapas para destinatarios vinculados; contenido de correo simulado, cero intentos/envíos |
| Interfaz/manual | Escritorio, web móvil y app; capturas directas, sin errores de página ni desborde; manual sin cambiar renderer/diseño |
| Continuidad del chofer | Cola de viajes simultáneos y recuperación del último viaje sin conexión, junto a la agenda de propuestas |
| Cierre | Suites completas seriales, tipos/builds, auditoría de tablas previas y configuración, detener recursos de QA, `[skip ci]` sin workflows |

No certifica aparatos físicos, GPS real, entrega de correo ni notificaciones de sistema.
