import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Evaluacion, EvaluacionDocument } from '../database/schemas/evaluacion.schema';
import { ResumenCarrera, ResumenCarreraDocument } from '../database/schemas/resumen-carrera.schema';

@Injectable()
export class ConsultasMongodbService {
  constructor(
    @InjectModel(Evaluacion.name) private readonly modeloEvaluacion: Model<EvaluacionDocument>,
    @InjectModel(ResumenCarrera.name) private readonly modeloResumenCarrera: Model<ResumenCarreraDocument>,
  ) { }

  /**
   * 1. Aspirantes por tipo de institución educativa.
   * Mostrar la cantidad de aspirantes agrupados por tipo de institución educativa.
   */
  async consulta1_aspirantesPorTipoInstitucion() {
    return this.modeloEvaluacion.aggregate([
      {
        // organiza los documentos por tipo de institucion educativa
        $group: {
          //id del tipo de institucion educativa
          _id: '$tipo_institucion_educativa',
          //cantidad de aspirantes
          aspirantes: { $addToSet: '$correlativo_aspirante' },
          //cantidad de evaluaciones (suma 1 por cada evaluacion)
          total_evaluaciones: { $sum: 1 },
        },
      },
      {
        //ordena el resultado final
        $project: {
          //elimina el id
          _id: 0,
          //tipo de institucion educativa
          tipo_institucion_educativa: '$_id',
          //cantidad de aspirantes
          total_aspirantes: { $size: '$aspirantes' },
          //cantidad de evaluaciones
          total_evaluaciones: 1,
        },
      },
      //ordena el resultado final de mayor a menor
      { $sort: { total_aspirantes: -1 } },
    ]);
  }

  /**
   * 2. Cantidad de aprobados por materia.
   * Mostrar la cantidad de evaluaciones aprobadas agrupadas por materia.
   */
  async consulta2_aprobadosPorMateria() {
    return this.modeloEvaluacion.aggregate([
      // filtra solo las evaluaciones aprobadas
      { $match: { aprobo: true } },
      {
        // organiza los documentos por materia
        $group: {
          // id de la materia
          _id: '$materia',
          // cantidad de aprobados (suma 1 por cada evaluacion)
          total_aprobados: { $sum: 1 },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la materia
          materia: '$_id',
          // cantidad de aprobados
          total_aprobados: 1,
        },
      },
      // ordena el resultado final de mayor a menor
      { $sort: { total_aprobados: -1 } },
    ]);
  }

  /**
   * 3. Aprobados por carrera y año de ingreso.
   * Mostrar la cantidad de aspirantes aprobados agrupados por carrera objetivo y año de ingreso.
   */
  async consulta3_aprobadosPorCarreraYAnio() {
    return this.modeloEvaluacion.aggregate([
      // filtra las evaluaciones aprobadas sin contar a las que no tienen carrera
      { $match: { aprobo: true, carrera_objetivo: { $ne: 'NINGUNO' } } },
      {
        // organiza los documentos por carrera objetivo y anio de ingreso
        $group: {
          // id compuesto por carrera y anio
          _id: { carrera: '$carrera_objetivo', anio: '$anio_de_ingreso' },
          // conjunto de aspirantes unicos
          aspirantes: { $addToSet: '$correlativo_aspirante' },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la carrera objetivo
          carrera_objetivo: '$_id.carrera',
          // anio de ingreso
          anio_de_ingreso: '$_id.anio',
          // cantidad de aspirantes aprobados unicos
          total_aprobados: { $size: '$aspirantes' },
        },
      },
      // ordena por anio de mas reciente a antiguo y luego por total de aprobados de mayor a menor
      { $sort: { anio_de_ingreso: -1, total_aprobados: -1 } },
    ]);
  }

  /**
   * 4. Porcentaje de aprobación por materia.
   * Calcular el porcentaje de aprobación correspondiente a cada materia.
   */
  async consulta4_porcentajeAprobacionPorMateria() {
    return this.modeloEvaluacion.aggregate([
      {
        // organiza los documentos por materia
        $group: {
          // id de la materia
          _id: '$materia',
          // cantidad total de evaluaciones
          total_evaluaciones: { $sum: 1 },
          // cantidad de evaluaciones aprobadas si aprobo es verdadero
          total_aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
        },
      },
      {
        // estructura el resultado final y calcula el porcentaje
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la materia
          materia: '$_id',
          // cantidad de evaluaciones
          total_evaluaciones: 1,
          // cantidad de aprobadas
          total_aprobadas: 1,
          // calcula el porcentaje de aprobacion redondeado a 2 decimales
          porcentaje_aprobacion: {
            $round: [
              { $multiply: [{ $divide: ['$total_aprobadas', '$total_evaluaciones'] }, 100] },
              2,
            ],
          },
        },
      },
      // ordena el resultado final de mayor a menor por porcentaje de aprobacion
      { $sort: { porcentaje_aprobacion: -1 } },
    ]);
  }

  /**
   * 5. Promedio de edad por carrera.
   * Calcular la edad promedio de los aspirantes agrupados por carrera objetivo.
   */
  async consulta5_promedioEdadPorCarrera() {
    return this.modeloEvaluacion.aggregate([
      {
        // filtra registros con edad no null y con carrera objetivo asignada
        $match: {
          edad: { $ne: null },
          carrera_objetivo: { $ne: 'NINGUNO' },
        },
      },
      {
        // agrupa primero por aspirante y carrera para evitar duplicar edades
        $group: {
          // id compuesto por aspirante y carrera
          _id: { aspirante: '$correlativo_aspirante', carrera: '$carrera_objetivo' },
          // edad del aspirante
          edad: { $first: '$edad' },
        },
      },
      {
        // organiza los documentos por carrera objetivo
        $group: {
          // id de la carrera
          _id: '$_id.carrera',
          // calcula el promedio de edad
          edad_promedio: { $avg: '$edad' },
          // cantidad de aspirantes unicos
          total_aspirantes: { $sum: 1 },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la carrera objetivo
          carrera_objetivo: '$_id',
          // promedio de edad redondeado a 2 decimales
          edad_promedio: { $round: ['$edad_promedio', 2] },
          // cantidad de aspirantes
          total_aspirantes: 1,
        },
      },
      // ordena el resultado final de menor a mayor por edad promedio
      { $sort: { edad_promedio: 1 } },
    ]);
  }

  /**
   * 6. Creación y actualización de la colección auxiliar resumen_carrera.
   * Generar una colección que almacene información resumida por carrera utilizando los datos procesados.
   */
  async consulta6_generarResumenCarrera() {
    await this.modeloEvaluacion.aggregate([
      // filtra los documentos que tienen una carrera objetivo valida
      { $match: { carrera_objetivo: { $ne: 'NINGUNO' } } },
      {
        // organiza los documentos por carrera objetivo
        $group: {
          // id de la carrera objetivo
          _id: '$carrera_objetivo',
          // cantidad total de evaluaciones
          total_evaluaciones: { $sum: 1 },
          // conjunto de aspirantes unicos
          aspirantes: { $addToSet: '$correlativo_aspirante' },
          // total de evaluaciones aprobadas
          total_aprobados: { $sum: { $cond: ['$aprobo', 1, 0] } },
          // lista de todas las edades registradas
          edades: { $push: '$edad' },
          // conjunto de materias evaluadas unicas
          materias_evaluadas: { $addToSet: '$materia' },
        },
      },
      {
        // estructura el resultado final calculando metricas
        $project: {
          // conserva el id como identificador de carrera
          _id: 1,
          // total de evaluaciones
          total_evaluaciones: 1,
          // cantidad de aspirantes unicos
          total_aspirantes_unicos: { $size: '$aspirantes' },
          // total de aprobados
          total_aprobados: 1,
          // calcula la tasa de aprobacion porcentual
          tasa_aprobacion: {
            $round: [{ $multiply: [{ $divide: ['$total_aprobados', '$total_evaluaciones'] }, 100] }, 2,],
          },
          // calcula la edad promedio filtrando valores nulos
          edad_promedio: {
            $round: [
              {
                $avg: {
                  $filter: {
                    input: '$edades',
                    as: 'edad',
                    cond: { $ne: ['$$edad', null] },
                  },
                },
              },
              2,
            ],
          },
          // materias evaluadas
          materias_evaluadas: 1,
          // fecha y hora de la actualizacion
          fecha_actualizacion: new Date(),
        },
      },
      {
        // fusiona o inserta los resultados en la coleccion resumen_carrera
        $merge: {
          // coleccion de destino
          into: 'resumen_carrera',
          // accion cuando el documento ya existe
          whenMatched: 'replace',
          // accion cuando el documento no existe
          whenNotMatched: 'insert',
        },
      },
    ]);

    // consulta y devuelve los registros de la coleccion generada ordenados por aspirantes
    return this.modeloResumenCarrera.find().sort({ total_aspirantes_unicos: -1 }).exec();
  }

  /**
   * funcion auxiliar para obtener los datos actuales de resumen_carrera.
   */
  async obtenerColeccionResumenCarrera() {
    // devuelve todos los documentos ordenados por cantidad de aspirantes unicos
    return this.modeloResumenCarrera.find().sort({ total_aspirantes_unicos: -1 }).exec();
  }

  /**
   * 7. Promedio de edad de aspirantes aprobados por carrera y tipo de institución.
   * Mostrar la edad promedio de los aspirantes que aprobaron, agrupada por carrera objetivo y tipo de institución educativa.
   */
  async consulta7_promedioEdadAprobadosCarreraYTipoInstitucion() {
    return this.modeloEvaluacion.aggregate([
      {
        // filtra solo evaluaciones aprobadas con edad y carrera validas
        $match: {
          aprobo: true,
          edad: { $ne: null },
          carrera_objetivo: { $ne: 'NINGUNO' },
        },
      },
      {
        // agrupa primero por aspirante para no repetir la edad del mismo aspirante
        $group: {
          // id compuesto por aspirante carrera y tipo de institucion
          _id: {
            aspirante: '$correlativo_aspirante',
            carrera: '$carrera_objetivo',
            tipo: '$tipo_institucion_educativa',
          },
          // toma la edad del aspirante
          edad: { $first: '$edad' },
        },
      },
      {
        // organiza los documentos por carrera y tipo de institucion
        $group: {
          // id compuesto por carrera y tipo de institucion
          _id: { carrera: '$_id.carrera', tipo_institucion: '$_id.tipo' },
          // calcula la edad promedio
          edad_promedio: { $avg: '$edad' },
          // cantidad de aspirantes aprobados
          total_aprobados: { $sum: 1 },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la carrera objetivo
          carrera_objetivo: '$_id.carrera',
          // tipo de institucion educativa
          tipo_institucion_educativa: '$_id.tipo_institucion',
          // promedio de edad redondeado a 2 decimales
          edad_promedio: { $round: ['$edad_promedio', 2] },
          // cantidad de aprobados
          total_aprobados: 1,
        },
      },
      // ordena el resultado final por carrera y tipo de institucion
      { $sort: { carrera_objetivo: 1, tipo_institucion_educativa: 1 } },
    ]);
  }

  /**
   * 8. Distribución de aprobados por municipio y carrera objetivo.
   * Mostrar la cantidad de aprobados según el municipio de la institución educativa y la carrera objetivo.
   */
  async consulta8_distribucionAprobadosMunicipioYCarrera() {
    return this.modeloEvaluacion.aggregate([
      {
        // filtra evaluaciones aprobadas con municipio y carrera registrados
        $match: {
          aprobo: true,
          carrera_objetivo: { $ne: 'NINGUNO' },
          municipio_institucion_educativa: { $ne: 'NO REGISTRADO' },
        },
      },
      {
        // organiza los documentos por municipio y carrera objetivo
        $group: {
          // id compuesto por municipio y carrera
          _id: {
            municipio: '$municipio_institucion_educativa',
            carrera: '$carrera_objetivo',
          },
          // conjunto de aspirantes unicos aprobados
          total_aprobados: { $addToSet: '$correlativo_aspirante' },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre del municipio
          municipio: '$_id.municipio',
          // nombre de la carrera objetivo
          carrera_objetivo: '$_id.carrera',
          // cantidad de aspirantes unicos aprobados
          total_aprobados: { $size: '$total_aprobados' },
        },
      },
      // ordena alfabeticamente por municipio y de mayor a menor por aprobados
      { $sort: { municipio: 1, total_aprobados: -1 } },
    ]);
  }

  /**
   * 9. Cantidad de evaluaciones por mes y materia para instituciones públicas.
   * Mostrar la cantidad de evaluaciones realizadas por mes y materia, considerando únicamente aspirantes provenientes de instituciones públicas.
   */
  async consulta9_evaluacionesPorMesYMateriaPublicas() {
    return this.modeloEvaluacion.aggregate([
      // filtra solo instituciones de tipo publica
      { $match: { es_publica: true } },
      {
        // organiza los documentos por mes de evaluacion y materia
        $group: {
          // id compuesto por mes extraido de la fecha y materia
          _id: {
            mes: { $month: '$fecha_asignacion' },
            materia: '$materia',
          },
          // cantidad de evaluaciones (suma 1 por cada registro)
          total_evaluaciones: { $sum: 1 },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // numero de mes obtenido
          mes: '$_id.mes',
          // nombre de la materia
          materia: '$_id.materia',
          // cantidad de evaluaciones
          total_evaluaciones: 1,
        },
      },
      // ordena de forma ascendente por mes y alfabeticamente por materia
      { $sort: { mes: 1, materia: 1 } },
    ]);
  }

  /**
   * 10. Top 5 de carreras más demandadas por aspirantes entre 16 y 18 años.
   * Determinar las cinco carreras objetivo con mayor cantidad de aspirantes dentro de ese rango de edad.
   */
  async consulta10_top5CarrerasDemandadas16a18() {
    return this.modeloEvaluacion.aggregate([
      {
        // filtra aspirantes entre 16 y 18 anios con carrera valida
        $match: {
          edad: { $gte: 16, $lte: 18 },
          carrera_objetivo: { $ne: 'NINGUNO' },
        },
      },
      {
        // agrupa primero por aspirante y carrera para eliminar registros repetidos
        $group: {
          // id compuesto por aspirante y carrera
          _id: { aspirante: '$correlativo_aspirante', carrera: '$carrera_objetivo' },
        },
      },
      {
        // organiza los documentos por carrera objetivo
        $group: {
          // id de la carrera
          _id: '$_id.carrera',
          // cantidad de aspirantes unicos
          total_aspirantes: { $sum: 1 },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la carrera objetivo
          carrera_objetivo: '$_id',
          // cantidad de aspirantes
          total_aspirantes: 1,
        },
      },
      // ordena el resultado final de mayor a menor demanda
      { $sort: { total_aspirantes: -1 } },
      // top 5 carreras
      { $limit: 5 },
    ]);
  }

  /**
   * 11. Historial de desempeño por aspirante.
   * Consultar el historial de un aspirante mostrando sus evaluaciones, materias, intentos y resultados.
   */
  async consulta11_historialDesempenoAspirante(correlativo: string) {
    const resultado = await this.modeloEvaluacion.aggregate([
      // filtra por el correlativo del aspirante indicado
      { $match: { correlativo_aspirante: correlativo } },
      {
        // selecciona los campos relevantes para el historial de desempeno
        $project: {
          // elimina el id
          _id: 0,
          // correlativo del aspirante
          correlativo_aspirante: 1,
          // materia evaluada
          materia: 1,
          // numero de intento o fecha de evaluacion
          numero_de_fecha_de_evaluacion: 1,
          // fecha de asignacion
          fecha_asignacion: 1,
          // anio de ingreso
          anio_de_ingreso: 1,
          // resultado textual de aprobacion
          aprobacion: 1,
          // estado booleano de si aprobo
          aprobo: 1,
          // carrera objetivo a la que aspira
          carrera_objetivo: 1,
        },
      },
      // ordena cronologicamente por fecha de asignacion y numero de evaluacion
      { $sort: { fecha_asignacion: 1, numero_de_fecha_de_evaluacion: 1 } },
    ]);

    // valida si se encontraron registros para el aspirante
    if (!resultado || resultado.length === 0) {
      throw new NotFoundException(`No se encontró historial para el aspirante "${correlativo}".`);
    }

    // retorna el listado de evaluaciones encontradas
    return resultado;
  }

  /**
   * 12. Distribución por sexo y tipo de institución educativa.
   * Mostrar la cantidad de aspirantes agrupados por sexo y tipo de institución.
   */
  async consulta12_distribucionSexoYTipoInstitucion() {
    return this.modeloEvaluacion.aggregate([
      {
        // organiza los documentos por sexo y tipo de institucion educativa
        $group: {
          // id compuesto por sexo y tipo de institucion
          _id: { sexo: '$sexo', tipo: '$tipo_institucion_educativa' },
          // conjunto de aspirantes unicos
          aspirantes: { $addToSet: '$correlativo_aspirante' },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // sexo del aspirante
          sexo: '$_id.sexo',
          // tipo de institucion educativa
          tipo_institucion_educativa: '$_id.tipo',
          // cantidad de aspirantes unicos
          total_aspirantes: { $size: '$aspirantes' },
        },
      },
      // ordena alfabeticamente por sexo y de mayor a menor por cantidad de aspirantes
      { $sort: { sexo: 1, total_aspirantes: -1 } },
    ]);
  }

  /**
   * 13. Tasa de aprobación por edad.
   * Calcular el porcentaje de aprobación correspondiente a cada edad.
   */
  async consulta13_tasaAprobacionPorEdad() {
    return this.modeloEvaluacion.aggregate([
      // filtra solo los registros que poseen una edad valida
      { $match: { edad: { $ne: null } } },
      {
        // organiza los documentos por edad
        $group: {
          // id correspondiente a la edad
          _id: '$edad',
          // cantidad de evaluaciones (suma 1 por cada registro)
          total_evaluaciones: { $sum: 1 },
          // cantidad de evaluaciones aprobadas si aprobo es verdadero
          total_aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
        },
      },
      {
        // estructura el resultado final calculando la tasa porcentual
        $project: {
          // elimina el id
          _id: 0,
          // edad de los aspirantes
          edad: '$_id',
          // total de evaluaciones realizadas
          total_evaluaciones: 1,
          // total de evaluaciones aprobadas
          total_aprobadas: 1,
          // calcula la tasa de aprobacion redondeada a 2 decimales
          tasa_aprobacion: {
            $round: [
              { $multiply: [{ $divide: ['$total_aprobadas', '$total_evaluaciones'] }, 100] },
              2,
            ],
          },
        },
      },
      // ordena el resultado final de menor a mayor por edad
      { $sort: { edad: 1 } },
    ]);
  }

  /**
   * 14. Número promedio de intentos por materia.
   * Determinar el promedio de oportunidades de evaluación utilizadas por los aspirantes para cada materia.
   */
  async consulta14_promedioIntentosPorMateria() {
    return this.modeloEvaluacion.aggregate([
      {
        // agrupa primero por aspirante y materia para obtener el maximo intento alcanzado
        $group: {
          // id compuesto por aspirante y materia
          _id: { aspirante: '$correlativo_aspirante', materia: '$materia' },
          // numero maximo de intento realizado por el aspirante
          intentos_realizados: { $max: '$numero_de_fecha_de_evaluacion' },
        },
      },
      {
        // organiza los documentos por materia
        $group: {
          // id de la materia
          _id: '$_id.materia',
          // calcula el promedio de intentos por materia
          promedio_intentos: { $avg: '$intentos_realizados' },
          // cantidad de aspirantes evaluados
          total_aspirantes_evaluados: { $sum: 1 },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la materia
          materia: '$_id',
          // promedio de intentos redondeado a 2 decimales
          promedio_intentos: { $round: ['$promedio_intentos', 2] },
          // cantidad total de aspirantes evaluados
          total_aspirantes_evaluados: 1,
        },
      },
      // ordena el resultado final de mayor a menor segun el promedio de intentos
      { $sort: { promedio_intentos: -1 } },
    ]);
  }

  /**
   * 15. Historial completo de un aspirante.
   * Mostrar toda la información disponible de un aspirante identificado mediante su correlativo_aspirante.
   */
  async consulta15_historialCompletoAspirante(correlativo: string) {
    const resultado = await this.modeloEvaluacion.aggregate([
      // filtra por el correlativo del aspirante indicado
      { $match: { correlativo_aspirante: correlativo } },
      {
        // organiza todas las evaluaciones bajo el correlativo del aspirante
        $group: {
          // id del aspirante
          _id: '$correlativo_aspirante',
          // captura los datos demograficos y generales del aspirante
          datos_aspirante: {
            $first: {
              // correlativo del aspirante
              correlativo_aspirante: '$correlativo_aspirante',
              // sexo del aspirante
              sexo: '$sexo',
              // anio de nacimiento
              anio_nacimiento: '$anio_nacimiento',
              // edad registrada
              edad: '$edad',
              // carrera objetivo
              carrera_objetivo: '$carrera_objetivo',
              // departamento de la institucion educativa
              departamento_institucion_educativa: '$departamento_institucion_educativa',
              // municipio de la institucion educativa
              municipio_institucion_educativa: '$municipio_institucion_educativa',
              // tipo de institucion educativa
              tipo_institucion_educativa: '$tipo_institucion_educativa',
              // indica si la institucion es publica
              es_publica: '$es_publica',
            },
          },
          // genera la lista con el detalle de cada evaluacion
          evaluaciones: {
            $push: {
              // materia evaluada
              materia: '$materia',
              // numero de intento de la evaluacion
              intento: '$numero_de_fecha_de_evaluacion',
              // anio de ingreso
              anio_de_ingreso: '$anio_de_ingreso',
              // fecha de asignacion
              fecha_asignacion: '$fecha_asignacion',
              // resultado en texto
              aprobacion: '$aprobacion',
              // estado booleano de aprobacion
              aprobo: '$aprobo',
            },
          },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // datos demograficos del aspirante
          datos_aspirante: 1,
          // cantidad total de evaluaciones registradas
          total_evaluaciones: { $size: '$evaluaciones' },
          // listado completo de evaluaciones
          evaluaciones: 1,
        },
      },
    ]);

    // verifica si el aspirante fue encontrado en la base de datos
    if (!resultado || resultado.length === 0) {
      throw new NotFoundException(`Aspirante con correlativo "${correlativo}" no encontrado.`);
    }

    // retorna el unico documento con el historial consolidado
    return resultado[0];
  }

  /**
   * 16. Carreras con más aspirantes reprobados en primer intento.
   * Determinar las carreras objetivo con mayor cantidad de aspirantes que no aprobaron en su primera oportunidad de evaluación.
   */
  async consulta16_carrerasMasReprobadosPrimerIntento() {
    return this.modeloEvaluacion.aggregate([
      {
        // filtra evaluaciones reprobadas en primer intento con carrera valida
        $match: {
          numero_de_fecha_de_evaluacion: 1,
          aprobo: false,
          carrera_objetivo: { $ne: 'NINGUNO' },
        },
      },
      {
        // agrupa por carrera y aspirante para evitar contar multiples reprobaciones del mismo aspirante
        $group: {
          // id compuesto por carrera y aspirante
          _id: { carrera: '$carrera_objetivo', aspirante: '$correlativo_aspirante' },
        },
      },
      {
        // organiza los documentos por carrera objetivo
        $group: {
          // id de la carrera
          _id: '$_id.carrera',
          // cantidad de aspirantes reprobados
          total_reprobados_primer_intento: { $sum: 1 },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre de la carrera objetivo
          carrera_objetivo: '$_id',
          // total de reprobados en primer intento
          total_reprobados_primer_intento: 1,
        },
      },
      // ordena el resultado final de mayor a menor segun la cantidad de reprobados
      { $sort: { total_reprobados_primer_intento: -1 } },
    ]);
  }

  /**
   * 17. Top 5 municipios con mayor cantidad de aspirantes.
   * Determinar los cinco municipios de procedencia de instituciones educativas con mayor cantidad de aspirantes registrados.
   */
  async consulta17_top5MunicipiosAspirantes() {
    return this.modeloEvaluacion.aggregate([
      {
        // filtra municipios que no esten vacios o sin registro
        $match: {
          municipio_institucion_educativa: { $nin: ['NO REGISTRADO', 'SIN REGISTRO'] },
        },
      },
      {
        // organiza los documentos por municipio de la institucion educativa
        $group: {
          // id del municipio
          _id: '$municipio_institucion_educativa',
          // conjunto de aspirantes unicos
          aspirantes: { $addToSet: '$correlativo_aspirante' },
        },
      },
      {
        // estructura el resultado final
        $project: {
          // elimina el id
          _id: 0,
          // nombre del municipio
          municipio: '$_id',
          // cantidad de aspirantes unicos
          total_aspirantes: { $size: '$aspirantes' },
        },
      },
      // ordena el resultado final de mayor a menor por total de aspirantes
      { $sort: { total_aspirantes: -1 } },
      //top 5 municipios
      { $limit: 5 },
    ]);
  }

  /**
   * 18. Tasa de aprobación por tipo de institución educativa.
   * Calcular y comparar el porcentaje de aprobación entre los diferentes tipos de institución educativa.
   */
  async consulta18_tasaAprobacionPorTipoInstitucion() {
    return this.modeloEvaluacion.aggregate([
      {
        // organiza los documentos por tipo de institucion educativa
        $group: {
          // id del tipo de institucion
          _id: '$tipo_institucion_educativa',
          // cantidad de evaluaciones (suma 1 por cada registro)
          total_evaluaciones: { $sum: 1 },
          // cantidad de evaluaciones aprobadas si aprobo es verdadero
          total_aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
        },
      },
      {
        // estructura el resultado final calculando el porcentaje
        $project: {
          // elimina el id
          _id: 0,
          // tipo de institucion educativa
          tipo_institucion_educativa: '$_id',
          // total de evaluaciones
          total_evaluaciones: 1,
          // total de evaluaciones aprobadas
          total_aprobadas: 1,
          // calcula la tasa porcentual de aprobacion redondeada a 2 decimales
          tasa_aprobacion: {
            $round: [
              { $multiply: [{ $divide: ['$total_aprobadas', '$total_evaluaciones'] }, 100] },
              2,
            ],
          },
        },
      },
      // ordena el resultado final de mayor a menor por tasa de aprobacion
      { $sort: { tasa_aprobacion: -1 } },
    ]);
  }

  /**
   * 19. Carreras más demandadas por departamento.
   * Determinar cuáles son las carreras objetivo con mayor demanda dentro de cada departamento de procedencia de la institución educativa.
   */
  async consulta19_carrerasMasDemandadasPorDepartamento() {
    return this.modeloEvaluacion.aggregate([
      {
        // filtra registros con departamento y carrera validos
        $match: {
          departamento_institucion_educativa: { $nin: ['NO REGISTRADO', 'SIN REGISTRO'] },
          carrera_objetivo: { $ne: 'NINGUNO' },
        },
      },
      {
        // agrupa primero por departamento y carrera para contar aspirantes unicos
        $group: {
          // id compuesto por departamento y carrera
          _id: {
            departamento: '$departamento_institucion_educativa',
            carrera: '$carrera_objetivo',
          },
          // conjunto de aspirantes unicos
          aspirantes: { $addToSet: '$correlativo_aspirante' },
        },
      },
      {
        // estructura los datos para facilitar la clasificacion
        $project: {
          // elimina el id
          _id: 0,
          // nombre del departamento
          departamento: '$_id.departamento',
          // nombre de la carrera objetivo
          carrera: '$_id.carrera',
          // cantidad de aspirantes unicos
          total_aspirantes: { $size: '$aspirantes' },
        },
      },
      // ordena por departamento y de mayor a menor demanda
      { $sort: { departamento: 1, total_aspirantes: -1 } },
      {
        // agrupa ahora por departamento para consolidar el ranking de carreras
        $group: {
          // id del departamento
          _id: '$departamento',
          // carrera con mayor demanda en el departamento
          carrera_mas_demandada: { $first: '$carrera' },
          // cantidad maxima de aspirantes para la carrera lider
          demanda_maxima: { $first: '$total_aspirantes' },
          // crea un arreglo con el listado de carreras y su demanda
          ranking_carreras: {
            $push: {
              // nombre de la carrera
              carrera: '$carrera',
              // cantidad de aspirantes
              total_aspirantes: '$total_aspirantes',
            },
          },
        },
      },
      {
        // estructura el resultado final limitando el ranking
        $project: {
          // elimina el id
          _id: 0,
          // nombre del departamento
          departamento: '$_id',
          // carrera mas solicitada
          carrera_mas_demandada: 1,
          // demanda mas alta registrada
          demanda_maxima: 1,
          // selecciona las 5 carreras con mas aspirantes
          ranking_carreras: { $slice: ['$ranking_carreras', 5] },
        },
      },
      // ordena alfabeticamente por departamento
      { $sort: { departamento: 1 } },
    ]);
  }

  /**
   * 20. Evolución de aprobación por año de ingreso.
   * Mostrar la cantidad y porcentaje de evaluaciones aprobadas y no aprobadas agrupadas por año de ingreso.
   */
  async consulta20_evolucionAprobacionPorAnio() {
    return this.modeloEvaluacion.aggregate([
      {
        // organiza los documentos por anio de ingreso
        $group: {
          // id del anio de ingreso
          _id: '$anio_de_ingreso',
          // total de evaluaciones registradas
          total_evaluaciones: { $sum: 1 },
          // total de evaluaciones aprobadas
          aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
          // total de evaluaciones reprobadas
          reprobadas: { $sum: { $cond: ['$aprobo', 0, 1] } },
        },
      },
      {
        // estructura el resultado final calculando porcentajes
        $project: {
          // elimina el id
          _id: 0,
          // anio de ingreso
          anio_de_ingreso: '$_id',
          // cantidad de evaluaciones
          total_evaluaciones: 1,
          // cantidad de aprobadas
          aprobadas: 1,
          // cantidad de reprobadas
          reprobadas: 1,
          // porcentaje de aprobacion redondeado a 2 decimales
          porcentaje_aprobadas: {
            $round: [
              { $multiply: [{ $divide: ['$aprobadas', '$total_evaluaciones'] }, 100] },
              2,
            ],
          },
          // porcentaje de reprobacion redondeado a 2 decimales
          porcentaje_reprobadas: {
            $round: [
              { $multiply: [{ $divide: ['$reprobadas', '$total_evaluaciones'] }, 100] },
              2,
            ],
          },
        },
      },
      // ordena cronologicamente por anio de ingreso de menor a mayor
      { $sort: { anio_de_ingreso: 1 } },
    ]);
  }
}
