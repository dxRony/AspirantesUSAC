import { Module } from '@nestjs/common';
import { Neo4jModule } from '../database/neo4j/neo4j.module';
import { ConsultasNeo4jController } from './consultas-neo4j.controller';
import { ConsultasNeo4jService } from './consultas-neo4j.service';

@Module({
  imports: [Neo4jModule],
  controllers: [ConsultasNeo4jController],
  providers: [ConsultasNeo4jService],
  exports: [ConsultasNeo4jService],
})
export class ConsultasNeo4jModule {}
