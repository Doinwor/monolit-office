/* ==========================================================
   ЛЕНТА ПРЕЗЕНТАЦИЙ МОНОЛИТ — кнопки верхних вкладок.
   Всё состояние берётся у движка через window.MonolitPres.
   ========================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var P = function () { return window.MonolitPres || null; };

  function on(id, fn) {
    var el = $(id);
    if (el) el.addEventListener('click', function (e) { e.preventDefault(); fn(e); }, false);
  }
  /* одинаковые кнопки на разных вкладках (data-act) */
  function acts() {
    var bs = document.querySelectorAll('[data-act]'), k;
    for (k = 0; k < bs.length; k++) {
      (function (b) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          var p = P();
          if (!p) return;
          if (b.getAttribute('data-act') === 'new') p.newSlide();
          if (b.getAttribute('data-act') === 'dup') p.dupSlide();
          if (b.getAttribute('data-act') === 'tpl') p.template();
          if (b.getAttribute('data-act') === 'addblk') p.addBlock();
          if (b.getAttribute('data-act') === 'show') p.show();
        }, false);
      })(bs[k]);
    }
  }
  function chk(id, fn) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('change', function () { fn(el.checked); }, false);
  }
  function sel(id, fn) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('change', function () { fn(el.value); }, false);
    el.addEventListener('input', function () { fn(el.value); }, false);
  }

  /* ---------- подсветка кнопок под выбранный блок ---------- */
  function paint() {
    var p = P();
    if (!p) return;
    var s = p.state();
    function mark(id, v) {
      var b = $(id);
      if (b) b.className = b.className.replace(/\s*on\b/, '') + (v ? ' on' : '');
    }
    var b = s.block;
    mark('btnB', !!(b && b.b));
    mark('btnI', !!(b && b.i));
    mark('btnU', !!(b && b.u));
    mark('btnAlignL', !!b && b.al === 'left');
    mark('btnCenterBlk', !!b && b.al === 'center');
    mark('btnAlR', !!b && b.al === 'right');
    mark('btnAlJ', !!b && b.al === 'justify');
    ['btnAddBlk', 'btnDelBlk', 'btnClearBlk', 'btnMidBlk', 'btnB', 'btnI', 'btnU',
      'btnAlignL', 'btnAlR', 'btnAlJ', 'btnCenterBlk', 'btnFitBlk'].forEach(function (id) {
        var el = $(id);
        if (el) el.disabled = !(b && s.sel >= 0);
      });
    if (b) {
      if ($('bSize') && $('bSize').value !== String(b.s)) $('bSize').value = b.s;
      if ($('bSizeOut')) $('bSizeOut').innerHTML = b.s;
      if ($('bFont') && $('bFont').value !== (b.ff || '')) $('bFont').value = b.ff || '';
      if ($('bColor') && b.c && $('bColor').value !== b.c) $('bColor').value = b.c;
    } else {
      if ($('bSizeOut')) $('bSizeOut').innerHTML = '—';
    }
    var dis = s.sel < 0;
    ['btnDup', 'btnUp', 'btnDown', 'btnDel', 'btnAddAfter'].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = dis;
    });
    if ($('btnUp')) $('btnUp').disabled = s.sel <= 0;
    if ($('btnDown')) $('btnDown').disabled = dis || s.sel >= s.slides - 1;
    ['btnShow', 'btnShow2', 'btnSaveMono', 'btnSaveHtm', 'btnSaveTxt'].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !s.slides;
    });
  }

  function start() {
    var p = P();
    if (!p) return;

    /* --- блоки --- */
    on('btnB', function () { p.mark('b'); });
    on('btnI', function () { p.mark('i'); });
    on('btnU', function () { p.mark('u'); });
    on('btnAlignL', function () { p.align('left'); });
    on('btnCenterBlk', function () { p.align('center'); });
    on('btnAlR', function () { p.align('right'); });
    on('btnAlJ', function () { p.align('justify'); });
    on('btnFitBlk', function () { p.autofit(); });
    on('btnColorAuto', function () { p.blkColor(''); });
    sel('bFont', function (v) { p.blkFont(v); });
    sel('bSize', function (v) {
      if ($('bSizeOut')) $('bSizeOut').innerHTML = v;
      p.blkSize(v);
    });
    var bc = $('bColor');
    if (bc) {
      bc.addEventListener('input', function () { p.blkColor(bc.value); }, false);
      bc.addEventListener('change', function () { p.blkColor(bc.value); }, false);
    }

    /* --- дизайн слайда --- */
    sel('fDesign', function (v) { p.setDesign(v); });
    sel('fFont', function (v) { p.setFont(v); });
    sel('fSize', function (v) {
      if ($('sizeOut')) $('sizeOut').innerHTML = v;
      p.setSize(v);
    });
    sel('fTrans', function (v) { p.setTrans(v); });
    chk('fPage', function (v) { p.setPage(v); });
    chk('fStamp', function (v) { p.setStamp(v); });

    /* --- вид --- */
    chk('ckGrid', function (v) { p.grid(v); });
    on('btnFit', function () { p.redraw(); });

    acts();
    /* движок перерисовывает сцену и сам просит перерисовать кнопки */
    p.paint = paint;
    /* пункт «О программе» из общего меню Офис открывает нужную вкладку */
    if (String(location.hash || '').replace('#', '') === 'about') p.tab('about');
    window.addEventListener('hashchange', function () {
      if (String(location.hash || '').replace('#', '') === 'about') p.tab('about');
    }, false);
    paint();
    setTimeout(paint, 40);
    setTimeout(paint, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, false);
  else start();
})();
