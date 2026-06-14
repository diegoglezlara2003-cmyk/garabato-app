/* =========================================================================
   disena.js — Módulo DISEÑA (Lucía)
   Programa · Teoría de Cambio (lienzo navegable) · MIR (una fila por indicador)
   ========================================================================= */

var Disena = (function () {
  var E = UI.el;

  var ETAPAS = [
    { id: 'insumos',     nombre: 'Insumos',     color: '#D8B98F' },
    { id: 'actividades', nombre: 'Actividades', color: '#F58220' },
    { id: 'productos',   nombre: 'Productos',   color: '#29C5D6' },
    { id: 'resultados',  nombre: 'Resultados',  color: '#1FA86B' },
    { id: 'impacto',     nombre: 'Impacto',     color: '#6A3FD4' },
  ];

  /* Mapeo ToC → niveles MIR (lógica vertical estándar) */
  var NIVELES_MIR = [
    { nivel: 'Fin',         etapa: 'impacto',     color: '#6A3FD4' },
    { nivel: 'Propósito',   etapa: 'resultados',  color: '#1FA86B' },
    { nivel: 'Componentes', etapa: 'productos',   color: '#29C5D6' },
    { nivel: 'Actividades', etapa: 'actividades', color: '#F58220' },
  ];

  var enlaceOrigen = null;    // id del nodo desde el que se está conectando
  var nodoIndicadores = null; // nodo cuyo picker de indicadores está abierto
  var detalleIndId = null;    // indicador con su ficha de detalle abierta
  var alRedimensionar = null; // handler vivo de resize para los conectores
  var _idCampo = 0;           // contador para asociar labels con sus campos

  /* Estado del lienzo (vive fuera del repintado para conservar pan/zoom y
     el espaciado por columna). colOffset: px horizontales extra por etapa. */
  var vistaToC = { pan: { x: 0, y: 0 }, zoom: 1, inicializado: false, colOffset: {} };

  function rw() { return Store.permiso('disena') === 'rw'; }

  /* ============================ RENDER RAÍZ ============================ */

  function render(cont) {
    var st = Store.get();
    var sub = st.subvistaDisena || 'toc';

    cont.appendChild(E('div', { class: 'vista-cabecera' }, [
      E('div', {}, [
        E('h1', { class: 'vista-titulo' }, ['Diseña']),
        E('p', { class: 'vista-sub' }, ['Estructura tu programa o proyecto desde la Teoría de Cambio hasta la Matríz de Indicadores para Resultados']),
      ]),
    ]));

    if (!rw()) {
      cont.appendChild(E('p', { class: 'solo-lectura' }, ['👁 Solo lectura — el diseño le pertenece a Lucía (Diseñadora).']));
    }

    var tabs = E('div', { class: 'subtabs', role: 'tablist' });
    [['programa', 'Programa'], ['toc', 'Teoría de Cambio'], ['mir', 'MIR']].forEach(function (par) {
      tabs.appendChild(E('button', {
        class: 'subtab',
        role: 'tab',
        'aria-current': sub === par[0] ? 'true' : null,
        onclick: function () { Store.mutar(function (s) { s.subvistaDisena = par[0]; }); },
      }, [par[1]]));
    });
    cont.appendChild(tabs);

    if (sub === 'programa') renderPrograma(cont);
    else if (sub === 'mir') renderMIR(cont);
    else renderToC(cont);
  }

  /* ============================ PROGRAMA ============================ */

  function renderPrograma(cont) {
    var p = Store.programa();
    var puede = rw();

    function campo(nombre, etiqueta, tipo, valor, ancho) {
      var input = tipo === 'area'
        ? E('textarea', { class: 'campo-area', id: 'prog-' + nombre, disabled: !puede }, [])
        : E('input', { class: 'campo', id: 'prog-' + nombre, type: tipo, disabled: !puede });
      input.value = valor || '';
      input.addEventListener('change', function () {
        Store.actualizarPrograma(definirCampo(nombre, input.value));
        UI.toast('Programa actualizado');
      });
      return E('div', { class: ancho ? '' : null }, [
        E('label', { class: 'etiqueta', for: 'prog-' + nombre }, [etiqueta]),
        input,
      ]);
    }

    cont.appendChild(E('div', { class: 'contenido' }, [
      E('div', { class: 'form-programa' }, [
        campo('nombre', 'Nombre del programa o proyecto', 'text', p.nombre),
        campo('dependencia', 'Dependencia responsable', 'text', p.dependencia),
        campo('poblacion', 'Población objetivo / beneficiaria', 'area', p.poblacion),
        E('div', { class: 'form-fila' }, [
          campo('presupuesto', 'Presupuesto', 'text', p.presupuesto),
          E('div', { class: 'form-fila' }, [
            campo('inicio', 'Inicio', 'date', p.inicio),
            campo('fin', 'Fin', 'date', p.fin),
          ]),
        ]),
        campo('descripcion', 'Descripción', 'area', p.descripcion),
      ]),
    ]));
  }

  /* ============================ TEORÍA DE CAMBIO (lienzo) ============================ */

  function aplicarTransform(lienzo) {
    lienzo.style.transform = 'translate(' + vistaToC.pan.x + 'px,' + vistaToC.pan.y + 'px) scale(' + vistaToC.zoom + ')';
  }

  function actualizarZoomLabel() {
    var l = document.getElementById('toc-zoom-label');
    if (l) l.textContent = Math.round(vistaToC.zoom * 100) + '%';
  }

  function fitToContent(viewport, lienzo) {
    var cw = lienzo.scrollWidth, ch = lienzo.scrollHeight;
    var vw = viewport.clientWidth, vh = viewport.clientHeight;
    if (!cw || !ch || !vw || !vh) return;
    var z = Math.min(vw / (cw + 80), vh / (ch + 80), 1);
    z = Math.max(z, 0.3);
    vistaToC.zoom = z;
    vistaToC.pan.x = Math.max(20, (vw - cw * z) / 2);
    vistaToC.pan.y = 20;
    aplicarTransform(lienzo);
    actualizarZoomLabel();
  }

  function renderToC(cont) {
    var st = Store.get();
    var puede = rw();

    /* Barra: estado a la izquierda, controles del lienzo a la derecha */
    var prog = Store.programa();
    var estado = enlaceOrigen
      ? E('span', { class: 'toc-aviso-conexion' }, ['Conectando — elige una tarjeta de la siguiente columna · Esc para cancelar'])
      : E('span', { class: 'conteo-suave' }, [prog.toc.nodos.length + ' tarjetas · ' + prog.toc.enlaces.length + ' conexiones · arrastra el lienzo para moverte · rueda para zoom']);

    var controles = E('div', { class: 'toc-controles' }, [
      E('button', { class: 'btn btn-quieto', 'aria-label': 'Alejar', onclick: function () { zoomPaso(1 / 1.2); } }, ['−']),
      E('span', { class: 'toc-zoom', id: 'toc-zoom-label' }, [Math.round(vistaToC.zoom * 100) + '%']),
      E('button', { class: 'btn btn-quieto', 'aria-label': 'Acercar', onclick: function () { zoomPaso(1.2); } }, ['+']),
      E('button', { class: 'btn', onclick: function () { centrar(); } }, ['Centrar']),
      E('button', { class: 'btn', onclick: exportarPDF }, ['Exportar PDF']),
    ]);
    cont.appendChild(E('div', { class: 'toc-barra' }, [estado, controles]));

    /* Viewport (recorta) → lienzo (se transforma) → svg + columnas */
    var viewport = E('div', { class: 'toc-viewport', id: 'toc-viewport' });
    var lienzo = E('div', { class: 'toc-lienzo', id: 'toc-lienzo' });

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'toc-conectores');
    svg.setAttribute('aria-hidden', 'true');
    lienzo.appendChild(svg);

    var tablero = E('div', { class: 'toc-tablero' });
    ETAPAS.forEach(function (etapa, idx) {
      var col = E('div', { class: 'toc-col', dataset: { etapa: etapa.id } });
      col.style.setProperty('--col-color', etapa.color);
      var off = vistaToC.colOffset[etapa.id] || 0;
      if (off) col.style.transform = 'translateX(' + off + 'px)';

      var cab = E('div', { class: 'toc-col-cabecera', title: 'Arrastra para espaciar esta columna' }, [
        E('span', { class: 'toc-col-grip', 'aria-hidden': 'true' }, ['⠿']),
        E('span', { class: 'punto', style: 'background:' + etapa.color }, []),
        etapa.nombre,
        E('span', { class: 'toc-col-num' }, [String(prog.toc.nodos.filter(function (n) { return n.etapa === etapa.id; }).length)]),
      ]);
      col.appendChild(cab);
      activarArrastreColumna(cab, col, etapa.id, lienzo, svg);
      var lista = E('div', { class: 'toc-lista' });
      prog.toc.nodos.filter(function (n) { return n.etapa === etapa.id; }).forEach(function (n) {
        lista.appendChild(tarjetaToC(n, etapa, idx, puede));
      });
      col.appendChild(lista);
      if (puede) {
        col.appendChild(E('button', {
          class: 'toc-agregar',
          onclick: function () {
            var nuevo = { id: Store.uid('n'), etapa: etapa.id, texto: '', supuesto: '', indicadores: [], mediosPorIndicador: {} };
            Store.tocMutar(function (toc) { toc.nodos.push(nuevo); });
            requestAnimationFrame(function () {
              var elNuevo = document.querySelector('[data-nodo="' + nuevo.id + '"] .toc-card-texto');
              if (elNuevo) elNuevo.focus();
            });
          },
        }, ['+ Agregar tarjeta']));
      }
      tablero.appendChild(col);
    });
    lienzo.appendChild(tablero);
    viewport.appendChild(lienzo);
    cont.appendChild(viewport);

    aplicarTransform(lienzo);
    activarPanZoom(viewport, lienzo);

    requestAnimationFrame(function () {
      if (!vistaToC.inicializado) { fitToContent(viewport, lienzo); vistaToC.inicializado = true; }
      dibujarConectores(lienzo, svg);
    });
    if (alRedimensionar) window.removeEventListener('resize', alRedimensionar);
    alRedimensionar = function () { if (document.contains(lienzo)) dibujarConectores(lienzo, svg); };
    window.addEventListener('resize', alRedimensionar);
  }

  /* Pan (arrastrar lienzo vacío) + zoom (rueda hacia el cursor) */
  function activarPanZoom(viewport, lienzo) {
    viewport.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      if (ev.target.closest('.toc-card') || ev.target.closest('button') || ev.target.closest('[contenteditable="true"]')) return;
      ev.preventDefault();
      var sx = ev.clientX, sy = ev.clientY;
      var p0 = { x: vistaToC.pan.x, y: vistaToC.pan.y };
      viewport.classList.add('arrastrando');
      function mover(e) {
        vistaToC.pan.x = p0.x + (e.clientX - sx);
        vistaToC.pan.y = p0.y + (e.clientY - sy);
        aplicarTransform(lienzo);
      }
      function soltar() {
        viewport.classList.remove('arrastrando');
        document.removeEventListener('mousemove', mover);
        document.removeEventListener('mouseup', soltar);
      }
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });

    viewport.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var vr = viewport.getBoundingClientRect();
      var cx = ev.clientX - vr.left, cy = ev.clientY - vr.top;
      var factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomHacia(lienzo, cx, cy, factor);
    }, { passive: false });
  }

  /* Arrastrar una columna en horizontal para espaciarla, sin cruzar a sus
     vecinas: se acota contra las columnas de al lado (separación mínima). */
  function activarArrastreColumna(handle, col, etapaId, lienzo, svg) {
    handle.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      ev.stopPropagation();   // que no paneé el lienzo
      ev.preventDefault();

      var cols = Array.prototype.slice.call(lienzo.querySelectorAll('.toc-col'));
      var idx = cols.indexOf(col);
      var prev = cols[idx - 1] || null;
      var next = cols[idx + 1] || null;
      var z = vistaToC.zoom || 1;
      var minGap = 24 * z;    // separación mínima (px de pantalla)

      var rCol = col.getBoundingClientRect();
      var rPrev = prev ? prev.getBoundingClientRect() : null;
      var rNext = next ? next.getBoundingClientRect() : null;
      var startOffset = vistaToC.colOffset[etapaId] || 0;
      var sx = ev.clientX;

      /* Límites en el espacio de offset (px del lienzo, sin escalar) */
      var minO = rPrev ? startOffset + (rPrev.right + minGap - rCol.left) / z : startOffset - 800;
      var maxO = rNext ? startOffset + (rNext.left - minGap - rCol.right) / z : startOffset + 800;

      handle.classList.add('arrastrando-col');
      var raf = null;
      function mover(e) {
        var o = startOffset + (e.clientX - sx) / z;
        o = Math.min(maxO, Math.max(minO, o));
        vistaToC.colOffset[etapaId] = o;
        col.style.transform = o ? 'translateX(' + o + 'px)' : '';
        /* coalescer el redibujo de conectores a un cuadro por frame */
        if (!raf) raf = requestAnimationFrame(function () { raf = null; dibujarConectores(lienzo, svg); });
      }
      function soltar() {
        handle.classList.remove('arrastrando-col');
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        dibujarConectores(lienzo, svg); // posición final exacta
        document.removeEventListener('mousemove', mover);
        document.removeEventListener('mouseup', soltar);
      }
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });
  }

  function zoomHacia(lienzo, cx, cy, factor) {
    var z0 = vistaToC.zoom;
    var z1 = Math.min(2.5, Math.max(0.3, z0 * factor));
    var contentX = (cx - vistaToC.pan.x) / z0;
    var contentY = (cy - vistaToC.pan.y) / z0;
    vistaToC.zoom = z1;
    vistaToC.pan.x = cx - contentX * z1;
    vistaToC.pan.y = cy - contentY * z1;
    aplicarTransform(lienzo);
    actualizarZoomLabel();
  }

  function zoomPaso(factor) {
    var viewport = document.getElementById('toc-viewport');
    var lienzo = document.getElementById('toc-lienzo');
    if (!viewport || !lienzo) return;
    zoomHacia(lienzo, viewport.clientWidth / 2, viewport.clientHeight / 2, factor);
  }

  function centrar() {
    var viewport = document.getElementById('toc-viewport');
    var lienzo = document.getElementById('toc-lienzo');
    if (viewport && lienzo) fitToContent(viewport, lienzo);
  }

  function tarjetaToC(n, etapa, idxEtapa, puede) {
    var st = Store.get();
    var enlazable = enlaceOrigen && esEtapaSiguiente(enlaceOrigen, n);
    var card = E('article', {
      class: 'toc-card' + (enlazable ? ' enlazable' : '') + (enlaceOrigen === n.id ? ' origen-enlace' : ''),
      dataset: { nodo: n.id },
      onclick: enlazable ? function () { crearEnlace(enlaceOrigen, n.id); } : null,
    });

    var texto = E('div', {
      class: 'toc-card-texto',
      contenteditable: puede && !enlaceOrigen ? 'true' : null,
      role: puede && !enlaceOrigen ? 'textbox' : null,
      'aria-multiline': puede && !enlaceOrigen ? 'true' : null,
      'aria-label': 'Texto de la tarjeta de ' + etapa.nombre,
      'data-placeholder': 'Escribe…',
    }, [n.texto || (puede ? '' : '—')]);
    if (!n.texto && puede) texto.textContent = '';
    texto.addEventListener('blur', function () {
      var v = texto.textContent.trim();
      if (v !== n.texto) Store.mutar(function (s) { Store.nodo(n.id).texto = v; });
    });
    texto.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); texto.blur(); }
    });
    card.appendChild(texto);

    /* Indicadores asignados: chips que abren la ficha de detalle */
    if ((n.indicadores || []).length) {
      var chips = E('div', { class: 'toc-card-inds' });
      n.indicadores.forEach(function (id) { chips.appendChild(chipIndicador(id)); });
      card.appendChild(chips);
    }

    if (n.supuesto || n._editandoSupuesto) {
      var sup = E('div', {
        class: 'toc-supuesto',
        contenteditable: puede ? 'true' : null,
        role: puede ? 'textbox' : null,
        'aria-multiline': puede ? 'true' : null,
        'aria-label': 'Supuesto de la tarjeta',
      }, [n.supuesto || '']);
      sup.addEventListener('blur', function () {
        var v = sup.textContent.trim();
        Store.mutar(function (s) { var x = Store.nodo(n.id); x.supuesto = v; delete x._editandoSupuesto; });
      });
      card.appendChild(sup);
      if (n._editandoSupuesto) requestAnimationFrame(function () { sup.focus(); });
    }

    if (puede) {
      var pie = E('div', { class: 'toc-card-pie' });
      if (!n.supuesto) {
        pie.appendChild(E('button', {
          class: 'toc-mini',
          onclick: function (ev) { ev.stopPropagation(); Store.mutar(function (s) { Store.nodo(n.id)._editandoSupuesto = true; }); },
        }, ['+ supuesto']));
      }
      pie.appendChild(E('button', {
        class: 'toc-mini',
        onclick: function (ev) { ev.stopPropagation(); abrirPickerIndicadores(n.id); },
      }, ['indicadores (' + (n.indicadores || []).length + ')']));
      pie.appendChild(E('button', {
        class: 'toc-mini',
        'aria-label': 'Eliminar tarjeta',
        onclick: function (ev) {
          ev.stopPropagation();
          var copia = JSON.parse(JSON.stringify(n));
          var enlacesCopia = Store.programa().toc.enlaces.filter(function (l) { return l.de === n.id || l.a === n.id; });
          Store.tocMutar(function (toc) {
            toc.nodos = toc.nodos.filter(function (x) { return x.id !== n.id; });
            toc.enlaces = toc.enlaces.filter(function (l) { return l.de !== n.id && l.a !== n.id; });
          });
          UI.toast('Tarjeta eliminada', 'Deshacer', function () {
            Store.tocMutar(function (toc) {
              toc.nodos.push(copia);
              enlacesCopia.forEach(function (l) { toc.enlaces.push(l); });
            });
          });
        },
      }, ['eliminar']));
      if (idxEtapa > 0) {
        pie.appendChild(E('button', {
          class: 'toc-mini', 'aria-label': 'Mover a la columna anterior',
          onclick: function (ev) { ev.stopPropagation(); moverDeEtapa(n.id, -1); },
        }, ['←']));
      }
      if (idxEtapa < ETAPAS.length - 1) {
        pie.appendChild(E('button', {
          class: 'toc-mini', 'aria-label': 'Mover a la columna siguiente',
          onclick: function (ev) { ev.stopPropagation(); moverDeEtapa(n.id, 1); },
        }, ['→']));
      }
      card.appendChild(pie);

      if (idxEtapa < ETAPAS.length - 1) {
        card.appendChild(E('button', {
          class: 'toc-conectar',
          'aria-label': 'Conectar esta tarjeta con la siguiente columna',
          title: 'Conectar →',
          onclick: function (ev) {
            ev.stopPropagation();
            enlaceOrigen = enlaceOrigen === n.id ? null : n.id;
            App.repintar();
          },
        }, ['→']));
      }
    }

    return card;
  }

  function esEtapaSiguiente(origenId, nodoDestino) {
    var origen = Store.nodo(origenId);
    if (!origen) return false;
    var iO = ETAPAS.findIndex(function (e) { return e.id === origen.etapa; });
    var iD = ETAPAS.findIndex(function (e) { return e.id === nodoDestino.etapa; });
    return iD === iO + 1;
  }

  function crearEnlace(de, a) {
    var existe = Store.programa().toc.enlaces.some(function (l) { return l.de === de && l.a === a; });
    enlaceOrigen = null;
    if (!existe) {
      Store.tocMutar(function (toc) { toc.enlaces.push({ de: de, a: a }); });
      UI.toast('Conexión creada');
    } else {
      App.repintar();
      UI.toast('Esas tarjetas ya están conectadas');
    }
  }

  function moverDeEtapa(nodoId, delta) {
    Store.tocMutar(function (toc) {
      var n = Store.nodo(nodoId);
      var i = ETAPAS.findIndex(function (e) { return e.id === n.etapa; });
      var j = Math.min(Math.max(i + delta, 0), ETAPAS.length - 1);
      if (i !== j) {
        n.etapa = ETAPAS[j].id;
        toc.enlaces = toc.enlaces.filter(function (l) {
          if (l.de !== nodoId && l.a !== nodoId) return true;
          var de = Store.nodo(l.de), a = Store.nodo(l.a);
          var iDe = ETAPAS.findIndex(function (e) { return e.id === de.etapa; });
          var iA = ETAPAS.findIndex(function (e) { return e.id === a.etapa; });
          return iA === iDe + 1;
        });
      }
    });
  }

  /* Conectores: béziers suaves, sin filtro de crayón. Coordenadas en el espacio
     local del lienzo (sin escalar) para que el zoom no las distorsione. */
  function dibujarConectores(lienzo, svg) {
    svg.innerHTML = '';
    var w = lienzo.scrollWidth, h = lienzo.scrollHeight;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    /* fill/stroke via style para resolver el token --kune (los atributos de
       presentación SVG no resuelven custom properties; el style sí) */
    defs.innerHTML = '<marker id="toc-flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--kune)"/></marker>';
    svg.appendChild(defs);

    var z = vistaToC.zoom || 1;
    var lr = lienzo.getBoundingClientRect();

    Store.programa().toc.enlaces.forEach(function (l) {
      var elDe = lienzo.querySelector('[data-nodo="' + l.de + '"]');
      var elA = lienzo.querySelector('[data-nodo="' + l.a + '"]');
      if (!elDe || !elA) return;
      var a = elDe.getBoundingClientRect(), b = elA.getBoundingClientRect();
      var x1 = (a.right - lr.left) / z;
      var y1 = (a.top + a.height / 2 - lr.top) / z;
      var x2 = (b.left - lr.left) / z;
      var y2 = (b.top + b.height / 2 - lr.top) / z;
      var dx = Math.max((x2 - x1) * 0.5, 40);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2);
      path.setAttribute('fill', 'none');
      path.style.stroke = 'var(--kune)';
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', '0.85');
      path.setAttribute('marker-end', 'url(#toc-flecha)');
      if (rw()) {
        path.setAttribute('class', 'conector-borrable');
        path.addEventListener('click', function () {
          var copia = { de: l.de, a: l.a };
          Store.tocMutar(function (toc) {
            toc.enlaces = toc.enlaces.filter(function (x) { return !(x.de === l.de && x.a === l.a); });
          });
          UI.toast('Conexión eliminada', 'Deshacer', function () {
            Store.tocMutar(function (toc) { toc.enlaces.push(copia); });
          });
        });
      }
      svg.appendChild(path);
    });
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && enlaceOrigen) { enlaceOrigen = null; App.repintar(); }
  });

  /* ============================ INDICADORES: chip + ficha de detalle ============================ */

  function chipIndicador(id) {
    var ind = Store.indicador(id);
    if (!ind) return E('span', { class: 'chip chip-ind' }, ['(indicador?)']);
    return E('button', {
      class: 'chip chip-ind' + (ind.editable ? ' chip-ind-edit' : ''),
      type: 'button',
      title: 'Ver ficha del indicador',
      onclick: function (ev) { ev.stopPropagation(); abrirDetalleIndicador(id); },
    }, [ind.nombre]);
  }

  function abrirDetalleIndicador(id) {
    detalleIndId = id;
    renderDetalleIndicador();
    document.getElementById('dialogo-indicador-detalle').showModal();
  }

  function renderDetalleIndicador() {
    var ind = Store.indicador(detalleIndId);
    var cont = document.getElementById('detalle-indicador');
    cont.innerHTML = '';
    if (!ind) return;
    var editable = !!ind.editable && rw();

    cont.appendChild(E('div', { class: 'dialogo-cabecera' }, [
      E('div', {}, [
        E('h2', { class: 'dialogo-titulo' }, ['Ficha del indicador']),
        E('span', { class: ind.editable ? 'badge-tipo badge-custom' : 'badge-tipo badge-externo' },
          [ind.editable ? 'Personalizado' : 'Externo · solo lectura']),
      ]),
      E('button', { class: 'btn-icono', 'aria-label': 'Cerrar', onclick: function () { document.getElementById('dialogo-indicador-detalle').close(); } }, ['✕']),
    ]));

    function grupo(etiqueta, control) {
      var lab = E('label', { class: 'etiqueta' }, [etiqueta]);
      var tag = control.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (!control.id) control.id = 'fd-' + (++_idCampo);
        lab.setAttribute('for', control.id);
      }
      return E('div', { class: 'detalle-campo' }, [lab, control]);
    }
    function guardar(campo, valor) { Store.actualizarIndicador(ind.id, definirCampo(campo, valor)); }

    /* Nombre */
    if (editable) {
      var inNombre = E('input', { class: 'campo', value: ind.nombre });
      inNombre.addEventListener('change', function () { guardar('nombre', inNombre.value.trim() || 'Sin nombre'); });
      cont.appendChild(grupo('Nombre del indicador', inNombre));
    } else {
      cont.appendChild(grupo('Nombre del indicador', E('p', { class: 'detalle-valor' }, [ind.nombre])));
    }

    /* Definición */
    if (editable) {
      var inDef = E('textarea', { class: 'campo-area' });
      inDef.value = ind.definicion || '';
      inDef.addEventListener('change', function () { guardar('definicion', inDef.value.trim()); });
      cont.appendChild(grupo('Definición del indicador', inDef));
    } else {
      cont.appendChild(grupo('Definición del indicador', E('p', { class: 'detalle-valor' }, [ind.definicion || '—'])));
    }

    /* Dimensión (dropdown) */
    if (editable) {
      var sel = E('select', { class: 'campo-select' });
      sel.appendChild(E('option', { value: '' }, ['(sin dimensión)']));
      Store.DIMENSIONES.forEach(function (d) {
        var op = E('option', { value: d }, [d]);
        if (ind.dimension === d) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function () { guardar('dimension', sel.value); });
      cont.appendChild(grupo('Dimensión', sel));
    } else {
      cont.appendChild(grupo('Dimensión', E('p', { class: 'detalle-valor' }, [ind.dimension || '—'])));
    }

    /* Método de cálculo */
    if (editable) {
      var inMet = E('textarea', { class: 'campo-area' });
      inMet.value = ind.metodoCalculo || '';
      inMet.addEventListener('change', function () { guardar('metodoCalculo', inMet.value.trim()); });
      cont.appendChild(grupo('Método de cálculo', inMet));
    } else {
      cont.appendChild(grupo('Método de cálculo', E('p', { class: 'detalle-valor' }, [ind.metodoCalculo || '—'])));
    }

    /* Unidad + Origen */
    if (editable) {
      var inUni = E('input', { class: 'campo', value: ind.unidad || '', placeholder: 'p. ej. %, árboles, personas' });
      inUni.addEventListener('change', function () { guardar('unidad', inUni.value.trim()); });
      var inOri = E('input', { class: 'campo', value: ind.origen || '', placeholder: 'p. ej. MIDE Jalisco, dependencia…' });
      inOri.addEventListener('change', function () { guardar('origen', inOri.value.trim()); });
      cont.appendChild(E('div', { class: 'detalle-fila-2' }, [grupo('Unidad de medida', inUni), grupo('Nombre del origen del indicador', inOri)]));
    } else {
      cont.appendChild(E('div', { class: 'detalle-fila-2' }, [
        grupo('Unidad de medida', E('p', { class: 'detalle-valor' }, [ind.unidad || '—'])),
        grupo('Nombre del origen del indicador', E('p', { class: 'detalle-valor' }, [ind.origen || ind.fuente || '—'])),
      ]));
    }

    if (!ind.editable) {
      cont.appendChild(E('p', { class: 'nota-fuente' }, ['Indicador de fuente externa: su ficha es de solo lectura. Crea un indicador personalizado para capturar tus propios datos.']));
    }
  }

  function definirCampo(k, v) { var o = {}; o[k] = v; return o; }

  /* ============================ INDICADORES (picker de asignación) ============================ */

  function abrirPickerIndicadores(nodoId) {
    nodoIndicadores = nodoId;
    pintarListaIndicadores('');
    document.getElementById('buscar-indicador').value = '';
    document.getElementById('dialogo-indicadores').showModal();
  }

  function pintarListaIndicadores(filtro) {
    var ul = document.getElementById('lista-indicadores');
    ul.innerHTML = '';
    var n = Store.nodo(nodoIndicadores);
    if (!n) return;
    Store.catalogo()
      .filter(function (i) { return i.nombre.toLowerCase().indexOf((filtro || '').toLowerCase()) !== -1; })
      .forEach(function (i) {
        var elegido = (n.indicadores || []).indexOf(i.id) !== -1;
        ul.appendChild(E('li', {}, [
          E('div', { class: 'ind-info' }, [
            E('button', { class: 'ind-nombre-btn', type: 'button', title: 'Ver ficha', onclick: function () { abrirDetalleIndicador(i.id); } }, [i.nombre]),
            E('span', { class: 'ind-meta' }, [(i.unidad ? i.unidad + ' · ' : '') + (i.editable ? 'Personalizado' : (i.origen || i.fuente || '').replace(' (muestra)', ''))]),
          ]),
          E('button', {
            class: 'btn ' + (elegido ? '' : 'btn-quieto'),
            type: 'button',
            onclick: function () {
              Store.mutar(function (s) {
                var x = Store.nodo(nodoIndicadores);
                if (!x.mediosPorIndicador) x.mediosPorIndicador = {};
                var pos = x.indicadores.indexOf(i.id);
                if (pos === -1) { x.indicadores.push(i.id); }
                else { x.indicadores.splice(pos, 1); delete x.mediosPorIndicador[i.id]; }
              });
              pintarListaIndicadores(document.getElementById('buscar-indicador').value);
            },
          }, [elegido ? 'Quitar' : 'Agregar']),
        ]));
      });
  }

  function crearIndicadorDesdePicker() {
    if (!nodoIndicadores) return;
    var id = Store.crearIndicador({});
    Store.mutar(function (s) {
      var x = Store.nodo(nodoIndicadores);
      if (x.indicadores.indexOf(id) === -1) x.indicadores.push(id);
      if (!x.mediosPorIndicador) x.mediosPorIndicador = {};
    });
    pintarListaIndicadores(document.getElementById('buscar-indicador').value);
    abrirDetalleIndicador(id);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var buscar = document.getElementById('buscar-indicador');
    if (buscar) buscar.addEventListener('input', function (ev) { pintarListaIndicadores(ev.target.value); });
    var crear = document.getElementById('crear-indicador');
    if (crear) crear.addEventListener('click', crearIndicadorDesdePicker);
    var dlgDet = document.getElementById('dialogo-indicador-detalle');
    if (dlgDet) dlgDet.addEventListener('close', function () { detalleIndId = null; App.repintar(); });
  });

  /* ============================ MIR ============================ */

  /* Numeración: Componentes 1,2,3…; Actividades C.A según el componente que enlazan.
     Fin/Propósito quedan en blanco; actividades sin componente van al final. */
  function numerarMIR() {
    var toc = Store.programa().toc;
    var num = {};
    var comps = toc.nodos.filter(function (n) { return n.etapa === 'productos'; });
    var compNum = {};
    comps.forEach(function (c, i) { compNum[c.id] = i + 1; num[c.id] = String(i + 1); });
    var sub = {};
    var orphanBase = comps.length + 1, orphan = 0;
    toc.nodos.filter(function (n) { return n.etapa === 'actividades'; }).forEach(function (a) {
      var link = toc.enlaces.find(function (l) { return l.de === a.id && compNum[l.a]; });
      if (link) {
        var cn = compNum[link.a];
        sub[cn] = (sub[cn] || 0) + 1;
        num[a.id] = cn + '.' + sub[cn];
      } else {
        orphan += 1;
        num[a.id] = orphanBase + '.' + orphan;
      }
    });
    return num;
  }

  function cmpNum(x, y) {
    function partes(s) { return (s || '').split('.').map(Number); }
    var px = partes(x), py = partes(y);
    return (px[0] - py[0]) || ((px[1] || 0) - (py[1] || 0));
  }

  function renderMIR(cont) {
    var st = Store.get();
    var puede = rw();
    var num = numerarMIR();

    cont.appendChild(E('div', { class: 'vista-cabecera' }, [
      E('p', { class: 'vista-sub' }, ['Generada desde la Teoría de Cambio · Formato Jalisco v1 (aproximación — se ajustará a la plantilla oficial).']),
      E('div', { class: 'mir-acciones' }, [
        E('button', { class: 'btn', onclick: exportarCSV }, ['Exportar']),
      ]),
    ]));

    var progMIR = Store.programa();
    var tabla = E('table', { class: 'mir-tabla' });
    tabla.appendChild(E('caption', {}, ['MIR — ' + progMIR.nombre + ' · ' + progMIR.dependencia]));
    tabla.appendChild(E('thead', {}, [
      E('tr', {}, ['Nivel', '#', 'Resumen narrativo', 'Indicadores', 'Métodos de cálculo', 'Medios de verificación', 'Supuestos']
        .map(function (h) { return E('th', { scope: 'col' }, [h]); })),
    ]));

    var cuerpo = E('tbody');
    NIVELES_MIR.forEach(function (nivel) {
      var nodos = progMIR.toc.nodos.filter(function (n) { return n.etapa === nivel.etapa; });
      if (nivel.etapa === 'productos' || nivel.etapa === 'actividades') {
        nodos = nodos.slice().sort(function (a, b) { return cmpNum(num[a.id], num[b.id]); });
      }

      if (!nodos.length) {
        cuerpo.appendChild(E('tr', {}, [
          E('td', { class: 'mir-nivel' }, [E('span', { class: 'punto', style: 'background:' + nivel.color }, []), nivel.nivel]),
          E('td', { colspan: '6' }, [E('span', { class: 'conteo-suave' }, ['Sin tarjetas de ' + nivel.etapa + ' en la Teoría de Cambio todavía.'])]),
        ]));
        return;
      }

      var totalRows = nodos.reduce(function (acc, n) { return acc + Math.max(1, (n.indicadores || []).length); }, 0);
      var nivelPuesto = false;

      nodos.forEach(function (n) {
        var inds = (n.indicadores || []).length ? n.indicadores : [null];
        inds.forEach(function (indId, k) {
          var fila = E('tr');

          if (!nivelPuesto) {
            fila.appendChild(E('td', { class: 'mir-nivel', rowspan: String(totalRows) },
              [E('span', { class: 'punto', style: 'background:' + nivel.color }, []), nivel.nivel]));
            nivelPuesto = true;
          }

          if (k === 0) {
            fila.appendChild(E('td', { class: 'mir-num', rowspan: String(inds.length) }, [num[n.id] || '']));
            var celdaRes = E('td', { rowspan: String(inds.length) }, [E('div', { class: 'mir-resumen-texto' }, [n.texto || '—'])]);
            if (puede) {
              celdaRes.appendChild(E('button', {
                class: 'chip chip-agregar', type: 'button',
                onclick: function () { abrirPickerIndicadores(n.id); },
              }, ['+ indicador']));
            }
            fila.appendChild(celdaRes);
          }

          var ind = indId ? Store.indicador(indId) : null;
          fila.appendChild(E('td', {}, [indId ? chipIndicador(indId) : E('span', { class: 'conteo-suave' }, ['—'])]));
          fila.appendChild(E('td', { class: 'mir-metodo' }, [ind ? (ind.metodoCalculo || '—') : '']));
          fila.appendChild(celdaMedios(n, indId, puede));

          if (k === 0) {
            fila.appendChild(E('td', { rowspan: String(inds.length) }, [n.supuesto || '—']));
          }

          cuerpo.appendChild(fila);
        });
      });
    });
    tabla.appendChild(cuerpo);
    cont.appendChild(E('div', { class: 'contenido mir-tabla-marco' }, [tabla]));
  }

  function celdaMedios(node, indId, puede) {
    var val = (node.mediosPorIndicador && node.mediosPorIndicador[indId]) || '';
    var ind = indId ? Store.indicador(indId) : null;
    var td = E('td', {
      class: 'mir-medios',
      contenteditable: (puede && indId) ? 'true' : null,
      role: (puede && indId) ? 'textbox' : null,
      'aria-label': ind ? 'Medios de verificación de ' + ind.nombre : null,
    }, [val]);
    if (puede && indId) {
      td.addEventListener('blur', function () {
        var v = td.textContent.trim();
        Store.mutar(function (s) {
          var x = Store.nodo(node.id);
          if (!x.mediosPorIndicador) x.mediosPorIndicador = {};
          x.mediosPorIndicador[indId] = v;
        });
      });
    }
    return td;
  }

  function exportarCSV() {
    var progCSV = Store.programa();
    var num = numerarMIR();
    var filas = [['Nivel', '#', 'Resumen narrativo', 'Indicador', 'Método de cálculo', 'Medios de verificación', 'Supuesto']];
    NIVELES_MIR.forEach(function (nivel) {
      var nodos = progCSV.toc.nodos.filter(function (n) { return n.etapa === nivel.etapa; });
      if (nivel.etapa === 'productos' || nivel.etapa === 'actividades') {
        nodos = nodos.slice().sort(function (a, b) { return cmpNum(num[a.id], num[b.id]); });
      }
      nodos.forEach(function (n) {
        var inds = (n.indicadores || []).length ? n.indicadores : [null];
        inds.forEach(function (indId) {
          var ind = indId ? Store.indicador(indId) : null;
          filas.push([
            nivel.nivel,
            num[n.id] || '',
            n.texto || '',
            ind ? ind.nombre : '',
            ind ? (ind.metodoCalculo || '') : '',
            (indId && n.mediosPorIndicador && n.mediosPorIndicador[indId]) || '',
            n.supuesto || '',
          ]);
        });
      });
    });
    var csv = filas.map(function (f) {
      return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'MIR-' + progCSV.nombre.replace(/[^\wáéíóúñ-]+/gi, '-') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast('MIR exportada como CSV');
  }

  /* ============================ EXPORTAR ToC A PDF (impresión) ============================ */

  function exportarPDF() {
    var lienzo = document.getElementById('toc-lienzo');
    var svg = lienzo && lienzo.querySelector('.toc-conectores');
    if (!lienzo) return;
    var prev = { pan: { x: vistaToC.pan.x, y: vistaToC.pan.y }, zoom: vistaToC.zoom };

    document.body.classList.add('imprimiendo-toc');
    vistaToC.pan = { x: 0, y: 0 };
    vistaToC.zoom = 1;
    aplicarTransform(lienzo);
    dibujarConectores(lienzo, svg);

    function restaurar() {
      document.body.classList.remove('imprimiendo-toc');
      vistaToC.pan = prev.pan;
      vistaToC.zoom = prev.zoom;
      aplicarTransform(lienzo);
      dibujarConectores(lienzo, svg);
      window.removeEventListener('afterprint', restaurar);
    }
    window.addEventListener('afterprint', restaurar);
    setTimeout(function () { window.print(); }, 80);
  }

  return { render: render, ETAPAS: ETAPAS, abrirDetalleIndicador: abrirDetalleIndicador };
})();
