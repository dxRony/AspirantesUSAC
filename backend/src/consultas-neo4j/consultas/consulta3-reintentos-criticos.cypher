// Consulta 3: Análisis de Cuellos de Botella y Reintentos Críticos
MATCH (c:Carrera)<-[:ASPIRA_A]-(a:Aspirante)-[r:EVALUADO_EN]->(m:Materia)
WHERE r.intento >= $minIntentos
  AND ($materia IS NULL OR m.nombre = $materia)
  AND ($carrera IS NULL OR c.nombre = $carrera)
RETURN m.nombre AS materia,
       c.nombre AS carrera,
       r.intento AS intento,
       r.resultado AS resultado,
       count(DISTINCT a) AS total_aspirantes
ORDER BY total_aspirantes DESC, intento DESC
LIMIT $limite
