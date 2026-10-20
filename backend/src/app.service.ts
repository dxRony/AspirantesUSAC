import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Driver } from 'neo4j-driver';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly conexionMongo: Connection,
    @Inject('NEO4J_DRIVER') private readonly driverNeo4j: Driver,
  ) {}

  async obtenerEstadoSalud() {
    let estadoMongo = 'desconectado';
    if (this.conexionMongo.readyState === 1) {
      estadoMongo = 'conectado';
    }

    let estadoNeo4j = 'desconectado';
    try {
      const infoServidor = await this.driverNeo4j.getServerInfo();
      if (infoServidor) {
        estadoNeo4j = `conectado (${infoServidor.agent})`;
      }
    } catch (error: any) {
      estadoNeo4j = `error: ${error.message}`;
    }

    return {
      estado: 'ok',
      status: 'ok',
      servicio: 'API Aspirantes USAC',
      marca_tiempo: new Date().toISOString(),
      tiempo_activo_segundos: process.uptime(),
      bases_de_datos: {
        mongodb: estadoMongo,
        neo4j: estadoNeo4j,
      },
    };
  }
}
