import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  signal,
} from '@angular/core';
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
  vistaActiva = signal<'grafo' | 'tabla'>('grafo');

  // Filtros interactivos
  filtroCarrera = signal<string>('');
  filtroDepartamento = signal<string>('');
  filtroMinIntentos = signal<number>(2);
  filtroAnio = signal<string>('');
  filtroCorrelativo = signal<string>('asp_01');
  filtroLimite = signal<number>(40);

  cargando = signal<boolean>(false);
  resultado = signal<any>(null);
  error = signal<string | null>(null);

  private network: any = null;

  consultas: ConsultaGrafoInfo[] = [
    {
      id: 1,
      titulo: '1. Rutas de Aprobación por Carrera (Subgrafo de Éxito)',
      descripcion:
        'Red de materias aprobadas requeridas para ingresar a cada carrera y volumen de aspirantes admitidos.',
      filtrosPermitidos: ['carrera', 'anio', 'limite'],
    },
    {
      id: 2,
      titulo: '2. Flujo Geográfico de Demanda Territorial',
      descripcion:
        'Cadena de 4 saltos: Departamento -> Municipio -> Aspirantes -> Carrera Objetivo.',
      filtrosPermitidos: ['departamento', 'carrera', 'limite'],
    },
    {
      id: 3,
      titulo: '3. Cuellos de Botella y Reintentos Críticos',
      descripcion:
        'Materias que actúan como filtro crítico donde aspirantes requirieron 2 o más intentos y su resultado.',
      filtrosPermitidos: ['minIntentos', 'carrera', 'limite'],
    },
    {
      id: 4,
      titulo: '4. Red de Materias Concurrentes (Co-evaluación)',
      descripcion:
        'Proyección bipartita que conecta pares de materias evaluadas en simultáneo en el mismo año.',
      filtrosPermitidos: ['anio', 'limite'],
    },
    {
      id: 5,
      titulo: '5. Rendimiento por Tipo de Institución',
      descripcion:
        'Comparativa de volumen y tasa de aprobación entre colegios públicos y privados hacia cada carrera.',
      filtrosPermitidos: ['carrera', 'limite'],
    },
    {
      id: 6,
      titulo: '6. Red Egocéntrica (Subgrafo) de un Aspirante',
      descripcion:
        'Radiografía egocéntrica completa: aspirante en el centro conectado a su carrera, colegio, ubicación y exámenes.',
      filtrosPermitidos: ['correlativo'],
    },
  ];

  constructor(
    private readonly apiService: ApiService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
  ) {}

  ngOnInit(): void {
    this.ejecutarConsulta();
  }

  ngOnDestroy(): void {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
  }

  cambiarConsulta(id: number): void {
    this.consultaSeleccionada.set(id);
    this.ejecutarConsulta();
  }

  cambiarVista(vista: 'grafo' | 'tabla'): void {
    this.vistaActiva.set(vista);
    if (vista === 'grafo') {
      setTimeout(() => this.renderizarGrafo(), 50);
    }
  }

  tieneFiltro(nombre: string): boolean {
    const consulta = this.consultas.find((c) => c.id === this.consultaSeleccionada());
    return consulta?.filtrosPermitidos.includes(nombre) ?? false;
  }

  ejecutarConsulta(): void {
    this.cargando.set(true);
    this.error.set(null);

    const params: Record<string, any> = {};
    if (this.tieneFiltro('carrera') && this.filtroCarrera()) params['carrera'] = this.filtroCarrera();
    if (this.tieneFiltro('departamento') && this.filtroDepartamento()) params['departamento'] = this.filtroDepartamento();
    if (this.tieneFiltro('minIntentos')) params['minIntentos'] = this.filtroMinIntentos();
    if (this.tieneFiltro('anio') && this.filtroAnio()) params['anio'] = this.filtroAnio();
    if (this.tieneFiltro('limite')) params['limite'] = this.filtroLimite();

    const idConsulta = this.consultaSeleccionada();

    if (idConsulta === 6) {
      // Consulta de ego-network
      const correlativo = this.filtroCorrelativo() || 'asp_01';
      this.apiService.obtenerEgoNetworkAspirante(correlativo).subscribe({
        next: (resp) => {
          this.resultado.set(resp);
          this.cargando.set(false);
          if (this.vistaActiva() === 'grafo') {
            setTimeout(() => this.renderizarGrafo(), 100);
          }
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Error al obtener la red del aspirante en Neo4j.');
          this.cargando.set(false);
        },
      });
    } else {
      this.apiService.obtenerConsultaNeo4j(idConsulta, params).subscribe({
        next: (resp) => {
          this.resultado.set(resp);
          this.cargando.set(false);
          if (this.vistaActiva() === 'grafo') {
            setTimeout(() => this.renderizarGrafo(), 100);
          }
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Error al ejecutar la consulta de grafos en Neo4j.');
          this.cargando.set(false);
        },
      });
    }
  }

  async renderizarGrafo(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.graphContainer?.nativeElement) return;

    const datosGrafo = this.resultado()?.grafo;
    if (!datosGrafo || !datosGrafo.nodes || datosGrafo.nodes.length === 0) return;

    try {
      const { Network } = await import('vis-network/standalone');

      // Mapeo estilizado Barça para Vis.js
      const nodes = datosGrafo.nodes.map((n: any) => {
        let color = '#004D98'; // Barça Blue
        let shape = 'dot';
        let size = 20;

        if (n.group === 'Carrera') {
          color = '#004D98'; // Azul
          shape = 'box';
          size = 25;
        } else if (n.group === 'Materia') {
          color = '#A50044'; // Grana/Rojo
          shape = 'ellipse';
          size = 22;
        } else if (n.group === 'AspiranteCentral' || n.group === 'Aspirante') {
          color = '#FFC107'; // Amarillo Barça
          shape = 'diamond';
          size = 28;
        } else if (n.group === 'Departamento') {
          color = '#28a745'; // Verde
          shape = 'hexagon';
        } else if (n.group === 'Municipio') {
          color = '#17a2b8'; // Cyan
        } else if (n.group?.startsWith('Institucion')) {
          color = '#6f42c1'; // Púrpura
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

      const edges = datosGrafo.edges.map((e: any) => ({
        from: e.from,
        to: e.to,
        label: e.label || '',
        title: e.title || e.label || '',
        arrows: 'to',
        color: { color: 'rgba(255, 193, 7, 0.65)', highlight: '#FFC107' },
        font: { color: '#FFC107', size: 10, strokeWidth: 2, strokeColor: '#000000' },
        smooth: { type: 'continuous' },
      }));

      const options = {
        physics: {
          stabilization: true,
          barnesHut: { gravitationalConstant: -3000, springLength: 120 },
        },
        interaction: {
          hover: true,
          navigationButtons: true,
          keyboard: true,
          zoomView: true,
        },
      };

      if (this.network) {
        this.network.destroy();
      }

      this.network = new Network(this.graphContainer.nativeElement, { nodes, edges }, options);
    } catch (e) {
      console.error('Error al instanciar Vis.js Network:', e);
    }
  }

  obtenerColumnas(datos: any[]): string[] {
    if (!datos || datos.length === 0) return [];
    return Object.keys(datos[0]);
  }
}
