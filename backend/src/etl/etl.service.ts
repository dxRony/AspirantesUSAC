import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as readline from 'readline';
import * as csvParser from 'csv-parser';
import { Evaluacion, EvaluacionDocument } from '../database/schemas/evaluacion.schema';
import { CargaHistorial, CargaHistorialDocument, ErrorFila } from '../database/schemas/carga-historial.schema';
import { Neo4jService } from '../database/neo4j/neo4j.service';

const csv = (csvParser as any).default || csvParser;

const TAMANIO_LOTE = 500;
const MAX_ERRORES_REGISTRADOS = 500;

interface ResultadoValidacion {
  valido: boolean;
  error?: string;
  documentoMongo?: any;
  documentoNeo4j?: any;
}

@Injectable()
export class EtlService {
  // variable para registrar eventos
  private readonly logger = new Logger(EtlService.name);

  constructor(
    @InjectModel(Evaluacion.name) private readonly modeloEvaluacion: Model<EvaluacionDocument>,
    @InjectModel(CargaHistorial.name) private readonly modeloCargaHistorial: Model<CargaHistorialDocument>,
    private readonly servicioNeo4j: Neo4jService,
  ) { }

  /**
   * metodo para procesar un archivo CSV validando y transformando
   * los registros e insertándolos en lotes en mongoDB y neo4j.
   */
  async procesarArchivoCsv(archivo: Express.Multer.File): Promise<CargaHistorialDocument> {
    if (!archivo || !archivo.path) {
      throw new BadRequestException('Archivo no recibido o ruta no válida.');
    }

    const tiempoInicio = Date.now();
    const nombreOriginal = archivo.originalname || 'archivo.csv';

    // verificando si el archivo ya fue cargado previamente con exito
    const cargaPrevia = await this.modeloCargaHistorial.findOne({
      nombre_archivo: nombreOriginal,
      estado: 'COMPLETADO',
    });

    if (cargaPrevia) {
      if (archivo.path && fs.existsSync(archivo.path)) {
        try {
          fs.unlinkSync(archivo.path);
        } catch {
          // ignorar error al eliminar archivo temporal
        }
      }
      throw new BadRequestException(`El archivo '${nombreOriginal}' ya fue cargado previamente.`);
    }

    // creando registro inicial de auditoría en cargas_historial
    const registroCarga = new this.modeloCargaHistorial({
      nombre_archivo: nombreOriginal,
      total_leidos: 0,
      total_procesados: 0,
      total_rechazados: 0,
      tiempo_utilizado_ms: 0,
      estado: 'PROCESANDO',
      fecha_inicio: new Date(tiempoInicio),
      fecha_fin: null,
      errores: [],
    });
    await registroCarga.save();

    let totalLeidos = 0;
    let totalProcesados = 0;
    let totalRechazados = 0;
    const errores: ErrorFila[] = [];

    let loteMongo: any[] = [];
    let loteNeo4j: any[] = [];

    try {
      // guardando el delimitador en base a la primera línea
      const delimitador = await this.detectarDelimitador(archivo.path);
      this.logger.log(`Iniciando procesamiento de ${nombreOriginal} con delimitador '${delimitador}'`);

      // inicializando flujo de lectura
      const flujoArchivo = fs.createReadStream(archivo.path);
      // creando parseador con el delimitador
      const parseador = flujoArchivo.pipe(
        csv({
          separator: delimitador,
          mapHeaders: ({ header }) => this.mapearEncabezado(header),
        }),
      );
      // la fila 1 es el encabezado del archivo; los datos empiezan en la fila 2
      let fila = 1;

      for await (const filaCruda of parseador) {
        fila++;
        totalLeidos++;

        const resultado = this.validarYTransformar(filaCruda);

        if (!resultado.valido) {
          totalRechazados++;
          if (errores.length < MAX_ERRORES_REGISTRADOS) {
            errores.push({
              fila,
              datos_crudos: filaCruda,
              motivo: resultado.error || 'Error desconocido de validación',
            });
          }
          continue;
        }

        loteMongo.push(resultado.documentoMongo);
        loteNeo4j.push(resultado.documentoNeo4j);
        totalProcesados++;

        // insercion en lote cuando se alcanza el tamaño óptimo de lote
        if (loteMongo.length >= TAMANIO_LOTE) {
          await this.guardarLotes(loteMongo, loteNeo4j);
          loteMongo = [];
          loteNeo4j = [];
        }
      }

      // Procesar remanentes finales
      if (loteMongo.length > 0) {
        await this.guardarLotes(loteMongo, loteNeo4j);
        loteMongo = [];
        loteNeo4j = [];
      }

      const tiempoFin = Date.now();
      const tiempoUtilizado = tiempoFin - tiempoInicio;

      let estadoFinal = 'COMPLETADO';
      if (totalProcesados === 0 && totalRechazados > 0) {
        estadoFinal = 'FALLIDO';
      } else if (totalRechazados > 0) {
        estadoFinal = 'COMPLETADO_CON_ERRORES';
      }

      registroCarga.total_leidos = totalLeidos;
      registroCarga.total_procesados = totalProcesados;
      registroCarga.total_rechazados = totalRechazados;
      registroCarga.tiempo_utilizado_ms = tiempoUtilizado;
      registroCarga.estado = estadoFinal;
      registroCarga.fecha_fin = new Date(tiempoFin);
      registroCarga.errores = errores;

      await registroCarga.save();

      this.logger.log(
        `Carga finalizada para ${nombreOriginal}: ${totalProcesados} procesados, ${totalRechazados} rechazados en ${tiempoUtilizado}ms (Estado: ${estadoFinal})`,
      );

      return registroCarga;
    } catch (error: any) {
      this.logger.error(`Error crítico procesando archivo ${nombreOriginal}: ${error.message}`, error.stack);
      registroCarga.estado = 'FALLIDO';
      registroCarga.fecha_fin = new Date();
      registroCarga.tiempo_utilizado_ms = Date.now() - tiempoInicio;
      registroCarga.errores.push({
        fila: 0,
        datos_crudos: {},
        motivo: `Fallo crítico en el ETL: ${error.message}`,
      });
      await registroCarga.save();
      throw error;
    } finally {
      // eliminando el archivo temporal del disco para liberar recursos
      fs.promises.unlink(archivo.path).catch((errorDesvincular) => {
        this.logger.warn(`No se pudo eliminar el archivo temporal ${archivo.path}: ${errorDesvincular.message}`);
      });
    }
  }

  /**
   * metodo para insertar un lote en mongo y neo4j.
   */
  private async guardarLotes(loteMongo: any[], loteNeo4j: any[]): Promise<void> {
    await Promise.all([
      this.modeloEvaluacion.insertMany(loteMongo, { ordered: false }),
      this.servicioNeo4j.cargarMasiva(loteNeo4j),
    ]);
  }

  /**
   * metodo que valida y transforma una fila del archivo CSV:
   * consideraciones :
   * - limpieza de anio_nacimiento 'SIN REGISTRO' -> null
   * - calculo de edad = anio_de_ingreso - anio_nacimiento
   * - conversion de aprobacion a bandera booleana aprobo
   * - deteccion de institución pública booleano: es_publica
   * - normalizacion de mayúsculas, espacios y valores por defecto
   */
  private validarYTransformar(filaCruda: Record<string, any>): ResultadoValidacion {
    // validacion de correlativo de aspirante
    const correlativo = String(filaCruda['correlativo_aspirante'] || '').trim();
    if (!correlativo) {
      return { valido: false, error: 'Campo obligatorio ausente: correlativo_aspirante' };
    }

    // validacion de fecha de asignacion y extraer mes
    const fechaCruda = filaCruda['fecha_asignacion'];
    const fechaParseada = this.parsearFecha(fechaCruda);
    if (!fechaParseada) {
      return { valido: false, error: `Formato de fecha de asignación inválido: "${fechaCruda}"` };
    }

    // validando la materia
    const materia = String(filaCruda['materia'] || '').trim().toUpperCase();
    if (!materia) {
      return { valido: false, error: 'Campo obligatorio ausente: materia' };
    }

    // validando numero de fecha de evaluacion (intento)
    const numeroIntento = parseInt(String(filaCruda['numero_de_fecha_de_evaluacion'] || filaCruda['numero_de_fecha_de_evaluaci'] || '').trim(), 10);
    if (isNaN(numeroIntento) || numeroIntento <= 0) {
      return {
        valido: false,
        error: `Número de fecha de evaluación (intento) inválido: "${filaCruda['numero_de_fecha_de_evaluacion']}"`,
      };
    }

    // validando anio de ingreso
    const anioIngreso = parseInt(String(filaCruda['anio_de_ingreso'] || '').trim(), 10);
    if (isNaN(anioIngreso) || anioIngreso < 1950 || anioIngreso > 2100) {
      return { valido: false, error: `Año de ingreso inválido: "${filaCruda['anio_de_ingreso']}"` };
    }

    // validando y normalizando aprobacion
    const aprobacionCruda = String(filaCruda['aprobacion'] || '').trim().toUpperCase();
    let aprobacionNormalizada = '';
    let esAprobado = false;

    if (aprobacionCruda.includes('NO APROBADO') || aprobacionCruda.includes('REPROBADO')) {
      aprobacionNormalizada = 'NO APROBADO';
      esAprobado = false;
    } else if (aprobacionCruda.includes('APROBADO')) {
      aprobacionNormalizada = 'APROBADO';
      esAprobado = true;
    } else {
      return { valido: false, error: `Resultado de aprobación no reconocido: "${aprobacionCruda}"` };
    }

    // normalizando anio de nacimiento y calculando edad
    let anioNacimiento: number | null = null;
    let edad: number | null = null;
    const nacimientoCrudo = String(filaCruda['anio_nacimiento'] || '').trim().toUpperCase();

    if (
      nacimientoCrudo &&
      nacimientoCrudo !== 'SIN REGISTRO' &&
      nacimientoCrudo !== 'NULL' &&
      nacimientoCrudo !== 'NO REGISTRADO'
    ) {
      const anioParsed = parseInt(nacimientoCrudo, 10);
      if (!isNaN(anioParsed) && anioParsed > 1940 && anioParsed <= new Date().getFullYear()) {
        anioNacimiento = anioParsed;
        const edadCalculada = anioIngreso - anioParsed;
        if (edadCalculada >= 10 && edadCalculada <= 100) {
          edad = edadCalculada;
        }
      }
    }

    // normalizando sexo
    const sexoCrudo = String(filaCruda['sexo'] || '').trim().toUpperCase();
    const sexo = sexoCrudo === 'M' || sexoCrudo === 'F' ? sexoCrudo : 'NO DEFINIDO';

    // normalizando carrera objetivo
    let carrera = String(filaCruda['carrera_objetivo'] || '').trim().toUpperCase();
    if (!carrera || carrera === 'NULL' || carrera === 'UNDEFINED') {
      carrera = 'NINGUNO';
    } else if (carrera.startsWith('INGENIERIA EN CIENCIAS Y')) {
      carrera = 'INGENIERIA EN CIENCIAS Y SISTEMAS';
    }

    // normalizando institucion educativa
    let tipoInstitucion = String(filaCruda['tipo_institucion_educativa'] || '').trim().toUpperCase();
    if (!tipoInstitucion || tipoInstitucion === 'NULL' || tipoInstitucion === 'UNDEFINED') {
      tipoInstitucion = 'SIN REGISTRO';
    }
    const esPublica = this.clasificarInstitucionPublica(tipoInstitucion);

    // normalizando ubicacion geografica
    let departamento = String(filaCruda['departamento_institucion_educativa'] || '').trim().toUpperCase();
    if (!departamento || departamento === 'NULL') {
      departamento = 'NO REGISTRADO';
    }

    let municipio = String(filaCruda['municipio_institucion_educativa'] || '').trim().toUpperCase();
    if (!municipio || municipio === 'NULL') {
      municipio = 'NO REGISTRADO';
    } else if (
      municipio.startsWith('GUATEMALA -') ||
      municipio.includes('CIUDAD CAPITAL') ||
      municipio === 'GUATEMALA - CIUDAD' ||
      municipio === 'CIUDAD DE GUATEMALA'
    ) {
      municipio = 'GUATEMALA';
    } else if (municipio.startsWith('SAN JUAN SACATEPEQ')) {
      municipio = 'SAN JUAN SACATEPEQUEZ';
    } else if (municipio.startsWith('SAN PEDRO SACATEPEQ')) {
      municipio = 'SAN PEDRO SACATEPEQUEZ';
    } else if (municipio.startsWith('SAN LUCAS SACATEPEQ')) {
      municipio = 'SAN LUCAS SACATEPEQUEZ';
    } else if (municipio.startsWith('SANTIAGO SACATEPEQ')) {
      municipio = 'SANTIAGO SACATEPEQUEZ';
    } else if (municipio.startsWith('ANTIGUA GUATEMAL')) {
      municipio = 'ANTIGUA GUATEMALA';
    } else if (municipio.startsWith('TECPAN GUATEMAL')) {
      municipio = 'TECPAN GUATEMALA';
    } else if (municipio === 'SANTA CATARINA' && (departamento === 'GUATEMALA' || departamento === 'NO REGISTRADO' || !departamento)) {
      municipio = 'SANTA CATARINA PINULA';
    } else if (municipio.startsWith('NUEVA CONCEPCIO')) {
      municipio = 'NUEVA CONCEPCION';
    } else if (municipio.startsWith('SANTA CRUZ DEL')) {
      municipio = 'SANTA CRUZ DEL QUICHE';
    } else if (municipio.startsWith('NUEVA SANTA')) {
      municipio = 'NUEVA SANTA ROSA';
    } else if (municipio === 'SANTA LUCIA') {
      if (departamento === 'SACATEPEQUEZ') municipio = 'SANTA LUCIA MILPAS ALTAS';
      else if (departamento === 'SOLOLA') municipio = 'SANTA LUCIA UTATLAN';
      else municipio = 'SANTA LUCIA COTZUMALGUAPA';
    } else if (municipio === 'SAN ANDRES') {
      if (departamento === 'CHIMALTENANGO') municipio = 'SAN ANDRES ITZAPA';
      else if (departamento === 'RETALHULEU') municipio = 'SAN ANDRES VILLA SECA';
      else if (departamento === 'TOTONICAPAN') municipio = 'SAN ANDRES XECUL';
      else if (departamento === 'PETEN') municipio = 'SAN ANDRES';
      else municipio = 'SAN ANDRES SEMETABAJ';
    } else if (municipio === 'MELCHOR DE') {
      municipio = 'MELCHOR DE MENCOS';
    } else if (municipio === 'SAN JOSE LA') {
      municipio = 'SAN JOSE LA MAQUINA';
    } else if (municipio === 'SANTA ROSA DE') {
      municipio = 'SANTA ROSA DE LIMA';
    } else if (municipio === 'SAN MIGUEL' && departamento === 'BAJA VERAPAZ') {
      municipio = 'SAN MIGUEL CHICAJ';
    }

    // transformando fecha de asignacion
    const fechaAsignacionStr = fechaParseada.fecha.toISOString().split('T')[0];

    // registro para mongo
    const documentoMongo = {
      correlativo_aspirante: correlativo,
      fecha_asignacion: fechaParseada.fecha,
      sexo,
      anio_nacimiento: anioNacimiento,
      edad,
      materia,
      numero_de_fecha_de_evaluacion: numeroIntento,
      anio_de_ingreso: anioIngreso,
      aprobacion: aprobacionNormalizada,
      aprobo: esAprobado,
      carrera_objetivo: carrera,
      departamento_institucion_educativa: departamento,
      municipio_institucion_educativa: municipio,
      tipo_institucion_educativa: tipoInstitucion,
      es_publica: esPublica,
    };

    // documento para neo4j
    const documentoNeo4j = {
      correlativo_aspirante: correlativo,
      sexo,
      anio_nacimiento: anioNacimiento,
      edad,
      materia,
      numero_de_fecha_de_evaluacion: numeroIntento,
      anio_de_ingreso: anioIngreso,
      fecha_asignacion_str: fechaAsignacionStr,
      aprobacion: aprobacionNormalizada,
      aprobo: esAprobado,
      carrera_objetivo: carrera,
      tipo_institucion_educativa: tipoInstitucion,
      es_publica: esPublica,
      municipio_institucion_educativa: municipio,
      departamento_institucion_educativa: departamento,
    };

    return {
      valido: true,
      documentoMongo,
      documentoNeo4j
    };
  }

  /**
   * metodo que clasifica si una institucion educativa es publica osea si son:
   * oficiales, nacionales, cooperativas, experimentales o institutos,
   * excluyendo a las privadas.
   */
  private clasificarInstitucionPublica(tipo: string): boolean {
    if (!tipo) return false;
    const mayus = tipo.toUpperCase();
    if (/PRIVAD[OA]/i.test(mayus)) return false;
    return /OFICIAL|NACIONAL|P[UÚ]BLICA|MUNICIPAL|EXPERIMENTAL|COOPERATIVA|INEB|INED|ENCCA|INSTITUTO/i.test(
      mayus,
    );
  }

  /**
   * metodo que parsea cadenas de fecha en formatos: YYYY-MM-DD, DD/MM/YYYY y similares
   */
  private parsearFecha(cadenaFecha: any): { fecha: Date; mes: number } | null {
    if (!cadenaFecha || typeof cadenaFecha !== 'string') return null;
    const fechaStr = cadenaFecha.trim();

    // fecha en formato: YYYY-MM-DD o YYYY/MM/DD
    const anioMesDia = fechaStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (anioMesDia) {
      const anio = parseInt(anioMesDia[1], 10);
      const mes = parseInt(anioMesDia[2], 10);
      const dia = parseInt(anioMesDia[3], 10);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));
      if (!isNaN(fecha.getTime())) {
        return { fecha, mes };
      }
    }

    // fecha en formato: DD/MM/YYYY o DD-MM-YYYY
    const diaMesAnio = fechaStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (diaMesAnio) {
      const dia = parseInt(diaMesAnio[1], 10);
      const mes = parseInt(diaMesAnio[2], 10);
      const anio = parseInt(diaMesAnio[3], 10);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));
      if (!isNaN(fecha.getTime())) {
        return { fecha, mes };
      }
    }

    //si ninguna de las anteriores funciona se intenta parsear la fecha directamente
    const fallback = new Date(fechaStr);
    if (!isNaN(fallback.getTime())) {
      return { fecha: fallback, mes: fallback.getUTCMonth() + 1 };
    }

    return null;
  }

  /**
   * metodo que mapea y normaliza los encabezados de columnas para tolerar acentos,
   * espacios, mayúsculas y variaciones comunes de nombres en el CSV.
   */
  private mapearEncabezado(encabezado: string): string {
    const norm = encabezado
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ano/g, 'anio')
      .replace(/[\s\-]+/g, '_');

    if (norm.includes('correlativo')) return 'correlativo_aspirante';
    if (norm.includes('fecha') && norm.includes('asignacion')) return 'fecha_asignacion';
    if (norm.includes('materia')) return 'materia';
    if (norm.includes('sexo') || norm.includes('genero')) return 'sexo';
    if (norm.includes('nacimiento')) return 'anio_nacimiento';
    if (norm.includes('evaluac') || norm.includes('intento') || norm.includes('oportunidad'))
      return 'numero_de_fecha_de_evaluacion';
    if (norm.includes('ingreso')) return 'anio_de_ingreso';
    if (norm.includes('aprobacion') || norm.includes('resultado')) return 'aprobacion';
    if (norm.includes('carrera')) return 'carrera_objetivo';
    if (norm.includes('departamento')) return 'departamento_institucion_educativa';
    if (norm.includes('municipio')) return 'municipio_institucion_educativa';
    if (norm.includes('tipo') && norm.includes('institucion')) return 'tipo_institucion_educativa';

    return norm;
  }

  /**
   * metodo para detectear si el archivo usa , o ; como delimitador
   */
  private async detectarDelimitador(rutaArchivo: string): Promise<string> {
    const flujoArchivo = fs.createReadStream(rutaArchivo, { encoding: 'utf8' });
    const lineaPorLinea = readline.createInterface({ input: flujoArchivo, crlfDelay: Infinity });

    try {
      for await (const linea of lineaPorLinea) {
        if (linea.trim().length > 0) {
          const conteoComas = (linea.match(/,/g) || []).length;
          const conteoPuntosYComas = (linea.match(/;/g) || []).length;
          return conteoPuntosYComas > conteoComas ? ';' : ',';
        }
      }
    } finally {
      lineaPorLinea.close();
      flujoArchivo.destroy();
    }
    return ',';
  }

  /**
   * metodo para obtener el historial de cargas realizadas ordenadas descendentemente por fecha.
   */
  async obtenerHistorial(limite = 50): Promise<CargaHistorial[]> {
    return this.modeloCargaHistorial
      .find()
      .sort({ fecha_inicio: -1 })
      .limit(limite)
      .select('-errores.datos_crudos')
      .exec();
  }

  /**
   * metodo para obtener los detalles y muestra de errores de una carga específica.
   */
  async obtenerHistorialPorId(id: string): Promise<CargaHistorial> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de carga inválido.');
    }
    const registro = await this.modeloCargaHistorial.findById(id).exec();
    if (!registro) {
      throw new NotFoundException(`Registro de carga con ID ${id} no encontrado.`);
    }
    return registro;
  }

  /**
   * metodo para restablecer las bases de datos eliminando registros de evaluaciones, historial y nodos en Neo4j.
   */
  async restablecerDatos(): Promise<{ mensaje: string }> {
    await Promise.all([
      this.modeloEvaluacion.deleteMany({}),
      this.modeloCargaHistorial.deleteMany({}),
      this.servicioNeo4j.limpiarGrafo(),
    ]);
    return { mensaje: 'Datos de MongoDB y Neo4j restablecidos exitosamente.' };
  }
}
