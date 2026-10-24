// Consulta 1: Rutas de Aprobación por Carrera
MATCH (c:Carrera)<-[:ASPIRA_A]-(a:Aspirante)-[r:EVALUADO_EN]->(m:Materia)
WHERE ($carrera IS NULL OR c.nombre = $carrera)
  AND ($anio IS NULL OR r.anio = $anio)
  AND r.aprobo = true
WITH c, m, count(DISTINCT a) AS total_aprobados
RETURN c.nombre AS carrera,
       m.nombre AS materia,
       total_aprobados
ORDER BY c.nombre, total_aprobados DESC
LIMIT $limite
