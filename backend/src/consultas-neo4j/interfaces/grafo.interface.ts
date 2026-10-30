/**
 * interfaz que representa un nodo en el formato estándar de visualización de grafos
 */
export interface NodoGrafo {
  id: string;
  label: string;
  group: string;
  title?: string;
  properties?: Record<string, any>;
}

/**
 * interfaz que representa una arista en el grafo.
 */
export interface AristaGrafo {
  id?: string;
  from: string;
  to: string;
  label?: string;
  weight?: number;
  title?: string;
  properties?: Record<string, any>;
}

/**
 * interfaz que representa un contenedor de elementos de red
 */
export interface ElementosGrafo {
  nodes: NodoGrafo[];
  edges: AristaGrafo[];
}

/**
 * interfaz que representa la estructura de respuesta para todas las consultas de Neo4j
 */
export interface RespuestaConsultaNeo4j<T = any> {
  consulta: number;
  titulo: string;
  descripcion: string;
  parametros?: Record<string, any>;
  total_registros: number;
  metricas: T[];
  grafo: ElementosGrafo;
  datos_aspirante?: any;
  evaluaciones?: any[];
}
