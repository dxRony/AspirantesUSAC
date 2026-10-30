import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { generarConfiguracionGrafico, ConfiguracionGraficoMongo } from './mongodb-chart.helper';

interface DefinicionConsulta {
  id: number;
  titulo: string;
  descripcion: string;
  requiereParam?: string;
}

@Component({
  selector: 'app-mongodb',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mongodb.component.html',
  styleUrl: './mongodb.component.css',
})
export class MongodbComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  consultaSeleccionada = signal<DefinicionConsulta | null>(null);
  configGrafico = signal<ConfiguracionGraficoMongo | null>(null);
  private chart: any = null;

  // Parámetros y filtros como propiedades estándar compatibles al 100% con [(ngModel)]
  parametroInput: string = '';
  filtroAnio: string = '';
  filtroCarrera: string = '';
  filtroTipoInst: string = '';
  filtroDepto: string = '';
  filtroSexo: string = '';

  // Catálogos para selectores
  aniosDisponibles: number[] = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

  carrerasDisponibles: string[] = [
    'INGENIERIA EN CIENCIAS Y SISTEMAS',
    'INGENIERIA CIVIL',
    'INGENIERIA INDUSTRIAL',
    'INGENIERIA MECANICA',
    'INGENIERIA QUIMICA',
    'INGENIERIA ELECTRONICA',
    'INGENIERIA ELECTRICA',
    'INGENIERIA AMBIENTAL',
    'INGENIERIA MECANICA INDUSTRIAL',
    'INGENIERIA MECANICA ELECTRICA',
    'LICENCIATURA EN MATEMATICA APLICADA',
    'LICENCIATURA EN FISICA APLICADA',
    'ITUGS',
  ];

  departamentosDisponibles: string[] = [
    'ALTA VERAPAZ',
    'BAJA VERAPAZ',
    'CHIMALTENANGO',
    'CHIQUIMULA',
    'EL PROGRESO',
    'ESCUINTLA',
    'EXTRANJERO',
    'GUATEMALA',
    'HUEHUETENANGO',
    'IZABAL',
    'JALAPA',
    'JUTIAPA',
    'PETEN',
    'QUEZALTENANGO',
    'QUICHE',
    'RETALHULEU',
    'SACATEPEQUEZ',
    'SAN MARCOS',
    'SANTA ROSA',
    'SOLOLA',
    'SUCHITEPEQUEZ',
    'TOTONICAPAN',
    'ZACAPA',
  ];

  tiposInstitucionDisponibles: string[] = [
    'PUBLICO',
    'PRIVADO',
    'POR COOPERATIVA',
    'MUNICIPAL',
    'SIN DATOS',
  ];

  cargando = signal<boolean>(false);
  resultado = signal<any>(null);
  error = signal<string | null>(null);

  // 20 consultas analíticas
  consultas: DefinicionConsulta[] = [
    { id: 1, titulo: '1. Aspirantes por tipo de institución educativa', descripcion: 'Cantidad de aspirantes únicos agrupados por tipo de institución educativa.' },
    { id: 2, titulo: '2. Cantidad de aprobados por materia', descripcion: 'Cantidad total de evaluaciones aprobadas agrupadas por materia.' },
    { id: 3, titulo: '3. Aprobados por carrera y año de ingreso', descripcion: 'Aspirantes aprobados agrupados por carrera objetivo y año de ingreso.' },
    { id: 4, titulo: '4. Porcentaje de aprobación por materia', descripcion: 'Tasa y porcentaje de éxito correspondiente a cada materia evaluada.' },
    { id: 5, titulo: '5. Promedio de edad por carrera', descripcion: 'Porcentaje de aprobacion correspondiente a cada materia.' },
    { id: 6, titulo: '6. Creacion de colección auxiliar resumen_carrera', descripcion: 'Genera o actualiza la colección auxiliar con info resumida por carrera.' },
    { id: 7, titulo: '7. Promedio de edad de aspirantes aprobados por carrera y tipo de institución', descripcion: 'Edad promedio de aspirantes aprobados agrupada por carrera y tipo de institucion educativa.' },
    { id: 8, titulo: '8. Distribución de aprobados por municipio y carrera', descripcion: 'Cantidad de aprobados segun el municipio de la institucion educativa y la carrera objetivo.' },
    { id: 9, titulo: '9. Cantidad de evaluaciones por mes y materia para instituciones públicas', descripcion: 'Cantidad de evaluaciones realizadas por mes y materia, considerando únicamente aspirantes provenientes de instituciones públicas.' },
    { id: 10, titulo: '10. Top 5 carreras más demandadas por aspirantes entre 16 y 18 años', descripcion: 'Las cinco carreras con mayor volumen de aspirantes en ese rango de edad.' },
    { id: 11, titulo: '11. Historial de desempeño por aspirante', descripcion: 'Historial de un aspirante mostrando sus evaluaciones, materias, intentos y resultados.', requiereParam: 'correlativo' },
    { id: 12, titulo: '12. Distribución por sexo y tipo de institución educativa', descripcion: 'Cantidad de aspirantes agrupados por sexo y tipo de institución.' },
    { id: 13, titulo: '13. Tasa de aprobación por edad', descripcion: 'Porcentaje de aprobación correspondiente a cada edad.' },
    { id: 14, titulo: '14. Numero promedio de intentos por materia', descripcion: 'Promedio de oportunidades de evaluación utilizadas por los aspirantes para cada materia.' },
    { id: 15, titulo: '15. Historial completo de un aspirante', descripcion: 'Toda la información disponible de un aspirante identificado mediante su correlativo_aspirante.', requiereParam: 'correlativo' },
    { id: 16, titulo: '16. Carreras con más aspirantes reprobados en primer intento', descripcion: 'Carreras objetivo con mayor cantidad de aspirantes que no aprobaron en su primera oportunidad de evaluación.' },
    { id: 17, titulo: '17. Top 5 municipios con mayor cantidad de aspirantes', descripcion: 'Cinco municipios de procedencia de instituciones educativas con mayor cantidad de aspirantes registrados.' },
    { id: 18, titulo: '18. Tasa de aprobación por tipo de institución educativa', descripcion: 'Comparar el porcentaje de aprobación entre los diferentes tipos de institución educativa.' },
    { id: 19, titulo: '19. Carreras más demandadas por departamento', descripcion: 'Carreras objetivo con mayor demanda dentro de cada departamento de procedencia de la institución educativa.' },
    { id: 20, titulo: '20. Evolución de aprobación por año de ingreso', descripcion: 'Cantidad y porcentaje de evaluaciones aprobadas y no aprobadas agrupadas por año de ingreso.' },
  ];

  constructor(
    private readonly apiService: ApiService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
  ) { }

  ngOnInit(): void {
    this.seleccionarPorId(1);
  }

  ngOnDestroy(): void {
    this.destruirGrafico();
  }

  seleccionarPorId(id: number): void {
    const seleccionada = this.consultas.find((c) => c.id === Number(id));
    if (seleccionada) {
      this.seleccionarConsulta(seleccionada);
    }
  }

  seleccionarConsulta(consulta: DefinicionConsulta): void {
    this.destruirGrafico();
    this.configGrafico.set(null);

    this.consultaSeleccionada.set(consulta);
    this.resultado.set(null);
    this.error.set(null);

    // Reiniciar valores de filtros
    this.parametroInput = '';
    this.filtroAnio = '';
    this.filtroCarrera = '';
    this.filtroTipoInst = '';
    this.filtroDepto = '';
    this.filtroSexo = '';

    // Si la consulta requiere correlativo (ej. 11 y 15), no ejecutar automáticamente
    if (consulta.requiereParam) {
      return;
    }

    this.ejecutarConsulta();
  }

  private destruirGrafico(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  async renderizarGrafico(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.chartCanvas?.nativeElement) return;
    const cfg = this.configGrafico();
    if (!cfg) return;

    try {
      const { Chart } = await import('chart.js/auto');
      this.destruirGrafico();
      this.chart = new Chart(this.chartCanvas.nativeElement, cfg.config);
    } catch (e) {
      console.error('Error al instanciar Chart.js:', e);
    }
  }

  limpiarFiltros(): void {
    this.filtroAnio = '';
    this.filtroCarrera = '';
    this.filtroTipoInst = '';
    this.filtroDepto = '';
    this.filtroSexo = '';
    this.ejecutarConsulta();
  }

  ejecutarConsulta(): void {
    const consulta = this.consultaSeleccionada();
    if (!consulta) return;

    const params: Record<string, any> = {};

    if (consulta.id === 11 || consulta.id === 15) {
      const correlativo = this.parametroInput.trim();
      if (!correlativo) {
        return;
      }
      params['correlativo'] = correlativo;
    } else if (consulta.id === 3) {
      if (this.filtroAnio.trim()) params['anio'] = this.filtroAnio.trim();
      if (this.filtroCarrera.trim()) params['carrera'] = this.filtroCarrera.trim();
    } else if (consulta.id === 7) {
      if (this.filtroCarrera.trim()) params['carrera'] = this.filtroCarrera.trim();
      if (this.filtroTipoInst.trim()) params['tipo_institucion'] = this.filtroTipoInst.trim();
    } else if (consulta.id === 8) {
      if (this.filtroDepto.trim()) params['departamento'] = this.filtroDepto.trim();
      if (this.filtroCarrera.trim()) params['carrera'] = this.filtroCarrera.trim();
    } else if (consulta.id === 12) {
      if (this.filtroSexo.trim()) params['sexo'] = this.filtroSexo.trim();
      if (this.filtroTipoInst.trim()) params['tipo_institucion'] = this.filtroTipoInst.trim();
    }

    this.cargando.set(true);
    this.error.set(null);
    this.destruirGrafico();

    this.apiService.obtenerConsultaMongo(consulta.id, params).subscribe({
      next: (resp) => {
        this.resultado.set(resp);
        this.cargando.set(false);
        const cfg = generarConfiguracionGrafico(consulta.id, resp);
        this.configGrafico.set(cfg);
        if (cfg) {
          setTimeout(() => this.renderizarGrafico(), 80);
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Error al ejecutar la consulta en MongoDB.');
        this.cargando.set(false);
      },
    });
  }

  obtenerTotalRegistros(): number {
    const res = this.resultado();
    if (!res) return 0;
    if (Array.isArray(res)) return res.length;
    if (res.total_evaluaciones !== undefined) return res.total_evaluaciones;
    if (Array.isArray(res.evaluaciones)) return res.evaluaciones.length;
    if (typeof res.total_registros === 'number') return res.total_registros;
    if (Array.isArray(res.datos)) return res.datos.length;
    return 1;
  }

  obtenerColumnas(datos: any): string[] {
    if (!datos || !Array.isArray(datos) || datos.length === 0) return [];
    const keys = new Set<string>();
    datos.slice(0, 5).forEach((item) => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }

  formatearValor(val: any): string {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const fecha = new Date(val);
      if (!isNaN(fecha.getTime())) {
        const dia = String(fecha.getUTCDate()).padStart(2, '0');
        const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
        const anio = fecha.getUTCFullYear();
        return `${dia}/${mes}/${anio}`;
      }
    }
    if (Array.isArray(val)) {
      return val.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ');
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }
}
