import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CargaHistorialDocument = CargaHistorial & Document;

@Schema({ _id: false })
export class ErrorFila {
  @Prop({ required: true })
  fila: number;

  @Prop({ type: Object, default: {} })
  datos_crudos: Record<string, any>;

  @Prop({ required: true })
  motivo: string;
}

export const ErrorFilaSchema = SchemaFactory.createForClass(ErrorFila);

@Schema({ collection: 'cargas_historial', timestamps: true })
export class CargaHistorial {
  @Prop({ required: true })
  nombre_archivo: string;

  @Prop({ required: true, type: Number, default: 0 })
  total_leidos: number;

  @Prop({ required: true, type: Number, default: 0 })
  total_procesados: number;

  @Prop({ required: true, type: Number, default: 0 })
  total_rechazados: number;

  @Prop({ required: true, type: Number, default: 0 })
  tiempo_utilizado_ms: number;

  @Prop({
    required: true,
    enum: ['PROCESANDO', 'COMPLETADO', 'COMPLETADO_CON_ERRORES', 'FALLIDO'],
    default: 'PROCESANDO',
  })
  estado: string;

  @Prop({ required: true, type: Date, default: Date.now })
  fecha_inicio: Date;

  @Prop({ type: Date, default: null })
  fecha_fin: Date | null;

  @Prop({ type: [ErrorFilaSchema], default: [] })
  errores: ErrorFila[];
}

export const CargaHistorialSchema = SchemaFactory.createForClass(CargaHistorial);
