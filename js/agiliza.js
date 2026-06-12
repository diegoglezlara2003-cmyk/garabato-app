/* =========================================================================
   agiliza.js — Módulo AGILIZA (Carlos)
   Puente ToC→tareas · Épicas · Backlog · Sprints · Panel de tarea
   ========================================================================= */

var Agiliza = (function () {
  var E = UI.el;
  var tareaAbierta = null;
  var creandoSprint = false;
  var creandoEpica = false;

  function rw() { return Store.permiso('agiliza') === 'rw'; }

  /* ============================ RENDER RAÍZ ============================ */

  function render(cont) {
    var st = Store.get();
    var puede = rw();

    var acciones = E('div', { class: 'mir-acciones' });
    if (puede) {
      acciones.appendChild(E('button', { class: 'btn btn-primario', onclick: convertirToC }, ['⚡ Convertir ToC en tareas']));
      acciones.appendChild(E('button', { class: 'btn', onclick: nuevaTarea }, ['+ Nueva tarea']));
      acciones.appendChild(E('button', { class: 'btn', onclick: nuevoSprint }, ['+ Sprint']));
    }

    cont.appendChild(E('div', { class: 'vista-cabecera' }, [
      E('div', {}, [
        E('h1', { class: 'vista-titulo' }, ['Agiliza']),
        E('p', { class: 'vista-sub' }, ['Del diseño al tablero: agrupa en épicas, planea sprints y reparte el trabajo.']),
      ]),
      acciones,
    ]));

    if (!puede) {
      cont.appendChild(E('p', { class: 'solo-lectura' }, ['👁 Solo lectura — la planeación le pertenece a Carlos (Coordinador).']));
    }

    var marco = E('div', { class: 'agiliza-marco' });
    marco.appendChild(renderEpicas(puede));
    marco.appendChild(renderPrincipal(puede));
    cont.appendChild(marco);
  }

  /* ============================ PUENTE ToC → TAREAS (H2.1) ============================ */

  function convertirToC() {
    var st = Store.get();
    var convertibles = st.toc.nodos.filter(function (n) {
      return (n.etapa === 'actividades' || n.etapa === 'productos') &&
        !st.tareas.some(function (t) { return t.origen === n.id; });
    });
    if (!convertibles.length) {
      UI.toast('Todo el diseño ya tiene tareas — no hay nada nuevo que convertir');
      return;
    }
    Store.mutar(function (s) {
      convertibles.forEach(function (n) {
        s.tareas.push({
          id: Store.uid('t'),
          titulo: n.texto || '(tarjeta sin texto)',
          origen: n.id,
          indicadores: (n.indicadores || []).slice(),
          epica: null,
          sprint: null,
          estado: 'idea',
          asignado: null,
          inicio: '', fin: '',
          evidencia: n.medios || '',
          reportes: [],
        });
      });
    });
    UI.toast(convertibles.length + ' tareas creadas desde la Teoría de Cambio, con sus indicadores enlazados');
  }

  /* ============================ ÉPICAS ============================ */

  function renderEpicas(puede) {
    var st = Store.get();
    var barra = E('aside', { class: 'epicas-barra', 'aria-label': 'Épicas' });
    barra.appendChild(E('h2', { class: 'epicas-titulo' }, ['Épicas']));

    function item(id, nombre, color, conteo) {
      return E('button', {
        class: 'epica-item',
        'aria-current': st.epicaFiltro === id ? 'true' : null,
        onclick: function () { Store.mutar(function (s) { s.epicaFiltro = (s.epicaFiltro === id ? null : id); }); },
      }, [
        color ? E('span', { class: 'punto', style: 'background:' + color }, []) : E('span', { class: 'punto' }, []),
        nombre,
        E('span', { class: 'epica-conteo' }, [String(conteo)]),
      ]);
    }

    barra.appendChild(item(null, 'Todas las tareas', null, st.tareas.length));
    st.epicas.forEach(function (ep) {
      var n = st.tareas.filter(function (t) { return t.epica === ep.id; }).length;
      barra.appendChild(item(ep.id, ep.nombre, ep.color, n));
    });

    if (puede && creandoEpica) {
      var inEpica = E('input', { class: 'campo', placeholder: 'Fase 0 — Diagnóstico', maxlength: '60', 'aria-label': 'Nombre de la nueva épica' });
      var crear = function () {
        var nombre = inEpica.value.trim();
        if (!nombre) { inEpica.focus(); return; }
        var colores = ['#29C5D6', '#1FA86B', '#F977B6', '#F58220', '#6A3FD4', '#5FA9F5', '#E63B2E', '#D8B98F'];
        var usados = Store.get().epicas.length;
        creandoEpica = false;
        Store.mutar(function (s) {
          s.epicas.push({ id: Store.uid('ep'), nombre: nombre, color: colores[usados % colores.length] });
        });
      };
      inEpica.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') crear();
        if (ev.key === 'Escape') { creandoEpica = false; App.repintar(); }
      });
      barra.appendChild(E('div', { class: 'form-inline', style: 'padding: var(--s-3)' }, [
        inEpica,
        E('div', { class: 'form-inline-acciones' }, [
          E('button', { class: 'btn btn-primario', onclick: crear }, ['Crear']),
          E('button', { class: 'btn', onclick: function () { creandoEpica = false; App.repintar(); } }, ['Cancelar']),
        ]),
      ]));
      requestAnimationFrame(function () { inEpica.focus(); });
    } else if (puede) {
      barra.appendChild(E('button', {
        class: 'toc-agregar',
        onclick: function () { creandoEpica = true; App.repintar(); },
      }, ['+ Nueva épica']));
    }
    return barra;
  }

  /* ============================ SPRINTS + BACKLOG ============================ */

  function renderPrincipal(puede) {
    var st = Store.get();
    var principal = E('section', { class: 'agiliza-principal' });

    var filtro = function (t) { return !st.epicaFiltro || t.epica === st.epicaFiltro; };

    if (creandoSprint && puede) principal.appendChild(formSprint());

    st.sprints.forEach(function (sp) {
      principal.appendChild(bloqueSprint(sp, st.tareas.filter(function (t) { return t.sprint === sp.id; }).filter(filtro), puede));
    });

    /* Backlog */
    var backlog = st.tareas.filter(function (t) { return !t.sprint; }).filter(filtro);
    var bloque = E('section', { class: 'bloque-sprint', dataset: { contenedor: 'backlog' } });
    bloque.appendChild(E('header', { class: 'sprint-cabecera backlog-cabecera' }, [
      E('h2', { class: 'sprint-nombre' }, ['Backlog']),
      E('span', { class: 'conteo-suave' }, [backlog.length + ' tareas sin sprint']),
    ]));
    bloque.appendChild(listaTareas(backlog, 'backlog', puede,
      'El backlog está vacío. Convierte la Teoría de Cambio en tareas con el botón ⚡, o crea una tarea nueva.'));
    activarDrop(bloque, null, puede);
    principal.appendChild(bloque);

    return principal;
  }

  function bloqueSprint(sp, tareas, puede) {
    var bloque = E('section', { class: 'bloque-sprint', dataset: { contenedor: sp.id } });

    /* Fechas: editables en línea para quien planea, texto plano para el resto */
    var fechas;
    if (puede) {
      var inInicio = E('input', { class: 'fecha-inline', type: 'date', value: sp.inicio || '', 'aria-label': 'Inicio de ' + sp.nombre });
      var inFin = E('input', { class: 'fecha-inline', type: 'date', value: sp.fin || '', 'aria-label': 'Fin de ' + sp.nombre });
      function guardarFechas() {
        if (inInicio.value && inFin.value && inFin.value < inInicio.value) {
          inFin.setAttribute('aria-invalid', 'true');
          UI.toast('La fecha de fin no puede ser anterior al inicio');
          return;
        }
        Store.mutar(function (s) {
          var x = Store.sprint(sp.id);
          x.inicio = inInicio.value;
          x.fin = inFin.value;
        });
      }
      inInicio.addEventListener('change', guardarFechas);
      inFin.addEventListener('change', guardarFechas);
      fechas = E('span', { class: 'sprint-fechas' }, [inInicio, ' – ', inFin]);
    } else {
      fechas = E('span', { class: 'sprint-fechas' }, [(UI.fechaCorta(sp.inicio) || 'sin inicio') + ' – ' + (UI.fechaCorta(sp.fin) || 'sin fin')]);
    }

    var cab = E('header', { class: 'sprint-cabecera' }, [
      E('h2', { class: 'sprint-nombre' }, [sp.nombre]),
      fechas,
      sp.activo ? E('span', { class: 'chip sprint-activo' }, ['ACTIVO']) : null,
      puede && !sp.activo ? E('button', {
        class: 'btn btn-quieto',
        onclick: function () {
          Store.mutar(function (s) {
            s.sprints.forEach(function (x) { x.activo = x.id === sp.id; });
          });
          UI.toast(sp.nombre + ' es ahora el sprint activo');
        },
      }, ['Activar']) : null,
      E('span', { class: 'sprint-regla' }, ['solo lo asignado en el sprint activo llega a la app de campo']),
    ]);
    bloque.appendChild(cab);
    bloque.appendChild(listaTareas(tareas, sp.id, puede, 'Arrastra tareas del backlog, o usa "Mover a" en cada tarea.'));
    activarDrop(bloque, sp.id, puede);
    return bloque;
  }

  function listaTareas(tareas, contenedorId, puede, msjVacio) {
    var ul = E('ul', { class: 'lista-tareas' });
    if (!tareas.length) {
      ul.appendChild(E('li', {}, [E('div', { class: 'vacio' }, [msjVacio])]));
      return ul;
    }
    tareas.forEach(function (t) { ul.appendChild(filaTarea(t, puede)); });
    return ul;
  }

  function filaTarea(t, puede) {
    var st = Store.get();
    var ep = t.epica ? Store.epica(t.epica) : null;

    var fila = E('li', {
      class: 'tarea-fila',
      draggable: puede ? 'true' : null,
      dataset: { tarea: t.id },
      tabindex: '0',
      onclick: function () { abrirPanel(t.id); },
      onkeydown: function (ev) { if (ev.key === 'Enter') abrirPanel(t.id); },
    });

    if (puede) {
      fila.addEventListener('dragstart', function (ev) {
        ev.dataTransfer.setData('text/plain', t.id);
        fila.classList.add('arrastrando');
      });
      fila.addEventListener('dragend', function () { fila.classList.remove('arrastrando'); });
    }

    fila.appendChild(E('span', { class: 'agarre', 'aria-hidden': 'true' }, ['⠿']));
    fila.appendChild(E('span', { class: 'tarea-titulo' }, [t.titulo]));

    var meta = E('span', { class: 'tarea-meta' });
    if (t.origen) meta.appendChild(E('span', { class: 'badge-origen', title: 'Creada desde la Teoría de Cambio' }, ['ToC']));
    if (t.reportes && t.reportes.some(function (r) { return r.sync; }) && t.estado === 'done') {
      meta.appendChild(E('span', { class: 'badge-entregable' }, ['entregable ✓']));
    }
    if (ep) {
      var tag = E('span', { class: 'tag-epica' }, [ep.nombre.split('—')[0].trim()]);
      tag.style.setProperty('--tag-color', ep.color);
      meta.appendChild(tag);
    }
    if (t.inicio || t.fin) {
      meta.appendChild(E('span', { class: 'tarea-fechas' }, [
        (UI.fechaCorta(t.inicio) || '…') + ' → ' + (UI.fechaCorta(t.fin) || '…'),
      ]));
    }

    /* Estado como select directo en la fila (H2.6) */
    var sel = E('select', {
      class: 'estado-select',
      'aria-label': 'Estado de ' + t.titulo,
      disabled: !puede,
      onclick: function (ev) { ev.stopPropagation(); },
      onchange: function (ev) {
        Store.mutar(function (s) { Store.tarea(t.id).estado = ev.target.value; });
      },
    });
    UI.ESTADOS.forEach(function (e) {
      var op = E('option', { value: e.id }, [e.nombre]);
      if (t.estado === e.id) op.selected = true;
      sel.appendChild(op);
    });
    meta.appendChild(sel);
    meta.appendChild(UI.avatar(t.asignado, true));

    fila.appendChild(meta);
    return fila;
  }

  function activarDrop(bloque, sprintId, puede) {
    if (!puede) return;
    bloque.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      bloque.classList.add('arrastre-encima');
    });
    bloque.addEventListener('dragleave', function () { bloque.classList.remove('arrastre-encima'); });
    bloque.addEventListener('drop', function (ev) {
      ev.preventDefault();
      bloque.classList.remove('arrastre-encima');
      var id = ev.dataTransfer.getData('text/plain');
      if (!id || !Store.tarea(id)) return;
      Store.mutar(function (s) { Store.tarea(id).sprint = sprintId; });
      var destino = sprintId ? Store.sprint(sprintId).nombre : 'el Backlog';
      UI.toast('Tarea movida a ' + destino);
    });
  }

  /* ============================ ALTAS ============================ */

  function nuevaTarea() {
    var id = Store.uid('t');
    Store.mutar(function (s) {
      s.tareas.push({
        id: id, titulo: 'Nueva tarea', origen: null, indicadores: [],
        epica: s.epicaFiltro || null, sprint: null, estado: 'idea', asignado: null,
        inicio: '', fin: '', evidencia: '', reportes: [],
      });
    });
    abrirPanel(id);
  }

  function nuevoSprint() {
    creandoSprint = true;
    App.repintar();
  }

  /* Alta de sprint en línea: nombre + fechas con validación (H2.5) */
  function formSprint() {
    var n = Store.get().sprints.length + 1;

    var inNombre = E('input', { class: 'campo', id: 'ns-nombre', value: 'Sprint ' + n, maxlength: '60' });
    var inInicio = E('input', { class: 'campo', id: 'ns-inicio', type: 'date' });
    var inFin = E('input', { class: 'campo', id: 'ns-fin', type: 'date' });
    var error = E('p', { class: 'error-campo', style: 'display:none' }, []);

    function validar() {
      if (!inNombre.value.trim()) return 'El sprint necesita un nombre.';
      if (!inInicio.value || !inFin.value) return 'Define la fecha de inicio y la de fin.';
      if (inFin.value < inInicio.value) return 'La fecha de fin no puede ser anterior al inicio.';
      return null;
    }

    return E('section', { class: 'form-inline', 'aria-label': 'Nuevo sprint' }, [
      E('h2', { class: 'sprint-nombre' }, ['Nuevo sprint']),
      E('div', { class: 'form-inline-fila' }, [
        E('div', {}, [E('label', { class: 'etiqueta', for: 'ns-nombre' }, ['Nombre']), inNombre]),
        E('div', {}, [E('label', { class: 'etiqueta', for: 'ns-inicio' }, ['Inicio']), inInicio]),
        E('div', {}, [E('label', { class: 'etiqueta', for: 'ns-fin' }, ['Fin']), inFin]),
        E('div', { class: 'form-inline-acciones' }, [
          E('button', {
            class: 'btn btn-primario',
            onclick: function () {
              var problema = validar();
              if (problema) {
                error.textContent = problema;
                error.style.display = 'block';
                return;
              }
              creandoSprint = false;
              Store.mutar(function (s) {
                s.sprints.push({ id: Store.uid('sp'), nombre: inNombre.value.trim(), inicio: inInicio.value, fin: inFin.value, activo: false });
              });
              UI.toast('Sprint creado');
            },
          }, ['Crear sprint']),
          E('button', { class: 'btn', onclick: function () { creandoSprint = false; App.repintar(); } }, ['Cancelar']),
        ]),
      ]),
      error,
    ]);
  }

  /* ============================ PANEL DE TAREA ============================ */

  function abrirPanel(tareaId) {
    tareaAbierta = tareaId;
    pintarPanel();
  }

  function cerrarPanel() {
    tareaAbierta = null;
    document.getElementById('panel-tarea').hidden = true;
    document.getElementById('panel-fondo').hidden = true;
  }

  function pintarPanel() {
    var t = Store.tarea(tareaAbierta);
    var panel = document.getElementById('panel-tarea');
    var fondo = document.getElementById('panel-fondo');
    if (!t) { cerrarPanel(); return; }

    var puede = rw();
    panel.innerHTML = '';
    panel.hidden = false;
    fondo.hidden = false;
    fondo.onclick = cerrarPanel;

    panel.appendChild(E('div', { class: 'panel-cabecera' }, [
      E('h2', { class: 'panel-titulo' }, [t.titulo]),
      E('button', { class: 'btn-icono', 'aria-label': 'Cerrar panel', onclick: cerrarPanel }, ['✕']),
    ]));

    if (t.origen) {
      var nodoOrigen = Store.nodo(t.origen);
      panel.appendChild(E('p', { class: 'conteo-suave' }, [
        'Creada desde la Teoría de Cambio: "' + (nodoOrigen ? nodoOrigen.texto : '(tarjeta eliminada)') + '"',
      ]));
    }

    function grupo(etiqueta, control) {
      return E('div', { class: 'panel-grupo' }, [E('label', { class: 'etiqueta' }, [etiqueta]), control]);
    }

    /* Título */
    var inTitulo = E('input', { class: 'campo', value: t.titulo, disabled: !puede });
    inTitulo.addEventListener('change', function () {
      Store.mutar(function (s) { Store.tarea(t.id).titulo = inTitulo.value.trim() || 'Sin título'; });
    });
    panel.appendChild(grupo('Título', inTitulo));

    /* Épica + Sprint */
    var selEpica = E('select', { class: 'campo-select', disabled: !puede });
    selEpica.appendChild(E('option', { value: '' }, ['Sin épica']));
    Store.get().epicas.forEach(function (ep) {
      var op = E('option', { value: ep.id }, [ep.nombre]);
      if (t.epica === ep.id) op.selected = true;
      selEpica.appendChild(op);
    });
    selEpica.addEventListener('change', function () {
      Store.mutar(function (s) { Store.tarea(t.id).epica = selEpica.value || null; });
    });

    var selSprint = E('select', { class: 'campo-select', disabled: !puede });
    selSprint.appendChild(E('option', { value: '' }, ['Backlog (sin sprint)']));
    Store.get().sprints.forEach(function (sp) {
      var op = E('option', { value: sp.id }, [sp.nombre + (sp.activo ? ' · activo' : '')]);
      if (t.sprint === sp.id) op.selected = true;
      selSprint.appendChild(op);
    });
    selSprint.addEventListener('change', function () {
      Store.mutar(function (s) { Store.tarea(t.id).sprint = selSprint.value || null; });
    });

    panel.appendChild(E('div', { class: 'panel-fila-2' }, [
      grupo('Épica', selEpica),
      grupo('Mover a', selSprint),
    ]));

    /* Estado + Asignado */
    var selEstado = E('select', { class: 'campo-select', disabled: !puede });
    UI.ESTADOS.forEach(function (e) {
      var op = E('option', { value: e.id }, [e.nombre]);
      if (t.estado === e.id) op.selected = true;
      selEstado.appendChild(op);
    });
    selEstado.addEventListener('change', function () {
      Store.mutar(function (s) { Store.tarea(t.id).estado = selEstado.value; });
    });

    var selAsignado = E('select', { class: 'campo-select', disabled: !puede });
    selAsignado.appendChild(E('option', { value: '' }, ['Sin asignar']));
    Store.PERSONAS.filter(function (p) { return p.id === 'marco' || p.id === 'carlos'; }).forEach(function (p) {
      var op = E('option', { value: p.id }, [p.nombre + ' — ' + p.cargo]);
      if (t.asignado === p.id) op.selected = true;
      selAsignado.appendChild(op);
    });
    selAsignado.addEventListener('change', function () {
      Store.mutar(function (s) { Store.tarea(t.id).asignado = selAsignado.value || null; });
    });

    panel.appendChild(E('div', { class: 'panel-fila-2' }, [
      grupo('Estado', selEstado),
      grupo('Responsable', selAsignado),
    ]));

    /* Fechas */
    var inInicio = E('input', { class: 'campo', type: 'date', value: t.inicio || '', disabled: !puede });
    var inFin = E('input', { class: 'campo', type: 'date', value: t.fin || '', disabled: !puede });
    inInicio.addEventListener('change', function () { Store.mutar(function (s) { Store.tarea(t.id).inicio = inInicio.value; }); });
    inFin.addEventListener('change', function () { Store.mutar(function (s) { Store.tarea(t.id).fin = inFin.value; }); });
    panel.appendChild(E('div', { class: 'panel-fila-2' }, [
      grupo('Inicio', inInicio),
      grupo('Fin', inFin),
    ]));

    /* Evidencia requerida */
    var inEvidencia = E('textarea', { class: 'campo-area', disabled: !puede });
    inEvidencia.value = t.evidencia || '';
    inEvidencia.placeholder = '¿Qué evidencia debe reportar el operador? (fotos, actas, lecturas…)';
    inEvidencia.addEventListener('change', function () {
      Store.mutar(function (s) { Store.tarea(t.id).evidencia = inEvidencia.value.trim(); });
    });
    panel.appendChild(grupo('Evidencia requerida', inEvidencia));

    /* Indicadores enlazados */
    var chips = E('div', { class: 'mir-indicadores' });
    (t.indicadores || []).forEach(function (id) {
      var ind = Store.indicador(id);
      if (ind) chips.appendChild(E('span', { class: 'chip chip-ind' }, [ind.nombre]));
    });
    if (!(t.indicadores || []).length) chips.appendChild(E('span', { class: 'conteo-suave' }, ['Sin indicadores — se heredan al convertir desde la ToC.']));
    panel.appendChild(grupo('Indicadores', chips));

    /* Reportes de campo (lo que genera Marco) */
    var reportes = E('div', { class: 'reportes-previos' });
    (t.reportes || []).forEach(function (r) {
      var item = E('div', { class: 'reporte-item' }, [
        E('div', { class: 'reporte-meta' }, [
          UI.fechaHora(r.fecha),
          r.sync ? E('span', { class: 'badge-sync' }, ['sincronizado ✓']) : E('span', { class: 'badge-pendiente' }, ['pendiente de sincronizar']),
        ]),
        E('div', {}, [r.nota || '(sin nota)']),
      ]);
      if (r.fotos && r.fotos.length) {
        var fotos = E('div', { class: 'reporte-fotos' });
        r.fotos.forEach(function (src) { fotos.appendChild(E('img', { src: src, alt: 'Evidencia fotográfica del reporte' })); });
        item.appendChild(fotos);
      }
      reportes.appendChild(item);
    });
    if (!(t.reportes || []).length) reportes.appendChild(E('span', { class: 'conteo-suave' }, ['Todavía sin reportes de campo.']));
    panel.appendChild(grupo('Reportes de campo (' + (t.reportes || []).length + ')', reportes));

    /* Eliminar */
    if (puede) {
      panel.appendChild(E('button', {
        class: 'btn',
        onclick: function () {
          var copia = JSON.parse(JSON.stringify(t));
          Store.mutar(function (s) { s.tareas = s.tareas.filter(function (x) { return x.id !== t.id; }); });
          cerrarPanel();
          UI.toast('Tarea eliminada', 'Deshacer', function () {
            Store.mutar(function (s) { s.tareas.push(copia); });
          });
        },
      }, ['Eliminar tarea']));
    }
  }

  /* Cerrar panel con Escape */
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && tareaAbierta) cerrarPanel();
  });

  /* Si el estado cambia con el panel abierto, repintarlo */
  Store.alCambiar(function () { if (tareaAbierta) pintarPanel(); });

  return {
    render: render,
    cerrarPanel: cerrarPanel,
    abrirFormSprint: function () { creandoSprint = true; }, // hook de prueba/demo
  };
})();
