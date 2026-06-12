/* =========================================================================
   ui.js — helpers de DOM, avatares, toasts, formato
   ========================================================================= */

var UI = (function () {

  /* el('div', {class:'x', onclick:fn}, [hijos|string]) */
  function el(tag, attrs, hijos) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k.indexOf('on') === 0 && typeof v === 'function') {
        n.addEventListener(k.slice(2), v);
      } else if (k === 'dataset') {
        Object.keys(v).forEach(function (d) { n.dataset[d] = v[d]; });
      } else if (v === true) {
        n.setAttribute(k, '');
      } else {
        n.setAttribute(k, v);
      }
    });
    (hijos || []).forEach(function (h) {
      if (h === null || h === undefined) return;
      n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
    });
    return n;
  }

  function avatar(personaId, chico) {
    var p = Store.persona(personaId);
    var a = el('span', { class: 'avatar' + (chico ? ' av-sm' : ''), title: p ? p.nombre : 'Sin asignar' },
      [p ? p.iniciales : '—']);
    if (p) a.style.background = p.color + '33'; /* 20% del color de la persona */
    return a;
  }

  var toastTimer = null;
  function toast(msje, accion, fnAccion) {
    var cont = document.getElementById('toasts');
    cont.innerHTML = '';
    var t = el('div', { class: 'toast' }, [msje]);
    if (accion && fnAccion) {
      t.appendChild(el('button', {
        onclick: function () { fnAccion(); cont.innerHTML = ''; },
      }, [accion]));
    }
    cont.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { cont.innerHTML = ''; }, 5000);
  }

  function fechaCorta(iso) {
    if (!iso) return '';
    var partes = iso.slice(0, 10).split('-');
    var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return parseInt(partes[2], 10) + ' ' + meses[parseInt(partes[1], 10) - 1];
  }

  function fechaHora(iso) {
    if (!iso) return '';
    return fechaCorta(iso) + ' · ' + iso.slice(11, 16);
  }

  var ESTADOS = [
    { id: 'idea', nombre: 'Idea' },
    { id: 'todo', nombre: 'Por hacer' },
    { id: 'doing', nombre: 'En curso' },
    { id: 'done', nombre: 'Hecho' },
  ];

  function nombreEstado(id) {
    var e = ESTADOS.find(function (x) { return x.id === id; });
    return e ? e.nombre : id;
  }

  return { el: el, avatar: avatar, toast: toast, fechaCorta: fechaCorta, fechaHora: fechaHora, ESTADOS: ESTADOS, nombreEstado: nombreEstado };
})();
