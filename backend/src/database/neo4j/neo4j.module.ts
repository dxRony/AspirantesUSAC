import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import neo4j, { Driver } from 'neo4j-driver';
import { Neo4jService } from './neo4j.service';

/**
 * modulo para el manejo de la base de datos neo4j
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'NEO4J_DRIVER',
      inject: [ConfigService],
      useFactory: (servicioConfiguracion: ConfigService): Driver => {
        const uri = servicioConfiguracion.get<string>('NEO4J_URI', 'bolt://localhost:7687');
        const usuario = servicioConfiguracion.get<string>('NEO4J_USER', 'neo4j');
        const clave = servicioConfiguracion.get<string>('NEO4J_PASSWORD', 'dxrony');
        return neo4j.driver(uri, neo4j.auth.basic(usuario, clave));
      },
    },
    Neo4jService,
  ],
  exports: ['NEO4J_DRIVER', Neo4jService],
})
export class Neo4jModule { }
