import { Controller, Get, Param, Query } from '@nestjs/common';
import { ConsultasNeo4jService } from './consultas-neo4j.service';

@Controller('consultas-neo4j')
export class ConsultasNeo4jController {
  constructor(private readonly consultasNeo4jService: ConsultasNeo4jService) { }

  // 1. Rutas de Aprobación por Carrera
  @Get('1')
  obtenerConsulta1(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: number,
    @Query('limite') limite?: number,
  ) {
    return this.consultasNeo4jService.consulta1_rutasAprobacion(carrera, anio, limite);
  }

  // 2. Flujo Geográfico de Demanda
  @Get('2')
  obtenerConsulta2(
    @Query('departamento') departamento?: string,
    @Query('carrera') carrera?: string,
    @Query('limite') limite?: number,
  ) {
    return this.consultasNeo4jService.consulta2_flujoGeografico(departamento, carrera, limite);
  }

  // 3. Cuellos de botella academincos
  @Get('3')
  obtenerConsulta3(
    @Query('minIntentos') minIntentos?: number,
    @Query('materia') materia?: string,
    @Query('carrera') carrera?: string,
    @Query('limite') limite?: number,
  ) {
    return this.consultasNeo4jService.consulta3_reintentosCriticos(minIntentos, materia, carrera, limite);
  }

  // 4. Evaluacion conjunta de materias
  @Get('4')
  obtenerConsulta4(
    @Query('anio') anio?: number,
    @Query('limite') limite?: number,
  ) {
    return this.consultasNeo4jService.consulta4_materiasConcurrentes(anio, limite);
  }

  // 5. Rendimiento por tipo de institucion
  @Get('5')
  obtenerConsulta5(
    @Query('tipoInstitucion') tipoInstitucion?: string,
    @Query('carrera') carrera?: string,
    @Query('limite') limite?: number,
  ) {
    return this.consultasNeo4jService.consulta5_brechaInstitucion(tipoInstitucion, carrera, limite);
  }

  // 6. historial y trayectoria de aspirante
  @Get('6/:correlativo')
  obtenerConsulta6(@Param('correlativo') correlativo: string) {
    return this.consultasNeo4jService.consulta6_egoNetworkAspirante(correlativo);
  }

  //endpoint sin correlativo
  @Get('6')
  obtenerConsulta6Query(@Query('correlativo') correlativo?: string) {
    return this.consultasNeo4jService.consulta6_egoNetworkAspirante(correlativo || '');
  }

}
