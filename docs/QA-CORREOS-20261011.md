# Correos SITREP — corte verificable del 11/10/2026

## Resultado

Implementación funcional, no sólo backlog. **GO del lote de seguridad y
plantillas en QA. NO-GO todavía para habilitar correo real de toda la matriz.**
No publicación de este lote ni cambios de configuración en producción.

Producto probado: `eb33b582d6019b043014641f87a3558d02823a03`.
Rama: `codex/sitrep-mail-safety-20261011`.
Corrida: https://github.com/martinsantos/peliresi/actions/runs/38150666287
Terminó 11/10 a las 15:18:59 UTC (12:18:59 Mendoza), en 1 min 21 s.

| Gate | Resultado real |
|---|---|
| Unit backend completas | 820 aprobadas, 0 fallidas, 0 omitidas |
| TypeScript backend | Aprobado |
| PostgreSQL + SMTP loopback | Seis grupos aprobados; 36 mensajes capturados dentro de la VM |
| Destinatarios externos | 0 |
| Concurrencia | Dos procesos independientes: 20 reintentos, 10 entradas de digest y 3 avisos confirmados, sin repetición en nueva pasada |
| Rollback | Notificación revertida no genera entrada de correo |
| Historial | Fallido antiguo intacto; suprimidos nunca liberados |
| Plantillas | 12 HTML + 12 versiones de texto + índice, con datos ficticios |

La prueba primero reprodujo los tres casos inseguros en `38149176120`.
Las corridas intermedias sin `pdftotext` no se contaron como suites aprobadas;
la dependencia fue instalada sólo en la VM y se repitió la suite completa.

## Cambios de producto

- Corte de activación obligatorio y supresión terminal, sin estados de envío falsos.
- Acuse SMTP comprobado; ambigüedad de transporte/persistencia no reintenta a ciegas.
- Toma exclusiva de filas y reintento de digest conservando su agrupación.
- Plantillas breves, escapadas y versionadas; texto plano, enlaces restringidos
  al origen, tokens codificados, remitente configurable y TLS para SMTP remoto.
- Relay optativo de avisos internos confirmados: solicitudes, soporte e
  inspecciones. Identificador persistente para deduplicación y activación por
  familia, deshabilitada por defecto. Sin contenido privado de notas/adjuntos.
- Exclusión de indicadores de revisión/prueba, manifiestos demo y actas de
  capacitación reconocidas. Preferencias y verificación de correo respetadas
  en el nuevo relay.

No cambia esquema de base, archivos frontend, formularios abiertos ni sesiones.
No Docker, instalación de dependencias, navegador o emulador local. VM y
contenedores cerrados por el workflow; artefactos pequeños en disco externo.

## Límites y pendientes antes del GO de correo externo

1. Decisión solicitada: correos para solicitantes verificados aún no aprobados.
   `activo=false` también se usa en suspensiones; el relay los suprime hasta
   diferenciar esos estados sin abrir una excepción insegura.
2. Completar conexiones faltantes de la matriz (baja/cambio de cuenta,
   modificaciones de padrón, CAA, actuaciones y vencimientos específicos).
   La existencia de una plantilla no demuestra que su evento esté conectado.
3. Ejecutar HTTP/E2E de cada flujo emisor y navegación autenticada desde
   enlaces en web/app; revisar HTML en clientes de correo reales. Este lote
   no repitió E2E web/APK ni certifica recepción visual en Gmail/Outlook.
4. Aprobar remitente/Reply-To, DNS SPF/DKIM/DMARC, familias/frecuencia y canario;
   inventariar cola histórica. ENVIADO previo a la corrección no se reinterpreta
   como evidencia de entrega. No se borró ni reemitió nada de producción.
5. Revisar gates para publicación reversible. Correo permanece apagado hasta
   autorización específica de habilitación y prueba canario.

Inventario y criterios completos: [backlog de correos](BACKLOG-CORREOS-PRODUCCION-20261013.md).

## Evidencia guardada

`/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/tmp/sitrep-go-evidence-20261003/mail-qa-20261011/final/`

- `sitrep-mail-unit.json`
- `sitrep-mail-integration.json`
- `sitrep-mail-templates/index.html` y variantes HTML/texto.

No activar automáticamente `EMAIL_NOTIFICATION_FAMILIES` ni elegir una fecha
histórica para `EMAIL_DELIVERY_NOT_BEFORE`. No reutilizar credenciales o
destinatarios QA para producción. Mantener `DISABLE_EMAILS=true`.
