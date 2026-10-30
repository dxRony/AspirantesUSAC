// seleccionando la base de datos
db = db.getSiblingDB('aspirantes_db');
print("EJECUTANDO CONSULTAS ANALiTICAS EN MONGODB - ASPIRANTES USAC");


// CONSULTA 1: Aspirantes por tipo de institución educativa
print(">>> Consulta 1: Aspirantes por tipo de institución educativa");

const c1 = db.evaluaciones.aggregate([
  {
    $group: {
      _id: '$tipo_institucion_educativa',
      aspirantes: { $addToSet: '$correlativo_aspirante' },
      total_evaluaciones: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      tipo_institucion_educativa: '$_id',
      total_aspirantes: { $size: '$aspirantes' },
      total_evaluaciones: 1,
    },
  },
  { $sort: { total_aspirantes: -1 } },
]).toArray();
printjson(c1);
print("\n--------------------------------------------------------------------------------\n");


// CONSULTA 2: Cantidad de aprobados por materia
print(">>> Consulta 2: Cantidad de aprobados por materia");
const c2 = db.evaluaciones.aggregate([
  { $match: { aprobo: true } },
  {
    $group: {
      _id: '$materia',
      total_aprobados: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      materia: '$_id',
      total_aprobados: 1,
    },
  },
  { $sort: { total_aprobados: -1 } },
]).toArray();
printjson(c2);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 3: Aprobados por carrera y año de ingreso
print(">>> Consulta 3: Aprobados por carrera y año de ingreso");
const c3 = db.evaluaciones.aggregate([
  {
    $match: {
      aprobo: true,
      carrera_objetivo: { $ne: 'NINGUNO' },
    },
  },
  {
    $group: {
      _id: { carrera: '$carrera_objetivo', anio: '$anio_de_ingreso' },
      aspirantes: { $addToSet: '$correlativo_aspirante' },
    },
  },
  {
    $project: {
      _id: 0,
      carrera_objetivo: '$_id.carrera',
      anio_de_ingreso: '$_id.anio',
      total_aprobados: { $size: '$aspirantes' },
    },
  },
  { $sort: { anio_de_ingreso: -1, total_aprobados: -1 } },
]).toArray();
printjson(c3);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 4: Porcentaje de aprobación por materia
print(">>> Consulta 4: Porcentaje de aprobación por materia");
const c4 = db.evaluaciones.aggregate([
  {
    $group: {
      _id: '$materia',
      total_evaluaciones: { $sum: 1 },
      total_aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
    },
  },
  {
    $project: {
      _id: 0,
      materia: '$_id',
      total_evaluaciones: 1,
      total_aprobadas: 1,
      porcentaje_aprobacion: {
        $round: [
          { $multiply: [{ $divide: ['$total_aprobadas', '$total_evaluaciones'] }, 100] },
          2,
        ],
      },
    },
  },
  { $sort: { porcentaje_aprobacion: -1 } },
]).toArray();
printjson(c4);
print("\n--------------------------------------------------------------------------------\n");


// CONSULTA 5: Promedio de edad por carrera
print(">>> Consulta 5: Promedio de edad por carrera");
const c5 = db.evaluaciones.aggregate([
  {
    $match: {
      edad: { $ne: null },
      carrera_objetivo: { $ne: 'NINGUNO' },
    },
  },
  {
    $group: {
      _id: { aspirante: '$correlativo_aspirante', carrera: '$carrera_objetivo' },
      edad: { $first: '$edad' },
    },
  },
  {
    $group: {
      _id: '$_id.carrera',
      edad_promedio: { $avg: '$edad' },
      total_aspirantes: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      carrera_objetivo: '$_id',
      edad_promedio: { $round: ['$edad_promedio', 2] },
      total_aspirantes: 1,
    },
  },
  { $sort: { edad_promedio: 1 } },
]).toArray();
printjson(c5);
print("\n--------------------------------------------------------------------------------\n");


// CONSULTA 6: Creación y actualización de la colección auxiliar 'resumen_carrera'
print(">>> Consulta 6: Materializando colección auxiliar 'resumen_carrera'");
db.evaluaciones.aggregate([
  { $match: { carrera_objetivo: { $ne: 'NINGUNO' } } },
  {
    $group: {
      _id: '$carrera_objetivo',
      total_evaluaciones: { $sum: 1 },
      aspirantes: { $addToSet: '$correlativo_aspirante' },
      total_aprobados: { $sum: { $cond: ['$aprobo', 1, 0] } },
      edades: { $push: '$edad' },
      materias_evaluadas: { $addToSet: '$materia' },
    },
  },
  {
    $project: {
      _id: 1,
      total_evaluaciones: 1,
      total_aspirantes_unicos: { $size: '$aspirantes' },
      total_aprobados: 1,
      tasa_aprobacion: {
        $round: [
          { $multiply: [{ $divide: ['$total_aprobados', '$total_evaluaciones'] }, 100] },
          2,
        ],
      },
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
      materias_evaluadas: 1,
      fecha_actualizacion: new Date(),
    },
  },
  {
    $merge: {
      into: 'resumen_carrera',
      whenMatched: 'replace',
      whenNotMatched: 'insert',
    },
  },
]);
const c6 = db.resumen_carrera.find().sort({ total_aspirantes_unicos: -1 }).toArray();
printjson(c6);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 7: Promedio de edad de aspirantes aprobados por carrera y tipo de institución
print(">>> Consulta 7: Promedio de edad de aspirantes aprobados por carrera y tipo de institución");
const c7 = db.evaluaciones.aggregate([
  {
    $match: {
      aprobo: true,
      edad: { $ne: null },
      carrera_objetivo: { $ne: 'NINGUNO' },
    },
  },
  {
    $group: {
      _id: {
        aspirante: '$correlativo_aspirante',
        carrera: '$carrera_objetivo',
        tipo: '$tipo_institucion_educativa',
      },
      edad: { $first: '$edad' },
    },
  },
  {
    $group: {
      _id: { carrera: '$_id.carrera', tipo_institucion: '$_id.tipo' },
      edad_promedio: { $avg: '$edad' },
      total_aprobados: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      carrera_objetivo: '$_id.carrera',
      tipo_institucion_educativa: '$_id.tipo_institucion',
      edad_promedio: { $round: ['$edad_promedio', 2] },
      total_aprobados: 1,
    },
  },
  { $sort: { carrera_objetivo: 1, tipo_institucion_educativa: 1 } },
]).toArray();
printjson(c7);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 8: Distribución de aprobados por municipio y carrera
print(">>> Consulta 8: Distribución de aprobados por municipio y carrera");
const c8 = db.evaluaciones.aggregate([
  {
    $match: {
      aprobo: true,
      carrera_objetivo: { $ne: 'NINGUNO' },
      municipio_institucion_educativa: { $ne: 'NO REGISTRADO' },
    },
  },
  {
    $group: {
      _id: {
        departamento: '$departamento_institucion_educativa',
        municipio: '$municipio_institucion_educativa',
        carrera: '$carrera_objetivo',
      },
      total_aprobados: { $addToSet: '$correlativo_aspirante' },
    },
  },
  {
    $project: {
      _id: 0,
      departamento: '$_id.departamento',
      municipio: '$_id.municipio',
      carrera_objetivo: '$_id.carrera',
      total_aprobados: { $size: '$total_aprobados' },
    },
  },
  { $sort: { departamento: 1, municipio: 1, total_aprobados: -1 } },
]).toArray();
printjson(c8);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 9: Cantidad de evaluaciones por mes y materia para instituciones públicas
print(">>> Consulta 9: Cantidad de evaluaciones por mes y materia para instituciones públicas");
const c9 = db.evaluaciones.aggregate([
  { $match: { es_publica: true } },
  {
    $group: {
      _id: {
        mes_num: { $month: '$fecha_asignacion' },
        materia: '$materia',
      },
      total_evaluaciones: { $sum: 1 },
    },
  },
  { $sort: { '_id.mes_num': 1, '_id.materia': 1 } },
  {
    $project: {
      _id: 0,
      mes: {
        $switch: {
          branches: [
            { case: { $eq: ['$_id.mes_num', 1] }, then: '1 (Enero)' },
            { case: { $eq: ['$_id.mes_num', 2] }, then: '2 (Febrero)' },
            { case: { $eq: ['$_id.mes_num', 3] }, then: '3 (Marzo)' },
            { case: { $eq: ['$_id.mes_num', 4] }, then: '4 (Abril)' },
            { case: { $eq: ['$_id.mes_num', 5] }, then: '5 (Mayo)' },
            { case: { $eq: ['$_id.mes_num', 6] }, then: '6 (Junio)' },
            { case: { $eq: ['$_id.mes_num', 7] }, then: '7 (Julio)' },
            { case: { $eq: ['$_id.mes_num', 8] }, then: '8 (Agosto)' },
            { case: { $eq: ['$_id.mes_num', 9] }, then: '9 (Septiembre)' },
            { case: { $eq: ['$_id.mes_num', 10] }, then: '10 (Octubre)' },
            { case: { $eq: ['$_id.mes_num', 11] }, then: '11 (Noviembre)' },
            { case: { $eq: ['$_id.mes_num', 12] }, then: '12 (Diciembre)' },
          ],
          default: { $toString: '$_id.mes_num' },
        },
      },
      materia: '$_id.materia',
      total_evaluaciones: 1,
    },
  },
]).toArray();
printjson(c9);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 10: Top 5 carreras más demandadas por aspirantes entre 16 y 18 años
print(">>> Consulta 10: Top 5 carreras más demandadas por aspirantes entre 16 y 18 años");
const c10 = db.evaluaciones.aggregate([
  {
    $match: {
      edad: { $gte: 16, $lte: 18 },
      carrera_objetivo: { $ne: 'NINGUNO' },
    },
  },
  {
    $group: {
      _id: { aspirante: '$correlativo_aspirante', carrera: '$carrera_objetivo' },
    },
  },
  {
    $group: {
      _id: '$_id.carrera',
      total_aspirantes: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      carrera_objetivo: '$_id',
      total_aspirantes: 1,
    },
  },
  { $sort: { total_aspirantes: -1 } },
  { $limit: 5 },
]).toArray();
printjson(c10);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 11: Historial de desempeño por aspirante
print(">>> Consulta 11: Historial de desempeño por aspirante (Ejemplo)");
var correlativoEjemplo = "949d241ac10256edf11339a303c72a50";
const c11 = db.evaluaciones.aggregate([
  { $match: { correlativo_aspirante: correlativoEjemplo } },
  {
    $project: {
      _id: 0,
      correlativo_aspirante: 1,
      materia: 1,
      numero_de_fecha_de_evaluacion: 1,
      fecha_asignacion: 1,
      anio_de_ingreso: 1,
      aprobo: 1,
      carrera_objetivo: 1,
    },
  },
  { $sort: { fecha_asignacion: 1, numero_de_fecha_de_evaluacion: 1 } },
]).toArray();
printjson(c11);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 12: Distribución por sexo y tipo de institución educativa
print(">>> Consulta 12: Distribución por sexo y tipo de institución educativa");
const c12 = db.evaluaciones.aggregate([
  {
    $group: {
      _id: { sexo: '$sexo', tipo: '$tipo_institucion_educativa' },
      aspirantes: { $addToSet: '$correlativo_aspirante' },
    },
  },
  {
    $project: {
      _id: 0,
      sexo: '$_id.sexo',
      tipo_institucion_educativa: '$_id.tipo',
      total_aspirantes: { $size: '$aspirantes' },
    },
  },
  { $sort: { sexo: 1, total_aspirantes: -1 } },
]).toArray();
printjson(c12);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 13: Tasa de aprobación por edad
print(">>> Consulta 13: Tasa de aprobación por edad");
const c13 = db.evaluaciones.aggregate([
  { $match: { edad: { $ne: null } } },
  {
    $group: {
      _id: '$edad',
      total_evaluaciones: { $sum: 1 },
      total_aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
    },
  },
  {
    $project: {
      _id: 0,
      edad: '$_id',
      total_evaluaciones: 1,
      total_aprobadas: 1,
      tasa_aprobacion: {
        $round: [
          { $multiply: [{ $divide: ['$total_aprobadas', '$total_evaluaciones'] }, 100] },
          2,
        ],
      },
    },
  },
  { $sort: { edad: 1 } },
]).toArray();
printjson(c13);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 14: Número promedio de intentos por materia
print(">>> Consulta 14: Número promedio de intentos por materia");
const c14 = db.evaluaciones.aggregate([
  {
    $group: {
      _id: { aspirante: '$correlativo_aspirante', materia: '$materia' },
      intentos_realizados: { $max: '$numero_de_fecha_de_evaluacion' },
    },
  },
  {
    $group: {
      _id: '$_id.materia',
      promedio_intentos: { $avg: '$intentos_realizados' },
      total_aspirantes_evaluados: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      materia: '$_id',
      promedio_intentos: { $round: ['$promedio_intentos', 2] },
      total_aspirantes_evaluados: 1,
    },
  },
  { $sort: { promedio_intentos: -1 } },
]).toArray();
printjson(c14);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 15: Historial completo de un aspirante
print(">>> Consulta 15: Historial completo de un aspirante (Ejemplo)");
const c15 = db.evaluaciones.aggregate([
  { $match: { correlativo_aspirante: correlativoEjemplo } },
  {
    $group: {
      _id: '$correlativo_aspirante',
      datos_aspirante: {
        $first: {
          correlativo_aspirante: '$correlativo_aspirante',
          sexo: '$sexo',
          anio_nacimiento: '$anio_nacimiento',
          edad: '$edad',
          carrera_objetivo: '$carrera_objetivo',
          departamento_institucion_educativa: '$departamento_institucion_educativa',
          municipio_institucion_educativa: '$municipio_institucion_educativa',
          tipo_institucion_educativa: '$tipo_institucion_educativa',
          es_publica: '$es_publica',
        },
      },
      evaluaciones: {
        $push: {
          materia: '$materia',
          intento: '$numero_de_fecha_de_evaluacion',
          anio_de_ingreso: '$anio_de_ingreso',
          fecha_asignacion: '$fecha_asignacion',
          aprobacion: '$aprobacion',
          aprobo: '$aprobo',
        },
      },
    },
  },
  {
    $project: {
      _id: 0,
      datos_aspirante: 1,
      total_evaluaciones: { $size: '$evaluaciones' },
      evaluaciones: 1,
    },
  },
]).toArray();
printjson(c15);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 16: Carreras con más aspirantes reprobados en primer intento
print(">>> Consulta 16: Carreras con más aspirantes reprobados en primer intento");
const c16 = db.evaluaciones.aggregate([
  {
    $match: {
      numero_de_fecha_de_evaluacion: 1,
      aprobo: false,
      carrera_objetivo: { $ne: 'NINGUNO' },
    },
  },
  {
    $group: {
      _id: { carrera: '$carrera_objetivo', aspirante: '$correlativo_aspirante' },
    },
  },
  {
    $group: {
      _id: '$_id.carrera',
      total_reprobados_primer_intento: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      carrera_objetivo: '$_id',
      total_reprobados_primer_intento: 1,
    },
  },
  { $sort: { total_reprobados_primer_intento: -1 } },
]).toArray();
printjson(c16);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 17: Top 5 municipios con mayor cantidad de aspirantes
print(">>> Consulta 17: Top 5 municipios con mayor cantidad de aspirantes");
const c17 = db.evaluaciones.aggregate([
  {
    $match: {
      municipio_institucion_educativa: { $nin: ['NO REGISTRADO', 'SIN REGISTRO'] },
    },
  },
  {
    $group: {
      _id: '$municipio_institucion_educativa',
      aspirantes: { $addToSet: '$correlativo_aspirante' },
    },
  },
  {
    $project: {
      _id: 0,
      municipio: '$_id',
      total_aspirantes: { $size: '$aspirantes' },
    },
  },
  { $sort: { total_aspirantes: -1 } },
  { $limit: 5 },
]).toArray();
printjson(c17);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 18: Tasa de aprobación por tipo de institución educativa
print(">>> Consulta 18: Tasa de aprobación por tipo de institución educativa");
const c18 = db.evaluaciones.aggregate([
  {
    $group: {
      _id: '$tipo_institucion_educativa',
      total_evaluaciones: { $sum: 1 },
      total_aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
    },
  },
  {
    $project: {
      _id: 0,
      tipo_institucion_educativa: '$_id',
      total_evaluaciones: 1,
      total_aprobadas: 1,
      tasa_aprobacion: {
        $round: [
          { $multiply: [{ $divide: ['$total_aprobadas', '$total_evaluaciones'] }, 100] },
          2,
        ],
      },
    },
  },
  { $sort: { tasa_aprobacion: -1 } },
]).toArray();
printjson(c18);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 19: Carreras más demandadas por departamento
print(">>> Consulta 19: Carreras más demandadas por departamento");
const c19 = db.evaluaciones.aggregate([
  {
    $match: {
      departamento_institucion_educativa: { $nin: ['NO REGISTRADO', 'SIN REGISTRO'] },
      carrera_objetivo: { $ne: 'NINGUNO' },
    },
  },
  {
    $group: {
      _id: {
        departamento: '$departamento_institucion_educativa',
        carrera: '$carrera_objetivo',
      },
      aspirantes: { $addToSet: '$correlativo_aspirante' },
    },
  },
  {
    $project: {
      _id: 0,
      departamento: '$_id.departamento',
      carrera: '$_id.carrera',
      total_aspirantes: { $size: '$aspirantes' },
    },
  },
  { $sort: { departamento: 1, total_aspirantes: -1 } },
  {
    $group: {
      _id: '$departamento',
      carrera_mas_demandada: { $first: '$carrera' },
      demanda_maxima: { $first: '$total_aspirantes' },
    },
  },
  {
    $project: {
      _id: 0,
      departamento: '$_id',
      carrera_mas_demandada: 1,
      total_aspirantes: '$demanda_maxima',
    },
  },
  { $sort: { departamento: 1 } },
]).toArray();
printjson(c19);
print("\n--------------------------------------------------------------------------------\n");

// CONSULTA 20: Evolución de aprobación por año de ingreso
print(">>> Consulta 20: Evolución de aprobación por año de ingreso");
const c20 = db.evaluaciones.aggregate([
  {
    $group: {
      _id: '$anio_de_ingreso',
      total_evaluaciones: { $sum: 1 },
      aprobadas: { $sum: { $cond: ['$aprobo', 1, 0] } },
      reprobadas: { $sum: { $cond: ['$aprobo', 0, 1] } },
    },
  },
  {
    $project: {
      _id: 0,
      anio_de_ingreso: '$_id',
      total_evaluaciones: 1,
      aprobadas: 1,
      reprobadas: 1,
      porcentaje_aprobadas: {
        $round: [
          { $multiply: [{ $divide: ['$aprobadas', '$total_evaluaciones'] }, 100] },
          2,
        ],
      },
      porcentaje_reprobadas: {
        $round: [
          { $multiply: [{ $divide: ['$reprobadas', '$total_evaluaciones'] }, 100] },
          2,
        ],
      },
    },
  },
  { $sort: { anio_de_ingreso: 1 } },
]).toArray();
printjson(c20);
print("Fin de script consultas mongo");
