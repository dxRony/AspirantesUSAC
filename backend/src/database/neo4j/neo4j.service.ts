import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Driver, Session } from 'neo4j-driver';
import { CYPHER_CARGA_MASIVA, RESTRICCIONES_DUPLICADOS } from './consultas';

/**
 * clase para el manejo de la base de datos neo4j
 */
@Injectable()
export class Neo4jService implements OnApplicationBootstrap, OnApplicationShutdown {
  // var para registrar los eventos
  private readonly logger = new Logger(Neo4jService.name);

  constructor(@Inject('NEO4J_DRIVER') private readonly driver: Driver) { }

  /**
   * metodo para inicializar las restricciones de duplicados en neo4j
   */
  async onApplicationBootstrap() {
    await this.inicializarRestricciones();
  }

  /**
   * metodo para cerrar la conexion con neo4j
   */
  async onApplicationShutdown() {
    await this.driver.close();
    this.logger.log('conexion con neo4j cerrada correctamente.');
  }

  /**
   * metodo para crear las restricciones de duplicados en neo4j
   */
  async inicializarRestricciones(): Promise<void> {
    const sesion = this.driver.session();
    try {
      for (const restriccion of RESTRICCIONES_DUPLICADOS) {
        await sesion.run(restriccion);
      }
      this.logger.log('Restricciones de duplicados en neo4j verificadas.');
    } catch (error: any) {
      this.logger.error(`Error al crear restricciones en neo4j: ${error.message}`, error.stack);
    } finally {
      await sesion.close();
    }
  }

  /**
   * metodo para insertar o actualiza un lote de registros en neo4j mediante UNWIND y MERGE en una única transacción.
   */
  async cargarMasiva(lote: any[]): Promise<void> {
    if (!lote || lote.length === 0) return;

    const sesion: Session = this.driver.session();
    try {
      await sesion.executeWrite(async (transaccion) => {
        await transaccion.run(CYPHER_CARGA_MASIVA, { lote });
      });
    } catch (error: any) {
      this.logger.error(`Error en cargar datos a neo4j: ${error.message}`);
      throw error;
    } finally {
      await sesion.close();
    }
  }

  /**
   * metodo para ejecutar una consulta Cypher de lectura.
   */
  async leer<T = any>(consulta: string, parametros: Record<string, any> = {}): Promise<T[]> {
    const sesion = this.driver.session();
    try {
      const resultado = await sesion.executeRead(async (transaccion) => {
        return await transaccion.run(consulta, parametros);
      });
      return resultado.records.map((registro) => registro.toObject() as T);
    } finally {
      await sesion.close();
    }
  }

  /**
   * metodo para ejecutar una consulta Cypher de escritura.
   */
  async escribir<T = any>(consulta: string, parametros: Record<string, any> = {}): Promise<T[]> {
    const sesion = this.driver.session();
    try {
      const resultado = await sesion.executeWrite(async (transaccion) => {
        return await transaccion.run(consulta, parametros);
      });
      return resultado.records.map((registro) => registro.toObject() as T);
    } finally {
      await sesion.close();
    }
  }

  /**
   * metodo para eliminar todos los nodos y relaciones en la base de datos Neo4j.
   */
  async limpiarGrafo(): Promise<void> {
    const sesion = this.driver.session();
    try {
      await sesion.executeWrite(async (transaccion) => {
        await transaccion.run('MATCH (n) DETACH DELETE n');
      });
      this.logger.warn('Grafo de neo4j limpiado.');
    } finally {
      await sesion.close();
    }
  }

  obtenerDriver(): Driver {
    return this.driver;
  }
}
