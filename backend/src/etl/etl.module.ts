import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EtlController } from './etl.controller';
import { EtlService } from './etl.service';
import { Evaluacion, EvaluacionSchema } from '../database/schemas/evaluacion.schema';
import { CargaHistorial, CargaHistorialSchema } from '../database/schemas/carga-historial.schema';
import { Neo4jModule } from '../database/neo4j/neo4j.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Evaluacion.name, schema: EvaluacionSchema },
      { name: CargaHistorial.name, schema: CargaHistorialSchema },
    ]),
    Neo4jModule,
  ],
  controllers: [EtlController],
  providers: [EtlService],
  exports: [EtlService],
})
export class EtlModule {}
