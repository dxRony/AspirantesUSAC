export class ErrorFilaDto {
  fila: number;
  datos_crudos: Record<string, any>;
  motivo: string;
}

export class MetricasCargaDto {
  id_carga: string;
  nombre_archivo: string;
  total_leidos: number;
  total_procesados: number;
  total_rechazados: number;
  tiempo_utilizado_ms: number;
  estado: string;
  fecha_inicio: Date;
  fecha_fin: Date | null;
  errores_muestra: ErrorFilaDto[];
}

export class RespuestaCargaDto {
  codigo_estado: number;
  mensaje: string;
  datos: MetricasCargaDto;
}
