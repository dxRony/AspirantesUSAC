import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Driver } from 'neo4j-driver';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject('NEO4J_DRIVER') private readonly neo4jDriver: Driver,
  ) {}

  async getHealth() {
    let mongoStatus = 'disconnected';
    if (this.mongoConnection.readyState === 1) {
      mongoStatus = 'connected';
    }

    let neo4jStatus = 'disconnected';
    try {
      const serverInfo = await this.neo4jDriver.getServerInfo();
      if (serverInfo) {
        neo4jStatus = `connected (${serverInfo.agent})`;
      }
    } catch (err: any) {
      neo4jStatus = `error: ${err.message}`;
    }

    return {
      status: 'ok',
      service: 'Aspirantes USAC API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      databases: {
        mongodb: mongoStatus,
        neo4j: neo4jStatus,
      },
    };
  }
}
