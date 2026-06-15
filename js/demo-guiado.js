/* =========================================================================
   demo-guiado.js — overlay de onboarding
   Completamente autónomo: no toca app.js, store.js, disena.js ni ui.js.
   Se comunica con la app solo vía Store.mutar() y Store.cambiarPrograma().
   ========================================================================= */

var DemoGuiado = (function () {
  'use strict';

  var STORAGE_KEY  = 'garabato-demo-v1';
  var TOTAL_PASOS  = 9;

  /* ── Estado ─────────────────────────────────────────────────────────── */

  var estado = { fase: 'bienvenida', paso: 0, personaje: null, completado: false };

  /* ── DOM refs ────────────────────────────────────────────────────────── */

  var elBloqueo   = null;
  var elSpotlight = null;
  var elCard      = null;

  // Cleanup fn for the current auto-advance listener (cleared on nav)
  var limpiarAutoListener = null;

  /* ── Definición de pasos ─────────────────────────────────────────────── */

  var PERSONAS_DEMO = [
    {
      id: 'lucia',
      desc: 'Diseña programas y define la Teoría de Cambio.',
      disponible: true,
    },
    {
      id: 'carlos',
      desc: 'Coordina tareas y equipos en el módulo Agiliza.',
      disponible: false,
    },
    {
      id: 'marco',
      desc: 'Registra avances y evidencia en campo.',
      disponible: false,
    },
  ];

  var PASOS = [
    {
      // 1
      selector: '#btn-rol',
      titulo: 'Cambia de rol en cualquier momento',
      desc: 'Desde aquí puedes ver Garabato como Lucía, Carlos, Marco y más. Cada rol ve información distinta del mismo programa.',
    },
    {
      // 2
      selector: '#sidebar',
      titulo: 'El menú lateral',
      desc: 'Aquí están tus programas, las tareas asignadas a ti y tus favoritos.',
      preAccion: function () { abrirSidebar(); },
    },
    {
      // 3
      selector: '#sidebar-programas',
      titulo: '3 programas de ejemplo cargados',
      desc: 'Reforestación Urbana AMG, Agua Potable Rural y Mujeres en Situación de Riesgo están listos para explorar.',
      preAccion: function () { abrirSidebar(); },
    },
    {
      // 4
      selector: '#sidebar-programas .sidebar-prog',
      titulo: 'Entremos a Reforestación Urbana AMG',
      desc: 'Haz click en el programa para abrirlo. Verás sus detalles y el diseño de la política.',
      preAccion: function () { abrirSidebar(); },
      // Auto-advance when user clicks the program header
      autoSelector: '#sidebar-programas .sidebar-prog-cab',
      autoDelay: 450,
    },
    {
      // 5
      selector: '#vista',
      titulo: 'Los detalles del programa',
      desc: 'Responsable, periodo, estado y objetivos — todo lo que necesitas para entender el alcance.',
      preAccion: function () {
        Store.cambiarPrograma('prog-1', 'disena', 'programa');
      },
    },
    {
      // 6
      selector: '.subtabs',
      titulo: 'Diseña tiene dos vistas',
      desc: 'Teoría de Cambio define cómo lograrás el impacto. MIR convierte esa teoría en actividades medibles.',
    },
    {
      // 7
      selector: '#toc-viewport',
      titulo: 'Tu Teoría de Cambio',
      desc: 'Cada nodo es una intervención. Haz click en uno para ver sus detalles y agregar indicadores.',
    },
    {
      // 8
      selector: '.toc-lista',
      titulo: 'Agrega un indicador a un nodo',
      desc: 'Haz click en el botón "indicadores" dentro de cualquier nodo para vincular cómo medirás ese resultado.',
      // Auto-advance when user clicks any indicator button inside a toc-card
      autoSelector: '.toc-lista',
      autoEvent: 'click',
      autoFilter: function (e) {
        var btn = e.target.closest('.toc-mini');
        return btn && btn.textContent.indexOf('indicadores') !== -1;
      },
      autoDelay: 300,
    },
    {
      // 9
      selector: '.subtabs',
      titulo: 'Ahora explora el MIR',
      desc: 'Haz click en la pestaña MIR. Organiza tus actividades, componentes y fin en una sola Matriz de Indicadores de Resultados.',
      // Auto-advance when user clicks the MIR subtab
      autoSelector: '.subtabs',
      autoEvent: 'click',
      autoFilter: function (e) {
        var btn = e.target.closest('.subtab');
        return btn && btn.textContent.indexOf('MIR') !== -1;
      },
      autoDelay: 300,
    },
  ];

  /* ── Persistencia ────────────────────────────────────────────────────── */

  function cargar() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var datos = JSON.parse(raw);
        estado.fase       = datos.fase       || 'bienvenida';
        estado.paso       = datos.paso       || 0;
        estado.personaje  = datos.personaje  || null;
        estado.completado = !!datos.completado;
      }
    } catch (e) {}
  }

  function guardar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (e) {}
  }

  /* ── Init ────────────────────────────────────────────────────────────── */

  function init() {
    cargar();
    if (!estado.completado) {
      crearDOM();
      mostrarFase(estado.fase);
    }

    // Intercept the app's "Restablecer demo" button — wrap Store.reiniciar
    // so it also launches the guided tour after a reset.
    var _reiniciarOriginal = Store.reiniciar;
    Store.reiniciar = function () {
      _reiniciarOriginal.call(Store);
      localStorage.removeItem(STORAGE_KEY);
      estado.fase = 'bienvenida';
      estado.paso = 0;
      estado.personaje = null;
      estado.completado = false;
      guardar();
      // If overlay DOM doesn't exist yet (user had completed and dismissed)
      if (!elCard) crearDOM();
      setTimeout(function () {
        elCard.hidden = false;
        mostrarFase('bienvenida');
      }, 400); // Let the app re-render first
    };
  }

  /* ── DOM base ────────────────────────────────────────────────────────── */

  function crearDOM() {
    elBloqueo = document.createElement('div');
    elBloqueo.className = 'demo-bloqueo';
    elBloqueo.hidden = true;
    document.body.appendChild(elBloqueo);

    elSpotlight = document.createElement('div');
    elSpotlight.className = 'demo-spotlight';
    elSpotlight.hidden = true;
    document.body.appendChild(elSpotlight);

    elCard = document.createElement('div');
    elCard.className = 'demo-card';
    document.body.appendChild(elCard);
  }

  /* ── Fases ───────────────────────────────────────────────────────────── */

  function mostrarFase(fase) {
    // Clean up any pending auto-advance listener from the previous step
    if (limpiarAutoListener) {
      limpiarAutoListener();
      limpiarAutoListener = null;
    }
    limpiarSpotlight();
    estado.fase = fase;
    guardar();
    elCard.hidden = false;

    switch (fase) {
      case 'bienvenida': renderBienvenida(); break;
      case 'persona':    renderPersona();    break;
      case 'paso':       renderPaso(estado.paso); break;
      case 'final':      renderFinal();      break;
    }
  }

  /* ── Bienvenida ──────────────────────────────────────────────────────── */

  function renderBienvenida() {
    elBloqueo.hidden = false;
    elSpotlight.hidden = true;
    elCard.className = 'demo-card demo-card-centrado';
    elCard.style.cssText = '';

    elCard.innerHTML =
      '<div class="demo-card-cabecera demo-card-cabecera-solo">' +
        '<button class="btn-icono demo-cerrar" aria-label="Cerrar demo">✕</button>' +
      '</div>' +
      '<div class="demo-card-cuerpo">' +
        '<p class="demo-wordmark">GARABATO<span class="demo-acento">_</span></p>' +
        '<h2 class="demo-titulo">Bienvenido al demo</h2>' +
        '<p class="demo-desc">Explora cómo funciona el sistema con datos reales de ejemplo. Toma el demo guiado o explora a tu ritmo.</p>' +
        '<div class="demo-acciones-bienvenida">' +
          '<button class="btn btn-primario demo-btn-guiado">Iniciar demo guiado</button>' +
          '<button class="btn demo-btn-libre">Explorar libremente</button>' +
        '</div>' +
      '</div>';

    elCard.querySelector('.demo-cerrar').addEventListener('click', cerrar);
    elCard.querySelector('.demo-btn-guiado').addEventListener('click', function () {
      mostrarFase('persona');
    });
    elCard.querySelector('.demo-btn-libre').addEventListener('click', cerrar);
  }

  /* ── Selección de persona ────────────────────────────────────────────── */

  function renderPersona() {
    elBloqueo.hidden = false;
    elSpotlight.hidden = true;
    elCard.className = 'demo-card demo-card-centrado demo-card-ancha';
    elCard.style.cssText = '';

    var personasHTML = PERSONAS_DEMO.map(function (p) {
      var persona = Store.PERSONAS.find(function (x) { return x.id === p.id; });
      var color   = persona ? persona.color : '#888';
      var nombre  = persona ? persona.nombre : p.id;
      var cargo   = persona ? persona.cargo  : '';

      return (
        '<button class="demo-persona-card" data-persona="' + p.id + '">' +
          '<div class="demo-persona-icono" style="background:' + color + '22; border:2px solid ' + color + '">' +
            '<svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
              '<circle cx="16" cy="12" r="6" fill="' + color + '"/>' +
              '<path d="M4 29c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="' + color + '"/>' +
            '</svg>' +
          '</div>' +
          '<p class="demo-persona-nombre">' + nombre + '</p>' +
          '<p class="demo-persona-cargo">' + cargo + '</p>' +
          '<p class="demo-persona-desc">' + p.desc + '</p>' +
          '<p class="demo-persona-pronto" hidden>Ruta disponible pronto. Explora con Lucía por ahora.</p>' +
        '</button>'
      );
    }).join('');

    elCard.innerHTML =
      '<div class="demo-card-cabecera">' +
        '<button class="btn-icono demo-cerrar" aria-label="Cerrar demo">✕</button>' +
      '</div>' +
      '<div class="demo-card-cuerpo">' +
        '<h2 class="demo-titulo">¿Con quién te identificas?</h2>' +
        '<p class="demo-desc demo-desc-sub">Elige un perfil para comenzar el recorrido.</p>' +
        '<div class="demo-persona-grid">' + personasHTML + '</div>' +
      '</div>';

    elCard.querySelector('.demo-cerrar').addEventListener('click', cerrar);

    elCard.querySelectorAll('.demo-persona-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var personaId = btn.dataset.persona;
        var p = PERSONAS_DEMO.find(function (x) { return x.id === personaId; });

        if (!p || !p.disponible) {
          // Mostrar advertencia inline
          elCard.querySelectorAll('.demo-persona-pronto').forEach(function (el) { el.hidden = true; });
          elCard.querySelectorAll('.demo-persona-card').forEach(function (b) { b.classList.remove('demo-persona-activa'); });
          btn.querySelector('.demo-persona-pronto').hidden = false;
          btn.classList.add('demo-persona-activa');
          return;
        }

        // Lucía seleccionada
        estado.personaje = personaId;
        estado.paso = 1;
        guardar();
        cambiarRolApp(personaId);
        setTimeout(function () { mostrarFase('paso'); }, 300);
      });
    });
  }

  /* ── Pasos guiados ───────────────────────────────────────────────────── */

  function renderPaso(n) {
    var idx  = n - 1;
    var paso = PASOS[idx];

    if (!paso) {
      mostrarFase('final');
      return;
    }

    // Pre-acción (abrir sidebar, navegar a programa, etc.)
    if (paso.preAccion) paso.preAccion();

    // Espera al DOM actualizado por la pre-acción
    setTimeout(function () {
      var target = document.querySelector(paso.selector);

      if (!target) {
        // Elemento no encontrado — avanzar silenciosamente
        avanzar();
        return;
      }

      posicionarSpotlight(target);
      posicionarCard(target, n, paso);

      // Attach auto-advance listener if the step defines one
      if (paso.autoSelector) {
        var autoRoot = document.querySelector(paso.autoSelector);
        if (autoRoot) {
          var fired = false;
          var eventName = paso.autoEvent || 'click';
          var handler = function (e) {
            if (fired) return;
            // If there's a filter, check it
            if (paso.autoFilter && !paso.autoFilter(e)) return;
            fired = true;
            autoRoot.removeEventListener(eventName, handler);
            limpiarAutoListener = null;
            setTimeout(avanzar, paso.autoDelay || 300);
          };
          autoRoot.addEventListener(eventName, handler);
          limpiarAutoListener = function () {
            autoRoot.removeEventListener(eventName, handler);
          };
        }
      }
    }, 80);
  }

  /* ── Spotlight ───────────────────────────────────────────────────────── */

  function posicionarSpotlight(target) {
    var rect = target.getBoundingClientRect();
    var pad  = 8;

    elBloqueo.hidden = true;
    elSpotlight.hidden = false;

    elSpotlight.style.top    = (rect.top    - pad) + 'px';
    elSpotlight.style.left   = (rect.left   - pad) + 'px';
    elSpotlight.style.width  = (rect.width  + pad * 2) + 'px';
    elSpotlight.style.height = (rect.height + pad * 2) + 'px';
  }

  function limpiarSpotlight() {
    if (elSpotlight) {
      elSpotlight.hidden = true;
      elSpotlight.style.cssText = '';
    }
  }

  /* ── Posicionamiento del card ────────────────────────────────────────── */

  function posicionarCard(target, n, paso) {
    var rect    = target.getBoundingClientRect();
    var vw      = window.innerWidth;
    var vh      = window.innerHeight;
    var cardW   = 360;
    var gap     = 16;

    elCard.className  = 'demo-card';
    elCard.innerHTML  = buildCardHTML(n, paso);
    bindCardNav(n);

    // Positioning happens after render (need offsetHeight)
    requestAnimationFrame(function () {
      var cardH = elCard.offsetHeight || 180;
      var top, left;

      // Below if there's room, otherwise above, otherwise overlay bottom area
      if (rect.bottom + gap + cardH + 8 < vh) {
        top = rect.bottom + gap;
      } else if (rect.top - gap - cardH - 8 > 0) {
        top = rect.top - gap - cardH;
      } else {
        top = Math.max(8, vh - cardH - gap);
      }

      // Horizontally centered over target, clamped to viewport
      left = rect.left + rect.width / 2 - cardW / 2;
      left = Math.max(8, Math.min(left, vw - cardW - 8));

      elCard.style.top       = top  + 'px';
      elCard.style.left      = left + 'px';
      elCard.style.bottom    = '';
      elCard.style.right     = '';
      elCard.style.transform = '';
    });
  }

  function buildCardHTML(n, paso) {
    var prevDisabled  = n <= 1   ? ' disabled' : '';
    var nextLabel     = n >= TOTAL_PASOS ? 'Finalizar →' : 'Siguiente →';

    return (
      '<div class="demo-card-cabecera">' +
        '<button class="btn-icono demo-cerrar" aria-label="Cerrar demo">✕</button>' +
        '<span class="demo-progreso">Paso ' + n + ' de ' + TOTAL_PASOS + '</span>' +
      '</div>' +
      '<div class="demo-card-cuerpo">' +
        '<h3 class="demo-titulo">' + paso.titulo + '</h3>' +
        '<p class="demo-desc">' + paso.desc + '</p>' +
      '</div>' +
      '<div class="demo-nav">' +
        '<button class="btn demo-btn-prev"' + prevDisabled + '>← Anterior</button>' +
        '<button class="btn btn-primario demo-btn-next">' + nextLabel + '</button>' +
      '</div>'
    );
  }

  function bindCardNav(n) {
    var cerrarBtn = elCard.querySelector('.demo-cerrar');
    var prevBtn   = elCard.querySelector('.demo-btn-prev');
    var nextBtn   = elCard.querySelector('.demo-btn-next');

    if (cerrarBtn) cerrarBtn.addEventListener('click', cerrar);
    if (prevBtn)   prevBtn.addEventListener('click', retroceder);
    if (nextBtn)   nextBtn.addEventListener('click', avanzar);
  }

  /* ── Final ───────────────────────────────────────────────────────────── */

  function renderFinal() {
    elBloqueo.hidden = false;
    elSpotlight.hidden = true;
    elCard.className = 'demo-card demo-card-centrado';
    elCard.style.cssText = '';

    elCard.innerHTML =
      '<div class="demo-card-cabecera demo-card-cabecera-solo">' +
        '<button class="btn-icono demo-cerrar" aria-label="Cerrar demo">✕</button>' +
      '</div>' +
      '<div class="demo-card-cuerpo">' +
        '<p class="demo-badge-final">✓ Completado</p>' +
        '<h2 class="demo-titulo">Exploraste el módulo Diseña</h2>' +
        '<p class="demo-desc">Ya conoces cómo Lucía diseña un programa en Garabato. Próximamente: las rutas de Carlos en Agiliza y Marco en Ejecuta.</p>' +
        '<div class="demo-acciones-bienvenida">' +
          '<button class="btn btn-primario demo-btn-libre">Explorar por mi cuenta</button>' +
          '<button class="btn demo-btn-reiniciar">Reiniciar demo</button>' +
        '</div>' +
      '</div>';

    elCard.querySelector('.demo-cerrar').addEventListener('click', cerrar);
    elCard.querySelector('.demo-btn-libre').addEventListener('click', cerrar);
    elCard.querySelector('.demo-btn-reiniciar').addEventListener('click', reiniciar);
  }

  /* ── Navegación ──────────────────────────────────────────────────────── */

  function avanzar() {
    if (estado.fase !== 'paso') {
      estado.paso = 1;
      guardar();
      mostrarFase('paso');
      return;
    }
    if (estado.paso >= TOTAL_PASOS) {
      mostrarFase('final');
      return;
    }
    estado.paso = estado.paso + 1;
    guardar();
    mostrarFase('paso');
  }

  function retroceder() {
    if (estado.fase !== 'paso' || estado.paso <= 1) return;
    estado.paso = estado.paso - 1;
    guardar();
    mostrarFase('paso');
  }

  function cerrar() {
    if (limpiarAutoListener) { limpiarAutoListener(); limpiarAutoListener = null; }
    limpiarSpotlight();
    if (elBloqueo) elBloqueo.hidden = true;
    if (elCard)   { elCard.hidden = true; elCard.innerHTML = ''; }
    estado.completado = true;
    guardar();
  }

  function reiniciar() {
    localStorage.removeItem(STORAGE_KEY);
    estado.fase = 'bienvenida';
    estado.paso = 0;
    estado.personaje = null;
    estado.completado = false;
    guardar();
    elCard.hidden = false;
    mostrarFase('bienvenida');
  }

  /* ── Helpers de app ──────────────────────────────────────────────────── */

  function cambiarRolApp(rolId) {
    Store.mutar(function (s) {
      s.rolActual    = rolId;
      s.vistaActual  = (Store.VISTA_INICIO && Store.VISTA_INICIO[rolId]) || 'disena';
    });
  }

  function abrirSidebar() {
    var s = Store.get();
    if (s && s.sidebar && !s.sidebar.abierto) {
      Store.mutar(function (st) { st.sidebar.abierto = true; });
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  return { init: init };

})();

document.addEventListener('DOMContentLoaded', DemoGuiado.init);
