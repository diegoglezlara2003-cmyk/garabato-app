/* =========================================================================
   store.js — estado, semilla y persistencia (localStorage)
   Modelo pensado para portarse a un backend auditable: cada mutación pasa
   por Store.mutar(), el único punto donde se escribe estado.
   ========================================================================= */

var Store = (function () {
  var CLAVE = 'garabato-mvp-v1';
  var VERSION = 2;

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

  /* Permisos por rol: rw = edita, ro = consulta, lock = módulo en roadmap */
  var PERMISOS = {
    lucia:  { disena: 'rw',  agiliza: 'ro',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
    carlos: { disena: 'ro',  agiliza: 'rw',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
    marco:  { disena: null,  agiliza: null,  ejecuta: 'rw',  audita: null,   tablero: null },
    reyes:  { disena: 'ro',  agiliza: 'ro',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
    gomez:  { disena: 'ro',  agiliza: 'ro',  ejecuta: 'ro',  audita: 'lock', tablero: 'lock' },
  };

  var VISTA_INICIO = { lucia: 'disena', carlos: 'agiliza', marco: 'ejecuta', reyes: 'tablero', gomez: 'audita' };

  /* ---------- Catálogo de indicadores ----------
     Dos tipos: externos (editable:false, de fuentes como MIDE Jalisco, solo
     lectura) y personalizados (editable:true, creados por la usuaria). Vive
     dentro del estado para que los indicadores nuevos persistan. */
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

  /* ---------- Semilla: Reforestación Urbana AMG ---------- */
  function semilla() {
    return {
      version: VERSION,
      rolActual: 'lucia',
      vistaActual: 'disena',
      subvistaDisena: 'toc',
      epicaFiltro: null,
      offline: false,

      catalogo: catalogoSemilla(),

      programa: {
        nombre: 'Reforestación Urbana — AMG',
        dependencia: 'Secretaría de Medio Ambiente · Gobierno de Jalisco',
        poblacion: 'Habitantes de polígonos con índice alto de isla de calor en el Área Metropolitana de Guadalajara (est. 48,000 personas)',
        presupuesto: '$12,400,000 MXN',
        inicio: '2026-05-01',
        fin: '2027-04-30',
        descripcion: 'Programa de arbolado urbano con participación comunitaria: diagnóstico de polígonos, plantación de especies nativas y adopción vecinal del arbolado.',
      },

      /* Teoría de Cambio: 5 etapas */
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
          { de: 'n-i1', a: 'n-a1' },
          { de: 'n-i1', a: 'n-a2' },
          { de: 'n-i2', a: 'n-a2' },
          { de: 'n-i2', a: 'n-a3' },
          { de: 'n-a1', a: 'n-p1' },
          { de: 'n-a2', a: 'n-p1' },
          { de: 'n-a3', a: 'n-p2' },
          { de: 'n-p1', a: 'n-r1' },
          { de: 'n-p2', a: 'n-r1' },
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

  /* Sube datos antiguos (v1) al esquema actual sin perder lo capturado:
     - agrega el catálogo de indicadores si falta
     - convierte el campo único `medios` de cada nodo a `mediosPorIndicador`
     - asegura los campos nuevos del indicador en el catálogo */
  function migrar(st) {
    if (!st.catalogo) st.catalogo = catalogoSemilla();

    /* Catálogo: garantizar campos nuevos en indicadores ya existentes */
    var base = catalogoSemilla();
    st.catalogo.forEach(function (ind) {
      if (ind.editable === undefined) ind.editable = false;
      if (ind.dimension === undefined) ind.dimension = '';
      if (ind.definicion === undefined) ind.definicion = '';
      if (ind.metodoCalculo === undefined) ind.metodoCalculo = '';
      if (ind.origen === undefined) ind.origen = (ind.fuente || '').replace(' (muestra)', '');
    });
    /* Si el catálogo viejo perdió metadatos, recupéralos de la semilla por id */
    base.forEach(function (sem) {
      var actual = st.catalogo.find(function (i) { return i.id === sem.id; });
      if (actual && !actual.definicion) {
        actual.definicion = sem.definicion;
        actual.dimension = actual.dimension || sem.dimension;
        actual.metodoCalculo = actual.metodoCalculo || sem.metodoCalculo;
        actual.origen = actual.origen || sem.origen;
      }
    });

    /* Nodos: medios (string único) -> mediosPorIndicador (mapa) */
    if (st.toc && st.toc.nodos) {
      st.toc.nodos.forEach(function (n) {
        if (!n.mediosPorIndicador) {
          n.mediosPorIndicador = {};
          /* el medio único previo se asigna al primer indicador del nodo */
          if (n.medios && n.indicadores && n.indicadores.length) {
            n.mediosPorIndicador[n.indicadores[0]] = n.medios;
          }
        }
        delete n.medios;
      });
    }

    st.version = VERSION;
  }

  var fallaGuardado = false;

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      fallaGuardado = false;
    } catch (e) {
      /* Memoria local llena: el estado sigue en memoria, pero el usuario DEBE saberlo */
      fallaGuardado = true;
      if (window.UI) UI.toast('⚠ Memoria local llena — los cambios nuevos no se están guardando');
    }
  }

  /* Fracción aproximada de la cuota usada (~5MB típicos de localStorage) */
  function usoAlmacen() {
    try {
      var crudo = localStorage.getItem(CLAVE) || '';
      return Math.min(1, (crudo.length * 2) / (5 * 1024 * 1024));
    } catch (e) { return 0; }
  }

  /* Única puerta de mutación: aquí se conectará la bitácora auditable */
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

  /* ---------- Consultas frecuentes ---------- */
  function persona(id) { return PERSONAS.find(function (p) { return p.id === id; }) || null; }
  function catalogo() { return estado.catalogo || []; }
  function indicador(id) { return catalogo().find(function (i) { return i.id === id; }) || null; }

  /* Crea un indicador personalizado (editable) y devuelve su id */
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

  /* Actualiza campos de un indicador (solo si es editable) */
  function actualizarIndicador(id, campos) {
    var ind = indicador(id);
    if (!ind || !ind.editable) return false;
    mutar(function (s) {
      var x = s.catalogo.find(function (i) { return i.id === id; });
      Object.keys(campos).forEach(function (k) { x[k] = campos[k]; });
    });
    return true;
  }
  function nodo(id) { return estado.toc.nodos.find(function (n) { return n.id === id; }) || null; }
  function tarea(id) { return estado.tareas.find(function (t) { return t.id === id; }) || null; }
  function epica(id) { return estado.epicas.find(function (e) { return e.id === id; }) || null; }
  function sprint(id) { return estado.sprints.find(function (s) { return s.id === id; }) || null; }
  function permiso(vista) { return (PERMISOS[estado.rolActual] || {})[vista] || null; }

  return {
    PERSONAS: PERSONAS,
    PERMISOS: PERMISOS,
    VISTA_INICIO: VISTA_INICIO,
    DIMENSIONES: DIMENSIONES,
    cargar: cargar,
    mutar: mutar,
    alCambiar: alCambiar,
    uid: uid,
    reiniciar: reiniciar,
    get: function () { return estado; },
    guardadoFallo: function () { return fallaGuardado; },
    usoAlmacen: usoAlmacen,
    persona: persona,
    catalogo: catalogo,
    indicador: indicador,
    crearIndicador: crearIndicador,
    actualizarIndicador: actualizarIndicador,
    nodo: nodo,
    tarea: tarea,
    epica: epica,
    sprint: sprint,
    permiso: permiso,
  };
})();
