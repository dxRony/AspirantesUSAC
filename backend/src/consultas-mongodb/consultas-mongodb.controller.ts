import { Controller, Get, Post, Param } from '@nestjs/common';
import { ConsultasMongodbService } from './consultas-mongodb.service';

@Controller('consultas')
export class ConsultasMongodbController {
  constructor(private readonly servicioConsultas: ConsultasMongodbService) { }

  /**
   * 1. Aspirantes por tipo de institución educativa
   * GET /api/consultas/1
   */
  @Get('1')
  async consulta1() {
    return this.servicioConsultas.consulta1_aspirantesPorTipoInstitucion();
  }

  /**
   * 2. Cantidad de aprobados por materia
   * GET /api/consultas/2
   */
  @Get('2')
  async consulta2() {
    return this.servicioConsultas.consulta2_aprobadosPorMateria();
  }

  /**
   * 3. Aprobados por carrera y año de ingreso
   * GET /api/consultas/3
   */
  @Get('3')
  async consulta3() {
    return this.servicioConsultas.consulta3_aprobadosPorCarreraYAnio();
  }

  /**
   * 4. Porcentaje de aprobación por materia
   * GET /api/consultas/4
   */
  @Get('4')
  async consulta4() {
    return this.servicioConsultas.consulta4_porcentajeAprobacionPorMateria();
  }

  /**
   * 5. Promedio de edad por carrera
   * GET /api/consultas/5
   */
  @Get('5')
  async consulta5() {
    return this.servicioConsultas.consulta5_promedioEdadPorCarrera();
  }

  /**
   * 6.1 Generación de colección auxiliar resumen_carrera
   * POST /api/consultas/6/generar
   */
  @Post('6/generar')
  async consulta6Generar() {
    return this.servicioConsultas.consulta6_generarResumenCarrera();
  }

  /**
   * 6.2 Obtener datos de la colección auxiliar resumen_carrera
   * GET /api/consultas/6
   */
  @Get('6')
  async consulta6Obtener() {
    return this.servicioConsultas.obtenerColeccionResumenCarrera();
  }

  /**
   * 7. Promedio de edad de aspirantes aprobados por carrera y tipo de institución
   * GET /api/consultas/7
   */
  @Get('7')
  async consulta7() {
    return this.servicioConsultas.consulta7_promedioEdadAprobadosCarreraYTipoInstitucion();
  }

  /**
   * 8. Distribución de aprobados por municipio y carrera objetivo
   * GET /api/consultas/8
   */
  @Get('8')
  async consulta8() {
    return this.servicioConsultas.consulta8_distribucionAprobadosMunicipioYCarrera();
  }

  /**
   * 9. Cantidad de evaluaciones por mes y materia para instituciones públicas
   * GET /api/consultas/9
   */
  @Get('9')
  async consulta9() {
    return this.servicioConsultas.consulta9_evaluacionesPorMesYMateriaPublicas();
  }

  /**
   * 10. Top 5 de carreras más demandadas por aspirantes entre 16 y 18 años
   * GET /api/consultas/10
   */
  @Get('10')
  async consulta10() {
    return this.servicioConsultas.consulta10_top5CarrerasDemandadas16a18();
  }

  /**
   * 11. Historial de desempeño por aspirante
   * GET /api/consultas/11/:correlativo
   */
  @Get('11/:correlativo')
  async consulta11(@Param('correlativo') correlativo: string) {
    return this.servicioConsultas.consulta11_historialDesempenoAspirante(correlativo);
  }

  /**
   * 12. Distribución por sexo y tipo de institución educativa
   * GET /api/consultas/12
   */
  @Get('12')
  async consulta12() {
    return this.servicioConsultas.consulta12_distribucionSexoYTipoInstitucion();
  }

  /**
   * 13. Tasa de aprobación por edad
   * GET /api/consultas/13
   */
  @Get('13')
  async consulta13() {
    return this.servicioConsultas.consulta13_tasaAprobacionPorEdad();
  }

  /**
   * 14. Número promedio de intentos por materia
   * GET /api/consultas/14
   */
  @Get('14')
  async consulta14() {
    return this.servicioConsultas.consulta14_promedioIntentosPorMateria();
  }

  /**
   * 15. Historial completo de un aspirante
   * GET /api/consultas/15/:correlativo
   */
  @Get('15/:correlativo')
  async consulta15(@Param('correlativo') correlativo: string) {
    return this.servicioConsultas.consulta15_historialCompletoAspirante(correlativo);
  }

  /**
   * 16. Carreras con más aspirantes reprobados en primer intento
   * GET /api/consultas/16
   */
  @Get('16')
  async consulta16() {
    return this.servicioConsultas.consulta16_carrerasMasReprobadosPrimerIntento();
  }

  /**
   * 17. Top 5 municipios con mayor cantidad de aspirantes
   * GET /api/consultas/17
   */
  @Get('17')
  async consulta17() {
    return this.servicioConsultas.consulta17_top5MunicipiosAspirantes();
  }

  /**
   * 18. Tasa de aprobación por tipo de institución educativa
   * GET /api/consultas/18
   */
  @Get('18')
  async consulta18() {
    return this.servicioConsultas.consulta18_tasaAprobacionPorTipoInstitucion();
  }

  /**
   * 19. Carreras más demandadas por departamento
   * GET /api/consultas/19
   */
  @Get('19')
  async consulta19() {
    return this.servicioConsultas.consulta19_carrerasMasDemandadasPorDepartamento();
  }

  /**
   * 20. Evolución de aprobación por año de ingreso
   * GET /api/consultas/20
   */
  @Get('20')
  async consulta20() {
    return this.servicioConsultas.consulta20_evolucionAprobacionPorAnio();
  }
}
