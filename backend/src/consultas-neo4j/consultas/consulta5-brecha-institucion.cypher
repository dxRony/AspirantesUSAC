// Consulta 5: Rendimiento por Tipo de Institución
MATCH (t:TipoInstitucion)<-[:PROVIENE_DE]-(a:Aspirante)-[:ASPIRA_A]->(c:Carrera)
WHERE (
  $tipoInstitucion IS NULL OR
  ($tipoInstitucion IN ['PUBLICO', 'PUBLICA', 'PUBLICAS'] AND (t.es_publica = true OR t.tipo IN ['PUBLICO', 'POR COOPERATIVA', 'MUNICIPAL'])) OR
  ($tipoInstitucion IN ['PRIVADO', 'PRIVADA', 'PRIVADAS'] AND (t.tipo IN ['PRIVADO', 'SIN DATOS', 'SIN REGISTRO'])) OR
  t.tipo = $tipoInstitucion
)
  AND ($carrera IS NULL OR c.nombre = $carrera)
OPTIONAL MATCH (a)-[r:EVALUADO_EN]->(m:Materia)
RETURN t.tipo AS tipo_institucion,
       t.es_publica AS es_publica,
       c.nombre AS carrera,
       count(DISTINCT a) AS total_aspirantes,
       count(CASE WHEN r.aprobo = true THEN 1 END) AS aprobadas,
       count(CASE WHEN r.aprobo = false THEN 1 END) AS reprobadas
ORDER BY total_aspirantes DESC
LIMIT $limite
