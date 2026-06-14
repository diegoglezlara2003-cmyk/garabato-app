/*!
 * Garabato Crayon Overlay
 * Gimmick de dibujo libre — no interfiere con la app.
 * Auto-contenido: un solo <script> tag, cero dependencias.
 * Atajo: Ctrl+Shift+D  ·  Escape para cerrar
 */
(function () {
  'use strict';

  // ── Paleta & config ────────────────────────────────────────────────────────
  var COLORS = [
    '#E63B2E', '#F58220', '#FFD21F', '#7FD14C',
    '#1FA86B', '#29C5D6', '#5FA9F5', '#2B3FD6',
    '#1E2A78', '#6A3FD4', '#F977B6', '#D8B98F',
  ];
  var SIZES = { s: 3, m: 9, l: 20 };

  // Estado
  var panelOpen = false;
  var isDrawing = false;
  var currentTool = 'crayon';   // 'crayon' | 'highlight' | 'eraser'
  var currentSize = 'm';
  var currentColor = COLORS[0];
  var lastPos = null;

  // ── SVG filter (textura de crayón) ────────────────────────────────────────
  var filterSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  filterSvg.setAttribute('width', '0');
  filterSvg.setAttribute('height', '0');
  filterSvg.setAttribute('aria-hidden', 'true');
  filterSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  filterSvg.innerHTML =
    '<defs>' +
      '<filter id="gb-rough" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="3" seed="17" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>' +
    '</defs>';
  document.body.appendChild(filterSvg);

  // ── Canvas ─────────────────────────────────────────────────────────────────
  var canvas = document.createElement('canvas');
  canvas.id = 'gb-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;' +
    'z-index:1000;pointer-events:none;touch-action:none;';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var dpr = 1;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Preserve drawing across resize via data URL
    var saved = canvas.width > 0 ? canvas.toDataURL() : null;
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.scale(dpr, dpr);
    if (saved) {
      var img = new Image();
      img.src = saved;
      img.onload = function () {
        ctx.drawImage(img, 0, 0, window.innerWidth, window.innerHeight);
      };
    }
  }
  resizeCanvas();
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 120);
  });

  // ── Estilos ────────────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    /* Toggle button */
    '#gb-toggle {',
      'position:fixed; bottom:24px; left:24px; z-index:1002;',
      'width:48px; height:48px; border-radius:50%;',
      'background:#F1F1ED; border:2px solid #17181C;',
      'box-shadow:3px 3px 0 0 #17181C;',
      'cursor:pointer; padding:0;',
      'display:flex; align-items:center; justify-content:center;',
      'transition:box-shadow 140ms ease-out, transform 140ms ease-out;',
      'overflow:visible;',
    '}',
    '#gb-toggle:hover { box-shadow:4px 4px 0 0 #17181C; transform:translate(-0.5px,-0.5px); }',
    '#gb-toggle:active { box-shadow:1px 1px 0 0 #17181C; transform:translate(1px,1px); }',
    '#gb-toggle:focus-visible { outline:3px solid #2B3FD6; outline-offset:3px; }',

    /* Scribble inner animation */
    '#gb-toggle .gb-scribble { display:flex; align-items:center; justify-content:center; }',
    '#gb-toggle .gb-scribble .gb-p1 {',
      'stroke-dasharray:88; stroke-dashoffset:88;',
      'animation:gb-draw1 2s cubic-bezier(0.4,0,0.6,1) infinite;',
    '}',
    '#gb-toggle .gb-scribble .gb-p2 {',
      'stroke-dasharray:55; stroke-dashoffset:55;',
      'animation:gb-draw2 2.6s cubic-bezier(0.4,0,0.6,1) 0.35s infinite;',
    '}',
    '@keyframes gb-draw1 {',
      '0%   { stroke-dashoffset:88; opacity:0.25; }',
      '35%  { opacity:1; }',
      '75%  { stroke-dashoffset:0; opacity:1; }',
      '100% { stroke-dashoffset:-22; opacity:0; }',
    '}',
    '@keyframes gb-draw2 {',
      '0%   { stroke-dashoffset:55; opacity:0; }',
      '30%  { opacity:0.7; }',
      '70%  { stroke-dashoffset:0; opacity:0.7; }',
      '100% { stroke-dashoffset:-14; opacity:0; }',
    '}',

    /* Close state */
    '#gb-toggle .gb-close {',
      'display:none;',
      'font-family:"IBM Plex Mono",monospace;',
      'font-size:20px; font-weight:700; color:#17181C; line-height:1;',
    '}',
    '#gb-toggle.gb-open .gb-scribble { display:none; }',
    '#gb-toggle.gb-open .gb-close   { display:block; }',

    /* Panel */
    '#gb-panel {',
      'position:fixed; bottom:82px; left:24px; z-index:1001;',
      'width:192px; background:#F1F1ED;',
      'border:2px solid #17181C; box-shadow:4px 4px 0 0 #17181C;',
      'display:none; flex-direction:column;',
      'opacity:0; transform:translateY(10px);',
      'transition:opacity 200ms ease-out, transform 220ms cubic-bezier(0.16,1,0.3,1);',
    '}',
    '#gb-panel.gb-visible { opacity:1; transform:translateY(0); }',

    '.gb-sec { padding:10px 12px; border-bottom:1px solid rgba(23,24,28,0.1); }',
    '.gb-sec:last-child { border-bottom:none; }',
    '.gb-lbl {',
      'font-family:"IBM Plex Mono",monospace;',
      'font-size:0.58rem; font-weight:500; letter-spacing:0.2em;',
      'text-transform:uppercase; color:rgba(23,24,28,0.45); margin-bottom:7px;',
    '}',

    /* Tool buttons */
    '.gb-tools { display:flex; gap:5px; }',
    '.gb-tb {',
      'flex:1; height:36px; background:#FBFBF9;',
      'border:2px solid rgba(23,24,28,0.2); cursor:pointer;',
      'display:flex; align-items:center; justify-content:center; padding:0;',
      'transition:border-color 110ms, background 110ms, box-shadow 110ms;',
      'color:#17181C;',
    '}',
    '.gb-tb:hover { border-color:#17181C; box-shadow:2px 2px 0 0 #17181C; }',
    '.gb-tb.gb-on { background:#17181C; border-color:#17181C; color:#F1F1ED; box-shadow:2px 2px 0 0 #2B3FD6; }',
    '.gb-tb svg { width:16px; height:16px; }',

    /* Size buttons */
    '.gb-sizes { display:flex; gap:5px; }',
    '.gb-sb {',
      'flex:1; height:34px; background:#FBFBF9;',
      'border:2px solid rgba(23,24,28,0.2); cursor:pointer;',
      'display:flex; align-items:center; justify-content:center; padding:0;',
      'transition:border-color 110ms, background 110ms, box-shadow 110ms;',
    '}',
    '.gb-sb:hover { border-color:#17181C; box-shadow:2px 2px 0 0 #17181C; }',
    '.gb-sb.gb-on { background:#17181C; border-color:#17181C; }',
    '.gb-dot { border-radius:50%; background:#17181C; }',
    '.gb-sb.gb-on .gb-dot { background:#F1F1ED; }',

    /* Color grid */
    '.gb-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:4px; }',
    '.gb-sw {',
      'width:100%; aspect-ratio:1/1;',
      'border:2px solid rgba(23,24,28,0.25); cursor:pointer; padding:0;',
      'transition:transform 90ms, box-shadow 90ms, outline 90ms;',
    '}',
    '.gb-sw:hover { transform:scale(1.18); box-shadow:2px 2px 0 0 #17181C; }',
    '.gb-sw.gb-on { outline:2.5px solid #2B3FD6; outline-offset:2px; transform:scale(1.1); }',

    /* Clear button */
    '.gb-clear {',
      'width:100%; height:30px; background:transparent; border:none; cursor:pointer;',
      'font-family:"IBM Plex Mono",monospace; font-size:0.62rem; font-weight:500;',
      'letter-spacing:0.13em; text-transform:uppercase; color:rgba(23,24,28,0.45);',
      'transition:color 110ms;',
    '}',
    '.gb-clear:hover { color:#E63B2E; }',

    /* Reduced motion */
    '@media (prefers-reduced-motion:reduce) {',
      '#gb-toggle .gb-scribble .gb-p1,',
      '#gb-toggle .gb-scribble .gb-p2 {',
        'animation:none; stroke-dashoffset:0; opacity:0.7;',
      '}',
      '#gb-panel { transition:none; }',
    '}',
  ].join('\n');
  document.head.appendChild(styleEl);

  // ── Toggle button ──────────────────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.id = 'gb-toggle';
  btn.setAttribute('type', 'button');
  btn.setAttribute('aria-label', 'Activar modo garabato (Ctrl+Shift+D)');
  btn.innerHTML =
    '<svg class="gb-scribble" width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">' +
      '<path class="gb-p1" d="M5 18 Q 9 5, 13 13 Q 17 21, 21 8"' +
        ' stroke="#17181C" stroke-width="2.5" stroke-linecap="round" fill="none"/>' +
      '<path class="gb-p2" d="M4 13 Q 13 3, 22 13"' +
        ' stroke="#2B3FD6" stroke-width="2" stroke-linecap="round" fill="none"/>' +
    '</svg>' +
    '<span class="gb-close" aria-hidden="true">×</span>';
  document.body.appendChild(btn);

  // ── Panel ──────────────────────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = 'gb-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Herramientas de garabato');

  function svgCrayon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>' +
    '</svg>';
  }
  function svgHighlight() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
      '<line x1="15" y1="5" x2="18" y2="8"/>' +
    '</svg>';
  }
  function svgEraser() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 20H7L3 16l9-9 8 8z"/>' +
      '<path d="M6.5 17.5l5-5"/>' +
    '</svg>';
  }

  // Tools section
  var toolsHtml =
    '<div class="gb-sec">' +
      '<div class="gb-lbl">Herramienta</div>' +
      '<div class="gb-tools">' +
        '<button class="gb-tb gb-on" data-tool="crayon"    type="button" aria-label="Crayón">' + svgCrayon() + '</button>' +
        '<button class="gb-tb"       data-tool="highlight" type="button" aria-label="Resaltador">' + svgHighlight() + '</button>' +
        '<button class="gb-tb"       data-tool="eraser"    type="button" aria-label="Borrador">' + svgEraser() + '</button>' +
      '</div>' +
    '</div>';

  // Sizes section
  var sizesHtml =
    '<div class="gb-sec">' +
      '<div class="gb-lbl">Tamaño</div>' +
      '<div class="gb-sizes">' +
        '<button class="gb-sb" data-size="s" type="button" aria-label="Pequeño"><span class="gb-dot" style="width:5px;height:5px;"></span></button>' +
        '<button class="gb-sb gb-on" data-size="m" type="button" aria-label="Mediano"><span class="gb-dot" style="width:10px;height:10px;"></span></button>' +
        '<button class="gb-sb" data-size="l" type="button" aria-label="Grande"><span class="gb-dot" style="width:16px;height:16px;"></span></button>' +
      '</div>' +
    '</div>';

  // Colors section
  var colorsHtml = '<div class="gb-sec"><div class="gb-lbl">Color</div><div class="gb-grid">';
  COLORS.forEach(function (c, i) {
    colorsHtml +=
      '<button class="gb-sw' + (i === 0 ? ' gb-on' : '') + '"' +
        ' data-color="' + c + '"' +
        ' style="background:' + c + '"' +
        ' type="button"' +
        ' aria-label="Color ' + c + '"' +
        ' aria-pressed="' + (i === 0) + '">' +
      '</button>';
  });
  colorsHtml += '</div></div>';

  // Clear section
  var clearHtml =
    '<div class="gb-sec">' +
      '<button class="gb-clear" id="gb-clear-btn" type="button">Limpiar lienzo</button>' +
    '</div>';

  panel.innerHTML = toolsHtml + sizesHtml + colorsHtml + clearHtml;
  document.body.appendChild(panel);

  // ── Panel open/close ───────────────────────────────────────────────────────
  function openOverlay() {
    panelOpen = true;
    btn.classList.add('gb-open');
    btn.setAttribute('aria-label', 'Cerrar garabato (Escape)');
    panel.style.display = 'flex';
    requestAnimationFrame(function () { panel.classList.add('gb-visible'); });
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'crosshair';
  }

  function closeOverlay() {
    panelOpen = false;
    isDrawing = false;
    lastPos = null;
    btn.classList.remove('gb-open');
    btn.setAttribute('aria-label', 'Activar modo garabato (Ctrl+Shift+D)');
    panel.classList.remove('gb-visible');
    canvas.style.pointerEvents = 'none';
    canvas.style.cursor = '';
    setTimeout(function () {
      if (!panelOpen) panel.style.display = 'none';
    }, 230);
  }

  btn.addEventListener('click', function () {
    panelOpen ? closeOverlay() : openOverlay();
  });

  // ── Drawing ────────────────────────────────────────────────────────────────
  function getPt(e) {
    var src = e.touches ? e.touches[0] : e;
    return { x: src.clientX, y: src.clientY };
  }

  function stroke(from, to) {
    var sz = SIZES[currentSize];
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = sz * 3.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }

    if (currentTool === 'highlight') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = sz * 2.6;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    // Crayon: trazo principal + trazo ceroso desplazado (mismo que la landing)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = sz;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.globalAlpha = 0.3;
    ctx.lineWidth = sz * 0.4;
    ctx.beginPath();
    ctx.moveTo(from.x + 1.5, from.y + 2);
    ctx.lineTo(to.x + 1.5, to.y + 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!panelOpen) return;
    isDrawing = true;
    lastPos = getPt(e);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!panelOpen || !isDrawing) return;
    var pt = getPt(e);
    if (lastPos) stroke(lastPos, pt);
    lastPos = pt;
    e.preventDefault();
  });

  canvas.addEventListener('pointerup',    function () { isDrawing = false; lastPos = null; });
  canvas.addEventListener('pointerleave', function () { isDrawing = false; lastPos = null; });
  canvas.addEventListener('pointercancel',function () { isDrawing = false; lastPos = null; });

  // Touch: prevenir scroll cuando se está dibujando
  canvas.addEventListener('touchstart', function (e) { if (panelOpen) e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove',  function (e) { if (panelOpen) e.preventDefault(); }, { passive: false });

  // ── Panel: tool / size / color / clear ────────────────────────────────────
  panel.addEventListener('click', function (e) {
    // Tool
    var tb = e.target.closest('[data-tool]');
    if (tb) {
      currentTool = tb.dataset.tool;
      panel.querySelectorAll('.gb-tb').forEach(function (b) {
        b.classList.toggle('gb-on', b === tb);
      });
      return;
    }

    // Size
    var sb = e.target.closest('[data-size]');
    if (sb) {
      currentSize = sb.dataset.size;
      panel.querySelectorAll('.gb-sb').forEach(function (b) {
        b.classList.toggle('gb-on', b === sb);
      });
      return;
    }

    // Color swatch
    var sw = e.target.closest('[data-color]');
    if (sw) {
      currentColor = sw.dataset.color;
      panel.querySelectorAll('.gb-sw').forEach(function (b) {
        var on = b === sw;
        b.classList.toggle('gb-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      // Volver a crayón si estaba en borrador
      if (currentTool === 'eraser') {
        currentTool = 'crayon';
        panel.querySelectorAll('.gb-tb').forEach(function (b) {
          b.classList.toggle('gb-on', b.dataset.tool === 'crayon');
        });
      }
      return;
    }

    // Clear
    if (e.target.closest('#gb-clear-btn')) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  // ── Keyboard ───────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      panelOpen ? closeOverlay() : openOverlay();
      return;
    }
    if (e.key === 'Escape' && panelOpen) {
      closeOverlay();
    }
  });

})();
