import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import * as path from 'path';
import { EtlService } from './etl.service';
import { RespuestaCargaDto } from './dto/respuesta-carga.dto';

@Controller('etl')
export class EtlController {
  constructor(private readonly servicioEtl: EtlService) { }

  /**
   * endpoint para la carga masiva y procesamiento de archivos csv
   * POST /api/etl/cargar
   */
  @Post('cargar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, archivo, callback) => {
          const sufijoUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const extension = path.extname(archivo.originalname) || '.csv';
          callback(null, `aspirantes-${sufijoUnico}${extension}`);
        },
      }),
      fileFilter: (_req, archivo, callback) => {
        const esCsv = path.extname(archivo.originalname).toLowerCase() === '.csv';
        if (esCsv) {
          callback(null, true);
        } else {
          callback(new BadRequestException('solo se permiten archivos con extensión .csv.'), false);
        }
      },
      limits: {
        // limite para archivos de hasta 100MB
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async cargarCsv(@UploadedFiles() archivos: Express.Multer.File[]): Promise<RespuestaCargaDto> {
    const archivo = archivos?.find((a) => a.fieldname === 'file' || a.fieldname === 'archivo') || archivos?.[0];

    if (!archivo) {
      throw new BadRequestException('debes adjuntar un archivo .csv en el formulario.');
    }

    if (path.extname(archivo.originalname).toLowerCase() !== '.csv') {
      throw new BadRequestException('solo se permiten archivos con extensión .csv.');
    }

    const resultado = await this.servicioEtl.procesarArchivoCsv(archivo);

    return {
      codigo_estado: HttpStatus.OK,
      mensaje:
        resultado.estado === 'COMPLETADO'
          ? 'Archivo CSV procesado e insertado exitosamente en MongoDB y Neo4j.'
          : resultado.estado === 'COMPLETADO_CON_ERRORES'
            ? 'Archivo procesado con observaciones: se identificaron y registraron filas rechazadas.'
            : 'El procesamiento del archivo falló o no se procesó ningún registro válido.',
      datos: {
        id_carga: resultado._id.toString(),
        nombre_archivo: resultado.nombre_archivo,
        total_leidos: resultado.total_leidos,
        total_procesados: resultado.total_procesados,
        total_rechazados: resultado.total_rechazados,
        tiempo_utilizado_ms: resultado.tiempo_utilizado_ms,
        estado: resultado.estado,
        fecha_inicio: resultado.fecha_inicio,
        fecha_fin: resultado.fecha_fin,
        errores_muestra: resultado.errores.slice(0, 50),
      },
    };
  }

  /**
   * metodo para obtener el historial de cargas masivas.
   * GET /api/etl/historial
   */
  @Get('historial')
  async obtenerHistorial() {
    const historial = await this.servicioEtl.obtenerHistorial();
    return {
      codigo_estado: HttpStatus.OK,
      total: historial.length,
      datos: historial,
    };
  }

  /**
   * endpoint para obtener el detalle y muestra de errores de una carga específica.
   * GET /api/etl/historial/:id
   */
  @Get('historial/:id')
  async obtenerHistorialPorId(@Param('id') id: string) {
    const detalle = await this.servicioEtl.obtenerHistorialPorId(id);
    return {
      codigo_estado: HttpStatus.OK,
      datos: detalle,
    };
  }

  /**
   * endpoint para restablecer MongoDB y Neo4j en pruebas.
   * DELETE /api/etl/limpiar
   */
  @Delete('limpiar')
  async restablecerDatos() {
    const res = await this.servicioEtl.restablecerDatos();
    return {
      codigo_estado: HttpStatus.OK,
      ...res,
    };
  }
}
