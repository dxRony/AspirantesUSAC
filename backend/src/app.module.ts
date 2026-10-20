import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Neo4jModule } from './database/neo4j/neo4j.module';
import { EtlModule } from './etl/etl.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/aspirantes_db'),
      }),
    }),
    Neo4jModule,
    EtlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) { }

  async onModuleInit() {
    console.log('Módulo Principal Inicializado con soporte para MongoDB, Neo4j y ETL.');
  }
}
