-- Sólo lectura, resultados agregados: no devuelve identificadores ni datos personales.
-- Ejecutar únicamente contra la base elegida y autorizada para el análisis del corte.
-- Los grupos en origen sin transporte son candidatos para revisión: no se infiere
-- desde aquí si el registro tiene una propuesta antigua válida o datos inconsistentes.
BEGIN TRANSACTION READ ONLY;

SELECT 'SIN_PROPUESTA_REGISTRADA' AS motivo,
       m.estado::text AS estado,
       COALESCE(m.modalidad, 'FIJO') AS modalidad,
       COUNT(*) AS registros
FROM manifiestos AS m
WHERE m."isDemoData" = false
  AND m.estado::text IN ('BORRADOR', 'APROBADO')
  AND NOT EXISTS (
    SELECT 1 FROM eventos_manifiesto AS e
    WHERE e."manifiestoId" = m.id AND e.tipo = 'PROPUESTA_PARTES_V1'
  )
GROUP BY m.estado, COALESCE(m.modalidad, 'FIJO')

UNION ALL

SELECT 'ORIGEN_SIN_TRANSPORTE' AS motivo,
       m.estado::text AS estado,
       COALESCE(m.modalidad, 'FIJO') AS modalidad,
       COUNT(*) AS registros
FROM manifiestos AS m
WHERE m."isDemoData" = false
  AND m.estado::text IN ('PENDIENTE_APROBACION', 'APROBADO')
  AND m.modalidad = 'IN_SITU'
  AND m."transportistaId" IS NULL
  AND EXISTS (
    SELECT 1 FROM eventos_manifiesto AS e
    WHERE e."manifiestoId" = m.id AND e.tipo = 'PROPUESTA_PARTES_V1'
  )
GROUP BY m.estado, COALESCE(m.modalidad, 'FIJO')
ORDER BY motivo, estado, modalidad;

COMMIT;
