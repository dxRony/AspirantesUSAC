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
      titulo: 'Rutas de Aprobación por Carrera',
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

      // se agrega la arista del departamento al municipio (flujo territorial Depto -> Municipio)
      builderGrafo.agregarArista({
        from: idDepto,
        to: idMuni,
        label: 'MUNICIPIO',
        title: `Departamento: ${fila.departamento} -> Municipio: ${fila.municipio}`,
      });

      // se agrega la arista del flujo de aspirantes a la carrera (Municipio -> Carrera)
      builderGrafo.agregarArista({
        from: idMuni,
        to: idCarrera,
        label: `${fila.total_aspirantes} aspirantes`,
        weight: fila.total_aspirantes,
        title: `Flujo territorial: ${Number(fila.total_aspirantes).toLocaleString()} aspirantes de ${fila.municipio} hacia ${fila.carrera}`,
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

    // Consolidamos métricas por materia y carrera para evitar que 16 aristas se monten una sobre otra
    const mapaFlujos = new Map<string, {
      materia: string;
      carrera: string;
      totalReprobados: number;
      totalAprobados: number;
      detalles: string[];
    }>();

    for (const fila of metricas) {
      const clave = `${fila.materia}__${fila.carrera}`;
      if (!mapaFlujos.has(clave)) {
        mapaFlujos.set(clave, {
          materia: fila.materia,
          carrera: fila.carrera,
          totalReprobados: 0,
          totalAprobados: 0,
          detalles: [],
        });
      }
      const flujo = mapaFlujos.get(clave)!;
      const cant = Number(fila.total_aspirantes) || 0;
      if (fila.resultado === 'APROBADO' || fila.resultado === 'SATISFACTORIO') {
        flujo.totalAprobados += cant;
      } else {
        flujo.totalReprobados += cant;
      }
      flujo.detalles.push(`Intento ${fila.intento} (${fila.resultado}): ${cant.toLocaleString()} aspirantes`);
    }

    for (const flujo of mapaFlujos.values()) {
      const idMateria = `materia:${flujo.materia}`;
      const idCarrera = `carrera:${flujo.carrera}`;

      builderGrafo.agregarNodo({
        id: idMateria,
        label: flujo.materia,
        group: 'Materia',
      });

      builderGrafo.agregarNodo({
        id: idCarrera,
        label: flujo.carrera,
        group: 'Carrera',
      });

      const totalReintentos = flujo.totalReprobados + flujo.totalAprobados;
      const tasaReprobacion = totalReintentos > 0
        ? ((flujo.totalReprobados * 100) / totalReintentos).toFixed(1)
        : '0.0';

      builderGrafo.agregarArista({
        id: `${idMateria}->${idCarrera}`,
        from: idMateria,
        to: idCarrera,
        label: `Cuello: ${flujo.totalReprobados.toLocaleString()} reprobados`,
        weight: flujo.totalReprobados,
        title: `Cuello de botella en ${flujo.materia} para ${flujo.carrera}\n\nDesglose por oportunidad:\n${flujo.detalles.join('\n')}`,
        properties: {
          materia: flujo.materia,
          carrera: flujo.carrera,
          reprobados: flujo.totalReprobados,
          aprobados: flujo.totalAprobados,
          tasaReprobacion,
        },
      });
    }

    // se retorna la respuesta
    return {
      consulta: 3,
      titulo: 'Cuellos de Botella Académicos',
      descripcion: 'Identifica las materias donde los aspirantes acumulan 2 o más intentos por carrera.',
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
        label: `${Number(fila.peso_coocurrencia).toLocaleString()} aspirantes`,
        weight: fila.peso_coocurrencia,
        title: `Evaluación simultánea: ${Number(fila.peso_coocurrencia).toLocaleString()} aspirantes se examinaron conjuntamente de ${fila.materia_1} y ${fila.materia_2}`,
        properties: { peso: fila.peso_coocurrencia },
      });
    }

    // se retorna la respuesta
    return {
      consulta: 4,
      titulo: '4. Evaluación Conjunta de Materias',
      descripcion:
        'Identifica la cantidad de aspirantes que se examinaron simultáneamente en ambas materias (Matemática y Computación) durante un mismo ciclo de admisión.',
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
      let etiquetaTipo = fila.tipo_institucion;
      let grupoTipo = 'Institucion';

      if (fila.tipo_institucion === 'SIN DATOS' || fila.tipo_institucion === 'SIN REGISTRO' || fila.tipo_institucion === 'NO REGISTRADO') {
        etiquetaTipo = 'SIN DATOS';
        grupoTipo = 'Institucion';
      } else if (fila.es_publica === true || fila.tipo_institucion === 'PUBLICO') {
        etiquetaTipo = `${fila.tipo_institucion} (Pública)`;
        grupoTipo = 'InstitucionPublica';
      } else if (fila.es_publica === false || fila.tipo_institucion === 'PRIVADO') {
        etiquetaTipo = `${fila.tipo_institucion} (Privada)`;
        grupoTipo = 'InstitucionPrivada';
      }

      builderGrafo.agregarNodo({
        id: idTipo,
        label: etiquetaTipo,
        group: grupoTipo,
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
   * Consulta 6: Historial y Trayectoria del Aspirante
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
    const textoEdad = fila.edad ? `${fila.edad} años` : 'N/A';
    const textoNacimiento = fila.anio_nacimiento ? ` (${fila.anio_nacimiento})` : '';
    builderGrafo.agregarNodo({
      id: idAspirante,
      label: `Aspirante: ${fila.correlativo.substring(0, 8)}...`,
      group: 'AspiranteCentral',
      title: `Aspirante: ${fila.correlativo}\nSexo: ${fila.sexo || 'N/A'}\nEdad: ${textoEdad}${textoNacimiento}`,
      properties: {
        correlativo: fila.correlativo,
        sexo: fila.sexo,
        edad: fila.edad,
        anio_nacimiento: fila.anio_nacimiento,
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
      let labelTipo = fila.tipo_institucion;
      let groupTipo = 'Institucion';
      if (fila.tipo_institucion === 'SIN DATOS' || fila.tipo_institucion === 'SIN REGISTRO' || fila.tipo_institucion === 'NO REGISTRADO') {
        labelTipo = 'SIN DATOS';
      } else if (fila.es_publica === true || fila.tipo_institucion === 'PUBLICO') {
        labelTipo = `${fila.tipo_institucion} (Pública)`;
        groupTipo = 'InstitucionPublica';
      } else if (fila.es_publica === false || fila.tipo_institucion === 'PRIVADO') {
        labelTipo = `${fila.tipo_institucion} (Privada)`;
        groupTipo = 'InstitucionPrivada';
      }

      builderGrafo.agregarNodo({
        id: idTipo,
        label: labelTipo,
        group: groupTipo,
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

    // Filtrar y ordenar evaluaciones del aspirante
    const evaluacionesLimpias = (Array.isArray(fila.evaluaciones) ? fila.evaluaciones : [])
      .filter((e) => e && e.materia)
      .sort((a, b) => {
        if (a.materia !== b.materia) return a.materia.localeCompare(b.materia);
        return (a.intento || 0) - (b.intento || 0);
      });

    // se conectan las evaluaciones y materias del aspirante
    if (evaluacionesLimpias.length > 0) {
      // Contar intentos por materia para distribuir aristas paralelas curvas si hay varios intentos
      const conteoPorMateria = {};
      for (const ev of evaluacionesLimpias) {
        conteoPorMateria[ev.materia] = (conteoPorMateria[ev.materia] || 0) + 1;
      }

      const indicePorMateria = {};
      for (const ev of evaluacionesLimpias) {
        const idMateria = `materia:${ev.materia}`;
        builderGrafo.agregarNodo({ id: idMateria, label: ev.materia, group: 'Materia' });

        indicePorMateria[ev.materia] = (indicePorMateria[ev.materia] || 0) + 1;
        const index = indicePorMateria[ev.materia];
        const total = conteoPorMateria[ev.materia];

        // Curvatura balanceada para que múltiples intentos no se sobrepongan
        let roundness = 0;
        let smoothType = 'curvedCW';
        if (total > 1) {
          const offset = index - (total + 1) / 2;
          roundness = Math.abs(offset) * 0.22 + 0.1;
          smoothType = offset < 0 ? 'curvedCCW' : 'curvedCW';
        }

        const colorArista = ev.aprobo ? '#28a745' : '#dc3545';
        const textoAprobado = ev.resultado || (ev.aprobo ? 'APROBADO' : 'NO APROBADO');
        const fechaTexto = ev.fecha_asignacion || ev.fecha || '';

        builderGrafo.agregarArista({
          from: idAspirante,
          to: idMateria,
          label: `Intento ${ev.intento}: ${textoAprobado}`,
          title: `Materia: ${ev.materia}\nIntento: ${ev.intento}\nAño de Ingreso: ${ev.anio_de_ingreso || ev.anio || 'N/A'}\nFecha: ${fechaTexto}\nResultado: ${textoAprobado}\nAprobó: ${ev.aprobo ? 'Sí' : 'No'}`,
          properties: {
            ...ev,
            color: colorArista,
            roundness,
            smoothType,
          },
        });
      }
    }

    // Datos demográficos estructurados para visualización de ficha de perfil
    const datosAspirante = {
      correlativo_aspirante: fila.correlativo,
      carrera_objetivo: fila.carrera,
      sexo: fila.sexo,
      edad: fila.edad,
      anio_nacimiento: fila.anio_nacimiento,
      municipio_institucion_educativa: fila.municipio,
      departamento_institucion_educativa: fila.departamento,
      tipo_institucion_educativa: fila.tipo_institucion,
      es_publica: fila.es_publica,
    };

    // se retorna la respuesta
    return {
      consulta: 6,
      titulo: `Historial y Trayectoria del Aspirante ${fila.correlativo}`,
      descripcion: 'Visualización del aspirante conectado a todos sus datos demográficos, académicos y el historial completo de sus evaluaciones.',
      parametros,
      total_registros: evaluacionesLimpias.length,
      datos_aspirante: datosAspirante,
      evaluaciones: evaluacionesLimpias,
      metricas: [fila],
      grafo: builderGrafo.obtenerElementos(),
    };
  }
}
