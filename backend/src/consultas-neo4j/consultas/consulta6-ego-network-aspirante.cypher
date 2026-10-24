// Consulta 6: Red Egocéntrica de un Aspirante
MATCH (a:Aspirante { correlativo: $correlativo })
OPTIONAL MATCH (a)-[:ASPIRA_A]->(c:Carrera)
OPTIONAL MATCH (a)-[:PROVIENE_DE]->(t:TipoInstitucion)
OPTIONAL MATCH (a)-[:ORIGEN_EN]->(mun:Municipio)-[:PERTENECE_A]->(d:Departamento)
OPTIONAL MATCH (a)-[r:EVALUADO_EN]->(m:Materia)
RETURN a.correlativo AS correlativo,
       a.sexo AS sexo,
       a.edad AS edad,
       c.nombre AS carrera,
       t.tipo AS tipo_institucion,
       t.es_publica AS es_publica,
       mun.nombre AS municipio,
       d.nombre AS departamento,
       collect(DISTINCT {
         materia: m.nombre,
         intento: r.intento,
         resultado: r.resultado,
         aprobo: r.aprobo
       }) AS evaluaciones
