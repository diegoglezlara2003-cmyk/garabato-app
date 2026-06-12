/* =========================================================================
   app.js — arranque, navegación entre módulos y RBAC
   ========================================================================= */

var App = (function () {
  var E = UI.el;

  var MODULOS = {
    disena: { nombre: 'Diseña', render: function (c) { Disena.render(c); } },
    agiliza: { nombre: 'Agiliza', render: function (c) { Agiliza.render(c); } },
    ejecuta: { nombre: 'Ejecuta', render: function (c) { Ejecuta.render(c); } },
    audita: { nombre: 'Audita', render: renderBloqueado('Audita', '🔏', 'La verificación de evidencia y la bitácora inmutable de Gómez requieren el backend auditable.', 'En el roadmap — después del MVP front-end.') },
    tablero: { nombre: 'Tablero', render: renderBloqueado('Tablero directivo', '📊', 'La visibilidad en tiempo real para Reyes se construye sobre los datos que ya captura este MVP.', 'En el roadmap — después del MVP front-end.') },
  };

  var resetArmado = false;
  var resetTimer = null;

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

  /* ============================ PINTADO ============================ */

  function pintarTopbar() {
    var st = Store.get();
    var rol = Store.persona(st.rolActual);

    document.getElementById('topbar-programa').textContent = st.programa.nombre;

    /* Tabs de módulos con candado según permisos */
    document.querySelectorAll('.modulo-tab').forEach(function (tab) {
      var vista = tab.dataset.vista;
      var permiso = (Store.PERMISOS[st.rolActual] || {})[vista];
      tab.disabled = !permiso;
      tab.setAttribute('aria-current', st.vistaActual === vista ? 'true' : 'false');
      tab.onclick = function () { if (permiso) irA(vista); };
      tab.title = permiso ? '' : 'Sin acceso para ' + rol.nombre;
    });

    /* Rol actual */
    var av = document.getElementById('rol-avatar');
    av.textContent = rol.iniciales;
    av.style.background = rol.color + '33';
    document.getElementById('rol-nombre').textContent = rol.nombre;
    document.getElementById('rol-cargo').textContent = rol.cargo;

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
    /* Restablecer en dos pasos: el primer toque arma, el segundo ejecuta */
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

  function repintar() {
    var st = Store.get();

    /* RBAC: si el rol no tiene acceso a la vista guardada, va a su módulo de inicio */
    if (!Store.permiso(st.vistaActual)) {
      st.vistaActual = Store.VISTA_INICIO[st.rolActual] || 'disena';
    }

    pintarTopbar();
    var vista = document.getElementById('vista');
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
          s.rolActual = params.get('rol');
          s.vistaActual = Store.VISTA_INICIO[s.rolActual];
        }
        if (params.has('vista') && MODULOS[params.get('vista')]) s.vistaActual = params.get('vista');
        if (params.has('sub')) s.subvistaDisena = params.get('sub');
        if (params.has('offline')) s.offline = params.get('offline') === '1';
      });
      if (params.get('form') === 'sprint') Agiliza.abrirFormSprint();
    }

    Store.alCambiar(repintar);
    repintar();
  });

  return { repintar: repintar, irA: irA };
})();
