// ================================================================================
// SECCIÓN 0: RESTRICCIONES DE INTEGRIDAD Y UNICIDAD
// ================================================================================
CREATE CONSTRAINT aspirante_correlativo_unique IF NOT EXISTS
FOR (a:Aspirante) REQUIRE a.correlativo IS UNIQUE;

CREATE CONSTRAINT carrera_nombre_unique IF NOT EXISTS
FOR (c:Carrera) REQUIRE c.nombre IS UNIQUE;

CREATE CONSTRAINT materia_nombre_unique IF NOT EXISTS
FOR (m:Materia) REQUIRE m.nombre IS UNIQUE;

CREATE CONSTRAINT tipoinstitucion_tipo_unique IF NOT EXISTS
FOR (t:TipoInstitucion) REQUIRE t.tipo IS UNIQUE;

CREATE CONSTRAINT municipio_nombre_unique IF NOT EXISTS
FOR (mun:Municipio) REQUIRE mun.nombre IS UNIQUE;

CREATE CONSTRAINT departamento_nombre_unique IF NOT EXISTS
FOR (d:Departamento) REQUIRE d.nombre IS UNIQUE;


// ================================================================================
// CONSULTA 1: RUTAS DE APROBACIÓN POR CARRERA
// ================================================================================
MATCH (c:Carrera)<-[:ASPIRA_A]-(a:Aspirante)-[r:EVALUADO_EN]->(m:Materia)
WHERE r.aprobo = true
WITH c, m, count(DISTINCT a) AS total_aprobados
RETURN c.nombre AS carrera,
       m.nombre AS materia,
       total_aprobados
ORDER BY c.nombre, total_aprobados DESC
LIMIT 50;


// ================================================================================
// CONSULTA 2: FLUJO GEOGRÁFICO DE DEMANDA TERRITORIAL
// ================================================================================
MATCH (d:Departamento)<-[:PERTENECE_A]-(mun:Municipio)<-[:ORIGEN_EN]-(a:Aspirante)-[:ASPIRA_A]->(c:Carrera)
WITH d, mun, c, count(DISTINCT a) AS total_aspirantes
RETURN d.nombre AS departamento,
       mun.nombre AS municipio,
       c.nombre AS carrera,
       total_aspirantes
ORDER BY total_aspirantes DESC
LIMIT 50;


// ================================================================================
// CONSULTA 3: CUELLOS DE BOTELLA ACADÉMICOS
// ================================================================================
MATCH (c:Carrera)<-[:ASPIRA_A]-(a:Aspirante)-[r:EVALUADO_EN]->(m:Materia)
WHERE r.intento >= 2
RETURN m.nombre AS materia,
       c.nombre AS carrera,
       r.intento AS intento,
       r.resultado AS resultado,
       count(DISTINCT a) AS total_aspirantes
ORDER BY total_aspirantes DESC, intento DESC
LIMIT 50;


// ================================================================================
// CONSULTA 4: EVALUACIÓN CONJUNTA DE MATERIAS
// ================================================================================
MATCH (m1:Materia)<-[r1:EVALUADO_EN]-(a:Aspirante)-[r2:EVALUADO_EN]->(m2:Materia)
WHERE m1.nombre < m2.nombre
  AND r1.anio = r2.anio
WITH m1, m2, count(DISTINCT a) AS peso_coocurrencia
RETURN m1.nombre AS materia_1,
       m2.nombre AS materia_2,
       peso_coocurrencia
ORDER BY peso_coocurrencia DESC
LIMIT 50;


// ================================================================================
// CONSULTA 5: RENDIMIENTO POR TIPO DE INSTITUCIÓN
// ================================================================================
MATCH (t:TipoInstitucion)<-[:PROVIENE_DE]-(a:Aspirante)-[:ASPIRA_A]->(c:Carrera)
OPTIONAL MATCH (a)-[r:EVALUADO_EN]->(m:Materia)
RETURN t.tipo AS tipo_institucion,
       t.es_publica AS es_publica,
       c.nombre AS carrera,
       count(DISTINCT a) AS total_aspirantes,
       count(CASE WHEN r.aprobo = true THEN 1 END) AS aprobadas,
       count(CASE WHEN r.aprobo = false THEN 1 END) AS reprobadas
ORDER BY total_aspirantes DESC
LIMIT 50;


// ================================================================================
// CONSULTA 6: HISTORIAL Y TRAYECTORIA DEL ASPIRANTE
// ================================================================================
MATCH (a:Aspirante)
WHERE a.correlativo = '949d241ac10256edf11339a303c72a50'
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
         fecha_asignacion: r.fecha,
         aprobacion: r.resultado,
         aprobo: r.aprobo
       } ELSE NULL END) AS evaluaciones;
