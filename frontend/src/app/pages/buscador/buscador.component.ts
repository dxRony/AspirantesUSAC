import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador.component.html',
  styleUrl: './buscador.component.css',
})
export class BuscadorComponent {
  terminoBusqueda = signal<string>('');
  cargando = signal<boolean>(false);
  aspirante = signal<any>(null);
  error = signal<string | null>(null);

  constructor(private readonly apiService: ApiService) { }

  buscar(): void {
    const correlativo = this.terminoBusqueda()?.trim();
    if (!correlativo) {
      this.error.set('Por favor, ingresa un correlativo de aspirante.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.aspirante.set(null);

    this.apiService.obtenerConsultaMongo(15, { correlativo }).subscribe({
      next: (resp) => {
        const crudo = resp?.datos || resp;
        if (crudo?.datos_aspirante) {
          this.aspirante.set({
            ...crudo.datos_aspirante,
            evaluaciones: crudo.evaluaciones || [],
          });
        } else if (Array.isArray(crudo) && crudo.length > 0) {
          this.aspirante.set(crudo[0]);
        } else if (crudo && typeof crudo === 'object' && Object.keys(crudo).length > 0) {
          this.aspirante.set(crudo);
        } else {
          this.error.set(`No se encontraron registros para el correlativo "${correlativo}".`);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Error al buscar el aspirante.');
        this.cargando.set(false);
      },
    });
  }

}
