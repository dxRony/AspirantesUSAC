import * as fs from 'fs';
import * as path from 'path';

/**
 * carga el texto de la consulta Cypher desde el archivo: modelo_grafos.cypher.
 */
export const CYPHER_CARGA_MASIVA = fs.readFileSync(
    path.join(__dirname, 'modelo_grafos.cypher'),
    'utf8',
);

/**
 * Restricciones para evitar duplicados
 */
export const RESTRICCIONES_DUPLICADOS = [
    'CREATE CONSTRAINT aspirante_correlativo_unique IF NOT EXISTS FOR (a:Aspirante) REQUIRE a.correlativo IS UNIQUE',
    'CREATE CONSTRAINT carrera_nombre_unique IF NOT EXISTS FOR (c:Carrera) REQUIRE c.nombre IS UNIQUE',
    'CREATE CONSTRAINT materia_nombre_unique IF NOT EXISTS FOR (m:Materia) REQUIRE m.nombre IS UNIQUE',
    'CREATE CONSTRAINT tipoinstitucion_tipo_unique IF NOT EXISTS FOR (t:TipoInstitucion) REQUIRE t.tipo IS UNIQUE',
    'CREATE CONSTRAINT municipio_nombre_unique IF NOT EXISTS FOR (mun:Municipio) REQUIRE mun.nombre IS UNIQUE',
    'CREATE CONSTRAINT departamento_nombre_unique IF NOT EXISTS FOR (d:Departamento) REQUIRE d.nombre IS UNIQUE',
];
