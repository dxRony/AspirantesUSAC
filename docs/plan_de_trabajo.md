# Hoja de Ruta y Arquitectura Técnica: Proyecto Final Bases de Datos 2 - Aspirantes USAC

## 1. Análisis del Proyecto y Requerimientos

### 1.1 Objetivo del Sistema
Desarrollar una plataforma web completa para la extracción, procesamiento (ETL), almacenamiento, análisis estadístico y exploración de relaciones en grafo sobre las **Pruebas Específicas** de los aspirantes a primer ingreso de la Facultad de Ingeniería de la Universidad de San Carlos de Guatemala (USAC).

### 1.2 Reglas de Negocio y Particularidades del Dataset
Cada fila del archivo CSV representa un **intento de evaluación**, no un aspirante único:
* Un mismo `correlativo_aspirante` puede presentar múltiples evaluaciones para distintas materias o en diferentes oportunidades (`numero_de_fecha_de_evaluacion`).
* **Valores especiales y limpieza requerida**:
  - `anio_nacimiento`: Puede venir `"SIN REGISTRO"`. Se normaliza a `null` o valor numérico para permitir el cálculo de `edad = anio_de_ingreso - anio_nacimiento`.
  - `aprobacion`: Texto `"APROBADO"` o `"NO APROBADO"`. Se estandariza y se crea un indicador booleano `es_aprobado` para optimizar agregaciones.
  - `carrera_objetivo`: Puede contener `"NINGUNO"`. Debe categorizarse o tratarse según la consulta.
  - `tipo_institucion_educativa`: Normalizar ("OFICIAL", "NACIONAL", "PRIVADO", etc.) y derivar bandera `es_publica` (vital para la Consulta #9).
  - Fechas: Normalizar `fecha_asignacion` a formato de fecha ISO para extraer mes y año.

---

## 2. Definición y Modelado de Bases de Datos NoSQL

### 2.1 Modelo Documental en MongoDB

Para garantizar que las **20 consultas analíticas** solicitadas se ejecuten de forma eficiente sin saturar la memoria ni requerir múltiples joins complejos, utilizaremos una colección principal enriquecida en la fase ETL:

#### Colección 1: `evaluaciones` (Colección Principal)
```json
{
  "_id": "ObjectId",
  "correlativo_aspirante": "949d241ac10256edf11339a303c72a50",
  "fecha_asignacion": "2014-08-23T00:00:00.000Z",
  "mes_asignacion": 8,
  "sexo": "M",
  "anio_nacimiento": 1996,
  "edad": 19,
  "materia": "MATEMATICA",
  "numero_de_fecha_de_evaluacion": 1,
  "anio_de_ingreso": 2015,
  "aprobacion": "APROBADO",
  "es_aprobado": true,
  "carrera_objetivo": "INGENIERIA EN CIENCIAS Y SISTEMAS",
  "departamento_institucion_educativa": "GUATEMALA",
  "municipio_institucion_educativa": "GUATEMALA - CIUDAD CAPITAL ZONA 1",
  "tipo_institucion_educativa": "PRIVADO",
  "es_institucion_publica": false,
  "archivo_origen": "pruebas_especificas_2015.csv",
  "fecha_carga": "2026-10-19T23:00:00.000Z"
}
```

* **Índices Estratégicos**:
  - `correlativo_aspirante`: 1
  - `materia`: 1, `aprobacion`: 1
  - `carrera_objetivo`: 1, `anio_de_ingreso`: 1
  - `departamento_institucion_educativa`: 1, `municipio_institucion_educativa`: 1
  - `tipo_institucion_educativa`: 1, `es_institucion_publica`: 1
  - `edad`: 1

#### Colección 2: `cargas_historial` (Auditoría de Carga y Métricas ETL)
Almacena el registro de cada proceso de carga con las métricas exigidas:
```json
{
  "_id": "ObjectId",
  "nombre_archivo": "pruebas_2015.csv",
  "total_leidos": 15000,
  "total_procesados": 14920,
  "total_rechazados": 80,
  "tiempo_utilizado_ms": 4250,
  "estado": "COMPLETADO",
  "fecha_inicio": "2026-10-19T23:00:00.000Z",
  "fecha_fin": "2026-10-19T23:00:04.250Z",
  "errores": [
    {
      "fila": 45,
      "datos_raw": { "..." : "..." },
      "motivo": "Formato de fecha de asignación inválido"
    }
  ]
}
```

#### Colección 3: `resumen_carrera` (Colección Auxiliar - Consulta #6)
Generada dinámicamente mediante pipeline de agregación con `$out` o `$merge`:
```json
{
  "_id": "INGENIERIA EN CIENCIAS Y SISTEMAS",
  "total_evaluaciones": 4500,
  "total_aspirantes_unicos": 2100,
  "total_aprobados": 1400,
  "tasa_aprobacion": 66.67,
  "edad_promedio": 18.4,
  "materias_evaluadas": ["MATEMATICA", "FISICA"],
  "fecha_actualizacion": "2026-10-19T23:05:00.000Z"
}
```

---

### 2.2 Modelo de Grafos en Neo4j

El modelo evita redundancia usando nodos canónicos conectados con `MERGE` y restricciones de unicidad.

```
(:Aspirante) -[:ASPIRA_A]-> (:Carrera)
(:Aspirante) -[:EVALUADO_EN {fecha, intento, resultado, anio}]-> (:Materia)
(:Aspirante) -[:PROVIENE_DE]-> (:TipoInstitucion)
(:Aspirante) -[:ORIGEN_EN]-> (:Municipio)
(:Municipio) -[:PERTENECE_A]-> (:Departamento)
```

#### Restricciones de Unicidad en Neo4j:
```cypher
CREATE CONSTRAINT FOR (a:Aspirante) REQUIRE a.correlativo IS UNIQUE;
CREATE CONSTRAINT FOR (c:Carrera) REQUIRE c.nombre IS UNIQUE;
CREATE CONSTRAINT FOR (m:Materia) REQUIRE m.nombre IS UNIQUE;
CREATE CONSTRAINT FOR (t:TipoInstitucion) REQUIRE t.tipo IS UNIQUE;
CREATE CONSTRAINT FOR (mun:Municipio) REQUIRE mun.nombre IS UNIQUE;
CREATE CONSTRAINT FOR (d:Departamento) REQUIRE d.nombre IS UNIQUE;
```

#### Definición de las 5 Consultas Cypher (Personalizadas):
1. **Rutas de Aprobación por Carrera**: Aspirantes que aprobaron todas sus materias evaluadas conectadas a su carrera objetivo.
2. **Centralidad de Demanda por Departamento**: Detección de flujos geográficos desde departamentos hacia carreras más demandadas.
3. **Análisis de Reintentos Críticos**: Aspirantes con 2 o más intentos en la misma materia y su desenlace final.
4. **Comportamiento por Tipo de Institución**: Comparativa de caminos de éxito entre instituciones públicas vs privadas hacia facultades.
5. **Comunidades de Materias Concurrentes**: Co-ocurrencia de materias evaluadas en el mismo periodo por aspirante.

---

## 3. Hoja de Ruta de Desarrollo (Roadmap)

| Fase | Rama sugerida | Funcionalidad Clave | Estado |
| :--- | :--- | :--- | :--- |
| **Fase 0** | `feature/01-infraestructura` | Docker Compose (Mongo + Neo4j), Backend NestJS, Frontend Angular con `barca-theme.css`. | ✅ Completada y Merged |
| **Fase 1** | `feature/02-etl-csv-loader` | Servicio ETL en NestJS con streaming (csv-parser), validación de tipos, detección de rechazados, inserción masiva a MongoDB y Neo4j, registro de métricas. | ⏳ Siguiente paso |
| **Fase 2** | `feature/03-mongodb-analytics` | Implementación de las 20 consultas analíticas solicitadas en MongoDB usando pipelines de agregación optimizados y generación de la colección `resumen_carrera`. | Pendiente |
| **Fase 3** | `feature/04-neo4j-graph-queries` | Integración del driver oficial de Neo4j en NestJS, restricciones de unicidad, carga de nodos/aristas y las 5 consultas Cypher con formato listo para visualización. | Pendiente |
| **Fase 4** | `feature/05-frontend-views` | Implementación de vistas Angular con `barca-theme.css`: Dashboard de estadísticas (gráficos/tarjetas), Buscador multicriterio, pantalla ETL y explorador de grafos interactivo (Vis.js). | Pendiente |
| **Fase 5** | `feature/06-docs-and-refinements` | Generación de reportes de errores controlados, manual técnico, manual de usuario, análisis de resultados y conclusiones. | Pendiente |
