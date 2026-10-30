import { Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild, signal, } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface ConsultaGrafoInfo {
  id: number;
  titulo: string;
  descripcion: string;
  filtrosPermitidos: string[];
}

@Component({
  selector: 'app-neo4j',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './neo4j.component.html',
  styleUrl: './neo4j.component.css',
})
export class Neo4jComponent implements OnInit, OnDestroy {
  @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;

  consultaSeleccionada = signal<number>(1);

  // filtros interactivos
  filtroCarrera: string = '';
  filtroDepartamento: string = 'GUATEMALA';
  filtroTipoInst: string = '';
  filtroMinIntentos: number = 2;
  filtroAnio: string = '';
  filtroCorrelativo: string = '';
  filtroLimite: number = 40;

  // catalogos para selects
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

  tiposInstitucionDisponibles: { valor: string; etiqueta: string }[] = [
    { valor: 'PUBLICO', etiqueta: 'Públicas (Público, Cooperativa, Municipal)' },
    { valor: 'PRIVADO', etiqueta: 'Privadas (Privado y Sin Datos)' },
    { valor: 'POR COOPERATIVA', etiqueta: 'Solo Por Cooperativa' },
    { valor: 'MUNICIPAL', etiqueta: 'Solo Municipal' },
    { valor: 'SIN DATOS', etiqueta: 'Solo Sin Datos' },
  ];

  intentosDisponibles: number[] = [2, 3, 4, 5];

  cargando = signal<boolean>(false);
  resultado = signal<any>(null);
  error = signal<string | null>(null);

  private network: any = null;

  consultas: ConsultaGrafoInfo[] = [
    {
      id: 1,
      titulo: '1. Rutas de Aprobación por Carrera',
      descripcion:
        'Red de materias aprobadas requeridas para ingresar a cada carrera y volumen de aspirantes admitidos.',
      filtrosPermitidos: ['carrera', 'anio'],
    },
    {
      id: 2,
      titulo: '2. Flujo Geográfico de Demanda Territorial',
      descripcion:
        'Cadena de 4 saltos: Departamento -> Municipio -> Aspirantes -> Carrera Objetivo.',
      filtrosPermitidos: ['departamento', 'carrera'],
    },
    {
      id: 3,
      titulo: '3. Cuellos de Botella Académicos',
      descripcion:
        'Identifica las materias donde los aspirantes se estancan requiriendo 2 o más intentos.',
      filtrosPermitidos: ['minIntentos', 'carrera'],
    },
    {
      id: 4,
      titulo: '4. Evaluación Conjunta de Materias',
      descripcion:
        'Identifica la cantidad de aspirantes que se examinaron simultáneamente en ambas materias (Matemática y Computación) durante un mismo ciclo de admisión.',
      filtrosPermitidos: ['anio'],
    },
    {
      id: 5,
      titulo: '5. Rendimiento por Tipo de Institución',
      descripcion:
        'Comparativa de volumen y tasa de aprobación entre colegios públicos y privados hacia cada carrera.',
      filtrosPermitidos: ['tipoInstitucion', 'carrera'],
    },
    {
      id: 6,
      titulo: '6. Historial y Trayectoria del Aspirante',
      descripcion:
        'Visualización del aspirante conectado a todos sus datos demográficos, académicos y el historial completo de sus evaluaciones.',
      filtrosPermitidos: ['correlativo'],
    },
  ];

  constructor(
    private readonly apiService: ApiService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
  ) { }

  ngOnInit(): void {
    this.cambiarConsulta(1);
  }

  ngOnDestroy(): void {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
  }

  cambiarConsulta(id: number): void {
    this.consultaSeleccionada.set(Number(id));
    this.error.set(null);
    this.resultado.set(null);

    // reiniciando los filtros
    this.filtroCarrera = '';
    this.filtroDepartamento = Number(id) === 2 ? 'GUATEMALA' : '';
    this.filtroTipoInst = '';
    this.filtroAnio = '';
    this.filtroCorrelativo = '';
    this.filtroMinIntentos = 2;
    this.filtroLimite = 40;

    // Si es la consulta 6, no se ejecuta hasta que se ingrese el correlativo
    if (Number(id) === 6) {
      return;
    }

    this.ejecutarConsulta();
  }

  tieneFiltro(nombre: string): boolean {
    const consulta = this.consultas.find((c) => c.id === this.consultaSeleccionada());
    return consulta?.filtrosPermitidos.includes(nombre) ?? false;
  }

  limpiarFiltros(): void {
    this.filtroCarrera = '';
    this.filtroDepartamento = this.consultaSeleccionada() === 2 ? 'GUATEMALA' : '';
    this.filtroTipoInst = '';
    this.filtroAnio = '';
    this.filtroMinIntentos = 2;
    this.filtroLimite = 40;
    this.ejecutarConsulta();
  }

  ejecutarConsulta(): void {
    const idConsulta = this.consultaSeleccionada();

    if (idConsulta === 6) {
      const correlativo = this.filtroCorrelativo.trim();
      if (!correlativo) {
        this.error.set('Por favor, ingresa el correlativo del aspirante para consultar su historial y trayectoria.');
        return;
      }

      this.cargando.set(true);
      this.error.set(null);

      this.apiService.obtenerEgoNetworkAspirante(correlativo).subscribe({
        next: (resp) => {
          this.resultado.set(resp);
          this.cargando.set(false);
          setTimeout(() => this.renderizarGrafo(), 50);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Error al obtener la red del aspirante en Neo4j.');
          this.cargando.set(false);
        },
      });
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    const params: Record<string, any> = {};
    if (this.tieneFiltro('carrera') && this.filtroCarrera) params['carrera'] = this.filtroCarrera;
    if (this.tieneFiltro('departamento') && this.filtroDepartamento) params['departamento'] = this.filtroDepartamento;
    if (this.tieneFiltro('tipoInstitucion') && this.filtroTipoInst) params['tipoInstitucion'] = this.filtroTipoInst;
    if (this.tieneFiltro('minIntentos')) params['minIntentos'] = this.filtroMinIntentos;
    if (this.tieneFiltro('anio') && this.filtroAnio) params['anio'] = this.filtroAnio;
    params['limite'] = 50;

    this.apiService.obtenerConsultaNeo4j(idConsulta, params).subscribe({
      next: (resp) => {
        this.resultado.set(resp);
        this.cargando.set(false);
        setTimeout(() => this.renderizarGrafo(), 50);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Error al ejecutar la consulta de grafos en Neo4j.');
        this.cargando.set(false);
      },
    });
  }

  async renderizarGrafo(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.graphContainer?.nativeElement) return;

    const datosGrafo = this.resultado()?.grafo;
    if (!datosGrafo || !datosGrafo.nodes || datosGrafo.nodes.length === 0) return;

    try {
      const { Network } = await import('vis-network/standalone');

      // dando colores y formas a los nodos
      const nodes = datosGrafo.nodes.map((n: any) => {
        let color = '#004D98';
        let shape = 'dot';
        let size = 20;

        if (n.group === 'Carrera') {
          color = '#004D98';
          shape = 'box';
          size = 25;
        } else if (n.group === 'Materia') {
          color = '#A50044';
          shape = 'ellipse';
          size = 22;
        } else if (n.group === 'AspiranteCentral' || n.group === 'Aspirante') {
          color = '#FFC107';
          shape = 'diamond';
          size = 28;
        } else if (n.group === 'Departamento') {
          color = '#28a745';
          shape = 'hexagon';
        } else if (n.group === 'Municipio') {
          color = '#17a2b8';
        } else if (n.group?.startsWith('Institucion')) {
          color = '#6f42c1';
        }

        return {
          id: n.id,
          label: n.label,
          title: n.title || n.label,
          shape,
          size,
          color: {
            background: color,
            border: '#FFFFFF',
            highlight: { background: '#FFC107', border: '#004D98' },
          },
          font: { color: '#FFFFFF', size: 12, bold: { color: '#FFFFFF' } },
        };
      });

      // Identificar consulta activa
      const idConsulta = this.consultaSeleccionada();

      // Las consultas de flujo dirigido (1: Materia->Carrera, 2: Depto->Muni->Carrera, 3: Materia->Carrera, 5: Inst->Carrera)
      // se presentan en layout jerárquico horizontal para que no se bugee el grafo
      const esJerarquica = [1, 2, 3, 5].includes(idConsulta);
      const esConsulta2 = idConsulta === 2;

      //definiendo aristas
      const edges = datosGrafo.edges.map((e: any) => {
        const peso = e.weight || e.properties?.aprobados || e.properties?.total_aspirantes || 1;
        // dando un grosor proporcional al volumen
        const ancho = esJerarquica ? Math.max(1.5, Math.min(8, Math.log10(peso + 1) * 2.2)) : 1.8;

        const colorBorde = e.properties?.color || 'rgba(255, 193, 7, 0.65)';
        let smoothConfig: any = { type: 'continuous' };
        if (esJerarquica) {
          smoothConfig = { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.6 };
        } else if (e.properties?.roundness !== undefined && e.properties.roundness !== 0) {
          smoothConfig = {
            enabled: true,
            type: e.properties.smoothType || 'curvedCW',
            roundness: Math.abs(e.properties.roundness),
          };
        }

        return {
          from: e.from,
          to: e.to,
          // con consultas jerárquicas con muchas aristas se oculta el texto encimado
          label: esJerarquica ? '' : (e.label || ''),
          title: e.title || e.label || '',
          arrows: 'to',
          width: ancho,
          color: { color: colorBorde, highlight: '#FFC107', hover: '#00D26A' },
          font: { color: e.properties?.color || '#FFC107', size: 10, strokeWidth: 2, strokeColor: '#000000' },
          smooth: smoothConfig,
        };
      });

      let options: any = {
        interaction: {
          hover: true,
          navigationButtons: true,
          keyboard: true,
          zoomView: true,
          tooltipDelay: 100,
        },
      };

      if (esJerarquica) {
        // configurando la disposicion jerárquica horizontal para evitar rebotes
        options.layout = {
          hierarchical: {
            enabled: true,
            direction: 'LR',
            sortMethod: 'directed',
            levelSeparation: esConsulta2 ? 280 : 360,
            nodeSpacing: esConsulta2 ? 38 : 48,
            treeSpacing: 70,
          },
        };
        options.physics = {
          enabled: false,
        };
      } else {
        // para consultas de redes orgánicas (4 y 6) se usa ForceAtlas2 suave
        options.physics = {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -40,
            centralGravity: 0.015,
            springLength: 130,
            springConstant: 0.08,
            damping: 0.45,
            avoidOverlap: 0.9,
          },
          stabilization: {
            enabled: true,
            iterations: 200,
            updateInterval: 25,
          },
        };
      }

      if (this.network) {
        this.network.destroy();
      }

      this.network = new Network(this.graphContainer.nativeElement, { nodes, edges }, options);

      // si la consulta usa fisica organica se congelaa la simulación para evitar rebotes
      if (!esJerarquica) {
        this.network.once('stabilizationIterationsDone', () => {
          this.network.setOptions({ physics: { enabled: false } });
        });
      }
    } catch (e) {
      console.error('Error al instanciar Vis.js Network:', e);
    }
  }
}
