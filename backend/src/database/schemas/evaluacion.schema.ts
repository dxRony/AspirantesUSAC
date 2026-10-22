import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EvaluacionDocument = Evaluacion & Document;

@Schema({ collection: 'evaluaciones', timestamps: true })
export class Evaluacion {
  @Prop({ required: true, index: true })
  correlativo_aspirante: string;

  @Prop({ required: true, type: Date, index: true })
  fecha_asignacion: Date;

  @Prop({ required: true, default: 'NO DEFINIDO' })
  sexo: string;

  @Prop({ type: Number, default: null })
  anio_nacimiento: number | null;

  @Prop({ type: Number, default: null, index: true })
  edad: number | null;

  @Prop({ required: true, index: true })
  materia: string;

  @Prop({ required: true, type: Number })
  numero_de_fecha_de_evaluacion: number;

  @Prop({ required: true, type: Number, index: true })
  anio_de_ingreso: number;

  @Prop({ required: true })
  aprobacion: string;

  @Prop({ required: true, type: Boolean, index: true })
  aprobo: boolean;

  @Prop({ required: true, default: 'NINGUNO', index: true })
  carrera_objetivo: string;

  @Prop({ required: true, default: 'NO REGISTRADO', index: true })
  departamento_institucion_educativa: string;

  @Prop({ required: true, default: 'NO REGISTRADO', index: true })
  municipio_institucion_educativa: string;

  @Prop({ required: true, default: 'SIN REGISTRO', index: true })
  tipo_institucion_educativa: string;

  @Prop({ required: true, type: Boolean, default: false, index: true })
  es_publica: boolean;
}

export const EvaluacionSchema = SchemaFactory.createForClass(Evaluacion);

// indices para consultas analiticas
EvaluacionSchema.index({ materia: 1, aprobo: 1 });
EvaluacionSchema.index({ carrera_objetivo: 1, anio_de_ingreso: 1 });
EvaluacionSchema.index({ departamento_institucion_educativa: 1, municipio_institucion_educativa: 1 });
EvaluacionSchema.index({ tipo_institucion_educativa: 1, es_publica: 1 });
EvaluacionSchema.index({ fecha_asignacion: 1, materia: 1, es_publica: 1 });
EvaluacionSchema.index({ correlativo_aspirante: 1, materia: 1 });
