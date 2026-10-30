export interface KpiItem {
  label: string;
  valor: string | number;
  subtexto?: string;
  color?: string;
}

export interface ConfiguracionGraficoMongo {
  id: number;
  tituloGrafico: string;
  tipo: 'bar' | 'line' | 'doughnut' | 'pie';
  kpis: KpiItem[];
  config: any; // ChartConfiguration de Chart.js
}

const PALETA_COLORES = [
  '#004D98',
  '#A50044',
  '#EDBB00',
  '#28a745',
  '#17a2b8',
  '#6f42c1',
  '#fd7e14',
  '#e83e8c',
  '#20c997',
  '#6610f2',
];

/**
 * Función principal que genera la configuración de Chart.js y KPIs según la consulta de MongoDB
 */
export function generarConfiguracionGrafico(idConsulta: number, datos: any): ConfiguracionGraficoMongo | null {
  if (!datos) return null;
  const lista = Array.isArray(datos) ? datos : (Array.isArray(datos.datos) ? datos.datos : (Array.isArray(datos.resumen) ? datos.resumen : []));

  // Las consultas 6 (colección auxiliar), 11 y 15 (historial individual) no requieren gráfica
  if ([6, 11, 15].includes(idConsulta) || lista.length === 0) {
    return null;
  }

  switch (idConsulta) {
    // 1. Aspirantes por tipo de institución educativa (Dona)
    case 1: {
      const labels = lista.map((d: any) => d.tipo_institucion_educativa || 'SIN REGISTRO');
      const valores = lista.map((d: any) => d.total_aspirantes || 0);
      const totalGeneral = valores.reduce((a: number, b: number) => a + b, 0);
      const lider = lista[0];

      return {
        id: 1,
        tituloGrafico: 'Distribución de Aspirantes por Tipo de Colegio',
        tipo: 'doughnut',
        kpis: [
          { label: 'Total de Aspirantes', valor: totalGeneral.toLocaleString(), color: '#004D98' },
          { label: 'Mayoritaria', valor: lider?.tipo_institucion_educativa || '-', subtexto: `${lider?.total_aspirantes?.toLocaleString()} aspirantes`, color: '#EDBB00' },
          { label: 'Tipos Registrados', valor: lista.length, color: '#28a745' },
        ],
        config: {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: valores,
              backgroundColor: PALETA_COLORES,
              borderColor: '#1e2433',
              borderWidth: 2,
            }],
          },
          options: obtenerOpcionesBasicas('doughnut', true),
        },
      };
    }

    // 2. Cantidad de aprobados por materia (Barras)
    case 2: {
      const labels = lista.map((d: any) => d.materia);
      const valores = lista.map((d: any) => d.total_aprobados || 0);
      const total = valores.reduce((a: number, b: number) => a + b, 0);

      return {
        id: 2,
        tituloGrafico: 'Evaluaciones Aprobadas por Materia',
        tipo: 'bar',
        kpis: [
          { label: 'Total Aprobaciones', valor: total.toLocaleString(), color: '#28a745' },
          { label: 'Materia Líder', valor: lista[0]?.materia || '-', subtexto: `${lista[0]?.total_aprobados?.toLocaleString()} aprobados`, color: '#004D98' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Total Aprobados',
              data: valores,
              backgroundColor: ['#004D98', '#A50044'],
              borderRadius: 8,
            }],
          },
          options: obtenerOpcionesBasicas('bar'),
        },
      };
    }

    // 3. Aprobados por carrera y año de ingreso (Barras)
    case 3: {
      const muestra = lista.slice(0, 15);
      const labels = muestra.map((d: any) => `${d.carrera_objetivo} (${d.anio_de_ingreso})`);
      const valores = muestra.map((d: any) => d.total_aprobados || 0);

      return {
        id: 3,
        tituloGrafico: 'Top Carreras con Más Aprobados por Año',
        tipo: 'bar',
        kpis: [
          { label: 'Carrera Líder', valor: lista[0]?.carrera_objetivo || '-', subtexto: `Año ${lista[0]?.anio_de_ingreso}: ${lista[0]?.total_aprobados} aprobados`, color: '#EDBB00' },
          { label: 'Registros Analizados', valor: lista.length, color: '#004D98' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Aspirantes Aprobados',
              data: valores,
              backgroundColor: '#004D98',
              borderRadius: 6,
            }],
          },
          options: obtenerOpcionesHorizontales(),
        },
      };
    }

    // 4. Porcentaje de aprobación por materia (Barras)
    case 4: {
      const labels = lista.map((d: any) => d.materia);
      const porcentajes = lista.map((d: any) => d.porcentaje_aprobacion || 0);

      return {
        id: 4,
        tituloGrafico: 'Tasa Porcentual de Aprobación por Materia',
        tipo: 'bar',
        kpis: [
          { label: lista[0]?.materia || 'Materia 1', valor: `${lista[0]?.porcentaje_aprobacion ?? 0}%`, subtexto: `${lista[0]?.total_aprobadas?.toLocaleString()} de ${lista[0]?.total_evaluaciones?.toLocaleString()}`, color: '#28a745' },
          { label: lista[1]?.materia || 'Materia 2', valor: `${lista[1]?.porcentaje_aprobacion ?? 0}%`, subtexto: `${lista[1]?.total_aprobadas?.toLocaleString()} de ${lista[1]?.total_evaluaciones?.toLocaleString()}`, color: '#A50044' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: '% de Aprobación',
              data: porcentajes,
              backgroundColor: ['#28a745', '#004D98'],
              borderRadius: 8,
            }],
          },
          options: obtenerOpcionesPorcentuales(),
        },
      };
    }

    // 5. Promedio de edad por carrera (Barras Horizontales)
    case 5: {
      const labels = lista.map((d: any) => d.carrera_objetivo);
      const valores = lista.map((d: any) => Number((d.edad_promedio || 0).toFixed(1)));
      const promedioGlobal = (valores.reduce((a: number, b: number) => a + b, 0) / (valores.length || 1)).toFixed(1);

      return {
        id: 5,
        tituloGrafico: 'Edad Promedio de Aspirantes por Carrera',
        tipo: 'bar',
        kpis: [
          { label: 'Promedio General', valor: `${promedioGlobal} años`, color: '#EDBB00' },
          { label: 'Total Carreras', valor: lista.length, color: '#004D98' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Edad Promedio (Años)',
              data: valores,
              backgroundColor: '#A50044',
              borderRadius: 6,
            }],
          },
          options: obtenerOpcionesHorizontales(16, 25),
        },
      };
    }

    // 7. Promedio de edad de aspirantes aprobados por carrera y tipo institución
    case 7: {
      const muestra = lista.slice(0, 12);
      const labels = muestra.map((d: any) => `${d.carrera_objetivo} [${d.tipo_institucion_educativa}]`);
      const valores = muestra.map((d: any) => Number((d.edad_promedio ?? d.edad_promedio_aprobados ?? 0).toFixed(1)));
      const promedioGlobal = (lista.reduce((acc: number, item: any) => acc + (item.edad_promedio || 0), 0) / (lista.length || 1)).toFixed(1);

      return {
        id: 7,
        tituloGrafico: 'Edad Promedio de Aprobados (Carrera y Tipo de Institución)',
        tipo: 'bar',
        kpis: [
          { label: 'Grupos Analizados', valor: lista.length, color: '#004D98' },
          { label: 'Edad Promedio Global', valor: `${promedioGlobal} años`, color: '#EDBB00' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Edad Promedio Aprobados',
              data: valores,
              backgroundColor: '#004D98',
              borderRadius: 6,
            }],
          },
          options: obtenerOpcionesHorizontales(),
        },
      };
    }

    // 8. Distribución de aprobados por municipio y carrera
    case 8: {
      const muestra = lista.slice(0, 10);
      const labels = muestra.map((d: any) => `${d.municipio} - ${d.carrera_objetivo}`);
      const valores = muestra.map((d: any) => d.total_aprobados || 0);

      return {
        id: 8,
        tituloGrafico: 'Top 10 Aprobados por Municipio y Carrera',
        tipo: 'bar',
        kpis: [
          { label: 'Municipio y Carrera Top', valor: lista[0]?.municipio || '-', subtexto: `${lista[0]?.carrera_objetivo} (${lista[0]?.total_aprobados} aprobados)`, color: '#EDBB00' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Total Aprobados',
              data: valores,
              backgroundColor: '#EDBB00',
              borderRadius: 6,
            }],
          },
          options: obtenerOpcionesHorizontales(),
        },
      };
    }

    // 9. Cantidad de evaluaciones por mes y materia para instituciones públicas (Línea)
    case 9: {
      const labels = lista.map((d: any) => `${d.mes_nombre || 'Mes ' + d.mes} (${d.materia})`);
      const valores = lista.map((d: any) => d.total_evaluaciones || 0);

      return {
        id: 9,
        tituloGrafico: 'Evolución Mensual de Evaluaciones (Colegios Públicos)',
        tipo: 'line',
        kpis: [
          { label: 'Mes con Mayor Demanda', valor: lista[0]?.mes_nombre || '-', subtexto: `${lista[0]?.total_evaluaciones?.toLocaleString()} evaluaciones (${lista[0]?.materia})`, color: '#004D98' },
        ],
        config: {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Evaluaciones',
              data: valores,
              borderColor: '#EDBB00',
              backgroundColor: 'rgba(237, 187, 0, 0.25)',
              tension: 0.35,
              fill: true,
              pointRadius: 5,
            }],
          },
          options: obtenerOpcionesBasicas('line'),
        },
      };
    }

    // 10. Top 5 carreras más demandadas por aspirantes entre 16 y 18 años (Barras Horizontales)
    case 10: {
      const labels = lista.map((d: any) => d.carrera_objetivo);
      const valores = lista.map((d: any) => d.total_aspirantes || 0);

      return {
        id: 10,
        tituloGrafico: 'Top 5 Carreras Más Demandadas (Aspirantes de 16 a 18 Años)',
        tipo: 'bar',
        kpis: [
          { label: 'Carrera #1', valor: lista[0]?.carrera_objetivo || '-', subtexto: `${lista[0]?.total_aspirantes?.toLocaleString()} aspirantes jóvenes`, color: '#EDBB00' },
          { label: 'Total Top 5', valor: valores.reduce((a: number, b: number) => a + b, 0).toLocaleString(), color: '#004D98' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Aspirantes Registrados',
              data: valores,
              backgroundColor: ['#EDBB00', '#004D98', '#A50044', '#28a745', '#17a2b8'],
              borderRadius: 8,
            }],
          },
          options: obtenerOpcionesHorizontales(),
        },
      };
    }

    // 12. Distribución por sexo y tipo de institución (Barras agrupadas / apiladas)
    case 12: {
      const tipos = Array.from(new Set(lista.map((d: any) => d.tipo_institucion_educativa || 'SIN REGISTRO')));
      const hombresPorTipo = tipos.map((t) => {
        const item = lista.find((d: any) => (d.tipo_institucion_educativa || 'SIN REGISTRO') === t && d.sexo === 'M');
        return item?.total_aspirantes || 0;
      });
      const mujeresPorTipo = tipos.map((t) => {
        const item = lista.find((d: any) => (d.tipo_institucion_educativa || 'SIN REGISTRO') === t && d.sexo === 'F');
        return item?.total_aspirantes || 0;
      });

      return {
        id: 12,
        tituloGrafico: 'Distribución de Aspirantes por Sexo y Tipo de Institución',
        tipo: 'bar',
        kpis: [
          { label: 'Total Hombres (M)', valor: hombresPorTipo.reduce((a, b) => a + b, 0).toLocaleString(), color: '#004D98' },
          { label: 'Total Mujeres (F)', valor: mujeresPorTipo.reduce((a, b) => a + b, 0).toLocaleString(), color: '#A50044' },
        ],
        config: {
          type: 'bar',
          data: {
            labels: tipos,
            datasets: [
              { label: 'Masculino (M)', data: hombresPorTipo, backgroundColor: '#004D98', borderRadius: 6 },
              { label: 'Femenino (F)', data: mujeresPorTipo, backgroundColor: '#A50044', borderRadius: 6 },
            ],
          },
          options: obtenerOpcionesBasicas('bar'),
        },
      };
    }

    // 13. Tasa de aprobación por edad (Línea de tendencia)
    case 13: {
      const ordenada = [...lista].sort((a: any, b: any) => (a.edad || 0) - (b.edad || 0));
      const labels = ordenada.map((d: any) => `${d.edad} años`);
      const tasas = ordenada.map((d: any) => d.tasa_aprobacion || 0);

      return {
        id: 13,
        tituloGrafico: 'Tasa de Aprobación (%) según Edad del Aspirante',
        tipo: 'line',
        kpis: [
          { label: 'Edades Evaluadas', valor: lista.length, color: '#004D98' },
        ],
        config: {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: '% Tasa de Aprobación',
              data: tasas,
              borderColor: '#28a745',
              backgroundColor: 'rgba(40, 167, 69, 0.2)',
              tension: 0.3,
              fill: true,
              pointRadius: 4,
            }],
          },
          options: obtenerOpcionesPorcentuales(),
        },
      };
    }

    // 14. Número promedio de intentos por materia (Barras)
    case 14: {
      const labels = lista.map((d: any) => d.materia);
      const intentos = lista.map((d: any) => Number((d.promedio_intentos || 0).toFixed(2)));

      return {
        id: 14,
        tituloGrafico: 'Promedio de Intentos Realizados por Materia',
        tipo: 'bar',
        kpis: [
          { label: lista[0]?.materia || 'Materia 1', valor: `${lista[0]?.promedio_intentos ?? 0} intentos`, subtexto: `${lista[0]?.total_aspirantes?.toLocaleString()} aspirantes evaluados`, color: '#A50044' },
          { label: lista[1]?.materia || 'Materia 2', valor: `${lista[1]?.promedio_intentos ?? 0} intentos`, subtexto: `${lista[1]?.total_aspirantes?.toLocaleString()} aspirantes evaluados`, color: '#004D98' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Intentos Promedio',
              data: intentos,
              backgroundColor: ['#A50044', '#004D98'],
              borderRadius: 8,
            }],
          },
          options: obtenerOpcionesBasicas('bar'),
        },
      };
    }

    // 16. Carreras con más aspirantes reprobados en primer intento (Barras Horizontales)
    case 16: {
      const top10 = lista.slice(0, 10);
      const labels = top10.map((d: any) => d.carrera_objetivo);
      const valores = top10.map((d: any) => d.total_reprobados_primer_intento || 0);

      return {
        id: 16,
        tituloGrafico: 'Carreras con Mayor Cantidad de Reprobados en Primer Intento',
        tipo: 'bar',
        kpis: [
          { label: 'Carrera con Más Reprobados', valor: lista[0]?.carrera_objetivo || '-', subtexto: `${lista[0]?.total_reprobados_primer_intento?.toLocaleString()} reprobados en Intento 1`, color: '#dc3545' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Reprobados Primer Intento',
              data: valores,
              backgroundColor: '#dc3545',
              borderRadius: 6,
            }],
          },
          options: obtenerOpcionesHorizontales(),
        },
      };
    }

    // 17. Top 5 municipios con mayor cantidad de aspirantes (Dona / Pastel)
    case 17: {
      const labels = lista.map((d: any) => d.municipio || 'SIN REGISTRO');
      const valores = lista.map((d: any) => d.total_aspirantes || 0);
      const totalTop5 = valores.reduce((a: number, b: number) => a + b, 0);

      return {
        id: 17,
        tituloGrafico: 'Top 5 Municipios de Procedencia con Más Aspirantes',
        tipo: 'doughnut',
        kpis: [
          { label: 'Municipio #1', valor: lista[0]?.municipio || '-', subtexto: `${lista[0]?.total_aspirantes?.toLocaleString()} aspirantes`, color: '#EDBB00' },
          { label: 'Total Top 5', valor: totalTop5.toLocaleString(), color: '#004D98' },
        ],
        config: {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: valores,
              backgroundColor: PALETA_COLORES.slice(0, 5),
              borderColor: '#1e2433',
              borderWidth: 2,
            }],
          },
          options: obtenerOpcionesBasicas('doughnut', true),
        },
      };
    }

    // 18. Tasa de aprobación por tipo de institución educativa (Barras)
    case 18: {
      const labels = lista.map((d: any) => d.tipo_institucion_educativa || 'SIN REGISTRO');
      const tasas = lista.map((d: any) => d.tasa_aprobacion || 0);

      return {
        id: 18,
        tituloGrafico: 'Tasa de Aprobación (%) por Tipo de Colegio',
        tipo: 'bar',
        kpis: [
          { label: 'Mayor Tasa', valor: `${lista[0]?.tasa_aprobacion ?? 0}%`, subtexto: lista[0]?.tipo_institucion_educativa || '-', color: '#28a745' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: '% Tasa de Aprobación',
              data: tasas,
              backgroundColor: PALETA_COLORES,
              borderRadius: 8,
            }],
          },
          options: obtenerOpcionesPorcentuales(),
        },
      };
    }

    // 19. Carreras más demandadas por departamento (Barras Horizontales)
    case 19: {
      const muestra = lista.slice(0, 10);
      const labels = muestra.map((d: any) => `${d.departamento}: ${d.carrera_mas_demandada ?? d.carrera_objetivo ?? ''}`);
      const valores = muestra.map((d: any) => d.total_aspirantes || 0);

      return {
        id: 19,
        tituloGrafico: 'Carreras Más Demandadas por Departamento',
        tipo: 'bar',
        kpis: [
          { label: 'Total Departamentos', valor: lista.length, color: '#004D98' },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Aspirantes Registrados',
              data: valores,
              backgroundColor: '#004D98',
              borderRadius: 6,
            }],
          },
          options: obtenerOpcionesHorizontales(),
        },
      };
    }

    // 20. Evolución de aprobación por año de ingreso (Barras Apiladas)
    case 20: {
      const ordenada = [...lista].sort((a: any, b: any) => (a.anio_de_ingreso || 0) - (b.anio_de_ingreso || 0));
      const labels = ordenada.map((d: any) => `Año ${d.anio_de_ingreso}`);
      const aprobadas = ordenada.map((d: any) => d.aprobadas || 0);
      const reprobadas = ordenada.map((d: any) => d.reprobadas ?? d.no_aprobadas ?? 0);
      const ultimoAnio = ordenada[ordenada.length - 1];

      return {
        id: 20,
        tituloGrafico: 'Evolución de Aprobados vs No Aprobados por Año',
        tipo: 'bar',
        kpis: [
          { label: 'Años Analizados', valor: lista.length, color: '#004D98' },
          { 
            label: `Año Reciente (${ultimoAnio?.anio_de_ingreso ?? '-'})`, 
            valor: `${ultimoAnio?.porcentaje_aprobadas ?? ultimoAnio?.porcentaje_aprobacion ?? 0}% aprobados`, 
            subtexto: `${ultimoAnio?.aprobadas?.toLocaleString() ?? 0} aprobadas de ${ultimoAnio?.total_evaluaciones?.toLocaleString() ?? 0}`, 
            color: '#28a745' 
          },
        ],
        config: {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Aprobadas', data: aprobadas, backgroundColor: '#28a745', borderRadius: 6 },
              { label: 'No Aprobadas', data: reprobadas, backgroundColor: '#dc3545', borderRadius: 6 },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true, ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
              y: { stacked: true, ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
            },
            plugins: {
              legend: { labels: { color: '#ffffff', font: { weight: 'bold' } } },
              tooltip: { padding: 10, cornerRadius: 8 },
            },
          },
        },
      };
    }

    default:
      return null;
  }
}

function obtenerOpcionesBasicas(tipo: string, sinEjes: boolean = false): any {
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: sinEjes,
        labels: { color: '#ffffff', font: { weight: 'bold' } },
      },
      tooltip: { padding: 10, cornerRadius: 8 },
    },
  };

  if (!sinEjes) {
    options.scales = {
      x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
      y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, beginAtZero: true },
    };
  }

  return options;
}

function obtenerOpcionesPorcentuales(): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: '#ffffff',
          callback: (value: any) => `${value}%`,
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => ` ${context.parsed.y}%`,
        },
      },
    },
  };
}

function obtenerOpcionesHorizontales(min?: number, max?: number): any {
  const scaleX: any = {
    ticks: { color: '#ffffff' },
    grid: { color: 'rgba(255, 255, 255, 0.1)' },
    beginAtZero: min === undefined,
  };
  if (min !== undefined) scaleX.min = min;
  if (max !== undefined) scaleX.max = max;

  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: scaleX,
      y: { ticks: { color: '#ffffff', autoSkip: false }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
    },
    plugins: {
      legend: { display: false },
      tooltip: { padding: 10, cornerRadius: 8 },
    },
  };
}
