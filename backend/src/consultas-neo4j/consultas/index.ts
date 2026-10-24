import * as fs from 'fs';
import * as path from 'path';

function cargarCypher(nombreArchivo: string): string {
  return fs.readFileSync(path.join(__dirname, nombreArchivo), 'utf8');
}

export const CYPHER_CONSULTA_1 = cargarCypher('consulta1-rutas-aprobacion.cypher');
export const CYPHER_CONSULTA_2 = cargarCypher('consulta2-flujo-geografico.cypher');
export const CYPHER_CONSULTA_3 = cargarCypher('consulta3-reintentos-criticos.cypher');
export const CYPHER_CONSULTA_4 = cargarCypher('consulta4-materias-concurrentes.cypher');
export const CYPHER_CONSULTA_5 = cargarCypher('consulta5-brecha-institucion.cypher');
export const CYPHER_CONSULTA_6 = cargarCypher('consulta6-ego-network-aspirante.cypher');
