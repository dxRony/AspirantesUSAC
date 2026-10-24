// Consulta 5: Rendimiento y Trayectoria por Tipo de Institución
MATCH (t:TipoInstitucion)<-[:PROVIENE_DE]-(a:Aspirante)-[:ASPIRA_A]->(c:Carrera)
OPTIONAL MATCH (a)-[r:EVALUADO_EN]->(m:Materia)
WHERE ($tipoInstitucion IS NULL OR t.tipo = $tipoInstitucion)
  AND ($carrera IS NULL OR c.nombre = $carrera)
RETURN t.tipo AS tipo_institucion,
       t.es_publica AS es_publica,
       c.nombre AS carrera,
       count(DISTINCT a) AS total_aspirantes,
       count(CASE WHEN r.aprobo = true THEN 1 END) AS aprobadas,
       count(CASE WHEN r.aprobo = false THEN 1 END) AS reprobadas
ORDER BY total_aspirantes DESC
LIMIT $limite
