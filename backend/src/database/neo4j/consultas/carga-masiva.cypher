UNWIND $lote AS fila

// Nodo Aspirante
MERGE (a:Aspirante { correlativo: fila.correlativo_aspirante })
ON CREATE SET
  a.sexo = fila.sexo,
  a.anio_nacimiento = fila.anio_nacimiento,
  a.edad = fila.edad
ON MATCH SET
  a.sexo = coalesce(a.sexo, fila.sexo),
  a.anio_nacimiento = coalesce(a.anio_nacimiento, fila.anio_nacimiento),
  a.edad = coalesce(a.edad, fila.edad)

// Nodo Materia y relación EVALUADO_EN
MERGE (m:Materia { nombre: fila.materia })
MERGE (a)-[r:EVALUADO_EN { intento: fila.numero_de_fecha_de_evaluacion, anio: fila.anio_de_ingreso }]->(m)
SET
  r.fecha = fila.fecha_asignacion_str,
  r.resultado = fila.aprobacion,
  r.es_aprobado = fila.es_aprobado

// Nodo Carrera y relación ASPIRA_A
FOREACH (_ IN CASE WHEN fila.carrera_objetivo IS NOT NULL AND fila.carrera_objetivo <> '' AND fila.carrera_objetivo <> 'NINGUNO' THEN [1] ELSE [] END |
  MERGE (c:Carrera { nombre: fila.carrera_objetivo })
  MERGE (a)-[:ASPIRA_A]->(c)
)

// Nodo TipoInstitucion y relación PROVIENE_DE
FOREACH (_ IN CASE WHEN fila.tipo_institucion_educativa IS NOT NULL AND fila.tipo_institucion_educativa <> '' AND fila.tipo_institucion_educativa <> 'SIN REGISTRO' THEN [1] ELSE [] END |
  MERGE (t:TipoInstitucion { tipo: fila.tipo_institucion_educativa })
  ON CREATE SET t.es_publica = fila.es_institucion_publica
  MERGE (a)-[:PROVIENE_DE]->(t)
)

// Nodo Municipio y Departamento
FOREACH (_ IN CASE WHEN fila.municipio_institucion_educativa IS NOT NULL AND fila.municipio_institucion_educativa <> '' AND fila.municipio_institucion_educativa <> 'NO REGISTRADO' THEN [1] ELSE [] END |
  MERGE (mun:Municipio { nombre: fila.municipio_institucion_educativa })
  MERGE (a)-[:ORIGEN_EN]->(mun)
  FOREACH (__ IN CASE WHEN fila.departamento_institucion_educativa IS NOT NULL AND fila.departamento_institucion_educativa <> '' AND fila.departamento_institucion_educativa <> 'NO REGISTRADO' THEN [1] ELSE [] END |
    MERGE (d:Departamento { nombre: fila.departamento_institucion_educativa })
    MERGE (mun)-[:PERTENECE_A]->(d)
  )
)
