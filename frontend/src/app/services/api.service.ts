import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private readonly http: HttpClient) { }

  // etl
  subirCsv(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('archivo', archivo);
    return this.http.post(`${this.baseUrl}/etl/cargar`, formData);
  }

  obtenerHistorialCargas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/etl/historial`);
  }

  limpiarBasesDatos(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/etl/limpiar`);
  }

  // llamada a consultas de mongodb
  obtenerConsultaMongo(numero: number, parametros: Record<string, any> = {}): Observable<any> {
    if ((numero === 11 || numero === 15) && parametros['correlativo']) {
      return this.http.get(`${this.baseUrl}/consultas/${numero}/${encodeURIComponent(parametros['correlativo'])}`);
    }

    let params = new HttpParams();
    for (const clave of Object.keys(parametros)) {
      if (parametros[clave] !== null && parametros[clave] !== undefined && parametros[clave] !== '') {
        params = params.set(clave, parametros[clave]);
      }
    }
    return this.http.get(`${this.baseUrl}/consultas/${numero}`, { params });
  }

  // llamada a consultas de neo4j
  obtenerConsultaNeo4j(numero: number, parametros: Record<string, any> = {}): Observable<any> {
    let params = new HttpParams();
    for (const clave of Object.keys(parametros)) {
      if (parametros[clave] !== null && parametros[clave] !== undefined && parametros[clave] !== '') {
        params = params.set(clave, parametros[clave]);
      }
    }
    return this.http.get(`${this.baseUrl}/consultas-neo4j/${numero}`, { params });
  }

  obtenerEgoNetworkAspirante(correlativo: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/consultas-neo4j/6/${correlativo}`);
  }
}
