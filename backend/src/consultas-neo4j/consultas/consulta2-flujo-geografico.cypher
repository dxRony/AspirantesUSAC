// Consulta 2: Flujo Geográfico de Demanda Territorial
MATCH (d:Departamento)<-[:PERTENECE_A]-(mun:Municipio)<-[:ORIGEN_EN]-(a:Aspirante)-[:ASPIRA_A]->(c:Carrera)
WHERE ($departamento IS NULL OR d.nombre = $departamento)
  AND ($carrera IS NULL OR c.nombre = $carrera)
WITH d, mun, c, count(DISTINCT a) AS total_aspirantes
RETURN d.nombre AS departamento,
       mun.nombre AS municipio,
       c.nombre AS carrera,
       total_aspirantes
ORDER BY total_aspirantes DESC
LIMIT $limite
