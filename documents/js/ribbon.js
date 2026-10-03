/* ==========================================================
   ЛЕНТА ДОКУМЕНТЫ МОНОЛИТ — связывает кнопки Word с редактором.
   Работает через window.MonolitDoc (см. js/main.js).
   ========================================================== */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function D() { return window.MonolitDoc; }

  var STYLE_LABEL = {
    p: 'обычный текст', h1: 'заголовок 1', h2: 'заголовок 2', h3: 'заголовок 3',
    li: 'список (точками)', ol: 'список (номерами)', quote: 'цитата', pre: 'моноширинный'
  };

  function click(id, fn) {
    var el = $(id);
    if (el) el.onclick = fn;
  }

  /* ---- простая обёртка: сказать «применить» ---- */
  function touch() {
    var d = D();
    if (!d) return;
    d.readForm();
    d.status();
    d.curInfo();
    paint();
  }

  /* ---- нарисовать состояние ленты по текущему абзацу ---- */
  function paint() {
    var d = D();
    if (!d) return;
    var b = d.state();
    if (!b) return;

    var f = $('fStyle'); if (f && f.value !== b.s) f.value = b.s;
    var a = $('fAl');     if (a) a.value = b.al;
    var fo = $('fFont');  if (fo && fo.value !== b.f) fo.value = b.f;
    setSize(b.z);
    var c = $('fColor');  if (c && c.value.toLowerCase() !== String(b.c || '#000000').toLowerCase()) c.value = b.c || '#000000';
    var ind = $('fInd');  if (ind && String(ind.value) !== String(b.ind)) ind.value = b.ind;
    var lhv = $('fLh');   if (lhv && String(lhv.value) !== String(b.lh || 0)) lhv.value = b.lh || 0;

    setOn('bBold', b.b);
    setOn('bIt', b.i);
    setOn('bUn', b.u);
    setOn('btnSup', b.sup);
    setOn('btnSub', b.sub);
    setOn('btnStrike', b.st);
    setOn('btnMark', b.hl);
    setOn('btnList', b.s === 'li');
    setOn('btnNum', b.s === 'ol');
    setOn('btnAlLeft', b.al === 'left');
    setOn('btnAlCenter', b.al === 'center');
    setOn('btnAlRight', b.al === 'right');
    setOn('btnAlJust', b.al === 'just');

    var so = $('styleOut');
    if (so) so.innerHTML = STYLE_LABEL[b.s] || b.s;
    var io = $('indOut');
    if (io) io.innerHTML = b.ind;
    var ci = $('curInfo2');
    if (ci) {
      var i = d.get().sel;
      ci.innerHTML = (i + 1) + ' из ' + d.doc().blocks.length + ' &mdash; ' + (STYLE_LABEL[b.s] || b.s);
    }

    var gal = document.querySelectorAll('.sg');
    for (var k = 0; k < gal.length; k++) {
      if (gal[k].getAttribute('data-s') === b.s) gal[k].className = 'sg on';
      else gal[k].className = 'sg';
    }
  }
  function setOn(id, on) {
    var el = $(id);
    if (!el) return;
    el.className = 'rbtn ico' + (on ? ' on' : '');
  }

  /* размер может быть любым числом 9..40 — если такого нет в списке,
     добавляем его, иначе select сбросится в пустое значение */
  function setSize(z) {
    var sel = $('fSize');
    if (!sel) return;
    z = String(z);
    if (sel.value === z) return;
    var found = false, opts = sel.options, k;
    for (k = 0; k < opts.length; k++) if (opts[k].value === z) { found = true; break; }
    if (!found) {
      var o = document.createElement('option');
      o.value = z; o.textContent = z;
      sel.appendChild(o);
    }
    sel.value = z;
  }

  /* ---- установка стиля абзаца ---- */
  function setStyle(s) {
    var f = $('fStyle');
    if (f) f.value = s;
    touch();
  }
  function setAl(al) {
    var a = $('fAl');
    if (a) a.value = al;
    touch();
  }

  /* ==========================================================
     ВКЛАДКИ ЛЕНТЫ
     ========================================================== */
  function switchTab(name) {
    var tabs = document.querySelectorAll('.rtab'), panes = document.querySelectorAll('.rpane'), k;
    for (k = 0; k < tabs.length; k++) {
      tabs[k].className = (tabs[k].getAttribute('data-tab') === name) ? 'rtab on' : 'rtab';
    }
    for (k = 0; k < panes.length; k++) {
      panes[k].className = (panes[k].getAttribute('data-pane') === name) ? 'rpane on' : 'rpane';
    }
  }
  click('qbNew', function () { switchTab('file'); });

  /* ==========================================================
     БЫСТРЫЙ ДОСТУП
     ========================================================== */
  click('qbNew', function () { var d = D(); if (d) d.clearAll(); });
  click('qbOpen', function () { var d = D(); if (d) d.openAny(); });
  click('qbSave', function () { var d = D(); if (d) d.saveMono(); });
  click('qbPrint', function () { var d = D(); if (d) d.doPrint(); });
  click('qbUndo', function () { var d = D(); if (d) { d.undo(); paint(); } });
  click('qbRedo', function () { var d = D(); if (d) { d.redo(); paint(); } });
  click('qbFind', function () { switchTab('view'); var f = $('fFind'); if (f) { f.focus(); f.select(); } });
  click('qbOpen2', function () { var d = D(); if (d) d.openAny(); });
  click('btnSound', function () {
    var box = $('sndOn');
    if (!box) return;
    box.checked = !box.checked;
    var st = $('sndState');
    if (st) st.innerHTML = box.checked ? 'вкл' : 'выкл';
  });

  /* ==========================================================
     ШРИФТ / АБЗАЦ
     ========================================================== */
  ['fStyle', 'fAl', 'fFont', 'fSize', 'fColor', 'fInd'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    var h = function () { touch(); };
    el.oninput = h;
    el.onchange = h;
  });

  click('bBold', function () { D().toggleFlag('b'); paint(); });
  click('bIt', function () { D().toggleFlag('i'); paint(); });
  click('bUn', function () { D().toggleFlag('u'); paint(); });
  click('bNone', function () {
    var d = D(), b = d.state();
    if (!b) return;
    if (!b.b && !b.i && !b.u && !b.sup && !b.sub && !b.st && !b.hl) {
      d.note('начертания и выделения не было');
      return;
    }
    if (d.clearChar) d.clearChar();
    paint();
  });

  click('btnList', function () {
    var d = D(), b = d.state();
    setStyle(b && b.s === 'li' ? 'p' : 'li');
  });
  click('btnNum', function () {
    var d = D(), b = d.state();
    setStyle(b && b.s === 'ol' ? 'p' : 'ol');
  });
  click('btnAlLeft', function () { setAl('left'); });
  click('btnAlCenter', function () { setAl('center'); });
  click('btnAlRight', function () { setAl('right'); });
  click('btnAlJust', function () { setAl('just'); });

  click('btnIndUp', function () {
    var f = $('fInd');
    if (!f) return;
    f.value = Math.max(0, (parseInt(f.value, 10) || 0) - 6);
    touch();
  });
  click('btnIndDown', function () {
    var f = $('fInd');
    if (!f) return;
    f.value = Math.min(60, (parseInt(f.value, 10) || 0) + 6);
    touch();
  });

  /* ==========================================================
     ГАЛЕРЕЯ СТИЛЕЙ
     ========================================================== */
  function styleGal() {
    var gal = document.querySelectorAll('.sg'), k;
    for (k = 0; k < gal.length; k++) {
      (function (b) {
        b.onclick = function () { setStyle(b.getAttribute('data-s')); };
      })(gal[k]);
    }
  }

  /* ==========================================================
     ВИД
     ========================================================== */
  click('zIn', function () { var d = D(); if (d) { d.zoom(10); zoomLabel(); } });
  click('zOut', function () { var d = D(); if (d) { d.zoom(-10); zoomLabel(); } });
  click('z100', function () { var d = D(); if (d) { d.zoomReset(); zoomLabel(); } });
  click('zPage', function () { var d = D(); if (d) { d.fit(); zoomLabel(); } });
  function zoomLabel() {
    var d = D();
    if (!d) return;
    var v = d.zoomGet();
    var a = $('rbZoom'), b = $('zoomOut');
    if (a) a.innerHTML = v;
    if (b) b.innerHTML = v;
  }

  function chk(id, fn) {
    var el = $(id);
    if (!el) return;
    el.onchange = function () { fn(el.checked); };
  }
  chk('ckRuler', function (v) {
    var r = $('rulerRow');
    if (r) r.className = v ? 'ruler' : 'ruler off';
  });
  chk('ckGrid', function (v) { var d = D(); if (d) d.setGuides(v); });
  chk('ckMarks', function (v) { var d = D(); if (d) d.setMarks(v); });

  /* ==========================================================
     РАЗМЕТКА
     ========================================================== */
  function pageModeBtns() {
    var bs = document.querySelectorAll('[data-pm]'), k;
    for (k = 0; k < bs.length; k++) {
      (function (b) {
        b.onclick = function () {
          var d = D();
          if (!d) return;
          var m = d.setPages(b.getAttribute('data-pm'));
          d.note('страница: ' + ({ port: 'книжная', land: 'альбомная', narrow: 'узкие поля', wide: 'широкие поля' })[m]);
        };
      })(bs[k]);
    }
  }

  /* ==========================================================
     ВСТАВКА
     ========================================================== */
  click('btnHr', function () {
    var d = D();
    if (!d) return;
    d.addAfter();
    var b = d.state();
    if (b) { d.doc().blocks[d.get().sel] = { t: '_______________', s: 'p', al: 'left', f: 'tah', z: 12, c: '', b: 0, i: 0, u: 0, ind: 0, sp: 0 }; }
    d.select(d.get().sel, true);
    d.note('линия вставлена');
  });
  click('btnImportWord', function () { openDrawer(); });
  click('btnImportAny', function () { var d = D(); if (d) d.openAny(); });

  /* буфер обмена */
  click('btnCopy', function () {
    var d = D();
    if (!d) return;
    var t = d.state();
    if (!t) return;
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    d.note(ok ? 'абзац скопирован' : 'не вышло скопировать');
  });
  click('btnCut', function () {
    var d = D();
    if (!d) return;
    var i = d.get().sel;
    try { document.execCommand('cut'); } catch (e) { }
    d.delBlock();
    d.note('абзац вырезан');
  });
  click('btnPaste', function () {
    var d = D();
    if (!d) return;
    var page = $('page');
    if (page) page.focus();
    var ok = false;
    try { ok = document.execCommand('paste'); } catch (e) { ok = false; }
    if (!ok) d.note('вставь текст через Ctrl+V — браузер не даёт нам читать буфер');
  });

  /* ==========================================================
     ПОИСК
     ========================================================== */
  click('btnFind', function () { var d = D(); if (d) d.find($('fFind').value, true); });
  click('btnFindNext', function () { var d = D(); if (d) d.find($('fFind').value, false); });
  click('btnRepl', function () {
    var d = D();
    if (!d) return;
    var q = $('fFind') ? $('fFind').value : '';
    if (!q) { d.note('а что менять-то?'); return; }
    var to = window.prompt('на что менять «' + q + '»?', q);
    if (to == null) return;
    d.replaceAll(q, to);
  });

  /* ==========================================================
     ПАНЕЛЬ ИМПОРТА
     ========================================================== */
  function openDrawer() {
    var p = $('importPanel');
    if (p) p.className = 'drawer open';
  }
  function closeDrawer() {
    var p = $('importPanel');
    if (p) p.className = 'drawer';
  }
  click('impClose', closeDrawer);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeDrawer();
  });

  /* перетаскивание панели за заголовок */
  (function () {
    var p = $('importPanel'), head = p ? p.querySelector('.dr-head') : null;
    if (!p || !head) return;
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    head.onmousedown = function (ev) {
      if (ev.target.id === 'impClose') return;
      var r = p.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = ev.clientX; sy = ev.clientY; on = true;
      ev.preventDefault();
    };
    document.addEventListener('mousemove', function (ev) {
      if (!on) return;
      p.style.left = (ox + ev.clientX - sx) + 'px';
      p.style.top = Math.max(4, oy + ev.clientY - sy) + 'px';
      p.style.transform = 'none';
    });
    document.addEventListener('mouseup', function () { on = false; });
  })();

  /* ==========================================================
     СТАРТ
     ========================================================== */
  function start() {
    var tabs = document.querySelectorAll('.rtab'), k;
    for (k = 0; k < tabs.length; k++) {
      (function (t) {
        t.onclick = function () {
          switchTab(t.getAttribute('data-tab'));
          if (window.MonolitDoc) window.MonolitDoc.beep(540, 0.02);
        };
      })(tabs[k]);
    }
    styleGal();
    pageModeBtns();
    switchTab('home');

    /* лента живая: перерисовываем состояние при смене выделения */
    var pg = $('page');
    if (pg) {
      pg.addEventListener('mouseup', function () { setTimeout(paint, 0); });
      pg.addEventListener('keyup', function () { setTimeout(paint, 0); });
    }
    setTimeout(function () { paint(); zoomLabel(); }, 60);
    setInterval(paint, 700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
