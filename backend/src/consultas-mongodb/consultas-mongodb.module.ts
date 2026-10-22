import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsultasMongodbController } from './consultas-mongodb.controller';
import { ConsultasMongodbService } from './consultas-mongodb.service';
import { Evaluacion, EvaluacionSchema } from '../database/schemas/evaluacion.schema';
import { ResumenCarrera, ResumenCarreraSchema } from '../database/schemas/resumen-carrera.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Evaluacion.name, schema: EvaluacionSchema },
      { name: ResumenCarrera.name, schema: ResumenCarreraSchema },
    ]),
  ],
  controllers: [ConsultasMongodbController],
  providers: [ConsultasMongodbService],
  exports: [ConsultasMongodbService],
})
export class ConsultasMongodbModule {}
