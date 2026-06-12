/* =========================================================================
   disena.js — Módulo DISEÑA (Lucía)
   Programa · Teoría de Cambio (constructor con conectores) · MIR
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
  var alRedimensionar = null; // handler vivo de resize para los conectores

  function rw() { return Store.permiso('disena') === 'rw'; }

  /* ============================ RENDER RAÍZ ============================ */

  function render(cont) {
    var st = Store.get();
    var sub = st.subvistaDisena || 'toc';

    cont.appendChild(E('div', { class: 'vista-cabecera' }, [
      E('div', {}, [
        E('h1', { class: 'vista-titulo' }, ['Diseña']),
        E('p', { class: 'vista-sub' }, ['Estructura el programa: de la Teoría de Cambio a la MIR, sin capturar dos veces.']),
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
    var p = Store.get().programa;
    var puede = rw();

    function campo(nombre, etiqueta, tipo, valor, ancho) {
      var input = tipo === 'area'
        ? E('textarea', { class: 'campo-area', id: 'prog-' + nombre, disabled: !puede }, [])
        : E('input', { class: 'campo', id: 'prog-' + nombre, type: tipo, disabled: !puede });
      input.value = valor || '';
      input.addEventListener('change', function () {
        Store.mutar(function (s) { s.programa[nombre] = input.value; });
        UI.toast('Programa actualizado');
      });
      return E('div', { class: ancho ? '' : null }, [
        E('label', { class: 'etiqueta', for: 'prog-' + nombre }, [etiqueta]),
        input,
      ]);
    }

    cont.appendChild(E('div', { class: 'contenido' }, [
      E('div', { class: 'form-programa' }, [
        campo('nombre', 'Nombre del programa', 'text', p.nombre),
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

  /* ============================ TEORÍA DE CAMBIO ============================ */

  function renderToC(cont) {
    var st = Store.get();
    var puede = rw();

    var barra = E('div', { class: 'toc-barra' });
    if (enlaceOrigen) {
      barra.appendChild(E('span', { class: 'toc-aviso-conexion' },
        ['Conectando — elige una tarjeta de la siguiente columna · Esc para cancelar']));
    } else {
      barra.appendChild(E('span', { class: 'conteo-suave' },
        [st.toc.nodos.length + ' tarjetas · ' + st.toc.enlaces.length + ' conexiones · clic en una conexión para eliminarla']));
    }
    cont.appendChild(barra);

    var tablero = E('div', { class: 'toc-tablero', id: 'toc-tablero' });

    /* Capa SVG de conectores (se dibuja después del layout) */
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'toc-conectores');
    svg.setAttribute('aria-hidden', 'true');
    tablero.appendChild(svg);

    ETAPAS.forEach(function (etapa, idx) {
      var col = E('div', { class: 'toc-col', dataset: { etapa: etapa.id } });
      col.style.setProperty('--col-color', etapa.color);

      col.appendChild(E('div', { class: 'toc-col-cabecera' }, [
        E('span', { class: 'punto', style: 'background:' + etapa.color }, []),
        etapa.nombre,
        E('span', { class: 'toc-col-num' }, [String(st.toc.nodos.filter(function (n) { return n.etapa === etapa.id; }).length)]),
      ]));

      var lista = E('div', { class: 'toc-lista' });
      st.toc.nodos.filter(function (n) { return n.etapa === etapa.id; }).forEach(function (n) {
        lista.appendChild(tarjetaToC(n, etapa, idx, puede));
      });
      col.appendChild(lista);

      if (puede) {
        col.appendChild(E('button', {
          class: 'toc-agregar',
          onclick: function () {
            var nuevo = { id: Store.uid('n'), etapa: etapa.id, texto: '', supuesto: '', medios: '', indicadores: [] };
            Store.mutar(function (s) { s.toc.nodos.push(nuevo); });
            /* foco al texto de la nueva tarjeta */
            requestAnimationFrame(function () {
              var elNuevo = document.querySelector('[data-nodo="' + nuevo.id + '"] .toc-card-texto');
              if (elNuevo) elNuevo.focus();
            });
          },
        }, ['+ Agregar tarjeta']));
      }

      tablero.appendChild(col);
    });

    cont.appendChild(tablero);

    /* Dibujar conectores cuando el layout ya existe; redibujar en cada resize */
    requestAnimationFrame(function () { dibujarConectores(tablero, svg); });
    if (alRedimensionar) window.removeEventListener('resize', alRedimensionar);
    alRedimensionar = function () {
      if (document.contains(tablero)) dibujarConectores(tablero, svg);
    };
    window.addEventListener('resize', alRedimensionar);
  }

  function tarjetaToC(n, etapa, idxEtapa, puede) {
    var st = Store.get();
    var enlazable = enlaceOrigen && esEtapaSiguiente(enlaceOrigen, n);
    var card = E('article', {
      class: 'toc-card' + (enlazable ? ' enlazable' : '') + (enlaceOrigen === n.id ? ' origen-enlace' : ''),
      dataset: { nodo: n.id },
      onclick: enlazable ? function () { crearEnlace(enlaceOrigen, n.id); } : null,
    });

    /* Texto editable en sitio */
    var texto = E('div', {
      class: 'toc-card-texto',
      contenteditable: puede && !enlaceOrigen ? 'true' : null,
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

    /* Supuesto (visible si existe o si se acaba de activar) */
    if (n.supuesto || n._editandoSupuesto) {
      var sup = E('div', { class: 'toc-supuesto', contenteditable: puede ? 'true' : null }, [n.supuesto || '']);
      sup.addEventListener('blur', function () {
        var v = sup.textContent.trim();
        Store.mutar(function (s) { var x = Store.nodo(n.id); x.supuesto = v; delete x._editandoSupuesto; });
      });
      card.appendChild(sup);
      if (n._editandoSupuesto) requestAnimationFrame(function () { sup.focus(); });
    }

    /* Pie: acciones pequeñas */
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
        onclick: function (ev) {
          ev.stopPropagation();
          abrirPickerIndicadores(n.id);
        },
      }, ['indicadores (' + (n.indicadores || []).length + ')']));
      pie.appendChild(E('button', {
        class: 'toc-mini',
        'aria-label': 'Eliminar tarjeta',
        onclick: function (ev) {
          ev.stopPropagation();
          var copia = JSON.parse(JSON.stringify(n));
          var enlacesCopia = st.toc.enlaces.filter(function (l) { return l.de === n.id || l.a === n.id; });
          Store.mutar(function (s) {
            s.toc.nodos = s.toc.nodos.filter(function (x) { return x.id !== n.id; });
            s.toc.enlaces = s.toc.enlaces.filter(function (l) { return l.de !== n.id && l.a !== n.id; });
          });
          UI.toast('Tarjeta eliminada', 'Deshacer', function () {
            Store.mutar(function (s) {
              s.toc.nodos.push(copia);
              enlacesCopia.forEach(function (l) { s.toc.enlaces.push(l); });
            });
          });
        },
      }, ['eliminar']));
      if (idxEtapa > 0) {
        pie.appendChild(E('button', {
          class: 'toc-mini',
          'aria-label': 'Mover a la columna anterior',
          onclick: function (ev) { ev.stopPropagation(); moverDeEtapa(n.id, -1); },
        }, ['←']));
      }
      if (idxEtapa < ETAPAS.length - 1) {
        pie.appendChild(E('button', {
          class: 'toc-mini',
          'aria-label': 'Mover a la columna siguiente',
          onclick: function (ev) { ev.stopPropagation(); moverDeEtapa(n.id, 1); },
        }, ['→']));
      }
      card.appendChild(pie);

      /* Asa de conexión (solo si hay etapa siguiente) */
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
    var existe = Store.get().toc.enlaces.some(function (l) { return l.de === de && l.a === a; });
    enlaceOrigen = null;
    if (!existe) {
      Store.mutar(function (s) { s.toc.enlaces.push({ de: de, a: a }); });
      UI.toast('Conexión creada');
    } else {
      App.repintar();
      UI.toast('Esas tarjetas ya están conectadas');
    }
  }

  function moverDeEtapa(nodoId, delta) {
    Store.mutar(function (s) {
      var n = Store.nodo(nodoId);
      var i = ETAPAS.findIndex(function (e) { return e.id === n.etapa; });
      var j = Math.min(Math.max(i + delta, 0), ETAPAS.length - 1);
      if (i !== j) {
        n.etapa = ETAPAS[j].id;
        /* los enlaces que ya no son entre columnas adyacentes se retiran */
        s.toc.enlaces = s.toc.enlaces.filter(function (l) {
          if (l.de !== nodoId && l.a !== nodoId) return true;
          var de = Store.nodo(l.de), a = Store.nodo(l.a);
          var iDe = ETAPAS.findIndex(function (e) { return e.id === de.etapa; });
          var iA = ETAPAS.findIndex(function (e) { return e.id === a.etapa; });
          return iA === iDe + 1;
        });
      }
    });
  }

  function dibujarConectores(tablero, svg) {
    var st = Store.get();
    svg.innerHTML = '';
    svg.setAttribute('width', tablero.scrollWidth);
    svg.setAttribute('height', tablero.scrollHeight);
    var marco = tablero.getBoundingClientRect();

    st.toc.enlaces.forEach(function (l) {
      var elDe = tablero.querySelector('[data-nodo="' + l.de + '"]');
      var elA = tablero.querySelector('[data-nodo="' + l.a + '"]');
      if (!elDe || !elA) return;
      var rDe = elDe.getBoundingClientRect();
      var rA = elA.getBoundingClientRect();
      var x1 = rDe.right - marco.left + tablero.scrollLeft;
      var y1 = rDe.top + rDe.height / 2 - marco.top + tablero.scrollTop;
      var x2 = rA.left - marco.left + tablero.scrollLeft;
      var y2 = rA.top + rA.height / 2 - marco.top + tablero.scrollTop;
      var dx = Math.max((x2 - x1) / 2, 24);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#2B3FD6');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', '0.75');
      path.setAttribute('filter', 'url(#crayon-rough)');
      if (rw()) {
        path.addEventListener('click', function () {
          var copia = { de: l.de, a: l.a };
          Store.mutar(function (s) {
            s.toc.enlaces = s.toc.enlaces.filter(function (x) { return !(x.de === l.de && x.a === l.a); });
          });
          UI.toast('Conexión eliminada', 'Deshacer', function () {
            Store.mutar(function (s) { s.toc.enlaces.push(copia); });
          });
        });
      }
      svg.appendChild(path);
    });
  }

  /* Escape cancela el modo conexión */
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && enlaceOrigen) {
      enlaceOrigen = null;
      App.repintar();
    }
  });

  /* ============================ INDICADORES (picker) ============================ */

  function abrirPickerIndicadores(nodoId) {
    nodoIndicadores = nodoId;
    var dlg = document.getElementById('dialogo-indicadores');
    pintarListaIndicadores('');
    document.getElementById('buscar-indicador').value = '';
    dlg.showModal();
  }

  function pintarListaIndicadores(filtro) {
    var ul = document.getElementById('lista-indicadores');
    ul.innerHTML = '';
    var n = Store.nodo(nodoIndicadores);
    if (!n) return;
    Store.CATALOGO
      .filter(function (i) { return i.nombre.toLowerCase().indexOf(filtro.toLowerCase()) !== -1; })
      .forEach(function (i) {
        var elegido = (n.indicadores || []).indexOf(i.id) !== -1;
        var li = E('li', {}, [
          E('span', { class: 'ind-nombre' }, [i.nombre]),
          E('span', { class: 'ind-meta' }, [i.unidad + ' · ' + i.fuente.replace(' (muestra)', '')]),
          E('button', {
            class: 'btn ' + (elegido ? '' : 'btn-quieto'),
            type: 'button',
            onclick: function () {
              Store.mutar(function (s) {
                var x = Store.nodo(nodoIndicadores);
                var pos = x.indicadores.indexOf(i.id);
                if (pos === -1) x.indicadores.push(i.id); else x.indicadores.splice(pos, 1);
              });
              pintarListaIndicadores(document.getElementById('buscar-indicador').value);
            },
          }, [elegido ? 'Quitar' : 'Agregar']),
        ]);
        ul.appendChild(li);
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('buscar-indicador').addEventListener('input', function (ev) {
      pintarListaIndicadores(ev.target.value);
    });
  });

  /* ============================ MIR ============================ */

  function renderMIR(cont) {
    var st = Store.get();
    var puede = rw();

    var cabecera = E('div', { class: 'vista-cabecera' }, [
      E('p', { class: 'vista-sub' }, [
        'Generada desde la Teoría de Cambio · Formato Jalisco v1 (aproximación — se ajustará a la plantilla oficial).',
      ]),
      E('div', { class: 'mir-acciones' }, [
        E('button', { class: 'btn', onclick: exportarCSV }, ['Exportar CSV']),
        E('button', { class: 'btn', onclick: function () { window.print(); } }, ['Imprimir']),
      ]),
    ]);
    cont.appendChild(cabecera);

    var tabla = E('table', { class: 'mir-tabla' });
    tabla.appendChild(E('caption', {}, [
      'MIR — ' + st.programa.nombre + ' · ' + st.programa.dependencia,
    ]));
    tabla.appendChild(E('thead', {}, [
      E('tr', {}, ['Nivel', 'Resumen narrativo', 'Indicadores', 'Medios de verificación', 'Supuestos']
        .map(function (h) { return E('th', { scope: 'col' }, [h]); })),
    ]));

    var cuerpo = E('tbody');
    NIVELES_MIR.forEach(function (nivel) {
      var nodos = st.toc.nodos.filter(function (n) { return n.etapa === nivel.etapa; });
      if (!nodos.length) {
        cuerpo.appendChild(E('tr', {}, [
          E('td', { class: 'mir-nivel' }, [E('span', { class: 'punto', style: 'background:' + nivel.color }, []), nivel.nivel]),
          E('td', { colspan: '4' }, [
            E('span', { class: 'conteo-suave' }, ['Sin tarjetas de ' + nivel.etapa + ' en la Teoría de Cambio todavía.']),
          ]),
        ]));
        return;
      }
      nodos.forEach(function (n, i) {
        var fila = E('tr');
        if (i === 0) {
          var celdaNivel = E('td', { class: 'mir-nivel', rowspan: String(nodos.length) }, [
            E('span', { class: 'punto', style: 'background:' + nivel.color }, []), nivel.nivel,
          ]);
          fila.appendChild(celdaNivel);
        }
        fila.appendChild(E('td', {}, [n.texto || '—']));

        var celdaInd = E('td');
        var grupo = E('div', { class: 'mir-indicadores' });
        (n.indicadores || []).forEach(function (id) {
          var ind = Store.indicador(id);
          if (ind) grupo.appendChild(E('span', { class: 'chip chip-ind', title: ind.fuente }, [ind.nombre]));
        });
        if (puede) {
          grupo.appendChild(E('button', {
            class: 'chip chip-agregar',
            type: 'button',
            onclick: function () { abrirPickerIndicadores(n.id); },
          }, ['+ indicador']));
        }
        celdaInd.appendChild(grupo);
        fila.appendChild(celdaInd);

        var medios = E('td', { class: 'mir-medios', contenteditable: puede ? 'true' : null }, [n.medios || '']);
        medios.addEventListener('blur', function () {
          var v = medios.textContent.trim();
          if (v !== n.medios) Store.mutar(function (s) { Store.nodo(n.id).medios = v; });
        });
        fila.appendChild(medios);

        fila.appendChild(E('td', {}, [n.supuesto || '—']));
        cuerpo.appendChild(fila);
      });
    });
    tabla.appendChild(cuerpo);

    cont.appendChild(E('div', { class: 'contenido mir-tabla-marco' }, [tabla]));
  }

  function exportarCSV(ev) {
    var st = Store.get();
    var filas = [['Nivel', 'Resumen narrativo', 'Indicadores', 'Medios de verificación', 'Supuestos']];
    NIVELES_MIR.forEach(function (nivel) {
      st.toc.nodos.filter(function (n) { return n.etapa === nivel.etapa; }).forEach(function (n) {
        filas.push([
          nivel.nivel,
          n.texto || '',
          (n.indicadores || []).map(function (id) { var i = Store.indicador(id); return i ? i.nombre : ''; }).join(' | '),
          n.medios || '',
          n.supuesto || '',
        ]);
      });
    });
    var csv = filas.map(function (f) {
      return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'MIR-' + st.programa.nombre.replace(/[^\wáéíóúñ-]+/gi, '-') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast('MIR exportada como CSV');
  }

  return { render: render, ETAPAS: ETAPAS };
})();
