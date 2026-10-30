// Consulta 6: Historial y Trayectoria del Aspirante
MATCH (a:Aspirante { correlativo: $correlativo })
OPTIONAL MATCH (a)-[:ASPIRA_A]->(c:Carrera)
OPTIONAL MATCH (a)-[:PROVIENE_DE]->(t:TipoInstitucion)
OPTIONAL MATCH (a)-[:ORIGEN_EN]->(mun:Municipio)-[:PERTENECE_A]->(d:Departamento)
OPTIONAL MATCH (a)-[r:EVALUADO_EN]->(m:Materia)
WITH a, c, t, mun, d, m, r
ORDER BY m.nombre ASC, r.intento ASC
RETURN a.correlativo AS correlativo,
       a.sexo AS sexo,
       a.edad AS edad,
       a.anio_nacimiento AS anio_nacimiento,
       c.nombre AS carrera,
       t.tipo AS tipo_institucion,
       t.es_publica AS es_publica,
       mun.nombre AS municipio,
       d.nombre AS departamento,
       collect(CASE WHEN m IS NOT NULL THEN {
         materia: m.nombre,
         intento: r.intento,
         anio_de_ingreso: r.anio,
         anio: r.anio,
         fecha_asignacion: r.fecha,
         fecha: r.fecha,
         aprobacion: r.resultado,
         resultado: r.resultado,
         aprobo: r.aprobo
       } ELSE NULL END) AS evaluaciones
