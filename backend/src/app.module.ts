import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import neo4j, { Driver } from 'neo4j-driver';

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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'NEO4J_DRIVER',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Driver => {
        const uri = configService.get<string>('NEO4J_URI', 'bolt://localhost:7687');
        const user = configService.get<string>('NEO4J_USER', 'neo4j');
        const password = configService.get<string>('NEO4J_PASSWORD', 'dxrony');
        return neo4j.driver(uri, neo4j.auth.basic(user, password));
      },
    },
  ],
  exports: ['NEO4J_DRIVER'],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) { }

  async onModuleInit() {
    console.log('Módulo Principal Inicializado.');
  }
}
