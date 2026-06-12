/* =========================================================================
   ejecuta.js — Módulo EJECUTA (Marco)
   Marco de teléfono · kanban móvil · captura con fotos · simulación offline
   Regla H2.6: aquí solo llegan tareas del sprint ACTIVO asignadas a Marco.
   ========================================================================= */

var Ejecuta = (function () {
  var E = UI.el;
  var tareaCaptura = null;      // tarea con la hoja de captura abierta
  var fotosPendientes = [];     // dataURLs de la captura en curso

  var COLS = [
    { id: 'todo', nombre: 'Por hacer', color: '#1E2A78' },
    { id: 'doing', nombre: 'En curso', color: '#F58220' },
    { id: 'done', nombre: 'Hecho', color: '#1FA86B' },
  ];

  function misTareas() {
    var st = Store.get();
    var activo = st.sprints.find(function (s) { return s.activo; });
    if (!activo) return [];
    return st.tareas.filter(function (t) { return t.sprint === activo.id && t.asignado === 'marco'; });
  }

  function pendientesDeSync() {
    var n = 0;
    Store.get().tareas.forEach(function (t) {
      (t.reportes || []).forEach(function (r) { if (!r.sync) n++; });
    });
    return n;
  }

  /* ============================ RENDER RAÍZ ============================ */

  function render(cont) {
    var st = Store.get();
    var escenario = E('div', { class: 'ejecuta-escenario' });
    var telefono = E('div', { class: 'telefono' });
    var interior = E('div', { class: 'telefono-interior' });

    /* Cabecera móvil */
    var pendientes = pendientesDeSync();
    var toggle = E('button', {
      class: 'toggle-red',
      'aria-pressed': st.offline ? 'true' : 'false',
      title: st.offline ? 'Sin señal (simulada) — toca para reconectar' : 'Con señal — toca para simular campo sin señal',
      onclick: alternarRed,
    }, [st.offline ? '✈ sin señal' : '📶 en línea']);

    telefono.appendChild(E('header', { class: 'movil-cabecera' }, [
      E('span', { class: 'movil-marca' }, ['GARABATO', E('span', { style: 'color:#2B3FD6' }, ['_'])]),
      E('span', { class: 'movil-usuario' }, [toggle, UI.avatar('marco', true)]),
    ]));

    if (st.offline) {
      var usoTxt = Store.usoAlmacen() > 0.6 ? ' · memoria ' + Math.round(Store.usoAlmacen() * 100) + '%' : '';
      telefono.appendChild(E('div', { class: 'banda-offline' }, [
        '✈ Sin señal — ' + (pendientes ? pendientes + ' reporte(s) en cola, se sincronizan al reconectar' : 'tus reportes se guardan en el teléfono') + usoTxt,
      ]));
    }

    /* La pérdida silenciosa de reportes es inaceptable: avisar SIEMPRE que falle el guardado */
    if (Store.guardadoFallo()) {
      telefono.appendChild(E('div', { class: 'banda-alerta', role: 'alert' }, [
        '⚠ Memoria del teléfono llena — los reportes nuevos NO se guardan. Sincroniza o libera espacio.',
      ]));
    }

    /* Kanban móvil */
    var tareas = misTareas();
    var kanban = E('div', { class: 'movil-kanban' });

    if (!tareas.length) {
      kanban.appendChild(E('div', { class: 'vacio', style: 'align-self:center' }, [
        E('span', { class: 'vacio-titulo' }, ['Sin tareas asignadas']),
        'Las tareas llegan aquí cuando Carlos las pone en el sprint activo y te las asigna.',
      ]));
    } else {
      COLS.forEach(function (col) {
        var tareasCol = tareas.filter(function (t) {
          /* "idea" se agrupa con "por hacer" en campo: Marco solo ve trabajo accionable */
          return col.id === 'todo' ? (t.estado === 'todo' || t.estado === 'idea') : t.estado === col.id;
        });
        var elCol = E('div', { class: 'movil-col' });
        elCol.style.setProperty('--col-color', col.color);
        elCol.appendChild(E('div', { class: 'movil-col-cab' }, [
          col.nombre,
          E('span', { class: 'movil-col-conteo' }, [String(tareasCol.length)]),
        ]));
        tareasCol.forEach(function (t) { elCol.appendChild(tarjetaMovil(t)); });
        if (!tareasCol.length) elCol.appendChild(E('div', { class: 'vacio' }, ['Nada en "' + col.nombre + '"']));
        kanban.appendChild(elCol);
      });
    }

    interior.appendChild(kanban);

    /* Hoja de captura encima del kanban */
    if (tareaCaptura) interior.appendChild(hojaCaptura(tareaCaptura));

    telefono.appendChild(interior);
    escenario.appendChild(telefono);
    cont.appendChild(escenario);
  }

  function tarjetaMovil(t) {
    var pendiente = (t.reportes || []).some(function (r) { return !r.sync; });
    var sincronizados = (t.reportes || []).filter(function (r) { return r.sync; }).length;

    var meta = E('div', { class: 'movil-tarea-meta' });
    if (t.inicio || t.fin) meta.appendChild(E('span', {}, [(UI.fechaCorta(t.inicio) || '…') + ' → ' + (UI.fechaCorta(t.fin) || '…')]));
    if (pendiente) meta.appendChild(E('span', { class: 'badge-pendiente' }, ['pendiente de sync']));
    if (sincronizados) meta.appendChild(E('span', { class: 'badge-sync' }, [sincronizados + ' reporte(s) ✓']));

    var idx = COLS.findIndex(function (c) { return c.id === (t.estado === 'idea' ? 'todo' : t.estado); });
    var botones = [];
    if (idx > 0) {
      botones.push(E('button', {
        class: 'movil-accion',
        'aria-label': 'Regresar a ' + COLS[idx - 1].nombre,
        onclick: function (ev) { ev.stopPropagation(); moverEstado(t.id, COLS[idx - 1].id); },
      }, ['← ' + COLS[idx - 1].nombre]));
    }
    if (idx < COLS.length - 1 && idx !== -1) {
      botones.push(E('button', {
        class: 'movil-accion',
        'aria-label': 'Avanzar a ' + COLS[idx + 1].nombre,
        onclick: function (ev) { ev.stopPropagation(); moverEstado(t.id, COLS[idx + 1].id); },
      }, [COLS[idx + 1].nombre + ' →']));
    }
    var acciones = E('div', { class: 'movil-acciones' + (botones.length === 1 ? ' una' : '') }, botones);

    return E('button', {
      class: 'movil-tarea',
      onclick: function () { tareaCaptura = t.id; fotosPendientes = []; App.repintar(); },
    }, [
      E('span', { class: 'movil-tarea-titulo' }, [t.titulo]),
      t.evidencia ? E('span', { class: 'movil-tarea-meta' }, ['📎 ' + t.evidencia]) : null,
      meta,
      acciones,
    ]);
  }

  function moverEstado(tareaId, estado) {
    Store.mutar(function (s) { Store.tarea(tareaId).estado = estado; });
  }

  /* ============================ HOJA DE CAPTURA (H3.2 / H3.3) ============================ */

  function hojaCaptura(tareaId) {
    var t = Store.tarea(tareaId);
    var st = Store.get();
    if (!t) { tareaCaptura = null; return E('div'); }

    var hoja = E('div', { class: 'hoja', role: 'dialog', 'aria-label': 'Reportar avance' });

    hoja.appendChild(E('header', { class: 'hoja-cabecera' }, [
      E('button', { class: 'btn-icono', 'aria-label': 'Volver al tablero', onclick: function () { tareaCaptura = null; App.repintar(); } }, ['←']),
      E('h2', { class: 'hoja-titulo' }, [t.titulo]),
    ]));

    var cuerpo = E('div', { class: 'hoja-cuerpo' });

    if (t.evidencia) {
      cuerpo.appendChild(E('div', { class: 'evidencia-nota' }, [
        E('strong', {}, ['Evidencia requerida']),
        t.evidencia,
      ]));
    }

    /* Nota */
    var nota = E('textarea', { class: 'campo-area', id: 'captura-nota' });
    nota.placeholder = '¿Qué encontraste? ¿Qué se hizo?';
    cuerpo.appendChild(E('div', { class: 'panel-grupo' }, [
      E('label', { class: 'etiqueta', for: 'captura-nota' }, ['Nota de campo']),
      nota,
    ]));

    /* Fotos */
    var inputFotos = E('input', { type: 'file', accept: 'image/*', multiple: true, class: 'oculto', id: 'captura-fotos' });
    inputFotos.addEventListener('change', function () {
      var archivos = Array.prototype.slice.call(inputFotos.files);
      var faltan = archivos.length;
      archivos.forEach(function (archivo) {
        var lector = new FileReader();
        lector.onload = function () {
          /* reducción simple para no reventar localStorage */
          comprimir(lector.result, function (mini) {
            fotosPendientes.push(mini);
            faltan--;
            if (!faltan) App.repintar();
          });
        };
        lector.readAsDataURL(archivo);
      });
    });

    var grid = E('div', { class: 'fotos-grid' });
    fotosPendientes.forEach(function (src, i) {
      grid.appendChild(E('div', { class: 'foto-celda' }, [
        E('img', { src: src, alt: 'Foto ' + (i + 1) + ' por adjuntar' }),
        E('button', {
          class: 'foto-quitar', 'aria-label': 'Quitar foto ' + (i + 1),
          onclick: function () { fotosPendientes.splice(i, 1); App.repintar(); },
        }, ['✕']),
      ]));
    });

    cuerpo.appendChild(E('div', { class: 'panel-grupo' }, [
      E('label', { class: 'etiqueta' }, ['Fotos (' + fotosPendientes.length + ')']),
      grid,
      E('button', { class: 'subir-fotos', onclick: function () { inputFotos.click(); } }, ['📷 Agregar fotos']),
      inputFotos,
    ]));

    /* Reportes previos de esta tarea */
    if ((t.reportes || []).length) {
      var previos = E('div', { class: 'reportes-previos' });
      t.reportes.slice().reverse().forEach(function (r) {
        var item = E('div', { class: 'reporte-item' }, [
          E('div', { class: 'reporte-meta' }, [
            UI.fechaHora(r.fecha),
            r.sync ? E('span', { class: 'badge-sync' }, ['sincronizado ✓']) : E('span', { class: 'badge-pendiente' }, ['en cola']),
          ]),
          E('div', {}, [r.nota || '(sin nota)']),
        ]);
        if (r.fotos && r.fotos.length) {
          var fotos = E('div', { class: 'reporte-fotos' });
          r.fotos.forEach(function (src) { fotos.appendChild(E('img', { src: src, alt: 'Evidencia del reporte' })); });
          item.appendChild(fotos);
        }
        previos.appendChild(item);
      });
      cuerpo.appendChild(E('div', { class: 'panel-grupo' }, [
        E('label', { class: 'etiqueta' }, ['Reportes anteriores']),
        previos,
      ]));
    }

    hoja.appendChild(cuerpo);

    /* Pie: reportar */
    var sinEspacio = Store.guardadoFallo();
    var btnReportar = E('button', {
      class: 'btn btn-primario',
      style: 'width:100%; justify-content:center; padding:12px; min-height:48px;',
      disabled: sinEspacio || null,
    }, [
      sinEspacio ? 'Sin espacio — no se puede guardar' : (st.offline ? 'Guardar reporte (se sincroniza al reconectar)' : 'Reportar'),
    ]);
    btnReportar.addEventListener('click', function () {
      var textoNota = nota.value.trim();
      if (!textoNota && !fotosPendientes.length) {
        UI.toast('Agrega una nota o al menos una foto antes de reportar');
        nota.focus();
        return;
      }
      var offline = Store.get().offline;
      Store.mutar(function (s) {
        Store.tarea(t.id).reportes.push({
          id: Store.uid('r'),
          fecha: new Date().toISOString(),
          nota: textoNota,
          fotos: fotosPendientes.slice(),
          sync: !offline,
        });
      });
      fotosPendientes = [];
      tareaCaptura = null;
      UI.toast(offline
        ? 'Reporte guardado en el teléfono — en cola de sincronización'
        : 'Reporte sincronizado ✓ — el entregable se genera de esta única captura');
      App.repintar();
    });
    hoja.appendChild(E('footer', { class: 'hoja-pie' }, [btnReportar]));

    return hoja;
  }

  /* Reduce las fotos a ~800px para que quepan en localStorage */
  function comprimir(dataUrl, listo) {
    var img = new Image();
    img.onload = function () {
      var maxLado = 800;
      var escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      listo(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = function () { listo(dataUrl); };
    img.src = dataUrl;
  }

  /* ============================ RED / SINCRONIZACIÓN ============================ */

  function alternarRed() {
    var estabaOffline = Store.get().offline;
    Store.mutar(function (s) { s.offline = !s.offline; });
    if (estabaOffline) sincronizar();
  }

  function sincronizar() {
    var enCola = [];
    Store.get().tareas.forEach(function (t) {
      (t.reportes || []).forEach(function (r) { if (!r.sync) enCola.push({ tarea: t.id, reporte: r.id }); });
    });
    if (!enCola.length) return;

    /* Sincronización secuencial simulada: un reporte cada 450ms */
    var i = 0;
    function paso() {
      if (i >= enCola.length) {
        UI.toast(enCola.length + ' reporte(s) sincronizados ✓');
        return;
      }
      var ref = enCola[i];
      Store.mutar(function (s) {
        var t = Store.tarea(ref.tarea);
        var r = t.reportes.find(function (x) { return x.id === ref.reporte; });
        if (r) r.sync = true;
      });
      i++;
      setTimeout(paso, 450);
    }
    paso();
  }

  return { render: render };
})();
