// Consulta 4: Red de Materias Concurrentes
MATCH (m1:Materia)<-[r1:EVALUADO_EN]-(a:Aspirante)-[r2:EVALUADO_EN]->(m2:Materia)
WHERE m1.nombre < m2.nombre
  AND r1.anio = r2.anio
  AND ($anio IS NULL OR r1.anio = $anio)
WITH m1, m2, count(DISTINCT a) AS peso_coocurrencia
RETURN m1.nombre AS materia_1,
       m2.nombre AS materia_2,
       peso_coocurrencia
ORDER BY peso_coocurrencia DESC
LIMIT $limite
