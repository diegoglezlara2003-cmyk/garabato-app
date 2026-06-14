/* =========================================================================
   store.js — estado, semilla y persistencia (localStorage)
   Modelo pensado para portarse a un backend auditable: cada mutación pasa
   por Store.mutar(), el único punto donde se escribe estado.
   VERSION 3: multi-programa (programas[]) + sidebar
   ========================================================================= */

var Store = (function () {
  var CLAVE = 'garabato-mvp-v1';
  var VERSION = 3;

  /* Dimensiones del indicador (metodología MIR) */
  var DIMENSIONES = ['Eficacia', 'Eficiencia', 'Economía', 'Calidad'];

  /* ---------- Personas (RBAC) ---------- */
  var PERSONAS = [
    { id: 'lucia',  nombre: 'Lucía',  cargo: 'Diseñadora de política', color: '#6A3FD4', iniciales: 'LU' },
    { id: 'carlos', nombre: 'Carlos', cargo: 'Coordinador de programa', color: '#F58220', iniciales: 'CA' },
    { id: 'marco',  nombre: 'Marco',  cargo: 'Operador de campo',       color: '#1FA86B', iniciales: 'MA' },
    { id: 'reyes',  nombre: 'Reyes',  cargo: 'Directora',               color: '#2B3FD6', iniciales: 'RE' },
    { id: 'gomez',  nombre: 'Gómez',  cargo: 'Auditor',                 color: '#E63B2E', iniciales: 'GO' },
  ];

  /* Permisos por rol */
  var PERMISOS = {
    lucia:  { disena: 'rw',  agiliza: 'ro',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
    carlos: { disena: 'ro',  agiliza: 'rw',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
    marco:  { disena: null,  agiliza: null,  ejecuta: 'rw',  audita: null,   tablero: null },
    reyes:  { disena: 'ro',  agiliza: 'ro',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
    gomez:  { disena: 'ro',  agiliza: 'ro',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
  };

  var VISTA_INICIO = { lucia: 'disena', carlos: 'agiliza', marco: 'ejecuta', reyes: 'tablero', gomez: 'audita' };

  /* ---------- Catálogo de indicadores ---------- */
  function catalogoSemilla() {
    return [
      { id: 'ind-01', editable: false, nombre: 'Porcentaje de cobertura arbórea urbana', dimension: 'Eficacia', definicion: 'Proporción de la superficie urbana cubierta por copa arbórea respecto a la superficie total del polígono.', metodoCalculo: '(Superficie con cobertura arbórea / Superficie total del polígono) × 100', origen: 'MIDE Jalisco', unidad: '%', fuente: 'MIDE Jalisco (muestra)' },
      { id: 'ind-02', editable: false, nombre: 'Árboles plantados con supervivencia a 12 meses', dimension: 'Eficacia', definicion: 'Número de árboles plantados que permanecen vivos doce meses después de su plantación.', metodoCalculo: 'Conteo en campo de árboles vivos a los 12 meses de la plantación', origen: 'MIDE Jalisco', unidad: 'árboles', fuente: 'MIDE Jalisco (muestra)' },
      { id: 'ind-03', editable: false, nombre: 'Superficie de áreas verdes por habitante', dimension: 'Calidad', definicion: 'Metros cuadrados de áreas verdes disponibles por cada habitante del polígono.', metodoCalculo: 'Superficie total de áreas verdes / Número de habitantes', origen: 'MIDE Jalisco', unidad: 'm²/hab', fuente: 'MIDE Jalisco (muestra)' },
      { id: 'ind-04', editable: false, nombre: 'Temperatura superficial promedio en polígonos de intervención', dimension: 'Eficacia', definicion: 'Temperatura superficial media registrada en los polígonos de intervención.', metodoCalculo: 'Promedio de mediciones de temperatura superficial por percepción remota', origen: 'MIDE Jalisco', unidad: '°C', fuente: 'MIDE Jalisco (muestra)' },
      { id: 'ind-05', editable: false, nombre: 'Personas beneficiadas por acciones de reforestación', dimension: 'Eficacia', definicion: 'Número de personas que habitan en los polígonos intervenidos por el programa.', metodoCalculo: 'Suma de la población residente en los polígonos intervenidos', origen: 'MIDE Jalisco', unidad: 'personas', fuente: 'MIDE Jalisco (muestra)' },
      { id: 'ind-06', editable: false, nombre: 'Porcentaje de avance físico de la obra/acción', dimension: 'Eficiencia', definicion: 'Proporción del avance físico de la obra o acción respecto a lo programado.', metodoCalculo: '(Avance físico real / Avance físico programado) × 100', origen: 'Común', unidad: '%', fuente: 'Común' },
      { id: 'ind-07', editable: false, nombre: 'Porcentaje de presupuesto ejercido', dimension: 'Economía', definicion: 'Proporción del presupuesto ejercido respecto al presupuesto autorizado.', metodoCalculo: '(Presupuesto ejercido / Presupuesto autorizado) × 100', origen: 'Común', unidad: '%', fuente: 'Común' },
      { id: 'ind-08', editable: false, nombre: 'Talleres comunitarios impartidos', dimension: 'Eficacia', definicion: 'Número de talleres comunitarios efectivamente impartidos durante el periodo.', metodoCalculo: 'Conteo de talleres impartidos según bitácora', origen: 'Común', unidad: 'talleres', fuente: 'Común' },
      { id: 'ind-09', editable: false, nombre: 'Asistentes a talleres de adopción de arbolado', dimension: 'Eficacia', definicion: 'Número de personas que asistieron a los talleres de adopción de arbolado.', metodoCalculo: 'Suma de asistentes registrados en listas de asistencia', origen: 'Común', unidad: 'personas', fuente: 'Común' },
      { id: 'ind-10', editable: false, nombre: 'Polígonos diagnosticados con índice de isla de calor', dimension: 'Eficiencia', definicion: 'Número de polígonos con diagnóstico de índice de isla de calor completado.', metodoCalculo: 'Conteo de polígonos con informe de diagnóstico concluido', origen: 'MIDE Jalisco', unidad: 'polígonos', fuente: 'MIDE Jalisco (muestra)' },
      { id: 'ind-11', editable: false, nombre: 'Convenios firmados con colonias y comités vecinales', dimension: 'Eficacia', definicion: 'Número de convenios de adopción firmados con colonias y comités vecinales.', metodoCalculo: 'Conteo de convenios firmados en archivo', origen: 'Común', unidad: 'convenios', fuente: 'Común' },
      { id: 'ind-12', editable: false, nombre: 'Porcentaje de reportes de campo con evidencia georreferenciada', dimension: 'Calidad', definicion: 'Proporción de reportes de campo que incluyen evidencia georreferenciada válida.', metodoCalculo: '(Reportes con evidencia georreferenciada / Total de reportes) × 100', origen: 'Común', unidad: '%', fuente: 'Común' },
    ];
  }

  /* ---------- Semillas de programa ---------- */

  function programaReforestacion() {
    return {
      id: 'prog-1',
      nombre: 'Reforestación Urbana — AMG',
      dependencia: 'Secretaría de Medio Ambiente · Gobierno de Jalisco',
      poblacion: 'Habitantes de polígonos con índice alto de isla de calor en el Área Metropolitana de Guadalajara (est. 48,000 personas)',
      presupuesto: '$12,400,000 MXN',
      inicio: '2026-05-01',
      fin: '2027-04-30',
      descripcion: 'Programa de arbolado urbano con participación comunitaria: diagnóstico de polígonos, plantación de especies nativas y adopción vecinal del arbolado.',
      toc: {
        nodos: [
          { id: 'n-i1', etapa: 'insumos', texto: 'Presupuesto estatal asignado ($12.4 MDP) y vivero metropolitano', supuesto: '', indicadores: ['ind-07'], mediosPorIndicador: { 'ind-07': 'Estados financieros del programa' } },
          { id: 'n-i2', etapa: 'insumos', texto: 'Brigadas de campo capacitadas (3 cuadrillas)', supuesto: 'Rotación de personal menor al 20%', indicadores: [], mediosPorIndicador: {} },
          { id: 'n-a1', etapa: 'actividades', texto: 'Diagnosticar polígonos prioritarios con índice de isla de calor', supuesto: 'Acceso a imágenes satelitales actualizadas', indicadores: ['ind-10'], mediosPorIndicador: { 'ind-10': 'Informe técnico de diagnóstico' } },
          { id: 'n-a2', etapa: 'actividades', texto: 'Plantar 5,000 árboles nativos en polígonos prioritarios', supuesto: 'Temporada de lluvias dentro del rango histórico', indicadores: ['ind-02'], mediosPorIndicador: { 'ind-02': 'Actas de plantación georreferenciadas' } },
          { id: 'n-a3', etapa: 'actividades', texto: 'Impartir talleres de adopción de arbolado con comités vecinales', supuesto: 'Participación vecinal sostenida', indicadores: ['ind-08', 'ind-09'], mediosPorIndicador: { 'ind-08': 'Bitácora de talleres impartidos', 'ind-09': 'Listas de asistencia firmadas' } },
          { id: 'n-p1', etapa: 'productos', texto: '5,000 árboles plantados y geolocalizados', supuesto: '', indicadores: ['ind-02', 'ind-12'], mediosPorIndicador: { 'ind-02': 'Padrón de arbolado en sistema', 'ind-12': 'Reportes de campo en la app con geolocalización' } },
          { id: 'n-p2', etapa: 'productos', texto: '24 comités vecinales con convenio de adopción firmado', supuesto: '', indicadores: ['ind-11'], mediosPorIndicador: { 'ind-11': 'Convenios firmados en archivo' } },
          { id: 'n-r1', etapa: 'resultados', texto: 'Cobertura arbórea aumenta 8% en polígonos intervenidos', supuesto: 'Supervivencia del arbolado ≥ 70%', indicadores: ['ind-01'], mediosPorIndicador: { 'ind-01': 'Comparativa satelital anual' } },
          { id: 'n-m1', etapa: 'impacto', texto: 'Reducción de 1.5°C en temperatura superficial de los polígonos al año 3', supuesto: 'No hay cambios de uso de suelo masivos en la zona', indicadores: ['ind-04'], mediosPorIndicador: { 'ind-04': 'Estudio de temperatura superficial' } },
        ],
        enlaces: [
          { de: 'n-i1', a: 'n-a1' }, { de: 'n-i1', a: 'n-a2' }, { de: 'n-i2', a: 'n-a2' },
          { de: 'n-i2', a: 'n-a3' }, { de: 'n-a1', a: 'n-p1' }, { de: 'n-a2', a: 'n-p1' },
          { de: 'n-a3', a: 'n-p2' }, { de: 'n-p1', a: 'n-r1' }, { de: 'n-p2', a: 'n-r1' },
          { de: 'n-r1', a: 'n-m1' },
        ],
      },
      epicas: [
        { id: 'ep-1', nombre: 'Fase 0 — Diagnóstico', color: '#29C5D6' },
        { id: 'ep-2', nombre: 'Fase 1 — Plantación', color: '#1FA86B' },
        { id: 'ep-3', nombre: 'Fase 2 — Adopción vecinal', color: '#F977B6' },
      ],
      sprints: [
        { id: 'sp-1', nombre: 'Sprint 1', inicio: '2026-06-04', fin: '2026-06-18', activo: true },
        { id: 'sp-2', nombre: 'Sprint 2', inicio: '2026-06-19', fin: '2026-07-03', activo: false },
      ],
      tareas: [
        {
          id: 't-1', titulo: 'Levantar índice de isla de calor en 12 polígonos', origen: 'n-a1',
          indicadores: ['ind-10'], epica: 'ep-1', sprint: 'sp-1', estado: 'doing', asignado: 'marco',
          inicio: '2026-06-04', fin: '2026-06-10',
          evidencia: 'Foto del polígono + lectura de temperatura en sitio',
          reportes: [
            { id: 'r-1', fecha: '2026-06-08T10:14:00', nota: 'Polígono 03 (Oblatos): lectura 41.2°C en explanada, 33.8°C bajo arbolado existente.', fotos: [], sync: true },
          ],
        },
        {
          id: 't-2', titulo: 'Validar lista de especies nativas con el vivero', origen: 'n-a2',
          indicadores: ['ind-02'], epica: 'ep-2', sprint: 'sp-1', estado: 'todo', asignado: 'marco',
          inicio: '2026-06-09', fin: '2026-06-12',
          evidencia: 'Foto de las especies apartadas y nota del responsable del vivero',
          reportes: [],
        },
        {
          id: 't-3', titulo: 'Plantación piloto: 120 árboles en polígono 03', origen: 'n-a2',
          indicadores: ['ind-02', 'ind-12'], epica: 'ep-2', sprint: 'sp-1', estado: 'todo', asignado: 'marco',
          inicio: '2026-06-12', fin: '2026-06-18',
          evidencia: 'Fotos del antes/después por cuadrante + acta de plantación',
          reportes: [],
        },
        {
          id: 't-4', titulo: 'Primer taller de adopción con comité de Oblatos', origen: 'n-a3',
          indicadores: ['ind-08', 'ind-09'], epica: 'ep-3', sprint: 'sp-2', estado: 'idea', asignado: null,
          inicio: '', fin: '',
          evidencia: 'Lista de asistencia firmada y foto del taller',
          reportes: [],
        },
        {
          id: 't-5', titulo: 'Padrón de arbolado: definir esquema de captura', origen: 'n-p1',
          indicadores: ['ind-12'], epica: 'ep-1', sprint: null, estado: 'idea', asignado: null,
          inicio: '', fin: '',
          evidencia: '',
          reportes: [],
        },
        {
          id: 't-6', titulo: 'Mapa de comités vecinales por polígono', origen: 'n-p2',
          indicadores: ['ind-11'], epica: 'ep-3', sprint: null, estado: 'todo', asignado: null,
          inicio: '', fin: '',
          evidencia: 'Documento de mapeo con contactos',
          reportes: [],
        },
      ],
    };
  }

  function programaAgua() {
    return {
      id: 'prog-2',
      nombre: 'Programa de Agua Potable Rural — Jalisco',
      dependencia: 'SIAPA · Gobierno de Jalisco',
      poblacion: 'Comunidades rurales de Jalisco con índice de rezago hídrico alto (est. 12,000 familias)',
      presupuesto: '$8,200,000 MXN',
      inicio: '2026-03-01',
      fin: '2027-02-28',
      descripcion: 'Dotación de infraestructura básica de agua potable en comunidades rurales marginadas, incluyendo captación, potabilización y red de distribución.',
      toc: {
        nodos: [
          { id: 'p2-i1', etapa: 'insumos',     texto: 'Presupuesto federal FAIS asignado ($8.2 MDP) y equipamiento técnico', supuesto: '', indicadores: [], mediosPorIndicador: {} },
          { id: 'p2-a1', etapa: 'actividades', texto: 'Diagnóstico de fuentes de agua y calidad en 20 comunidades', supuesto: 'Acceso vial en temporada seca', indicadores: [], mediosPorIndicador: {} },
          { id: 'p2-a2', etapa: 'actividades', texto: 'Instalación de sistemas de captación y potabilización', supuesto: 'Proveedores disponibles en tiempo y forma', indicadores: [], mediosPorIndicador: {} },
          { id: 'p2-p1', etapa: 'productos',   texto: '20 sistemas de agua potable instalados y en operación', supuesto: '', indicadores: [], mediosPorIndicador: {} },
          { id: 'p2-r1', etapa: 'resultados',  texto: '12,000 familias con acceso a agua potable de calidad', supuesto: 'Comités de agua comunitarios operando', indicadores: [], mediosPorIndicador: {} },
        ],
        enlaces: [
          { de: 'p2-i1', a: 'p2-a1' }, { de: 'p2-i1', a: 'p2-a2' },
          { de: 'p2-a1', a: 'p2-p1' }, { de: 'p2-a2', a: 'p2-p1' },
          { de: 'p2-p1', a: 'p2-r1' },
        ],
      },
      epicas: [
        { id: 'p2-ep1', nombre: 'Fase 1 — Diagnóstico hídrico', color: '#5FA9F5' },
        { id: 'p2-ep2', nombre: 'Fase 2 — Instalación', color: '#1FA86B' },
      ],
      sprints: [
        { id: 'p2-sp1', nombre: 'Sprint 1', inicio: '2026-06-04', fin: '2026-06-18', activo: true },
      ],
      tareas: [
        {
          id: 'p2-t1', titulo: 'Diagnóstico de calidad de agua en 5 comunidades piloto', origen: 'p2-a1',
          indicadores: [], epica: 'p2-ep1', sprint: 'p2-sp1', estado: 'doing', asignado: 'marco',
          inicio: '2026-06-04', fin: '2026-06-12',
          evidencia: 'Análisis de laboratorio + fotografías de fuentes',
          reportes: [],
        },
        {
          id: 'p2-t2', titulo: 'Mapeo de infraestructura existente en 20 comunidades', origen: 'p2-a1',
          indicadores: [], epica: 'p2-ep1', sprint: 'p2-sp1', estado: 'todo', asignado: 'marco',
          inicio: '2026-06-10', fin: '2026-06-18',
          evidencia: 'Croquis georeferenciado por comunidad',
          reportes: [],
        },
        {
          id: 'p2-t3', titulo: 'Licitación de equipamiento de potabilización', origen: 'p2-a2',
          indicadores: [], epica: 'p2-ep2', sprint: null, estado: 'idea', asignado: null,
          inicio: '', fin: '',
          evidencia: '',
          reportes: [],
        },
      ],
    };
  }

  function programaMujeres() {
    return {
      id: 'prog-3',
      nombre: 'Programa de Atención a Mujeres en Situación de Riesgo',
      dependencia: 'Secretaría de Igualdad Sustantiva · Gobierno de Jalisco',
      poblacion: 'Mujeres mayores de 18 años en situación de violencia de género en ZMG (est. 6,500 mujeres/año)',
      presupuesto: '$5,600,000 MXN',
      inicio: '2026-01-01',
      fin: '2026-12-31',
      descripcion: 'Atención integral a mujeres en situación de violencia: orientación jurídica, atención psicológica, refugio temporal y talleres de autonomía económica.',
      toc: {
        nodos: [
          { id: 'p3-i1', etapa: 'insumos',     texto: 'Red de 8 centros de atención y equipo multidisciplinario (psicólogas, abogadas, trabajadoras sociales)', supuesto: '', indicadores: [], mediosPorIndicador: {} },
          { id: 'p3-a1', etapa: 'actividades', texto: 'Brindar atención psicológica y orientación jurídica a mujeres en crisis', supuesto: 'Acceso seguro y confidencial garantizado', indicadores: [], mediosPorIndicador: {} },
          { id: 'p3-a2', etapa: 'actividades', texto: 'Impartir talleres de autonomía económica y empleabilidad', supuesto: 'Participación sostenida de las usuarias', indicadores: [], mediosPorIndicador: {} },
          { id: 'p3-p1', etapa: 'productos',   texto: '6,500 mujeres con al menos una atención integral registrada', supuesto: '', indicadores: [], mediosPorIndicador: {} },
          { id: 'p3-r1', etapa: 'resultados',  texto: 'Reducción del 15% en reincidencia de violencia en usuarias atendidas', supuesto: 'Vinculación con redes de apoyo comunitario', indicadores: [], mediosPorIndicador: {} },
        ],
        enlaces: [
          { de: 'p3-i1', a: 'p3-a1' }, { de: 'p3-i1', a: 'p3-a2' },
          { de: 'p3-a1', a: 'p3-p1' }, { de: 'p3-a2', a: 'p3-p1' },
          { de: 'p3-p1', a: 'p3-r1' },
        ],
      },
      epicas: [
        { id: 'p3-ep1', nombre: 'Atención directa', color: '#F977B6' },
        { id: 'p3-ep2', nombre: 'Talleres de autonomía', color: '#6A3FD4' },
      ],
      sprints: [
        { id: 'p3-sp1', nombre: 'Sprint 1', inicio: '2026-06-01', fin: '2026-06-30', activo: true },
      ],
      tareas: [
        {
          id: 'p3-t1', titulo: 'Levantar indicadores de atención del primer semestre', origen: 'p3-a1',
          indicadores: [], epica: 'p3-ep1', sprint: 'p3-sp1', estado: 'doing', asignado: 'carlos',
          inicio: '2026-06-01', fin: '2026-06-15',
          evidencia: 'Reporte estadístico firmado por coordinadora',
          reportes: [],
        },
        {
          id: 'p3-t2', titulo: 'Programar talleres de julio–agosto en 3 centros', origen: 'p3-a2',
          indicadores: [], epica: 'p3-ep2', sprint: 'p3-sp1', estado: 'todo', asignado: null,
          inicio: '2026-06-10', fin: '2026-06-30',
          evidencia: 'Cronograma de talleres validado por coordinación',
          reportes: [],
        },
        {
          id: 'p3-t3', titulo: 'Actualizar directorio de redes de apoyo comunitario', origen: 'p3-a1',
          indicadores: [], epica: 'p3-ep1', sprint: null, estado: 'idea', asignado: null,
          inicio: '', fin: '',
          evidencia: '',
          reportes: [],
        },
      ],
    };
  }

  function programaNuevo() {
    return {
      id: 'prog-4',
      nombre: 'Nuevo programa',
      dependencia: '',
      poblacion: '',
      presupuesto: '',
      inicio: '',
      fin: '',
      descripcion: '',
      toc: { nodos: [], enlaces: [] },
      epicas: [],
      sprints: [],
      tareas: [],
    };
  }

  /* ---------- Semilla completa ---------- */
  function semilla() {
    return {
      version: VERSION,
      rolActual: 'lucia',
      vistaActual: 'disena',
      subvistaDisena: 'toc',
      epicaFiltro: null,
      offline: false,
      sidebar: { abierto: false },
      favoritos: [],
      catalogo: catalogoSemilla(),
      programaActual: 'prog-1',
      programas: [
        programaReforestacion(),
        programaAgua(),
        programaMujeres(),
        programaNuevo(),
      ],
    };
  }

  /* ---------- Persistencia ---------- */
  var estado = null;
  var subscriptores = [];

  function cargar() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      estado = crudo ? JSON.parse(crudo) : semilla();
    } catch (e) {
      estado = semilla();
    }
    migrar(estado);
    return estado;
  }

  /* Migration: v1 → v2 → v3. Each step is idempotent and gated. */
  function migrar(st) {
    /* ── Catalog patches (v1→v2, idempotent) ── */
    if (!st.catalogo) st.catalogo = catalogoSemilla();
    var base = catalogoSemilla();
    st.catalogo.forEach(function (ind) {
      if (ind.editable === undefined) ind.editable = false;
      if (ind.dimension === undefined) ind.dimension = '';
      if (ind.definicion === undefined) ind.definicion = '';
      if (ind.metodoCalculo === undefined) ind.metodoCalculo = '';
      if (ind.origen === undefined) ind.origen = (ind.fuente || '').replace(' (muestra)', '');
    });
    base.forEach(function (sem) {
      var actual = st.catalogo.find(function (i) { return i.id === sem.id; });
      if (actual && !actual.definicion) {
        actual.definicion = sem.definicion;
        actual.dimension = actual.dimension || sem.dimension;
        actual.metodoCalculo = actual.metodoCalculo || sem.metodoCalculo;
        actual.origen = actual.origen || sem.origen;
      }
    });

    /* ── v2→v3: wrap flat keys into programas[] ── */
    if (!st.programas) {
      /* patch mediosPorIndicador on v1 toc nodes first */
      if (st.toc && st.toc.nodos) {
        st.toc.nodos.forEach(function (n) {
          if (!n.mediosPorIndicador) {
            n.mediosPorIndicador = {};
            if (n.medios && n.indicadores && n.indicadores.length) {
              n.mediosPorIndicador[n.indicadores[0]] = n.medios;
            }
          }
          delete n.medios;
        });
      }

      st.programas = [
        {
          id: 'prog-1',
          nombre:      (st.programa && st.programa.nombre)      || 'Reforestación Urbana — AMG',
          dependencia: (st.programa && st.programa.dependencia) || '',
          poblacion:   (st.programa && st.programa.poblacion)   || '',
          presupuesto: (st.programa && st.programa.presupuesto) || '',
          inicio:      (st.programa && st.programa.inicio)      || '',
          fin:         (st.programa && st.programa.fin)         || '',
          descripcion: (st.programa && st.programa.descripcion) || '',
          toc:     st.toc     || { nodos: [], enlaces: [] },
          epicas:  st.epicas  || [],
          sprints: st.sprints || [],
          tareas:  st.tareas  || [],
        },
        programaAgua(),
        programaMujeres(),
        programaNuevo(),
      ];
      st.programaActual = 'prog-1';
      st.favoritos = [];
      st.sidebar = { abierto: false };
      delete st.programa;
      delete st.toc;
      delete st.epicas;
      delete st.sprints;
      delete st.tareas;
    }

    /* ── Guard: ensure v3 root fields on already-migrated state ── */
    if (!st.sidebar)        st.sidebar = { abierto: false };
    if (!st.favoritos)      st.favoritos = [];
    if (!st.programaActual) st.programaActual = st.programas[0].id;

    /* ── Ensure each programa has all required fields + toc node patch ── */
    (st.programas || []).forEach(function (prog) {
      if (!prog.toc)     prog.toc = { nodos: [], enlaces: [] };
      if (!prog.epicas)  prog.epicas = [];
      if (!prog.sprints) prog.sprints = [];
      if (!prog.tareas)  prog.tareas = [];
      (prog.toc.nodos || []).forEach(function (n) {
        if (!n.mediosPorIndicador) {
          n.mediosPorIndicador = {};
          if (n.medios && n.indicadores && n.indicadores.length) {
            n.mediosPorIndicador[n.indicadores[0]] = n.medios;
          }
          delete n.medios;
        }
      });
    });

    st.version = VERSION;
  }

  var fallaGuardado = false;

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      fallaGuardado = false;
    } catch (e) {
      fallaGuardado = true;
      if (window.UI) UI.toast('⚠ Memoria local llena — los cambios nuevos no se están guardando');
    }
  }

  function usoAlmacen() {
    try {
      var crudo = localStorage.getItem(CLAVE) || '';
      return Math.min(1, (crudo.length * 2) / (5 * 1024 * 1024));
    } catch (e) { return 0; }
  }

  /* Única puerta de mutación */
  function mutar(fn) {
    fn(estado);
    guardar();
    subscriptores.forEach(function (s) { s(estado); });
  }

  function alCambiar(fn) { subscriptores.push(fn); }

  function uid(prefijo) {
    return prefijo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function reiniciar() {
    estado = semilla();
    guardar();
    subscriptores.forEach(function (s) { s(estado); });
  }

  /* ---------- Helper privado: programa activo ---------- */
  function programaActualObj() {
    return estado.programas.find(function (p) { return p.id === estado.programaActual; })
        || estado.programas[0];
  }

  /* ---------- Consultas frecuentes ---------- */
  function persona(id)    { return PERSONAS.find(function (p) { return p.id === id; }) || null; }
  function catalogo()     { return estado.catalogo || []; }
  function indicador(id)  { return catalogo().find(function (i) { return i.id === id; }) || null; }
  function nodo(id)       { return programaActualObj().toc.nodos.find(function (n) { return n.id === id; }) || null; }
  function tarea(id)      { return programaActualObj().tareas.find(function (t) { return t.id === id; }) || null; }
  function epica(id)      { return programaActualObj().epicas.find(function (e) { return e.id === id; }) || null; }
  function sprint(id)     { return programaActualObj().sprints.find(function (s) { return s.id === id; }) || null; }
  function permiso(vista) { return (PERMISOS[estado.rolActual] || {})[vista] || null; }

  /* ---------- Accessors: programa(s) ---------- */
  function programa()   { return programaActualObj(); }
  function programas()  { return estado.programas || []; }

  /* ---------- Mutations: programa helpers ---------- */

  /* Merge campos into the active program's top-level fields */
  function actualizarPrograma(campos) {
    mutar(function (s) {
      var prog = s.programas.find(function (p) { return p.id === s.programaActual; });
      if (!prog) return;
      Object.keys(campos).forEach(function (k) { prog[k] = campos[k]; });
    });
  }

  /* Run fn(prog, s) against the active program */
  function progMutar(fn) {
    mutar(function (s) {
      var prog = s.programas.find(function (p) { return p.id === s.programaActual; });
      if (prog) fn(prog, s);
    });
  }

  /* Run fn(toc, prog, s) against the active program's toc */
  function tocMutar(fn) {
    mutar(function (s) {
      var prog = s.programas.find(function (p) { return p.id === s.programaActual; });
      if (prog) fn(prog.toc, prog, s);
    });
  }

  /* ---------- Indicators ---------- */
  function crearIndicador(parcial) {
    var id = uid('ind');
    mutar(function (s) {
      s.catalogo.push({
        id: id,
        editable: true,
        nombre: (parcial && parcial.nombre) || 'Nuevo indicador',
        dimension: (parcial && parcial.dimension) || '',
        definicion: (parcial && parcial.definicion) || '',
        metodoCalculo: (parcial && parcial.metodoCalculo) || '',
        origen: (parcial && parcial.origen) || '',
        unidad: (parcial && parcial.unidad) || '',
        fuente: 'Personalizado',
      });
    });
    return id;
  }

  function actualizarIndicador(id, campos) {
    var ind = indicador(id);
    if (!ind || !ind.editable) return false;
    mutar(function (s) {
      var x = s.catalogo.find(function (i) { return i.id === id; });
      Object.keys(campos).forEach(function (k) { x[k] = campos[k]; });
    });
    return true;
  }

  /* ---------- Sidebar ---------- */
  function toggleSidebar() {
    mutar(function (s) { s.sidebar.abierto = !s.sidebar.abierto; });
  }

  /* ---------- Program switching ---------- */
  function cambiarPrograma(id, vistaDestino, subvistaDestino) {
    mutar(function (s) {
      s.programaActual = id;
      s.epicaFiltro = null;
      if (vistaDestino)   s.vistaActual     = vistaDestino;
      if (subvistaDestino) s.subvistaDisena = subvistaDestino;
    });
  }

  /* ---------- Favorites ---------- */
  function toggleFavorito(id) {
    mutar(function (s) {
      var idx = (s.favoritos || []).indexOf(id);
      if (idx === -1) s.favoritos.push(id);
      else s.favoritos.splice(idx, 1);
    });
  }

  function esFavorito(id) {
    return (estado.favoritos || []).indexOf(id) !== -1;
  }

  return {
    PERSONAS:            PERSONAS,
    PERMISOS:            PERMISOS,
    VISTA_INICIO:        VISTA_INICIO,
    DIMENSIONES:         DIMENSIONES,
    cargar:              cargar,
    mutar:               mutar,
    alCambiar:           alCambiar,
    uid:                 uid,
    reiniciar:           reiniciar,
    get:                 function () { return estado; },
    guardadoFallo:       function () { return fallaGuardado; },
    usoAlmacen:          usoAlmacen,
    persona:             persona,
    catalogo:            catalogo,
    indicador:           indicador,
    crearIndicador:      crearIndicador,
    actualizarIndicador: actualizarIndicador,
    nodo:                nodo,
    tarea:               tarea,
    epica:               epica,
    sprint:              sprint,
    permiso:             permiso,
    programa:            programa,
    programas:           programas,
    actualizarPrograma:  actualizarPrograma,
    progMutar:           progMutar,
    tocMutar:            tocMutar,
    toggleSidebar:       toggleSidebar,
    cambiarPrograma:     cambiarPrograma,
    toggleFavorito:      toggleFavorito,
    esFavorito:          esFavorito,
  };
})();
