import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Neo4jService } from '../database/neo4j/neo4j.service';
import {
  CYPHER_CONSULTA_1,
  CYPHER_CONSULTA_2,
  CYPHER_CONSULTA_3,
  CYPHER_CONSULTA_4,
  CYPHER_CONSULTA_5,
  CYPHER_CONSULTA_6,
} from './consultas';
import {
  AristaGrafo,
  ElementosGrafo,
  NodoGrafo,
  RespuestaConsultaNeo4j,
} from './interfaces';

// exportando interfaces
export { AristaGrafo, ElementosGrafo, NodoGrafo, RespuestaConsultaNeo4j };

/**
 * funcion para normalizar valores devueltos por neo4j driver
 */
function normalizarValor(valor: any): any {
  if (valor === null || valor === undefined) return valor;
  // si el valor es un objeto
  if (typeof valor === 'object') {
    // si el valor es un numero
    if (typeof valor.toNumber === 'function') {
      // se convierte a number
      return valor.toNumber();
    }
    // si el valor es un array
    if (Array.isArray(valor)) {
      // se recorren los elementos del array
      return valor.map(normalizarValor);
    }
    // si el valor es un objeto
    const objetoNormalizado: Record<string, any> = {};
    // se recorren las propiedades del objeto
    for (const clave of Object.keys(valor)) {
      // se normaliza cada propiedad del objeto
      objetoNormalizado[clave] = normalizarValor(valor[clave]);
    }
    // se retorna el objeto normalizado
    return objetoNormalizado;
  }
  return valor;
}

/**
 * servicio para la ejecución de las 6 consultas de grafos en Neo4j
 */
@Injectable()
export class ConsultasNeo4jService {
  private readonly logger = new Logger(ConsultasNeo4jService.name);

  constructor(private readonly neo4jService: Neo4jService) { }

  /**
   * Helper para construir un grafo
   */
  private crearGrafo(): {
    agregarNodo: (nodo: NodoGrafo) => void;
    agregarArista: (arista: AristaGrafo) => void;
    obtenerElementos: () => ElementosGrafo;
  } {
    // mapa para almacenar los nodos y aristas
    const mapaNodos = new Map<string, NodoGrafo>();
    const mapaAristas = new Map<string, AristaGrafo>();

    return {
      // funcion para agregar un nodo al mapa
      agregarNodo: (nodo: NodoGrafo) => {
        // si el nodo no existe en el mapa se agrega
        if (!mapaNodos.has(nodo.id)) {
          mapaNodos.set(nodo.id, nodo);
        }
      },
      // funcion para agregar aristas al mapa
      agregarArista: (arista: AristaGrafo) => {
        // se crea un id para la arista
        const idArista = arista.id || `${arista.from}->${arista.to}:${arista.label || ''}`;
        // si la arista no existe en el mapa se agrega
        if (!mapaAristas.has(idArista)) {
          mapaAristas.set(idArista, { ...arista, id: idArista });
        }
      },
      // funcion para obtener los nodos y aristas del grafo
      obtenerElementos: (): ElementosGrafo => ({
        nodes: Array.from(mapaNodos.values()),
        edges: Array.from(mapaAristas.values()),
      }),
    };
  }

  /**
   * Consulta 1: Rutas de Aprobación por Carrera
   * Esta consulta sirve para conocer qué materias debe aprobar un estudiante para ingresar a cada carrera
   * y cuántos aspirantes lograron superar cada una.
   */
  async consulta1_rutasAprobacion(carrera?: string, anio?: number, limite = 50,): Promise<RespuestaConsultaNeo4j> {
    // parametros para la consulta
    const parametros = {
      carrera: carrera || null,
      anio: anio ? Number(anio) : null,
      limite: Number(limite) || 50,
    };

    // se ejecuta la consulta
    const registrosCrudos = await this.neo4jService.leer(CYPHER_CONSULTA_1, parametros);
    //  se normalizan los valores de la consulta
    const metricas = registrosCrudos.map((r) => normalizarValor(r));
    // se crea el grafo
    const builderGrafo = this.crearGrafo();
    // se recorren las metricas
    for (const fila of metricas) {
      // se crea un id para la carrera y materia
      const idCarrera = `carrera:${fila.carrera}`;
      const idMateria = `materia:${fila.materia}`;

      // se agrega el nodo de la carrera
      builderGrafo.agregarNodo({
        id: idCarrera,
        label: fila.carrera,
        group: 'Carrera',
        title: `Carrera: ${fila.carrera}`,
      });

      // se agrega el nodo de la materia
      builderGrafo.agregarNodo({
        id: idMateria,
        label: fila.materia,
        group: 'Materia',
        title: `Materia Evaluada: ${fila.materia}`,
      });

      // se agrega la arista de la carrera
      builderGrafo.agregarArista({
        from: idMateria,
        to: idCarrera,
        label: `Aprobados: ${fila.total_aprobados}`,
        weight: fila.total_aprobados,
        title: `${fila.total_aprobados} aspirantes aprobaron ${fila.materia} para ingresar a ${fila.carrera}`,
        properties: { aprobados: fila.total_aprobados },
      });
    }

    // se retorna la respuesta
    return {
      consulta: 1,
      titulo: 'Rutas de Aprobación por Carrera (Subgrafo de Éxito)',
      descripcion:
        'Identifica la red de materias aprobadas requeridas para ingresar a cada carrera y el volumen de aspirantes admitidos.',
      parametros,
      total_registros: metricas.length,
      metricas,
      grafo: builderGrafo.obtenerElementos(),
    };
  }

  /**
   * Consulta 2: Flujo Geográfico de Demanda Territorial
   * Esta consulta nos permite ver de dónde vienen los aspirantes:
   * Departamento -> Municipio -> Aspirante -> Carrera.
   */
  async consulta2_flujoGeografico(departamento?: string, carrera?: string, limite = 50,): Promise<RespuestaConsultaNeo4j> {
    // parametros para la consulta
    const parametros = {
      departamento: departamento || null,
      carrera: carrera || null,
      limite: Number(limite) || 50,
    };

    // se ejecuta la consulta
    const registrosCrudos = await this.neo4jService.leer(CYPHER_CONSULTA_2, parametros);
    // se normalizan los valores de la consulta
    const metricas = registrosCrudos.map((r) => normalizarValor(r));
    // se crea el grafo
    const builderGrafo = this.crearGrafo();

    // se recorren las metricas
    for (const fila of metricas) {
      // se crea un id para el departamento, municipio y carrera
      const idDepto = `departamento:${fila.departamento}`;
      const idMuni = `municipio:${fila.municipio}`;
      const idCarrera = `carrera:${fila.carrera}`;

      // se agrega el nodo del departamento
      builderGrafo.agregarNodo({
        id: idDepto,
        label: fila.departamento,
        group: 'Departamento',
      });

      // se agrega el nodo del municipio
      builderGrafo.agregarNodo({
        id: idMuni,
        label: fila.municipio,
        group: 'Municipio',
      });

      // se agrega el nodo de la carrera
      builderGrafo.agregarNodo({
        id: idCarrera,
        label: fila.carrera,
        group: 'Carrera',
      });

      // se agrega la arista de pertenencia del municipio al departamento
      builderGrafo.agregarArista({
        from: idMuni,
        to: idDepto,
        label: 'PERTENECE_A',
      });

      // se agrega la arista del flujo de aspirantes a la carrera
      builderGrafo.agregarArista({
        from: idMuni,
        to: idCarrera,
        label: `${fila.total_aspirantes} aspirantes`,
        weight: fila.total_aspirantes,
        title: `Flujo territorial: ${fila.total_aspirantes} aspirantes de ${fila.municipio} hacia ${fila.carrera}`,
        properties: { total_aspirantes: fila.total_aspirantes },
      });
    }

    // se retorna la respuesta
    return {
      consulta: 2,
      titulo: 'Flujo Geográfico de Demanda Territorial',
      descripcion: 'Rastrea la cadena territorial Departamento -> Municipio -> Aspirantes -> Carrera Objetivo.',
      parametros,
      total_registros: metricas.length,
      metricas,
      grafo: builderGrafo.obtenerElementos(),
    };
  }

  /**
   * Consulta 3: Análisis de Cuellos de Botella y Reintentos Críticos
   * Esta consulta busca a los estudiantes que necesitaron dos o más intentos en una misma materia y analiza
   * si finalmente lograron aprobar o ya no continuaron.
   */
  async consulta3_reintentosCriticos(minIntentos = 2, materia?: string, carrera?: string, limite = 50): Promise<RespuestaConsultaNeo4j> {
    // parametros para la consulta
    const parametros = {
      minIntentos: Number(minIntentos) || 2,
      materia: materia || null,
      carrera: carrera || null,
      limite: Number(limite) || 50,
    };

    // se ejecuta la consulta
    const registrosCrudos = await this.neo4jService.leer(CYPHER_CONSULTA_3, parametros);
    // se normalizan los valores de la consulta
    const metricas = registrosCrudos.map((r) => normalizarValor(r));
    // se crea el grafo
    const builderGrafo = this.crearGrafo();

    // se recorren las metricas
    for (const fila of metricas) {
      // se crea un id para la materia y carrera
      const idMateria = `materia:${fila.materia}`;
      const idCarrera = `carrera:${fila.carrera}`;

      // se agrega el nodo de la materia
      builderGrafo.agregarNodo({
        id: idMateria,
        label: fila.materia,
        group: 'Materia',
      });

      // se agrega el nodo de la carrera
      builderGrafo.agregarNodo({
        id: idCarrera,
        label: fila.carrera,
        group: 'Carrera',
      });

      // se agrega la arista de reintentos entre materia y carrera
      builderGrafo.agregarArista({
        from: idMateria,
        to: idCarrera,
        label: `Intento ${fila.intento} (${fila.resultado}): ${fila.total_aspirantes}`,
        weight: fila.total_aspirantes,
        title: `${fila.total_aspirantes} aspirantes en intento ${fila.intento} (${fila.resultado}) para ${fila.carrera}`,
        properties: {
          intento: fila.intento,
          resultado: fila.resultado,
          aspirantes: fila.total_aspirantes,
        },
      });
    }

    // se retorna la respuesta
    return {
      consulta: 3,
      titulo: 'Cuellos de Botella Académicos y Reintentos Críticos',
      descripcion: 'Determina las materias con reintentos acumulados (>= 2) y el desenlace final por carrera objetivo.',
      parametros,
      total_registros: metricas.length,
      metricas,
      grafo: builderGrafo.obtenerElementos(),
    };
  }

  /**
   * Consulta 4: Red de Materias Concurrentes
   * Esta consulta muestra qué pares de materias suelen evaluarse al mismo tiempo en una misma fecha o año.
   */
  async consulta4_materiasConcurrentes(anio?: number, limite = 30): Promise<RespuestaConsultaNeo4j> {
    // parametros para la consulta
    const parametros = {
      anio: anio ? Number(anio) : null,
      limite: Number(limite) || 30,
    };

    // se ejecuta la consulta
    const registrosCrudos = await this.neo4jService.leer(CYPHER_CONSULTA_4, parametros);
    // se normalizan los valores de la consulta
    const metricas = registrosCrudos.map((r) => normalizarValor(r));
    // se crea el grafo
    const builderGrafo = this.crearGrafo();

    // se recorren las metricas
    for (const fila of metricas) {
      // se crea un id para ambas materias
      const idMat1 = `materia:${fila.materia_1}`;
      const idMat2 = `materia:${fila.materia_2}`;

      // se agrega el nodo de la primera materia
      builderGrafo.agregarNodo({
        id: idMat1,
        label: fila.materia_1,
        group: 'Materia',
      });

      // se agrega el nodo de la segunda materia
      builderGrafo.agregarNodo({
        id: idMat2,
        label: fila.materia_2,
        group: 'Materia',
      });

      // se agrega la arista entre las dos materias
      builderGrafo.agregarArista({
        from: idMat1,
        to: idMat2,
        label: `Peso: ${fila.peso_coocurrencia}`,
        weight: fila.peso_coocurrencia,
        title: `${fila.peso_coocurrencia} aspirantes evaluaron conjuntamente ${fila.materia_1} y ${fila.materia_2}`,
        properties: { peso: fila.peso_coocurrencia },
      });
    }

    // se retorna la respuesta
    return {
      consulta: 4,
      titulo: 'Red de Co-evaluación de Materias Concurrentes',
      descripcion:
        'Mide la concurrencia y relación entre pares de materias evaluadas simultáneamente por los mismos aspirantes.',
      parametros,
      total_registros: metricas.length,
      metricas,
      grafo: builderGrafo.obtenerElementos(),
    };
  }

  /**
   * Consulta 5: Rendimiento y Trayectoria por Tipo de Institución
   * Esta consulta permite comparar cómo les va a los aspirantes según el tipo de colegio de procedencia (público o privado)
   * para ingresar a distintas carreras
   */
  async consulta5_brechaInstitucion(
    tipoInstitucion?: string,
    carrera?: string,
    limite = 50,
  ): Promise<RespuestaConsultaNeo4j> {
    // parametros para la consulta
    const parametros = {
      tipoInstitucion: tipoInstitucion || null,
      carrera: carrera || null,
      limite: Number(limite) || 50,
    };

    // se ejecuta la consulta
    const registrosCrudos = await this.neo4jService.leer(CYPHER_CONSULTA_5, parametros);
    // se normalizan los valores de la consulta y se calcula la tasa de aprobacion
    const metricas = registrosCrudos.map((r) => {
      const fila = normalizarValor(r);
      const totalEval = (fila.aprobadas || 0) + (fila.reprobadas || 0);
      const tasaAprobacion =
        totalEval > 0 ? Number(((fila.aprobadas * 100) / totalEval).toFixed(2)) : 0;
      return {
        ...fila,
        tasa_aprobacion: tasaAprobacion,
      };
    });

    // se crea el grafo
    const builderGrafo = this.crearGrafo();

    // se recorren las metricas
    for (const fila of metricas) {
      // se crea un id para el tipo de institucion y carrera
      const idTipo = `tipo_institucion:${fila.tipo_institucion}`;
      const idCarrera = `carrera:${fila.carrera}`;

      // se agrega el nodo del tipo de institucion
      builderGrafo.agregarNodo({
        id: idTipo,
        label: `${fila.tipo_institucion} (${fila.es_publica ? 'Pública' : 'Privada'})`,
        group: fila.es_publica ? 'InstitucionPublica' : 'InstitucionPrivada',
      });

      // se agrega el nodo de la carrera
      builderGrafo.agregarNodo({
        id: idCarrera,
        label: fila.carrera,
        group: 'Carrera',
      });

      // se agrega la arista de trayectoria entre institucion y carrera
      builderGrafo.agregarArista({
        from: idTipo,
        to: idCarrera,
        label: `${fila.tasa_aprobacion}% (${fila.total_aspirantes} asp.)`,
        weight: fila.total_aspirantes,
        title: `${fila.tipo_institucion} -> ${fila.carrera}: Tasa aprobación ${fila.tasa_aprobacion}%, Aprobadas: ${fila.aprobadas}, Reprobadas: ${fila.reprobadas}`,
        properties: {
          tasa_aprobacion: fila.tasa_aprobacion,
          total_aspirantes: fila.total_aspirantes,
          aprobadas: fila.aprobadas,
          reprobadas: fila.reprobadas,
        },
      });
    }

    // se retorna la respuesta
    return {
      consulta: 5,
      titulo: 'Rendimiento y Trayectoria por Tipo de Institución',
      descripcion: 'Compara el flujo y la tasa de aprobación de aspirantes según el tipo de colegio hacia cada carrera.',
      parametros,
      total_registros: metricas.length,
      metricas,
      grafo: builderGrafo.obtenerElementos(),
    };
  }

  /**
   * Consulta 6: Red Egocéntrica de un Aspirante
   * Esta consulta muestra los datos completos de un aspirante usando su correlativo.
   */
  async consulta6_egoNetworkAspirante(correlativo: string): Promise<RespuestaConsultaNeo4j> {
    // se valida que venga el correlativo
    if (!correlativo) {
      throw new NotFoundException('El parámetro correlativo es obligatorio');
    }

    // parametros para la consulta
    const parametros = { correlativo: correlativo.trim() };
    // se ejecuta la consulta
    const registrosCrudos = await this.neo4jService.leer(CYPHER_CONSULTA_6, parametros);

    // se valida si se encontro el aspirante
    if (!registrosCrudos || registrosCrudos.length === 0 || !registrosCrudos[0].correlativo) {
      throw new NotFoundException(`No se encontró ningún aspirante con el correlativo: ${correlativo}`);
    }

    // se normalizan los valores de la consulta
    const fila = normalizarValor(registrosCrudos[0]);
    // se crea el grafo
    const builderGrafo = this.crearGrafo();

    // se crea y agrega el nodo central del aspirante
    const idAspirante = `aspirante:${fila.correlativo}`;
    builderGrafo.agregarNodo({
      id: idAspirante,
      label: `Aspirante: ${fila.correlativo.substring(0, 8)}...`,
      group: 'AspiranteCentral',
      title: `Aspirante: ${fila.correlativo}\nSexo: ${fila.sexo || 'N/A'}\nEdad: ${fila.edad || 'N/A'}`,
      properties: {
        correlativo: fila.correlativo,
        sexo: fila.sexo,
        edad: fila.edad,
      },
    });

    // se conecta el nodo de la carrera si existe
    if (fila.carrera) {
      const idCarrera = `carrera:${fila.carrera}`;
      builderGrafo.agregarNodo({ id: idCarrera, label: fila.carrera, group: 'Carrera' });
      builderGrafo.agregarArista({ from: idAspirante, to: idCarrera, label: 'ASPIRA_A' });
    }

    // se conecta el nodo del tipo de institucion si existe
    if (fila.tipo_institucion) {
      const idTipo = `tipo_institucion:${fila.tipo_institucion}`;
      builderGrafo.agregarNodo({
        id: idTipo,
        label: `${fila.tipo_institucion} (${fila.es_publica ? 'Pública' : 'Privada'})`,
        group: fila.es_publica ? 'InstitucionPublica' : 'InstitucionPrivada',
      });
      builderGrafo.agregarArista({ from: idAspirante, to: idTipo, label: 'PROVIENE_DE' });
    }

    // se conecta el nodo del municipio y departamento si existen
    if (fila.municipio) {
      const idMuni = `municipio:${fila.municipio}`;
      builderGrafo.agregarNodo({ id: idMuni, label: fila.municipio, group: 'Municipio' });
      builderGrafo.agregarArista({ from: idAspirante, to: idMuni, label: 'ORIGEN_EN' });

      if (fila.departamento) {
        const idDepto = `departamento:${fila.departamento}`;
        builderGrafo.agregarNodo({ id: idDepto, label: fila.departamento, group: 'Departamento' });
        builderGrafo.agregarArista({ from: idMuni, to: idDepto, label: 'PERTENECE_A' });
      }
    }

    // se conectan las evaluaciones y materias del aspirante
    if (Array.isArray(fila.evaluaciones)) {
      for (const ev of fila.evaluaciones) {
        if (!ev.materia) continue;
        const idMateria = `materia:${ev.materia}`;
        builderGrafo.agregarNodo({ id: idMateria, label: ev.materia, group: 'Materia' });
        builderGrafo.agregarArista({
          from: idAspirante,
          to: idMateria,
          label: `Intento ${ev.intento}: ${ev.resultado}`,
          title: `Intento: ${ev.intento}, Resultado: ${ev.resultado}`,
          properties: ev,
        });
      }
    }

    // se retorna la respuesta
    return {
      consulta: 6,
      titulo: `Red Egocéntrica del Aspirante ${fila.correlativo}`,
      descripcion: 'Muestra todos los datos completos de un aspirante usando su correlativo.',
      parametros,
      total_registros: 1,
      metricas: [fila],
      grafo: builderGrafo.obtenerElementos(),
    };
  }
}
