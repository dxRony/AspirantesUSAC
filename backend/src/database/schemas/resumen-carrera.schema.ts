import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ResumenCarreraDocument = ResumenCarrera & Document;

@Schema({ collection: 'resumen_carrera', timestamps: true })
export class ResumenCarrera {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true, type: Number, default: 0 })
  total_evaluaciones: number;

  @Prop({ required: true, type: Number, default: 0 })
  total_aspirantes_unicos: number;

  @Prop({ required: true, type: Number, default: 0 })
  total_aprobados: number;

  @Prop({ required: true, type: Number, default: 0 })
  tasa_aprobacion: number;

  @Prop({ type: Number, default: null })
  edad_promedio: number | null;

  @Prop({ type: [String], default: [] })
  materias_evaluadas: string[];

  @Prop({ required: true, type: Date, default: Date.now })
  fecha_actualizacion: Date;
}

export const ResumenCarreraSchema = SchemaFactory.createForClass(ResumenCarrera);
