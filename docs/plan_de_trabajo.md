# Hoja de Ruta y Arquitectura Técnica: Proyecto Final Bases de Datos 2 - Aspirantes USAC

## 1. Análisis del Proyecto y Requerimientos

### 1.1 Objetivo del Sistema
Desarrollar una plataforma web completa para la extracción, procesamiento (ETL), almacenamiento, análisis estadístico y exploración de relaciones en grafo sobre las **Pruebas Específicas** de los aspirantes a primer ingreso de la Facultad de Ingeniería de la Universidad de San Carlos de Guatemala (USAC).

### 1.2 Reglas de Negocio y Particularidades del Dataset
Cada fila del archivo CSV representa un **intento de evaluación**, no un aspirante único:
* Un mismo `correlativo_aspirante` puede presentar múltiples evaluaciones para distintas materias o en diferentes oportunidades (`numero_de_fecha_de_evaluacion`).
* **Valores especiales y limpieza requerida**:
  - `anio_nacimiento`: Puede venir `"SIN REGISTRO"`. Se normaliza a `null` o valor numérico para permitir el cálculo de `edad = anio_de_ingreso - anio_nacimiento`.
  - `aprobacion`: Texto `"APROBADO"` o `"NO APROBADO"`. Se estandariza y se crea un indicador booleano `aprobo` para optimizar agregaciones y filtros indexados.
  - `carrera_objetivo`: Puede contener `"NINGUNO"`. Debe categorizarse o tratarse según la consulta.
  - `tipo_institucion_educativa`: Normalizar ("OFICIAL", "NACIONAL", "PRIVADO", etc.) y derivar bandera booleana `es_publica` (vital para la Consulta #9 y comparativas).
  - Fechas: Normalizar `fecha_asignacion` a formato de fecha ISO para extraer mes (`$month`) y año (`$year`) directamente sin campos redundantes.

---

## 2. Definición y Modelado de Bases de Datos NoSQL

### 2.1 Modelo Documental en MongoDB

Para garantizar que las **20 consultas analíticas** solicitadas se ejecuten de forma eficiente sin saturar la memoria ni requerir múltiples joins complejos, utilizaremos una colección principal enriquecida en la fase ETL:

#### Colección 1: `evaluaciones` (Colección Principal - 14 Campos)
```json
{
  "_id": "ObjectId",
  "correlativo_aspirante": "949d241ac10256edf11339a303c72a50",
  "fecha_asignacion": "2014-08-23T00:00:00.000Z",
  "sexo": "M",
  "anio_nacimiento": 1996,
  "edad": 19,
  "materia": "MATEMATICA",
  "numero_de_fecha_de_evaluacion": 1,
  "anio_de_ingreso": 2015,
  "aprobacion": "APROBADO",
  "aprobo": true,
  "carrera_objetivo": "INGENIERIA EN CIENCIAS Y SISTEMAS",
  "departamento_institucion_educativa": "GUATEMALA",
  "municipio_institucion_educativa": "GUATEMALA - CIUDAD CAPITAL ZONA 1",
  "tipo_institucion_educativa": "PRIVADO",
  "es_publica": false
}
```

* **Índices Estratégicos**:
  - `correlativo_aspirante`: 1
  - `materia`: 1, `aprobo`: 1
  - `carrera_objetivo`: 1, `anio_de_ingreso`: 1
  - `departamento_institucion_educativa`: 1, `municipio_institucion_educativa`: 1
  - `tipo_institucion_educativa`: 1, `es_publica`: 1
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

#### Definición de las 6 Consultas Cypher (Personalizadas para Grafos):
1. **Rutas de Aprobación por Carrera (Subgrafo de Éxito)**: Red de materias aprobadas requeridas para acceder a cada carrera y volumen de admitidos (`(c:Carrera)<-[:ASPIRA_A]-(a:Aspirante)-[r:EVALUADO_EN]->(m:Materia)`).
2. **Flujo Geográfico de Demanda Territorial**: Rastrear la cadena territorial `Departamento -> Municipio -> Aspirante -> Carrera Objetivo` (4 saltos).
3. **Análisis de Cuellos de Botella y Reintentos Críticos**: Materias con reintentos acumulados ($\ge 2$ intentos) y su desenlace final por carrera.
4. **Red de Co-evaluación / Materias Concurrentes (Proyección Bipartita)**: Intensidad con que pares de materias son evaluadas simultáneamente por los mismos aspirantes (`Materia1 <- Aspirante -> Materia2`).
5. **Rendimiento y Trayectoria por Tipo de Institución**: Comparativa de evaluaciones aprobadas y reprobadas entre colegios oficiales y privados hacia cada carrera.
6. **Red Egocéntrica (Ego-Network) de un Aspirante**: Subgrafo personalizado de radio 1 y 2 saltos centrado en el aspirante para el buscador y explorador interactivo.

---

## 3. Hoja de Ruta de Desarrollo (Roadmap)

| Fase | Rama utilizada / sugerida | Funcionalidad Clave | Estado |
| :--- | :--- | :--- | :--- |
| **Fase 0** | `feature/01-infraestructura` | Docker Compose (Mongo + Neo4j), Backend NestJS, Frontend Angular con `barca-theme.css`. | ✅ Completada y Merged |
| **Fase 1** | `feature/02-etl` | Servicio ETL en NestJS con streaming (`csv-parser`), validación de tipos, detección de rechazados, inserción masiva a MongoDB y Neo4j (`carga-masiva.cypher`), registro de auditoría en `cargas_historial`. | ✅ Completada y Merged (PR #2) |
| **Fase 2** | `feature/03-consultas-mongodb` | Implementación de las 20 consultas analíticas en MongoDB usando aggregation pipelines optimizados, deduplicación de aspirantes (`$addToSet`), generación de la colección auxiliar `resumen_carrera` vía `$merge`, y endpoints duales (numéricos y semánticos). | ✅ Completada y Merged (PR #3) |
| **Fase 3** | `feature/04-consultas-neo4j` | Driver oficial de Neo4j en NestJS, restricciones de unicidad, 6 consultas Cypher personalizadas simplificadas con doble salida (métricas tabulares + elementos `nodes`/`edges` para Vis.js) y endpoints duales. | ✅ Completada y Merged (PR #4) |
| **Fase 4** | `feature/05-vistas-frontend` | Implementación de vistas Angular con `barca-theme.css`: Landing page descriptiva con CTA, Layout persistente con Navbar y Footer, Dashboard de KPIs, Carga ETL con streaming, 20 consultas MongoDB por categorías, Explorador interactivo Neo4j con Vis.js y Buscador multicriterio. | ⏳ En desarrollo |
| **Fase 5** | `feature/06-docs-and-refinements` | Generación de reportes de errores controlados, manual técnico, manual de usuario, análisis de resultados y conclusiones. | Pendiente |
