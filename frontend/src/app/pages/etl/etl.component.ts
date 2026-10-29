import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-etl',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './etl.component.html',
  styleUrl: './etl.component.css',
})
export class EtlComponent implements OnInit {
  archivoSeleccionado = signal<File | null>(null);
  cargando = signal<boolean>(false);
  resultadoCarga = signal<any>(null);
  historialCargas = signal<any[]>([]);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.cargarHistorial();
  }

  onArchivoSeleccionado(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.archivoSeleccionado.set(file);
      this.mensajeError.set(null);
    }
  }

  ejecutarCarga(): void {
    const file = this.archivoSeleccionado();
    if (!file) {
      this.mensajeError.set('Por favor, selecciona un archivo CSV antes de procesar.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    this.apiService.subirCsv(file).subscribe({
      next: (resp) => {
        const datos = resp?.datos ?? resp;
        this.resultadoCarga.set(datos);
        const tiempo = datos?.tiempo_utilizado_ms ?? resp?.tiempo_utilizado_ms;
        this.mensajeExito.set(`¡Carga masiva completada exitosamente en ${tiempo} ms!`);
        this.cargando.set(false);
        this.cargarHistorial();
      },
      error: (err) => {
        this.mensajeError.set(err?.error?.message || 'Error al procesar el archivo CSV.');
        this.cargando.set(false);
      },
    });
  }

  cargarHistorial(): void {
    this.apiService.obtenerHistorialCargas().subscribe({
      next: (resp: any) => {
        const historial = Array.isArray(resp) ? resp : (resp?.datos ?? []);
        this.historialCargas.set(historial);
        // Si no hay resultadoCarga activo pero hay historial, mostrar el más reciente en métricas
        if (!this.resultadoCarga() && historial.length > 0) {
          this.resultadoCarga.set(historial[0]);
        }
      },
      error: () => {},
    });
  }

  limpiarBases(): void {
    if (!confirm('¿Estás seguro de que deseas vaciar MongoDB y Neo4j? Esta acción eliminará todos los registros cargados.')) {
      return;
    }

    this.cargando.set(true);
    this.apiService.limpiarBasesDatos().subscribe({
      next: () => {
        this.resultadoCarga.set(null);
        this.mensajeExito.set('Bases de datos MongoDB y Neo4j limpiadas con éxito.');
        this.cargando.set(false);
        this.cargarHistorial();
      },
      error: (err) => {
        this.mensajeError.set(err?.error?.message || 'Error al limpiar las bases de datos.');
        this.cargando.set(false);
      },
    });
  }
}
