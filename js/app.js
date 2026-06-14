/* =========================================================================
   app.js — arranque, navegación entre módulos, RBAC y sidebar
   ========================================================================= */

var App = (function () {
  var E = UI.el;

  var MODULOS = {
    disena:  { nombre: 'Diseña',   render: function (c) { Disena.render(c); } },
    agiliza: { nombre: 'Agiliza',  render: function (c) { Agiliza.render(c); } },
    ejecuta: { nombre: 'Ejecuta',  render: function (c) { Ejecuta.render(c); } },
    audita:  { nombre: 'Audita',   render: renderBloqueado('Audita', '🔏', 'La verificación de evidencia y la bitácora inmutable de Gómez requieren el backend auditable.', 'En el roadmap — después del MVP front-end.') },
    tablero: { nombre: 'Tablero',  render: renderBloqueado('Tablero directivo', '📊', 'La visibilidad en tiempo real para Reyes se construye sobre los datos que ya captura este MVP.', 'En el roadmap — después del MVP front-end.') },
  };

  /* Sidebar module-level state (not in store — ephemeral UI state) */
  var progExpanded = {};         // { progId: boolean } — accordion open state
  var sidebarVistaActual = null; // 'para-ti' | 'favoritos' | 'organizacion' | null

  var resetArmado = false;
  var resetTimer  = null;

  function renderBloqueado(titulo, icono, texto, nota) {
    return function (cont) {
      cont.appendChild(E('div', { class: 'bloqueado' }, [
        E('div', { class: 'bloqueado-caja' }, [
          E('span', { class: 'bloqueado-icono', 'aria-hidden': 'true' }, [icono]),
          E('h2', {}, [titulo]),
          E('p', {}, [texto]),
          E('p', {}, [E('span', { class: 'chip' }, [nota])]),
        ]),
      ]));
    };
  }

  /* ============================ NAVEGACIÓN ============================ */

  function irA(vista) {
    Store.mutar(function (s) { s.vistaActual = vista; });
  }

  function cambiarRol(rolId) {
    Agiliza.cerrarPanel();
    Store.mutar(function (s) {
      s.rolActual = rolId;
      s.vistaActual = Store.VISTA_INICIO[rolId] || 'disena';
    });
    var p = Store.persona(rolId);
    UI.toast('Ahora navegas como ' + p.nombre + ' (' + p.cargo + ')');
  }

  /* ============================ TOPBAR ============================ */

  function pintarTopbar() {
    var st = Store.get();
    var rol = Store.persona(st.rolActual);

    document.getElementById('topbar-programa').textContent = Store.programa().nombre;

    /* Tabs de módulos con candado según permisos */
    document.querySelectorAll('.modulo-tab').forEach(function (tab) {
      var vista = tab.dataset.vista;
      var p = (Store.PERMISOS[st.rolActual] || {})[vista];
      tab.disabled = !p;
      tab.setAttribute('aria-current', st.vistaActual === vista ? 'true' : 'false');
      tab.onclick = function () { if (p) irA(vista); };
      tab.title = p ? '' : 'Sin acceso para ' + rol.nombre;
    });

    /* Rol actual */
    var av = document.getElementById('rol-avatar');
    av.textContent = rol.iniciales;
    av.style.background = rol.color + '33';
    document.getElementById('rol-nombre').textContent = rol.nombre;
    document.getElementById('rol-cargo').textContent  = rol.cargo;

    /* Menú de roles */
    var menu = document.getElementById('menu-roles');
    menu.innerHTML = '';
    Store.PERSONAS.forEach(function (p) {
      menu.appendChild(E('button', {
        class: 'menu-rol',
        role: 'menuitem',
        'aria-current': p.id === st.rolActual ? 'true' : null,
        onclick: function () {
          menu.hidePopover && menu.hidePopover();
          cambiarRol(p.id);
        },
      }, [
        UI.avatar(p.id),
        E('span', { class: 'rol-textos' }, [
          E('span', { class: 'rol-nombre' }, [p.nombre]),
          E('span', { class: 'rol-cargo' }, [p.cargo]),
        ]),
      ]));
    });

    /* Restablecer demo en dos pasos */
    var nombreReset = E('span', { class: 'rol-nombre' }, [resetArmado ? '¿Seguro? Toca otra vez' : 'Restablecer demo']);
    menu.appendChild(E('button', {
      class: 'menu-rol',
      role: 'menuitem',
      onclick: function () {
        if (!resetArmado) {
          resetArmado = true;
          nombreReset.textContent = '¿Seguro? Toca otra vez';
          nombreReset.style.color = 'var(--crayon-rojo-tinta)';
          clearTimeout(resetTimer);
          resetTimer = setTimeout(function () { resetArmado = false; pintarTopbar(); }, 3000);
          return;
        }
        resetArmado = false;
        clearTimeout(resetTimer);
        progExpanded = {};
        sidebarVistaActual = null;
        menu.hidePopover && menu.hidePopover();
        Store.reiniciar();
        UI.toast('Demo restablecida a la semilla de ejemplo');
      },
    }, [
      E('span', { class: 'avatar' }, ['↺']),
      E('span', { class: 'rol-textos' }, [
        nombreReset,
        E('span', { class: 'rol-cargo' }, ['se pierden los cambios locales']),
      ]),
    ]));
  }

  /* ============================ SIDEBAR ============================ */

  function pintarSidebar() {
    var st = Store.get();
    var abierto = st.sidebar.abierto;

    /* Sync body classes */
    document.body.classList.toggle('sidebar-abierta',   abierto);
    document.body.classList.toggle('sidebar-colapsada', !abierto);

    /* Backdrop (mobile) */
    var fondo = document.getElementById('sidebar-fondo');
    if (fondo) {
      fondo.hidden = !abierto;
      fondo.onclick = function () { Store.toggleSidebar(); };
    }

    /* Toggle buttons + wordmark visibility */
    var btnAbrir  = document.getElementById('btn-abrir-sidebar');
    var wordmark  = document.getElementById('topbar-wordmark');
    var esMovil   = window.innerWidth <= 720;

    if (btnAbrir)  btnAbrir.hidden  = abierto && !esMovil;
    if (wordmark)  wordmark.hidden  = abierto && !esMovil;

    var btnCerrar = document.getElementById('btn-cerrar-sidebar');
    if (btnCerrar) btnCerrar.onclick = function () { Store.toggleSidebar(); };
    if (btnAbrir)  btnAbrir.onclick  = function () { Store.toggleSidebar(); };

    /* Quick-nav: Para ti / Favoritos toggle dropdowns */
    document.querySelectorAll('.sidebar-item-toggle').forEach(function (btn) {
      var v = btn.dataset.sidebarVista;
      var abierta = sidebarVistaActual === v;
      btn.setAttribute('aria-expanded', abierta ? 'true' : 'false');
      btn.onclick = function () {
        sidebarVistaActual = abierta ? null : v;
        pintarSidebar();
      };
    });

    /* Para ti inline content */
    var contParaTi = document.getElementById('sidebar-parati-cont');
    if (contParaTi) {
      var abiertaParaTi = sidebarVistaActual === 'para-ti';
      contParaTi.hidden = !abiertaParaTi;
      if (abiertaParaTi) { contParaTi.innerHTML = ''; renderSidebarParaTi(contParaTi); }
    }

    /* Favoritos inline content */
    var contFavoritos = document.getElementById('sidebar-favoritos-cont');
    if (contFavoritos) {
      var abiertaFavoritos = sidebarVistaActual === 'favoritos';
      contFavoritos.hidden = !abiertaFavoritos;
      if (abiertaFavoritos) { contFavoritos.innerHTML = ''; renderSidebarFavoritos(contFavoritos); }
    }

    /* Clean up any lingering panel from previous implementation */
    var prev = document.getElementById('sidebar-vista');
    if (prev) prev.remove();

    pintarSidebarProgramas();
  }

  /* ---------- Program accordion ---------- */

  function pintarSidebarProgramas() {
    var st   = Store.get();
    var cont = document.getElementById('sidebar-programas');
    if (!cont) return;
    cont.innerHTML = '';

    Store.programas().forEach(function (prog) {
      var esActual  = prog.id === st.programaActual;
      var expandido = !!progExpanded[prog.id];
      var esFav     = Store.esFavorito(prog.id);

      /* Row: div[role=button] so nested <button> (star) stays valid */
      var cab = E('div', {
        class: 'sidebar-prog-cab',
        role: 'button',
        tabindex: '0',
        'aria-expanded': expandido ? 'true' : 'false',
        onclick: function () {
          progExpanded[prog.id] = !expandido;
          pintarSidebarProgramas();
        },
        onkeydown: function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            progExpanded[prog.id] = !expandido;
            pintarSidebarProgramas();
          }
        },
      }, [
        E('span', { class: 'sidebar-prog-chevron', 'aria-hidden': 'true' }, ['▶']),
        E('span', { class: 'sidebar-prog-nombre' + (esActual ? ' activo' : '') }, [prog.nombre || 'Sin nombre']),
        E('button', {
          class: 'sidebar-fav',
          'aria-label': esFav ? 'Quitar de favoritos' : 'Agregar a favoritos',
          'aria-pressed': esFav ? 'true' : 'false',
          onclick: function (ev) {
            ev.stopPropagation();
            Store.toggleFavorito(prog.id);
          },
        }, [esFav ? '★' : '☆']),
      ]);

      /* Dropdown menu */
      var menu = E('div', { class: 'sidebar-prog-menu' });

      function linkNav(label, vista, subvista, epica, bloqueada) {
        if (bloqueada) {
          menu.appendChild(E('button', { class: 'sidebar-link', disabled: true }, [label]));
          return;
        }
        var esVinculo = esActual &&
          st.vistaActual === vista &&
          (!subvista || st.subvistaDisena === subvista) &&
          (epica === undefined || st.epicaFiltro === epica);

        menu.appendChild(E('button', {
          class: 'sidebar-link',
          'aria-current': esVinculo ? 'true' : null,
          onclick: function () {
            Store.cambiarPrograma(prog.id, vista, subvista || null);
            if (epica !== undefined) {
              Store.mutar(function (s) { s.epicaFiltro = epica || null; });
            }
            if (window.innerWidth <= 720) {
              Store.mutar(function (s) { s.sidebar.abierto = false; });
            }
          },
        }, [label]));
      }

      linkNav('Detalles',         'disena',  'programa');
      linkNav('Teoría de Cambio', 'disena',  'toc');
      linkNav('MIR',              'disena',  'mir');
      linkNav('Agiliza',          'agiliza', null);

      /* Épica sub-items — only show when this program is active in agiliza */
      if (esActual && st.vistaActual === 'agiliza') {
        prog.epicas.forEach(function (ep) {
          var esEpicaActual = st.epicaFiltro === ep.id;
          menu.appendChild(E('button', {
            class: 'sidebar-link sidebar-epica-sub',
            'aria-current': esEpicaActual ? 'true' : null,
            onclick: function () {
              Store.cambiarPrograma(prog.id, 'agiliza');
              Store.mutar(function (s) { s.epicaFiltro = ep.id; });
              if (window.innerWidth <= 720) {
                Store.mutar(function (s) { s.sidebar.abierto = false; });
              }
            },
          }, [ep.nombre]));
        });
      }

      linkNav('Dashboards', 'tablero', null, undefined, true);

      var progEl = E('div', { class: 'sidebar-prog' });
      progEl.appendChild(cab);
      progEl.appendChild(menu);
      cont.appendChild(progEl);
    });
  }

  /* ---------- Quick-view renderers ---------- */

  function renderSidebarParaTi(cont) {
    var st = Store.get();

    var encontradas = [];
    Store.programas().forEach(function (prog) {
      (prog.tareas || []).forEach(function (t) {
        if (t.asignado === st.rolActual && (t.estado === 'todo' || t.estado === 'doing')) {
          var sp = (prog.sprints || []).find(function (s) { return s.id === t.sprint; });
          encontradas.push({ t: t, prog: prog, sprint: sp });
        }
      });
    });

    if (!encontradas.length) {
      cont.appendChild(E('p', { class: 'sidebar-vista-vacio' }, ['Sin tareas asignadas a ti.']));
      return;
    }

    encontradas.forEach(function (item) {
      cont.appendChild(E('button', {
        class: 'sidebar-tarea-item',
        onclick: function () {
          Store.cambiarPrograma(item.prog.id, 'agiliza');
          if (window.innerWidth <= 720) {
            Store.mutar(function (s) { s.sidebar.abierto = false; });
          }
        },
      }, [
        E('div', { class: 'sidebar-tarea-titulo' }, [item.t.titulo]),
        E('div', { class: 'sidebar-tarea-meta' }, [
          (item.sprint ? item.sprint.nombre + ' · ' : 'Backlog · ') + item.prog.nombre,
        ]),
      ]));
    });
  }

  function renderSidebarFavoritos(cont) {
    var st = Store.get();

    var favs = (st.favoritos || []).map(function (id) {
      return Store.programas().find(function (p) { return p.id === id; });
    }).filter(Boolean);

    if (!favs.length) {
      cont.appendChild(E('p', { class: 'sidebar-vista-vacio' }, ['Marca ☆ en un programa para agregarlo aquí.']));
      return;
    }

    favs.forEach(function (prog) {
      cont.appendChild(E('button', {
        class: 'sidebar-link',
        onclick: function () {
          Store.cambiarPrograma(prog.id, 'disena', 'toc');
          if (window.innerWidth <= 720) {
            Store.mutar(function (s) { s.sidebar.abierto = false; });
          }
        },
      }, [prog.nombre]));
    });
  }

  function renderSidebarOrganizacion(cont) {
    cont.appendChild(E('div', { class: 'sidebar-vista-titulo' }, ['Organización']));
    cont.appendChild(E('p', { class: 'sidebar-vista-vacio' }, [
      'Próximamente: estructura orgánica, jerarquía de dependencias y árbol de programas.',
    ]));
  }

  /* ============================ PINTADO PRINCIPAL ============================ */

  function repintar() {
    var st = Store.get();

    /* RBAC: si el rol no tiene acceso a la vista guardada, redirige */
    if (!Store.permiso(st.vistaActual)) {
      st.vistaActual = Store.VISTA_INICIO[st.rolActual] || 'disena';
    }

    pintarTopbar();
    pintarSidebar();

    var vista  = document.getElementById('vista');
    vista.innerHTML = '';
    var modulo = MODULOS[st.vistaActual] || MODULOS.disena;
    modulo.render(vista);
  }

  /* ============================ ARRANQUE ============================ */

  document.addEventListener('DOMContentLoaded', function () {
    Store.cargar();

    /* Atajos de prueba/demo: ?rol=carlos&vista=agiliza&sub=mir&offline=1 */
    var params = new URLSearchParams(location.search);
    if (params.has('rol') || params.has('vista') || params.has('sub') || params.has('offline')) {
      Store.mutar(function (s) {
        if (params.has('rol') && Store.persona(params.get('rol'))) {
          s.rolActual   = params.get('rol');
          s.vistaActual = Store.VISTA_INICIO[s.rolActual];
        }
        if (params.has('vista') && MODULOS[params.get('vista')]) s.vistaActual = params.get('vista');
        if (params.has('sub'))     s.subvistaDisena = params.get('sub');
        if (params.has('offline')) s.offline = params.get('offline') === '1';
      });
      if (params.get('form') === 'sprint') Agiliza.abrirFormSprint();
    }

    Store.alCambiar(repintar);
    repintar();
  });

  return { repintar: repintar, irA: irA };
})();
