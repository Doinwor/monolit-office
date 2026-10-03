/* ==================================================================
   ПРЕЗЕНТАЦИИ МОНОЛИТ 2000 (beta 0.97) — весь движок в одном файле
   ================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var LS = {
    pres: 'MONOLIT_pres_v2',
    guest: 'MONOLIT_guest_v2',
    hits: 'MONOLIT_hits_v2',
    auto: 'MONOLIT_auto_v2'
  };

  /* виртуальный холст слайда (4:3) — всё рисуется в нём и масштабируется */
  var VW = 800, VH = 450;
  var SAVE_DELAY = 700;   /* автосохранение, мс */
  var UNDO_MAX = 40;

  var DESIGNS = [
    { id: 'd-white', name: 'белый (как в школе)' },
    { id: 'd-blue', name: 'синий с жёлтым (классика)' },
    { id: 'd-green', name: 'тёмно-зелёный (леса)' },
    { id: 'd-gray', name: 'серый казённый' },
    { id: 'd-star', name: 'звёздное небо (вау)' },
    { id: 'd-wave', name: 'водица волнистая' },
    { id: 'd-paper', name: 'бумага в линейку' },
    { id: 'd-red', name: 'красный тревожный' }
  ];
  var FONTS = ["'Comic Sans MS', cursive", "'Times New Roman', serif", 'Impact, fantasy',
    'Arial, Helvetica, sans-serif', "'Courier New', monospace"];
  var TRANS = ['none', 'fade', 'blinds', 'slide', 'zoom', 'blinkit'];

  var DESIGN_OK = {}, FONT_OK = {}, TRANS_OK = {}, i;
  for (i = 0; i < DESIGNS.length; i++) DESIGN_OK[DESIGNS[i].id] = 1;
  for (i = 0; i < FONTS.length; i++) FONT_OK[FONTS[i]] = 1;
  for (i = 0; i < TRANS.length; i++) TRANS_OK[TRANS[i]] = 1;

  var slides = [];
  var sel = -1;
  var selBlk = -1;
  var draft = null;
  var auto = true;
  var dirty = false;
  var showOpen = false;
  var showIdx = 0;
  var undoStack = [];
  var saveTimer = null;
  var rafPending = 0;
  var drawing = false;
  var noteTimer = null;
  var logoReady = false;
  var showTimer = 0;
  var showTimerStart = 0;
  var showBlack = false;
  var showHelp = false;
  var showNotes = false;

  /* ==================================================================
     МЕЛОЧИ
     ================================================================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function hash(s) {
    var h = 0, k; s = String(s);
    for (k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) & 0x7fffffff;
    return h;
  }
  function copy(o) {
    /* глубокая копия: у слайда есть массив блоков, поверхностная копия
     связала бы черновик с сохранённым слайдом и сломала бы отмену */
    if (o === null || typeof o !== 'object') return o;
    var x = (Object.prototype.toString.call(o) === '[object Array]') ? [] : {}, k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) x[k] = copy(o[k]);
    return x;
  }
  function deep(o) { var x = [], k; for (k = 0; k < o.length; k++) x.push(copy(o[k])); return x; }
  function clamp(v, a, b) { v = num(v); if (v < a) v = a; if (v > b) v = b; return v; }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) || !isFinite(n) ? null : n; }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  /* возвращаем номер кадра, иначе отменить уже запланированный нельзя */
  function rAF(fn) {
    if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
    return setTimeout(fn, 16);
  }

  var ac = null;
  function beep(f, d) {
    var box = $('sndOn');
    if (!box || !box.checked) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ac) ac = new AC();
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = f || 880; g.gain.value = 0.02;
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + (d || 0.05));
    } catch (e) { }
  }

  /* ==================================================================
     НОРМАЛИЗАЦИЯ — чужой или битый файл не должен ронять программу
     ================================================================== */
  function norm(s) {
    s = (s && typeof s === 'object') ? s : {};
    var size = clamp(num(s.size) == null ? 24 : num(s.size), 8, 72);
    var design = DESIGN_OK[s.design] ? s.design : 'd-white';
    var font = FONT_OK[s.font] ? s.font : FONTS[1];
    var trans = TRANS_OK[s.trans] ? s.trans : 'none';
    return {
      title: String(s.title == null ? '' : s.title).slice(0, 70),
      text: String(s.text == null ? '' : s.text),
      design: design,
      font: font,
      size: size,
      trans: trans,
      page: s.page !== false && s.page !== 0,
      stamp: s.stamp !== false && s.stamp !== 0,
      notes: String(s.notes == null ? '' : s.notes).slice(0, 5000),
      blocks: normBlocks(s.blocks)
    };
  }
  function blank() {
    return { title: '', text: '', design: 'd-white', font: FONTS[3], size: 24, trans: 'none', page: true, stamp: true, notes: '', blocks: [] };
  }

  /* ==================================================================
     ТЕКСТОВЫЕ БЛОКИ СО СВОБОДНЫМ ПОЛОЖЕНИЕМ НА СЛАЙДЕ
     координаты — проценты от ширины/высоты слайда, поэтому блок
     одинаково живёт в превью, в миниатюре и в показе
     ================================================================== */
  var ALIGNS = ['left', 'center', 'right', 'justify'];
  function normBlock(b) {
    b = (b && typeof b === 'object') ? b : {};
    var ff = FONT_OK[b.ff] ? b.ff : '';
    return {
      x: clamp(num(b.x) == null ? 8 : num(b.x), -20, 120),
      y: clamp(num(b.y) == null ? 30 : num(b.y), -20, 120),
      w: clamp(num(b.w) == null ? 70 : num(b.w), 8, 120),
      h: clamp(num(b.h) == null ? 26 : num(b.h), 5, 120),
      t: String(b.t == null ? '' : b.t).replace(/\r\n/g, '\n').slice(0, 4000),
      s: clamp(num(b.s) == null ? 24 : num(b.s), 8, 96),
      b: b.b ? 1 : 0,
      i: b.i ? 1 : 0,
      u: b.u ? 1 : 0,
      al: ALIGNS.indexOf(b.al) >= 0 ? b.al : 'left',
      c: /^#[0-9a-fA-F]{3,6}$/.test(String(b.c || '')) ? String(b.c) : '',
      ff: ff
    };
  }
  function normBlocks(a) {
    var r = [], k;
    if (Object.prototype.toString.call(a) !== '[object Array]') return r;
    for (k = 0; k < a.length; k++) r.push(normBlock(a[k]));
    return r;
  }
  /* старый слайд (заголовок + текст) превращается в два блока — так ничего
     не теряется при открытии файлов, сделанных до появления блоков */
  function defBlocks(s) {
    var t = String(s.text == null ? '' : s.text), out = [], hasT = !!String(s.title || '').trim();
    if (hasT) {
      out.push(normBlock({ x: 10, y: 8, w: 80, h: 18, t: s.title, s: (s.size || 24) + 8, b: 1, al: 'center' }));
    }
    if (t.trim()) {
      out.push(normBlock({
        x: 10, y: hasT ? 32 : 20, w: 80, h: hasT ? 52 : 62, t: t, s: s.size || 24, al: 'left'
      }));
    }
    return out;
  }
  function blocksOf(s) {
    s = norm(s);
    return s.blocks.length ? s.blocks : defBlocks(s);
  }
  /* заголовок/текст оставляем в синхроне с блоками: на них смотрят
     экспорт .txt/.htm, подписи миниатюр и старые сохранения */
  function syncText(s) {
    var b = blocksOf(s), t = '', k, first = '';
    for (k = 0; k < b.length; k++) {
      if (!String(b[k].t).trim()) continue;
      if (!first) first = String(b[k].t).trim();
      else t += (t ? '\n' : '') + b[k].t;
    }
    s.title = first.slice(0, 70);
    s.text = t;
    return s;
  }
  function normAll(list) {
    var out = [], k;
    if (!list || !list.length) return out;
    for (k = 0; k < list.length; k++) out.push(norm(list[k]));
    return out;
  }
  function designName(id) {
    var k; for (k = 0; k < DESIGNS.length; k++) if (DESIGNS[k].id === id) return DESIGNS[k].name;
    return id;
  }

  /* ==================================================================
     СТАТУС-БАР (создаётся скриптом, в HTML его нет)
     ================================================================== */
  function buildStatus() {
    var host = $('status');
    if (!host || $('stBar')) return;
    var d = document.createElement('div');
    d.className = 'statusbar'; d.id = 'stBar';
    d.innerHTML = '<span id="stName">презентация</span>' +
      '<span id="stCount">слайдов: 0</span>' +
      '<span id="stSel">слайд: —</span>' +
      '<span id="stBlk">блок: —</span>' +
      '<span id="stPos"></span>' +
      '<span id="stZoom">масштаб: 100%</span>' +
      '<span id="stDirty">сохранено</span>' +
      '<span id="stAuto">автосохр: вкл</span>' +
      '<span id="stNote"></span>' +
      '<span id="stClock" style="float:right">--:--:--</span>';
    host.appendChild(d);
  }
  function note(t, sticky) {
    var el = $('stNote');
    if (!el) return;
    el.innerHTML = esc(t);
    if (noteTimer) clearTimeout(noteTimer);
    if (t && !sticky) noteTimer = setTimeout(function () { el.innerHTML = ''; }, 4000);
  }
  function draftDiffers() {
    if (sel < 0 || !draft) return false;
    var a = norm(draft), b = norm(slides[sel]);
    if (a.title !== b.title || a.text !== b.text || a.design !== b.design ||
      a.font !== b.font || a.size !== b.size || a.trans !== b.trans ||
      a.page !== b.page || a.stamp !== b.stamp) return true;
    return JSON.stringify(blocksOf(a)) !== JSON.stringify(blocksOf(b));
  }
  function updateStatus() {
    var nm = $('fName'), d;
    if ($('stName')) $('stName').innerHTML = esc((nm && nm.value) || 'презентация') + ' <b>.mono</b>';
    if ($('stCount')) $('stCount').innerHTML = 'слайдов: ' + slides.length;
    if ($('stSel')) $('stSel').innerHTML = 'слайд: ' + (sel >= 0 ? (sel + 1) : '—');
    if ($('stBlk')) $('stBlk').innerHTML = 'блок: ' + (selBlk >= 0 ? (selBlk + 1) : '—');
    d = $('stDirty');
    if (d) {
      if (draftDiffers()) { d.className = 'rd'; d.innerHTML = 'есть правки'; }
      else if (dirty) { d.className = 'rd'; d.innerHTML = 'НЕ СОХРАНЕНО'; }
      else { d.className = 'gr'; d.innerHTML = 'сохранено'; }
    }
    if ($('stAuto')) $('stAuto').innerHTML = 'автосохр: ' + (auto ? 'вкл' : 'выкл');
  }
  function tick() {
    var el = $('stClock');
    if (el) el.innerHTML = new Date().toLocaleTimeString('ru-RU');
  }

  /* ==================================================================
     ОТМЕНА ДЕЙСТВИЙ (Ctrl+Z)
     ================================================================== */
  function pushUndo(label) {
    undoStack.push({ slides: deep(slides), sel: sel, name: ($('fName') || {}).value || '', label: label || 'изменение' });
    while (undoStack.length > UNDO_MAX) undoStack.shift();
  }
  function undo() {
    var u;
    if (showOpen) { alert('Сначала выйди из показа.'); return; }
    if (!undoStack.length) { note('отменять нечего'); beep(200, 0.1); return; }
    u = undoStack.pop();
    slides = u.slides; sel = u.sel;
    if ($('fName')) $('fName').value = u.name;
    if (sel >= 0 && sel < slides.length) { draft = copy(slides[sel]); fillForm(draft); }
    else if (sel >= slides.length) { sel = slides.length ? slides.length - 1 : -1; draft = sel >= 0 ? copy(slides[sel]) : blank(); fillForm(draft); }
    else { sel = -1; draft = blank(); fillForm(draft); }
    dirty = true;
    renderAll();
    queueSave();
    note('отменено: ' + u.label);
    beep(320, 0.08);
  }

  /* ==================================================================
     ХРАНИЛИЩЕ
     ================================================================== */
  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    var nm = $('fName');
    var payload = {
      app: 'MONOLIT-2000', v: 2, at: new Date().toISOString(),
      name: (nm && nm.value) || 'Моя презентация', slides: slides
    };
    if (lsSet(LS.pres, JSON.stringify(payload))) { dirty = false; updateStatus(); return true; }
    return false;
  }
  function queueSave() {
    dirty = true;
    updateStatus();
    if (!auto) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY);
  }
  function loadStored() {
    var raw = lsGet(LS.pres);
    if (!raw) return false;
    try {
      var o = JSON.parse(raw);
      if (!o || !o.slides || !o.slides.length) return false;
      slides = normAll(o.slides);
      if (o.name && $('fName')) $('fName').value = o.name;
      return true;
    } catch (e) { return false; }
  }
  function loadAutoFlag() {
    var v = lsGet(LS.auto);
    auto = (v === null) ? true : (v !== 'off');
  }
  function saveAutoFlag() { lsSet(LS.auto, auto ? 'on' : 'off'); }

  /* ==================================================================
     РЕНДЕР СЛАЙДА
     ================================================================== */
  function niceText(t) {
    return String(t == null ? '' : t).replace(/\r\n/g, '\n').split('\n').map(function (ln) {
      var isBullet = /^\s*[-*•●▪>]\s*/.test(ln);
      return (isBullet ? '• ' : '') + ln.replace(/^\s*[-*•●▪>]\s*/, '');
    }).join('\n');
  }
  function blockMarkup(b, i, editable) {
    /* рамка (и положение) — на .blk, оформление текста — на .btx */
    var pos = 'left:' + b.x + '%;top:' + b.y + '%;width:' + b.w + '%;height:' + b.h + '%;';
    var css = 'font-size:' + b.s + 'px;';
    if (b.ff) css += 'font-family:' + esc(b.ff) + ';';
    if (b.b) css += 'font-weight:bold;';
    if (b.i) css += 'font-style:italic;';
    if (b.u) css += 'text-decoration:underline;';
    if (b.al !== 'left') css += 'text-align:' + b.al + ';';
    if (b.c) css += 'color:' + b.c + ';';
    var cls = 'blk' + (editable ? ' ed' : '') + (editable && i === selBlk ? ' sel' : '') +
      (!String(b.t).trim() ? ' empty' : '');
    /* полоска перетаскивания и уголок размера есть только при редактировании;
       текст всегда в .btx, поэтому в показе блок выглядит так же */
    return '<div class="' + cls + '" data-b="' + i + '" style="' + pos + '">' +
      (editable ? '<div class="bbar" contenteditable="false" data-g="' + i + '"></div>' : '') +
      '<div class="btx"' + (editable ? ' contenteditable="true" spellcheck="false"' : '') +
      ' style="' + css + '">' + esc(b.t) + '</div>' +
      (editable ? '<div class="bhand" contenteditable="false"></div>' : '') +
      '</div>';
  }
  function slideMarkup(s, num, total, editable) {
    s = norm(s);
    var showPn = s.page !== false && total > 1;
    var showSt = s.stamp !== false;
    var bs = blocksOf(s), h = '', k;
    for (k = 0; k < bs.length; k++) h += blockMarkup(bs[k], k, editable);
    return '<div class="si ' + esc(s.design) + (editable ? ' editing' : '') + '" data-i="' + num +
      '" style="width:' + VW + 'px;height:' + VH + 'px;font-size:' + s.size + 'px;font-family:' +
      esc(s.font) + '">' + h +
      (showPn ? '<div class="pn">' + num + ' / ' + total + '</div>' : '') +
      (showSt ? '<div class="st">сделано в МОНОЛИТ 2000</div>' : '') +
      '</div>';
  }
  /* Вписывает слайд целиком: и по ширине, и по высоте, чтобы он
     всегда был в кадре и ничего не убегало за край окна. */
  function mount(el, s, num, total, fallbackW, editable) {
    if (!el) return 1;
    el.innerHTML = slideMarkup(s, num, total, editable);
    var inner = el.firstChild;
    var wrap = el.parentNode;
    var w = el.clientWidth || fallbackW || 0;
    var h = 0, k = w ? w / VW : 1;
    /* если есть свободная высота — ужимаем ещё и по ней */
    if (wrap && wrap.clientHeight) {
      var free = wrap.clientHeight - 28; /* отступы .stagewrap */
      if (free > 60) {
        var kh = free / VH;
        if (kh < k) k = kh;
      }
    }
    h = Math.round(VH * k);
    if (inner) {
      inner.style.transform = 'scale(' + k + ')';
      inner.style.transformOrigin = 'left top';
    }
    el.style.height = h + 'px';
    el.style.width = Math.round(VW * k) + 'px';
    return k;
  }
  function drawCanvas() {
    /* рисуем сразу: в headless и на скрытой вкладке кадр от rAF может не
       прийти, и слайд остался бы старым. Глубину рекурсии бережём. */
    if (drawing) return;
    drawing = true;
    try {
      var s = draft || readForm();
      var k = mount($('canvas'), s, sel >= 0 ? sel + 1 : 1, Math.max(1, slides.length), 380, true);
      if ($('zoomOut')) $('zoomOut').innerHTML = Math.round(k * 100);
      if ($('stZoom')) $('stZoom').innerHTML = 'масштаб: ' + Math.round(k * 100) + '%';
      wireStage();
    } finally { drawing = false; }
  }

  /* ==================================================================
     ПРЯМОЕ РЕДАКТИРОВАНИЕ СЛАЙДА: пишем по слайду, двигаем блоки
     ================================================================== */
  var stageWired = false;
  var drag = null;
  var dragSlideIdx = -1;
  var liveTimer = null;
  

  function blkEl(i) {
    var host = $('canvas');
    if (!host) return null;
    return host.querySelector('.blk[data-b="' + i + '"]');
  }
  function blkAt(i) {
    var b = liveBlocks();
    return (i >= 0 && i < b.length) ? b[i] : null;
  }
  function stageSlide() {
    var h = $('canvas');
    return h ? h.firstChild : null;
  }
  function evToSlide(e) {
    var si = stageSlide(), r;
    if (!si) return { x: 12, y: 20 };
    try { r = si.getBoundingClientRect(); } catch (err) { r = null; }
    if (!r || !r.width || !r.height) return { x: 12, y: 20 };
    return {
      x: clamp((e.clientX - r.left) / r.width * 100, 0, 92),
      y: clamp((e.clientY - r.top) / r.height * 100, 0, 88)
    };
  }
  function stageEvents(host) {
    host.addEventListener('mousedown', onStageDown, false);
    host.addEventListener('dblclick', onStageDbl, false);
    host.addEventListener('input', onStageInput, false);
    host.addEventListener('keydown', onStageKey, false);
    window.addEventListener('mousemove', onDragMove, false);
    window.addEventListener('mouseup', onDragUp, false);
  }
  function wireStage() {
    var host = $('canvas');
    if (!host) return;
    if (!stageWired) { stageWired = true; stageEvents(host); }
    paintBlk();
  }
  function markEmpty() {
    var host = $('canvas'), bs, k, t;
    if (!host) return;
    bs = host.querySelectorAll('.blk');
    for (k = 0; k < bs.length; k++) {
      t = bs[k].querySelector('.btx');
      if (!t) continue;
      if (String(t.textContent || '').trim()) bs[k].className = String(bs[k].className).replace(' empty', '');
      else if (bs[k].className.indexOf('empty') < 0) bs[k].className += ' empty';
    }
  }
  function paintBlk() {
    var host = $('canvas'), bs, k;
    if (!host) return;
    bs = host.querySelectorAll('.blk');
    for (k = 0; k < bs.length; k++) {
      /* класс перетаскивания не теряем, иначе блок мигает при отрисовке */
      bs[k].className = 'blk ed' + (num(bs[k].getAttribute('data-b')) === selBlk ? ' sel' : '') +
        (String(bs[k].className).indexOf('dragging') >= 0 ? ' dragging' : '');
    }
    markEmpty();
    if ($('stBlk')) $('stBlk').innerHTML = selBlk >= 0 ? 'блок: ' + (selBlk + 1) : 'блок: —';
    if (window.MonolitPres && window.MonolitPres.paint) window.MonolitPres.paint();
  }
  function onStageDown(e) {
    var t = e.target, orig = e.target, el = null, i, b;
    while (t && t !== $('canvas')) {
      if (t.className && String(t.className).indexOf('blk') === 0) { el = t; break; }
      t = t.parentNode;
    }
    if (!el) {                       /* кликнули мимо блоков — снимаем выделение */
      if (selBlk !== -1) { selBlk = -1; paintBlk(); }
      return;
    }
    i = num(el.getAttribute('data-b'));
    b = blkAt(i);
    if (selBlk !== i) { selBlk = i; paintBlk(); }
    if (!b) return;
    /* что именно схватили: полоску (перенос) или уголок (размер).
       сверху обходили DOM, поэтому здесь смотрим исходную цель события */
    var mode = null, cn = (orig && orig.className) ? String(orig.className) : '';
    if (cn.indexOf('bbar') >= 0 || cn.indexOf('grip') >= 0) mode = 'move';
    else if (cn.indexOf('bhand') >= 0) mode = 'size';
    if (!mode) return;
    e.preventDefault();
    e.stopPropagation();
    var si = stageSlide(), r = null;
    if (si) { try { r = si.getBoundingClientRect(); } catch (err) { r = null; } }
    pushUndo(mode === 'move' ? 'перенос блока' : 'размер блока');
    drag = {
      mode: mode, i: i, mx: e.clientX, my: e.clientY,
      x0: b.x, y0: b.y, w0: b.w, h0: b.h,
      rw: r && r.width ? r.width : VW, rh: r && r.height ? r.height : VH
    };
    el.className = (el.className || 'blk ed') + ' dragging';
  }
  function onDragMove(e) {
    var b, dx, dy, el;
    if (!drag) return;
    b = blkAt(drag.i);
    if (!b) return;
    dx = (e.clientX - drag.mx) / (drag.rw || VW) * 100;
    dy = (e.clientY - drag.my) / (drag.rh || VH) * 100;
    e.preventDefault();
    if (drag.mode === 'move') {
      b.x = clamp(Math.round((drag.x0 + dx) * 10) / 10, -20, 120);
      b.y = clamp(Math.round((drag.y0 + dy) * 10) / 10, -20, 120);
      snapBlock(b, drag.i);
    } else {
      b.w = clamp(Math.round((drag.w0 + dx) * 10) / 10, 8, 120);
      b.h = clamp(Math.round((drag.h0 + dy) * 10) / 10, 5, 120);
    }
    el = blkEl(drag.i);
    if (el) {
      el.style.left = b.x + '%';
      el.style.top = b.y + '%';
      el.style.width = b.w + '%';
      el.style.height = b.h + '%';
    }
    if ($('stPos')) $('stPos').innerHTML = 'x ' + Math.round(b.x) + '% · y ' + Math.round(b.y) + '%';
  }
  function onDragUp() {
    var el;
    if (!drag) return;
    el = blkEl(drag.i);
    if (el) el.className = String(el.className || '').replace(' dragging', '');
    drag = null;
    clearGuides();
    applyDraft();
    beep(900, 0.04);
  }
  /* направляющие и привязка блока к центру слайда и краям других блоков */
  function clearGuides() {
    var st = stageSlide(), gs, k;
    if (!st) return;
    gs = st.querySelectorAll('.guide');
    for (k = 0; k < gs.length; k++) if (gs[k].parentNode) gs[k].parentNode.removeChild(gs[k]);
  }
  function guideLine(axis, pos) {
    var st = stageSlide(), cls, g;
    if (!st) return;
    cls = 'guide g-' + axis;
    g = st.querySelector('.' + cls);
    if (!g) { g = document.createElement('div'); g.className = cls; st.appendChild(g); }
    if (axis === 'v') { g.style.left = pos + '%'; g.style.top = '0'; g.style.height = '100%'; g.style.width = '1px'; }
    else { g.style.top = pos + '%'; g.style.left = '0'; g.style.width = '100%'; g.style.height = '1px'; }
  }
  function snapAxis(pos, size, targets, thr) {
    var pts = [0, size / 2, size], best = null, t, p, cur, d;
    for (t = 0; t < targets.length; t++) {
      for (p = 0; p < pts.length; p++) {
        cur = pos + pts[p];
        d = targets[t] - cur;
        if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, g: targets[t] };
      }
    }
    return best;
  }
  function snapBlock(b, i) {
    var bs = liveBlocks(), vt = [50], ht = [50], k, o, sv, sh;
    for (k = 0; k < bs.length; k++) {
      if (k === i) continue;
      o = bs[k];
      vt.push(o.x, o.x + o.w / 2, o.x + o.w);
      ht.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    clearGuides();
    sv = snapAxis(b.x, b.w, vt, 1.6);
    sh = snapAxis(b.y, b.h, ht, 1.6);
    if (sv) { b.x = clamp(Math.round((b.x + sv.d) * 10) / 10, -20, 120); guideLine('v', sv.g); }
    if (sh) { b.y = clamp(Math.round((b.y + sh.d) * 10) / 10, -20, 120); guideLine('h', sh.g); }
  }
  function onStageDbl(e) {
    var t = e.target, el = null, p;
    while (t && t !== $('canvas')) {
      if (t.className && String(t.className).indexOf('blk') === 0) { el = t; break; }
      t = t.parentNode;
    }
    if (el) {                       /* двойной клик по блоку — просто печатать */
      var tx = el.querySelector('.btx');
      if (tx) { try { tx.focus(); } catch (err) { } }
      return;
    }
    if (sel < 0) { note('сначала выбери или создай слайд'); return; }
    p = evToSlide(e);
    addBlock(p.x, p.y);
  }
  function onStageInput(e) {
    var t = e.target, b, el;
    if (!t || !t.className || String(t.className).indexOf('btx') !== 0) return;
    el = t.parentNode;
    b = blkAt(num(el.getAttribute('data-b')));
    if (!b) return;
    b.t = String(t.textContent || '').replace(/\r\n/g, '\n');
    if (String(b.t).trim()) el.className = String(el.className).replace(' empty', '');
    else if (String(el.className).indexOf('empty') < 0) el.className += ' empty';
    draftDirty();
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { liveTimer = null; applyDraft(); }, 260);
  }
  function onStageKey(e) {
    var k = e.keyCode, t = e.target, el, b;
    if (sel < 0) return;
    if (k === 27) {                 /* Esc — выйти из текста */
      if (t && t.blur) t.blur();
      paintBlk();
      return;
    }
    if (k === 13 && t && String(t.className).indexOf('btx') === 0) {
      e.preventDefault();
      if (!document.execCommand) return;
      document.execCommand('insertText', false, '\n');
      return;
    }
    if (k === 13 && e.ctrlKey) { e.preventDefault(); addBlock(); return; }
    if (k === 46 && e.ctrlKey && selBlk >= 0) { e.preventDefault(); delBlock(); return; }
    if (selBlk < 0) return;
    /* стрелки двигают блок, когда текст не печатается */
    if (t && String(t.className).indexOf('btx') === 0) return;
    b = blkAt(selBlk);
    if (!b) return;
    var step = e.shiftKey ? 0.3 : (e.ctrlKey ? 5 : 1), used = true;
    if (k === 37) b.x = clamp(b.x - step, -20, 120);
    else if (k === 39) b.x = clamp(b.x + step, -20, 120);
    else if (k === 38) b.y = clamp(b.y - step, -20, 120);
    else if (k === 40) b.y = clamp(b.y + step, -20, 120);
    else used = false;
    if (used) {
      e.preventDefault();
      var el2 = blkEl(selBlk);
      if (el2) { el2.style.left = b.x + '%'; el2.style.top = b.y + '%'; }
      applyDraft();
    }
  }
  /* --- операции над блоками --- */
  function draftDirty() {
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
    var d = readForm();
    d.title = ''; d.text = '';
    syncText(d);
    draft = d;
    thumbNow();
    updateStatus();
  }
  function applyDraft(quiet) {
    if (sel < 0) return false;
    var d = readForm();
    syncText(d);
    slides[sel] = norm(d);
    draft = copy(slides[sel]);
    queueSave();
    updateStatus();
    if (!quiet) thumbNow();
    return true;
  }
  function thumbNow() {
    var t = $('thumbs'), th, mn, cap;
    if (sel < 0 || !t) return;
    th = t.children[sel];
    if (!th) return;
    mn = th.querySelector('.mini');
    if (mn) mount(mn, draft || slides[sel], sel + 1, Math.max(1, slides.length), 200);
    cap = th.querySelector('.cap');
    if (cap && draft) cap.innerHTML = esc(draft.title || '(без заголовка)');
  }
  function addBlock(x, y) {
    var s, k;
    if (sel < 0) { note('сначала выбери или создай слайд'); beep(200, 0.1); return -1; }
    pushUndo('новый блок');
    s = readForm();
    s.blocks = liveBlocks().slice();
    k = s.blocks.length;
    s.blocks.push(normBlock({
      x: x == null ? 12 : x, y: y == null ? 20 : y, w: 62, h: 18, t: '',
      s: (draft && draft.size) || 24
    }));
    draft = s;
    selBlk = k;
    applyDraft();
    drawCanvas();
    note('добавлен блок ' + (k + 1) + ' — пиши прямо на слайде');
    beep(1250, 0.06);
    return k;
  }
  function delBlock() {
    var s, b;
    if (sel < 0 || selBlk < 0) { note('блок не выбран'); return; }
    b = blkAt(selBlk);
    pushUndo('удаление блока');
    s = readForm();
    s.blocks = liveBlocks().slice();
    s.blocks.splice(selBlk, 1);
    draft = s;
    selBlk = Math.min(selBlk, s.blocks.length - 1);
    applyDraft();
    drawCanvas();
    note('блок удалён' + (b ? '' : ''));
    beep(240, 0.12);
  }
  /* оформление выбранного блока из ленты */
  function blkPatch(p, label) {
    var b, k;
    if (sel < 0 || selBlk < 0) { note('сначала выбери блок на слайде'); return false; }
    b = blkAt(selBlk);
    if (!b) return false;
    pushUndo(label || 'оформление блока');
    for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) b[k] = normBlockPatch(k, p[k]);
    applyDraft();
    drawCanvas();
    return true;
  }
  function normBlockPatch(k, v) {
    if (k === 's') return clamp(num(v) || 24, 8, 96);
    if (k === 'al') return ALIGNS.indexOf(v) >= 0 ? v : 'left';
    if (k === 'c') return /^#[0-9a-fA-F]{3,6}$/.test(String(v || '')) ? String(v) : '';
    if (k === 'ff') return FONT_OK[v] ? v : '';
    if (k === 'x' || k === 'y') return clamp(num(v) || 0, -20, 120);
    if (k === 'w') return clamp(num(v) || 70, 8, 120);
    if (k === 'h') return clamp(num(v) || 26, 5, 120);
    return v;
  }
  function blkAlign(a) {
    var b = blkAt(selBlk);
    if (!b) return false;
    return blkPatch({ al: a }, 'выравнивание блока');
  }
  function blkMark(kind) {
    var b = blkAt(selBlk);
    if (!b) { note('сначала выбери блок на слайде'); return false; }
    return blkPatch(kind === 'b' ? { b: b.b ? 0 : 1 } : kind === 'i' ? { i: b.i ? 0 : 1 } : { u: b.u ? 0 : 1 },
      'начертание блока');
  }
  function blkFont(ff) {
    return blkPatch({ ff: ff }, 'шрифт блока');
  }
  function blkColor(c) {
    return blkPatch({ c: c }, 'цвет блока');
  }
  function blkSize(v) {
    var b = blkAt(selBlk);
    if (!b) { note('сначала выбери блок на слайде'); return false; }
    return blkPatch({ s: clamp(num(v) || b.s, 8, 96) }, 'кегль блока');
  }
  /* автоподгон: уменьшаем кегль блока, пока весь текст не влезет в рамку */
  function autofitBlock() {
    var b, el, tx, guard = 0, base;
    if (sel < 0 || selBlk < 0) { note('сначала выбери блок на слайде'); return false; }
    b = blkAt(selBlk);
    el = blkEl(selBlk);
    if (!b || !el) return false;
    tx = el.querySelector('.btx');
    if (!tx) return false;
    pushUndo('автоподгон текста');
    base = b.s;
    while (guard++ < 96) {
      if (tx.scrollHeight <= tx.clientHeight + 1 && tx.scrollWidth <= tx.clientWidth + 1) break;
      if (b.s <= 8) break;
      b.s -= 1;
      tx.style.fontSize = b.s + 'px';
    }
    applyDraft();
    drawCanvas();
    note('автоподгон: кегль ' + base + ' → ' + b.s + ' pt');
    return true;
  }

  /* ==================================================================
     СПИСОК СЛАЙДОВ СЛЕВА
     ================================================================== */
  function renderList() {
    var box = $('thumbs');
    if (!box) return;
    var h = '', k;
    for (k = 0; k < slides.length; k++) {
      h += '<div class="thumb' + (k === sel ? ' sel' : '') + '" data-i="' + k + '">' +
        '<div class="num">' + (k + 1) + '</div><div class="mini"></div>' +
        '<div class="cap">' + esc(slides[k].title || '(без заголовка)') + '</div></div>';
    }
    box.innerHTML = h;
    var kids = box.children;
    for (k = 0; k < kids.length; k++) {
      (function (k) {
        var kid = kids[k];
        mount(kid.querySelector('.mini'), slides[k], k + 1, slides.length, 200);
        kid.onclick = function () { select(k); beep(700); };
        /* перетаскивание слайда вверх/вниз по списку */
        kid.setAttribute('draggable', 'true');
        kid.addEventListener('dragstart', function (ev) {
          dragSlideIdx = k;
          if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', String(k)); } catch (e) { } }
          kid.className = String(kid.className).replace(/\s*dragging\b/, '') + ' dragging';
        });
        kid.addEventListener('dragend', function () {
          kid.className = String(kid.className).replace(/\s*dragging\b/, '');
        });
        kid.addEventListener('dragover', function (ev) { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'; });
        kid.addEventListener('drop', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          reorderSlide(dragSlideIdx, k);
        });
      })(k);
    }
    if ($('cnt')) $('cnt').innerHTML = slides.length;
    if ($('emptyNote')) $('emptyNote').style.display = slides.length ? 'none' : 'block';
    ['btnDup', 'btnUp', 'btnDown', 'btnDel', 'btnRevert'].forEach(function (id) {
      var b = $(id); if (b) b.disabled = (sel < 0);
    });
    ['btnUp'].forEach(function (id) { var b = $(id); if (b) b.disabled = (sel <= 0); });
    ['btnDown'].forEach(function (id) { var b = $(id); if (b) b.disabled = (sel < 0 || sel >= slides.length - 1); });
    ['btnShow', 'btnSaveMono', 'btnSaveHtm', 'btnSaveTxt'].forEach(function (id) {
      var b = $(id); if (b) b.disabled = !slides.length;
    });
  }

  function select(i) {
    sel = (i >= 0 && i < slides.length) ? i : -1;
    draft = sel >= 0 ? copy(slides[sel]) : blank();
    fillForm(draft);
    if ($('ctorTitle')) $('ctorTitle').innerHTML = sel >= 0
      ? 'КОНСТРУКТОР — редактор слайда ' + (sel + 1) + ' из ' + slides.length
      : 'КОНСТРУКТОР — слайд не выбран';
    if ($('editNote')) $('editNote').innerHTML = sel >= 0
      ? '(выбран слайд ' + (sel + 1) + ') — пиши прямо на слайде' : '(ничего не выбрано — жми «Создать слайд»)';
    renderAll();
  }
  function renderAll() {
    renderList();
    drawCanvas();
    updateStatus();
  }

  /* ==================================================================
     КОНСТРУКТОР
     ================================================================== */
  function curBlocks() {
    if (sel < 0) return [];
    return blocksOf(draft || blank());
  }
  /* живой массив блоков черновика — без копий, иначе правка текста и
     перетаскивание меняли бы временный объект и пропадали бы */
  function liveBlocks() {
    var d;
    if (sel < 0) return [];
    d = draft || blank();
    if (!d.blocks || !d.blocks.length) d.blocks = defBlocks(d);
    return d.blocks;
  }
  function readForm() {
    var s = draft || blank();
    var dz = $('fDesign'), ff = $('fFont'), fz = $('fSize'), tr = $('fTrans');
    return {
      title: s.title,
      text: s.text,
      blocks: curBlocks(),
      design: dz ? dz.value : s.design,
      font: ff ? ff.value : s.font,
      size: clamp(parseInt(fz ? fz.value : s.size, 10) || s.size, 8, 72),
      trans: tr ? tr.value : s.trans,
      page: $('fPage') ? $('fPage').checked : s.page,
      stamp: $('fStamp') ? $('fStamp').checked : s.stamp,
      notes: $('fNotes') ? String($('fNotes').value) : (s.notes || '')
    };
  }
  function fillForm(s) {
    s = norm(s);
    /* старый слайд без блоков сразу получает блоки — редактировать можно всё */
    s = syncText(s);
    if (!s.blocks.length && (s.title || s.text)) s.blocks = defBlocks(s);
    draft = s;
    if ($('fTitle')) $('fTitle').value = s.title;
    if ($('fText')) $('fText').value = s.text;
    if ($('fDesign')) $('fDesign').value = s.design;
    if ($('fFont')) $('fFont').value = s.font;
    if ($('fSize')) $('fSize').value = s.size;
    if ($('fTrans')) $('fTrans').value = s.trans;
    if ($('fPage')) $('fPage').checked = s.page;
    if ($('fStamp')) $('fStamp').checked = s.stamp;
    if ($('fNotes')) $('fNotes').value = s.notes || '';
    if ($('sizeOut')) $('sizeOut').innerHTML = s.size;
    selBlk = s.blocks.length ? 0 : -1;
    updateStatus();
  }
  function onFormChange(e) {
    var d = readForm(), id = (e && e.target && e.target.id) || '';
    /* если правили старое поле заголовка/текста — пересобираем блоки */
    if (id === 'fTitle' || id === 'fText') {
      d.blocks = [];
      if (d.title || d.text) d.blocks = defBlocks(d);
      draft = d;
      selBlk = d.blocks.length ? 0 : -1;
      drawCanvas();
      thumbNow();
      updateStatus();
      return;
    }
    draft = d;
    if ($('sizeOut')) $('sizeOut').innerHTML = $('fSize').value;
    if (id === 'fSize') {
      /* «кегль слайда» меняет все блоки, у которых свой размер не трогали */
      var bs = curBlocks(), k;
      for (k = 0; k < bs.length; k++) if (bs[k].s) bs[k].s = clamp(parseInt($('fSize').value, 10) || 24, 8, 96);
      draft.blocks = bs;
    }
    if (id === 'fDesign' || id === 'fFont' || id === 'fTrans' || id === 'fPage' || id === 'fStamp' || id === 'fNotes') {
      applyDraft();
    }
    drawCanvas();
    thumbNow();
    updateStatus();
  }
  function apply() {
    if (sel < 0) { alert('Слайд не выбран. Жми «Создать слайд».'); return; }
    var d = readForm();
    if (!d.blocks.length) {
      if (!confirm('Слайд совсем пустой. Всё равно применить?')) return;
    }
    pushUndo('правка слайда ' + (sel + 1));
    syncText(d);
    slides[sel] = norm(d);
    draft = copy(slides[sel]);
    fillForm(draft);
    renderAll();
    queueSave();
    if ($('editNote')) $('editNote').innerHTML = '(применено ' + new Date().toLocaleTimeString('ru-RU') + ')';
    note('применено к слайду ' + (sel + 1));
    beep(1300, 0.08);
  }
  function newSlide() {
    if (showOpen) { alert('Сначала выйди из показа.'); return; }
    pushUndo('новый слайд');
    var s = norm({
      title: 'Слайд ' + (slides.length + 1), text: '', design: 'd-white', font: FONTS[1],
      size: 24, trans: 'none', page: true, stamp: true
    });
    s.blocks = defBlocks({ title: s.title, text: '', size: s.size });
    var at = (sel >= 0) ? sel + 1 : slides.length;
    slides.splice(at, 0, s);
    sel = at;
    draft = copy(s);
    fillForm(draft);
    if ($('ctorTitle')) $('ctorTitle').innerHTML = 'КОНСТРУКТОР — новый слайд ' + (sel + 1);
    if ($('editNote')) $('editNote').innerHTML = '(новый слайд — пиши прямо на слайде)';
    renderAll(); queueSave(); note('добавлен слайд ' + (sel + 1)); beep(1000);
  }
  function addAfter() {
    if (showOpen) { alert('Сначала выйди из показа.'); return; }
    var s = readForm();
    if (!s.blocks.length) { alert('Пустой слайд не нужен. Напиши хоть что-нибудь.'); return; }
    pushUndo('вставка слайда');
    syncText(s);
    s = norm(s);
    var at = (sel >= 0) ? sel + 1 : slides.length;
    slides.splice(at, 0, s);
    sel = at;
    draft = copy(s);
    fillForm(draft);
    renderAll(); queueSave(); note('вставлен слайд ' + (sel + 1)); beep(1100);
  }
  function revert() {
    if (sel < 0) { alert('Нечего отменять — слайд не выбран.'); return; }
    draft = copy(slides[sel]);
    fillForm(draft);
    drawCanvas();
    var t = $('thumbs') && $('thumbs').children[sel];
    if (t) {
      mount(t.querySelector('.mini'), slides[sel], sel + 1, Math.max(1, slides.length), 200);
      var cap = t.querySelector('.cap');
      if (cap) cap.innerHTML = esc(slides[sel].title || '(без заголовка)');
    }
    if ($('editNote')) $('editNote').innerHTML = '(правки отменены, слайд вернулся к сохранённому)';
    updateStatus();
    note('правки отменены');
    beep(420, 0.08);
  }
  function clearAll(quiet) {
    if (showOpen) { if (!quiet) alert('Показ идёт. Сначала выйди (ESC), потом стирай.'); return false; }
    if (!slides.length) { if (!quiet) alert('И так пусто.'); return false; }
    if (!quiet && !confirm('СТЕРЕТЬ ВСЮ презентацию (' + slides.length + ' слайдов)?\nCtrl+Z сможет вернуть.')) return false;
    pushUndo('стёрто всё');
    slides = [];
    sel = -1;
    draft = blank();
    fillForm(draft);
    if ($('ctorTitle')) $('ctorTitle').innerHTML = 'КОНСТРУКТОР — слайд не выбран';
    if ($('editNote')) $('editNote').innerHTML = '(ничего не выбрано — жми СОЗДАТЬ)';
    renderAll(); queueSave(); beep(180, 0.3);
    note('презентация стёрта. Ctrl+Z — вернуть');
    return true;
  }
  function dupSlide() {
    if (sel < 0 || showOpen) return;
    pushUndo('копия слайда');
    slides.splice(sel + 1, 0, copy(slides[sel]));
    select(sel + 1);
    queueSave(); note('копия слайда ' + (sel + 1)); beep(880);
  }
  function moveSlide(d) {
    if (sel < 0 || showOpen) return;
    var to = sel + d;
    if (to < 0 || to > slides.length - 1) return;
    pushUndo('порядок слайдов');
    slides.splice(to, 0, slides.splice(sel, 1)[0]);
    select(to);
    queueSave(); note('слайд ' + (to + 1)); beep(720);
  }
  function reorderSlide(from, to) {
    if (showOpen || from < 0 || to < 0 || from === to) return;
    if (from >= slides.length || to >= slides.length) return;
    pushUndo('перетаскивание слайда');
    slides.splice(to, 0, slides.splice(from, 1)[0]);
    select(to);
    queueSave();
    note('слайд переставлен: ' + (from + 1) + ' → ' + (to + 1));
    beep(720);
  }
  function delSlide() {
    if (sel < 0) return;
    if (showOpen) { alert('Сначала выйди из показа (ESC).'); return; }
    if (!confirm('Удалить слайд ' + (sel + 1) + '?\nCtrl+Z сможет вернуть.')) return;
    pushUndo('удаление слайда ' + (sel + 1));
    slides.splice(sel, 1);
    sel = slides.length ? Math.min(sel, slides.length - 1) : -1;
    draft = sel >= 0 ? copy(slides[sel]) : blank();
    fillForm(draft);
    if (sel < 0 && $('ctorTitle')) $('ctorTitle').innerHTML = 'КОНСТРУКТОР — слайд не выбран';
    renderAll(); queueSave(); note('удалён слайд'); beep(220, 0.2);
  }

  /* ==================================================================
     СОХРАНЕНИЕ / ЭКСПОРТ
     ================================================================== */
  function download(name, text, mime) {
    try {
      var blob = new Blob(['\ufeff' + text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var u = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = u; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(u); }, 400);
      return true;
    } catch (e) {
      alert('Браузер не даёт сохранить файл. Попробуй Chrome или сохрани вручную.');
      return false;
    }
  }
  function safeName() {
    var v = ($('fName') && $('fName').value) || 'презентация';
    return v.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  }
  function haveSlides() {
    if (slides.length) return true;
    alert('Нечего сохранять: слайдов ноль.\nСначала создай слайд.');
    return false;
  }
  function exportData(extra) {
    var o = {
      app: 'MONOLIT-2000', v: 2,
      name: ($('fName') && $('fName').value) || 'Моя презентация',
      exported: new Date().toLocaleString('ru-RU'),
      slides: normAll(slides)
    };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }
  function saveMono() {
    if (!haveSlides()) return;
    if (download(safeName() + '.mono', JSON.stringify(exportData(), null, 1), 'application/octet-stream')) {
      dirty = false; updateStatus();
      note('сохранено: ' + safeName() + '.mono');
      beep(1500, 0.1);
    }
  }
  function saveTxt() {
    if (!haveSlides()) return;
    var t = 'ПРЕЗЕНТАЦИЯ: ' + (($('fName') && $('fName').value) || '') +
      '\r\nсделано в ПРЕЗЕНТАЦИИ МОНОЛИТ 2000\r\n' +
      '================================================\r\n\r\n';
    slides.forEach(function (s, k) {
      t += '--- слайд ' + (k + 1) + ' ---\r\n' + (s.title || '') + '\r\n' + (s.text || '') + '\r\n\r\n';
    });
    download(safeName() + '.txt', t, 'text/plain');
    note('сохранено: .txt');
  }

  /* --- автономный плеер для .htm --- */
  var PLAYER_CSS = [
    '*{box-sizing:border-box}',
    'body{background:#000;color:#eee;font-family:Tahoma,Verdana,sans-serif;font-size:11px;',
    'text-align:center;margin:0;padding:18px 0 60px}',
    '#s{position:relative;width:min(760px,94%);height:min(428px,64vh);margin:0 auto;padding:5% 6%;',
    'border:8px ridge #c0c0c0;overflow:hidden;text-align:left}',
    '#s h1{margin:0 0 3% 0;text-align:center;border-bottom:3px double currentColor;padding-bottom:2%;',
    'font-size:1.6em;line-height:1.15}',
    '#s .b{white-space:pre-wrap;word-wrap:break-word;line-height:1.45;font-size:1em}',
    '#s .pn{position:absolute;right:2%;bottom:2%;font-family:Courier New,monospace;font-size:.55em;opacity:.8}',
    '#s .st{position:absolute;left:2%;bottom:2%;font-family:Courier New,monospace;font-size:.45em;opacity:.6}',
    '.bar{position:fixed;left:0;bottom:0;width:100%;background:#c0c0c0;border-top:3px outset #dfdfdf;',
    'padding:6px;color:#000;font-family:Tahoma,Verdana,sans-serif}',
    '.bar b{font-family:Courier New,monospace;font-size:12px}',
    '.bar button{font-family:Tahoma,sans-serif;font-size:11px;border:2px outset #dfdfdf;',
    'background:#c0c0c0;padding:3px 12px;cursor:pointer;margin:0 4px}',
    '.hint{display:block;margin-top:3px;font-size:10px}',
    '.d-white{background:#fff;color:#000}.d-blue{background:#000080;color:#ff0}',
    '.d-green{background:#006400;color:#cfc}.d-gray{background:#808080;color:#fff}',
    '.d-star{background:#000040;color:#fff;background-image:radial-gradient(#fff 1px,transparent 1px);',
    'background-size:24px 24px}',
    '.d-wave{background:linear-gradient(180deg,#5ff 0,#0080c0 55%,#004060 100%);color:#002040}',
    '.d-paper{background:#ffe;color:#400;background-image:repeating-linear-gradient(0deg,transparent,',
    'transparent 22px,#e0c0a0 23px)}',
    '.d-red{background:#8b0000;color:#ffeb3b}'
  ];
  var PLAYER_JS = [
    'var D=JSON.parse(document.getElementById("mono").textContent),S=D.slides||[],',
    'i=0,el=document.getElementById("s"),B=String.fromCharCode(8226);',
    'function esc2(s){return String(s==null?"":s);}',
    'function nice(t){return esc2(t).split(/\\r?\\n/).map(function(l){var s=l.replace(/^[ \\t]+/,""),',
    'c=s.charAt(0);if(c==="-"||c==="*"||c===B){return B+" "+s.slice(1).replace(/^[ \\t]+/,"");}return s;}).join("\\n");}',
    'function draw(){var s=S[i];if(!s){return;}el.className=s.design||"d-white";',
    'el.style.fontFamily=s.font||"Arial";el.style.fontSize=(s.size||24)+"px";el.innerHTML="";',
    'if(s.title){var h=document.createElement("h1");h.textContent=esc2(s.title);el.appendChild(h);}',
    'var b=document.createElement("div");b.className="b";b.textContent=nice(s.text);el.appendChild(b);',
    'if(S.length>1&&s.page!==false){var p=document.createElement("div");p.className="pn";',
    'p.textContent=(i+1)+" / "+S.length;el.appendChild(p);}',
    'if(s.stamp!==false){var t=document.createElement("div");t.className="st";',
    't.textContent="сделано в МОНОЛИТ 2000";el.appendChild(t);}',
    'document.getElementById("n").textContent=i+1;',
    'document.getElementById("a").textContent=S.length;}',
    'function go(d){var j=i+d;if(j<0||j>=S.length){return;}i=j;draw();}',
    'document.addEventListener("click",function(){go(1);});',
    'document.addEventListener("keydown",function(e){var c=e.keyCode;',
    'if(c===39||c===32||c===34||c===13){go(1);e.preventDefault();}',
    'else if(c===37||c===33){go(-1);e.preventDefault();}',
    'else if(c===36){i=0;draw();}else if(c===35){i=S.length-1;draw();}});',
    'document.getElementById("pv").onclick=function(e){e.stopPropagation();go(-1);};',
    'document.getElementById("nx").onclick=function(e){e.stopPropagation();go(1);};',
    'document.title=(D.name||"Презентация")+" — показ";',
    'if(!S.length){el.className="d-red";el.innerHTML="<h1>Слайдов нет</h1>";}',
    'else{draw();}'
  ];
  function saveHtm() {
    if (!haveSlides()) return;
    var data = JSON.stringify(exportData({ player: 'MONOLIT-player-1' }));
    data = data.replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, function (c) {
      return c === '\u2028' ? '\\u2028' : '\\u2029';
    });
    var h = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<meta name="generator" content="ПРЕЗЕНТАЦИИ МОНОЛИТ 2000">\n' +
      '<title>' + esc(($('fName') && $('fName').value) || 'Презентация') + ' — показ</title>\n' +
      '<style>\n' + PLAYER_CSS.join('\n') + '\n</style>\n</head>\n<body>\n' +
      '<div id="s"></div>\n' +
      '<div class="bar">слайд <b id="n">1</b> из <b id="a">1</b>\n' +
      '<button id="pv">назад</button><button id="nx">вперёд</button>\n' +
      '<span class="hint">клик по слайду — вперёд, ← → пробел, Home/End. Файл работает без интернета.</span>\n' +
      '</div>\n' +
      '<script id="mono" type="application/x-mono">' + data + '<' + '/script>\n' +
      '<script>\n' + PLAYER_JS.join('\n') + '\n<' + '/script>\n' +
      '</body>\n</html>\n';
    if (download(safeName() + '.htm', h, 'text/html')) {
      note('сохранено: ' + safeName() + '.htm — открывается без нас');
      beep(1600, 0.1);
    }
  }

  /* ==================================================================
     ОТКРЫТИЕ .mono / .htm / .json
     ================================================================== */
  function deBom(s) { return String(s == null ? '' : s).replace(/^\ufeff/, ''); }

  /* достаёт JSON из .mono, из .htm с плеером и из «мусора вокруг JSON» */
  function extractJson(raw) {
    var s = deBom(raw), m, from, to;
    if (!s.trim()) return { error: 'Файл пустой. Совсем.' };
    m = s.match(/<script[^>]*type\s*=\s*["']application\/x-mono["'][^>]*>([\s\S]*?)<\/script>/i);
    if (m) s = deBom(m[1]);
    else {
      m = s.match(/<script[^>]*id\s*=\s*["']mono["'][^>]*>([\s\S]*?)<\/script>/i);
      if (m) s = deBom(m[1]);
    }
    from = s.indexOf('{');
    to = s.lastIndexOf('}');
    if (from < 0 || to <= from) {
      return { error: 'В файле не нашлось фигурных скобок. Это вообще .mono?' };
    }
    s = s.slice(from, to + 1);
    try { return { obj: JSON.parse(s) }; }
    catch (e) {
      try { return { obj: JSON.parse(s.replace(/,(\s*[}\]])/g, '$1')) }; }
      catch (e2) { return { error: 'JSON битый: ' + (e2.message || 'непонятно') }; }
    }
  }
  function readTextFile(f, then) {
    var r = new FileReader();
    r.onload = function () { then(deBom(String(r.result)), null); };
    r.onerror = function () { then(null, 'Файл не читается: ' + f.name); };
    r.readAsText(f, 'utf-8');
  }
  function openMonoFile(f) {
    readTextFile(f, function (text, err) {
      if (err) { report(err + '\nТекущие слайды не тронуты.'); alert(err); return; }
      var low = (f.name || '').toLowerCase();
      if (/\.htm?$/.test(low)) {
        if (/<script[^>]*application\/x-mono/i.test(text)) { applyJson(extractJson(text), f.name); return; }
        importHtm(text, f.name);
        return;
      }
      applyJson(extractJson(text), f.name);
    });
  }
  function applyJson(res, fname) {
    if (res.error) {
      report('ОТКРЫТИЕ НЕ УДАЛОСЬ\nфайл: ' + fname + '\n' + res.error + '\n\nТекущие слайды не тронуты.');
      alert('Файл не читается.\n' + res.error + '\n\nТекущая презентация цела.');
      return;
    }
    var o = res.obj;
    var list = null;
    if (o && o.slides) list = o.slides;
    else if (Array.isArray(o)) list = o;
    if (!list || !list.length) {
      report('В файле «' + fname + '» нет ни одного слайда.\nТекущие слайды не тронуты.');
      alert('В файле нет слайдов. Текущая презентация цела.');
      return;
    }
    if (showOpen) { alert('Сначала выйди из показа (ESC), потом открывай.'); return; }
    pushUndo('открытие файла');
    slides = normAll(list);
    if (o.name && $('fName')) $('fName').value = o.name;
    else if ($('fName')) $('fName').value = String(fname || '').replace(/\.(mono|json|htm?)$/i, '');
    sel = 0;
    draft = copy(slides[0]);
    fillForm(draft);
    tab('editor');
    renderAll(); queueSave();
    note('открыто: ' + fname + ' — слайдов ' + slides.length);
    beep(1200, 0.1);
  }
  function importHtm(s, name) {
    var doc, nodes, got = [], k, n;
    try { doc = new DOMParser().parseFromString(s, 'text/html'); }
    catch (e) { report('HTM не разобрали.'); return; }
    if (!doc) { report('HTM не разобрали.'); return; }
    nodes = doc.querySelectorAll ? doc.querySelectorAll('#s, .sl, .slide') : [];
    for (k = 0; k < nodes.length; k++) {
      n = nodes[k];
      var h = n.querySelector('h1'), b = n.querySelector('.b') || n.querySelector('[class*=b]');
      var cls = (n.className || '').split(/\s+/).filter(function (c) { return DESIGN_OK[c]; })[0] || 'd-white';
      got.push(norm({
        title: h ? h.textContent : '',
        text: b ? b.textContent : '',
        design: cls,
        font: n.style.fontFamily || FONTS[1],
        size: parseInt(n.style.fontSize, 10) || 24
      }));
    }
    if (!got.length) {
      report('В .htm «' + name + '» слайдов Монолита не найдено.\nНаш формат для показа — .mono или .htm из кнопки «СОХРАНИТЬ».');
      alert('В этом .htm слайдов не найдено. Текущие слайды не тронуты.');
      return;
    }
    pushUndo('импорт .htm');
    slides = got;
    if ($('fName')) $('fName').value = String(name).replace(/\.htm?$/i, '');
    sel = 0; draft = copy(slides[0]); fillForm(draft);
    tab('editor'); renderAll(); queueSave();
    note('открыто из .htm: слайдов ' + got.length);
  }

  /* ==================================================================
     РАСПАКОВКА ZIP (для .pptx)
     ================================================================== */
  function Buf() { this.a = new Uint8Array(1 << 16); this.n = 0; }
  Buf.prototype.room = function (k) {
    if (this.n + k <= this.a.length) return;
    var cap = this.a.length;
    while (cap < this.n + k) cap <<= 1;
    var b = new Uint8Array(cap);
    b.set(this.a.subarray(0, this.n));
    this.a = b;
  };
  Buf.prototype.byte = function (v) { this.room(1); this.a[this.n++] = v; };
  Buf.prototype.put = function (u8) { this.room(u8.length); this.a.set(u8, this.n); this.n += u8.length; };
  Buf.prototype.back = function (dist, len) {
    this.room(len);
    var from = this.n - dist, k;
    for (k = 0; k < len; k++) this.a[this.n++] = this.a[from++];
  };
  Buf.prototype.done = function () { return this.a.slice(0, this.n); };

  var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  function makeTables(lengths, n) {
    var counts = [], offs = [], syms = [], k;
    for (k = 0; k < 16; k++) { counts[k] = 0; offs[k] = 0; }
    for (k = 0; k < n; k++) if (lengths[k]) counts[lengths[k]]++;
    counts[0] = 0;
    for (k = 1; k < 16; k++) offs[k] = offs[k - 1] + counts[k - 1];
    for (k = 0; k < n; k++) if (lengths[k]) syms[offs[lengths[k]]++] = k;
    return { counts: counts, syms: syms };
  }
  function fixedTables() {
    var l = [], d = [], k;
    for (k = 0; k < 144; k++) l[k] = 8;
    for (; k < 256; k++) l[k] = 9;
    for (; k < 280; k++) l[k] = 7;
    for (; k < 288; k++) l[k] = 8;
    for (k = 0; k < 30; k++) d[k] = 5;
    return { l: makeTables(l, 288), d: makeTables(d, 30) };
  }
  /* свой inflate: работает кусками, без 200-МБ строк в памяти */
  function inflateRaw(src, start) {
    var out = new Buf();
    var pos = start || 0, bb = 0, bc = 0, last = 0, ft = null;
    function bits(need) {
      var val;
      while (bc < need) {
        if (pos >= src.length) throw new Error('данные кончились');
        bb |= src[pos++] << bc; bc += 8;
      }
      val = bb & ((1 << need) - 1);
      bb >>>= need; bc -= need;
      return val;
    }
    function decode(h) {
      var code = 0, first = 0, index = 0, len, cnt;
      for (len = 1; len < 16; len++) {
        code |= bits(1);
        cnt = h.counts[len];
        if (code - first < cnt) return h.syms[index + (code - first)];
        index += cnt; first = (first + cnt) << 1; code <<= 1;
      }
      throw new Error('битый код');
    }
    function stored() {
      var len, nlen, k, base;
      bb = 0; bc = 0;
      if (pos + 4 > src.length) throw new Error('обрыв');
      len = src[pos] | (src[pos + 1] << 8);
      nlen = src[pos + 2] | (src[pos + 3] << 8);
      pos += 4;
      if ((len ^ 0xffff) !== nlen) throw new Error('неверная длина блока');
      out.room(len);
      base = out.n;
      for (k = 0; k < len; k++) out.a[base + k] = pos < src.length ? src[pos++] : 0;
      out.n = base + len;
    }
    function dynTables() {
      var nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, k, ln2, prev, sym;
      var ord = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
      var cl = [], ct, lengths = [];
      for (k = 0; k < 19; k++) cl[k] = 0;
      for (k = 0; k < nc; k++) cl[ord[k]] = bits(3);
      ct = makeTables(cl, 19);
      while (lengths.length < nl + nd) {
        sym = decode(ct);
        if (sym < 16) { lengths.push(sym); continue; }
        if (sym === 16) { prev = lengths[lengths.length - 1] || 0; ln2 = 3 + bits(2); while (ln2--) lengths.push(prev); }
        else if (sym === 17) { ln2 = 3 + bits(3); while (ln2--) lengths.push(0); }
        else { ln2 = 11 + bits(7); while (ln2--) lengths.push(0); }
      }
      if (lengths.length > nl + nd) lengths.length = nl + nd;
      return { l: makeTables(lengths.slice(0, nl), nl), d: makeTables(lengths.slice(nl), nd) };
    }
    function codes(lh, dh) {
      for (; ;) {
        var sym = decode(lh);
        if (!(sym >= 0)) throw new Error('битый символ');
        if (sym < 256) { out.byte(sym); continue; }
        if (sym === 256) return;
        sym -= 257;
        if (sym >= 29) throw new Error('плохая длина');
        var len = LBASE[sym] + bits(LEXT[sym]);
        var ds = decode(dh);
        if (!(ds >= 0) || ds >= 30) throw new Error('плохое расстояние');
        var dist = DBASE[ds] + bits(DEXT[ds]);
        if (!(len > 0) || !(dist > 0) || dist > out.n) throw new Error('ссылка за начало');
        out.back(dist, len);
      }
    }
    do {
      last = bits(1);
      var type = bits(2);
      if (type === 0) stored();
      else if (type === 1) { if (!ft) ft = fixedTables(); codes(ft.l, ft.d); }
      else if (type === 2) { var t = dynTables(); codes(t.l, t.d); }
      else throw new Error('неизвестный блок сжатия');
    } while (!last);
    return { data: out.done(), used: pos - (start || 0) };
  }
  function nativeInflate(chunk) {
    var st = new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(st).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function canNative() { return typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined'; }

  function u16(v, o) { return (v[o] | (v[o + 1] << 8)); }
  function u32(v, o) { return (v[o] | (v[o + 1] << 8) | (v[o + 2] << 16) | (v[o + 3] << 24)) >>> 0; }
  function u64(v, o) { return u32(v, o) + u32(v, o + 4) * 4294967296; }
  function latin(v, o, n) {
    var s = '', k; for (k = 0; k < n; k++) s += String.fromCharCode(v[o + k]); return s;
  }
  function txt(u8) {
    if (!u8 || !u8.length) return '';
    try { return new TextDecoder('utf-8').decode(u8); }
    catch (e) {
      var s = '', k; for (k = 0; k < u8.length; k++) s += String.fromCharCode(u8[k]); return s;
    }
  }
  function findEOCD(v) {
    var k, from = Math.max(0, v.length - 66000);
    for (k = v.length - 22; k >= from; k--) if (u32(v, k) === 0x06054b50) return k;
    return -1;
  }
  var CRC_T = null;
  function crc32(u8) {
    var c = -1, n, k;
    if (!CRC_T) {
      CRC_T = new Int32Array(256);
      for (n = 0; n < 256; n++) {
        c = n;
        for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        CRC_T[n] = c;
      }
    }
    c = -1;
    for (k = 0; k < u8.length; k++) c = CRC_T[(c ^ u8[k]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }
  function readZip(v) {
    var eocd = findEOCD(v);
    if (eocd < 0) return Promise.reject(new Error('not-zip'));
    var count = u16(v, eocd + 10), cdOff = u32(v, eocd + 16);
    if (count === 0xffff || cdOff === 0xffffffff) {
      var loc = eocd - 20;
      if (loc >= 0 && u32(v, loc) === 0x07064b50) {
        var z = u64(v, loc + 8);
        if (z >= 0 && z + 56 < v.length && u32(v, z) === 0x06064b50) {
          count = u64(v, z + 32);
          cdOff = u64(v, z + 48);
        }
      }
    }
    var list = [], p = cdOff, k;
    while (p + 46 <= v.length && u32(v, p) === 0x02014b50) {
      var method = u16(v, p + 10);
      var csize = u32(v, p + 20), usize = u32(v, p + 24);
      var nlen = u16(v, p + 28), elen = u16(v, p + 30), clen = u16(v, p + 32);
      var lho = u32(v, p + 42);
      var name = latin(v, p + 46, nlen);
      var crc = u32(v, p + 16);
      if (csize === 0xffffffff || usize === 0xffffffff || lho === 0xffffffff) {
        var ep = p + 46 + nlen, end = ep + elen;
        while (ep + 4 <= end) {
          var id = u16(v, ep), sz = u16(v, ep + 2);
          if (id === 1) {
            var q = ep + 4;
            if (usize === 0xffffffff) { usize = u32(v, q); q += 4; }
            if (csize === 0xffffffff) { csize = u32(v, q); q += 4; }
            if (lho === 0xffffffff) { lho = u64(v, q); }
            break;
          }
          ep += 4 + sz;
        }
      }
      if (lho === 0xffffffff) { lho = -1; }
      list.push({ name: name, method: method, csize: csize, usize: usize, lho: lho, crc: crc });
      p += 46 + nlen + elen + clen;
      if (list.length > 20000) break;
    }
    return Promise.resolve(unzipAll(list, v));
  }
  function unzipAll(list, v) {
    var res = [], jobs = [];
    function bad(e, why) { res.push({ name: e.name, data: null, err: why, size: e.usize || e.csize }); }
    function good(e, data) {
      if (e.crc && data && crc32(data) !== e.crc) { bad(e, 'не совпала контрольная сумма'); return; }
      res.push({ name: e.name, data: data, size: e.usize || e.csize });
    }
    list.forEach(function (e) {
      if (e.lho < 0 || e.lho + 30 > v.length) { bad(e, 'битая ссылка'); return; }
      var start = e.lho + 30 + u16(v, e.lho + 26) + u16(v, e.lho + 28);
      if (start < 0 || start > v.length) { bad(e, 'смешение за пределами файла'); return; }
      e.size = e.usize || e.csize;
      /* медиафайлы не распаковываем — они всё равно не переносятся, а память жрут */
      if (/^ppt\/media\//.test(e.name)) { res.push({ name: e.name, data: null, size: e.usize || e.csize }); return; }
      if (e.method === 0) {
        good(e, v.subarray(start, start + (e.csize || (v.length - start))));
        return;
      }
      if (e.method !== 8) { bad(e, 'метод сжатия ' + e.method + ' нам не известен'); return; }
      var chunk = v.subarray(start, start + (e.csize || (v.length - start)));
      if (!e.csize) {
        try {
          var r = inflateRaw(v, start);
          good(e, r.data);
        } catch (err) { bad(e, 'распаковка не удалась: ' + (err && err.message ? err.message : err)); }
        return;
      }
      if (canNative()) {
        jobs.push(nativeInflate(chunk).then(function (d) {
          if (e.crc && crc32(d) !== e.crc) return { name: e.name, data: null, err: 'не совпала контрольная сумма', size: e.usize || e.csize };
          return { name: e.name, data: d, size: e.usize || e.csize };
        }, function () {
          try {
            var d2 = inflateRaw(chunk, 0).data;
            if (e.crc && crc32(d2) !== e.crc) return { name: e.name, data: null, err: 'не совпала контрольная сумма', size: e.usize || e.csize };
            return { name: e.name, data: d2, size: e.usize || e.csize };
          } catch (err) {
            return { name: e.name, data: null, err: 'распаковка не удалась: ' + (err && err.message ? err.message : err), size: e.usize || e.csize };
          }
        }));
      } else {
        try { good(e, inflateRaw(chunk, 0).data); }
        catch (err) { bad(e, 'распаковка не удалась: ' + (err && err.message ? err.message : err)); }
      }
    });
    return Promise.all(jobs).then(function (extra) { return res.concat(extra.filter(Boolean)); });
  }

  /* ==================================================================
     РАЗБОР OOXML — ТОЛЬКО ПО ЛОКАЛЬНЫМ ИМЕНАМ (префиксы namespace не важны)
     ================================================================== */
  function ln(n) { return n.localName || String(n.nodeName).replace(/^[^:]*:/, ''); }
  function descendants(node, name, out) {
    out = out || [];
    for (var c = node.firstElementChild; c; c = c.nextElementSibling) {
      if (ln(c) === name) out.push(c);
      descendants(c, name, out);
    }
    return out;
  }
  function firstNamed(node, name) {
    for (var c = node.firstElementChild; c; c = c.nextElementSibling) if (ln(c) === name) return c;
    return null;
  }
  function paraText(p) {
    var s = '';
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { s += c.nodeValue; continue; }
        if (c.nodeType !== 1) continue;
        var t = ln(c);
        if (t === 'br') { s += '\n'; continue; }
        if (t === 'tab') { s += '\t'; continue; }
        if (t === 't') {
          for (var d = c.firstChild; d; d = d.nextSibling) if (d.nodeType === 3) s += d.nodeValue;
          continue;
        }
        walk(c);
      }
    })(p);
    return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/[ \t]+$/, '');
  }
  function collectParas(tb) {
    var lines = [], c;
    for (c = tb.firstElementChild; c; c = c.nextElementSibling) {
      if (ln(c) !== 'p') continue;
      var t = paraText(c);
      if (t) lines.push(t);
    }
    return lines.join('\n');
  }
  function parseSlideXml(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (!doc || !doc.documentElement) throw new Error('плохой xml');
    var all = doc.getElementsByTagName('*'), shapes = [], i, n;
    for (i = 0; i < all.length; i++) {
      n = all[i];
      if (ln(n) === 'sp' || ln(n) === 'graphicFrame') shapes.push(n);
    }
    /* убираем вложенные (mc:AlternateContent дубли) */
    var top = [];
    for (i = 0; i < shapes.length; i++) {
      n = shapes[i];
      var nested = false;
      for (var p = n.parentNode; p && p.nodeType === 1; p = p.parentNode) {
        if (shapes.indexOf(p) >= 0) { nested = true; break; }
      }
      if (!nested) top.push(n);
    }
    var title = '', parts = [];
    for (i = 0; i < top.length; i++) {
      var sp = top[i];
      var phs = descendants(sp, 'ph');
      var ph = phs.length ? phs[0] : null;
      var isTitle = false, t;
      if (ph) {
        var ty = (ph.getAttribute('type') || '').toLowerCase();
        if (ty === 'title' || ty === 'ctrtitle') isTitle = true;
      }
      if (ln(sp) === 'graphicFrame') {
        var tbs = descendants(sp, 'txBody'), chunks = [], q;
        for (q = 0; q < tbs.length; q++) { var one = collectParas(tbs[q]); if (one) chunks.push(one); }
        t = chunks.join('\n') || null;
      } else {
        var tb = firstNamed(sp, 'txBody');
        t = tb ? (collectParas(tb) || null) : null;
      }
      if (!t) continue;
      if (isTitle && !title) title = t.split('\n')[0];
      else if (!parts.length || parts[parts.length - 1] !== t) parts.push(t);
    }
    if (!title && !parts.length) {
      var ps = descendants(doc.documentElement, 'p'), lines = [];
      for (i = 0; i < ps.length; i++) { var x = paraText(ps[i]); if (x) lines.push(x); }
      if (lines.length) {
        title = lines[0];
        if (lines.length > 1) parts = [lines.slice(1).join('\n')];
      }
    }
    if (!title && parts.length) {
      var f = parts[0].split('\n');
      title = f[0];
      parts[0] = f.slice(1).join('\n');
      if (!parts[0].trim()) parts.shift();
    }
    parts = parts.filter(function (x) { return String(x).trim(); });
    if (!title && !parts.length) throw new Error('пустой слайд');
    return { title: title, text: parts.join('\n\n') };
  }

  /* ==================================================================
     ОТЧЁТ О КОНВЕРТАЦИИ
     ================================================================== */
  function report(t) {
    var el = $('report');
    if (!el) return;
    el.innerHTML = esc(t);
    el.scrollTop = 0;
  }
  function countTag(entries, tag) {
    var re = new RegExp('<(?:[A-Za-z0-9_]+:)?' + tag + '[\\s/>]', 'g');
    var n = 0, k, m, s;
    for (k = 0; k < entries.length; k++) {
      if (!entries[k].data) continue;
      if (!/slide\d+\.xml$/.test(entries[k].name)) continue;
      s = txt(entries[k].data);
      while ((m = re.exec(s))) n++;
    }
    return n;
  }
  function collectFonts(entries) {
    var set = {}, k, m, s;
    for (k = 0; k < entries.length; k++) {
      if (!entries[k].data || !/\.xml$/.test(entries[k].name)) continue;
      s = txt(entries[k].data);
      var re = /typeface="([^"]{1,40})"/g;
      while ((m = re.exec(s))) if (m[1].charAt(0) !== '+') set[m[1]] = 1;
    }
    return Object.keys(set);
  }
  var LOST = [
    'выравнивание текста (всё по левому краю)',
    'местоположение блоков на слайде',
    'полужирное и курсивное начертание',
    'размер текста по блокам (теперь один на слайд)',
    'поля и отступы',
    'тени, обводки и заливки фигур',
    'подчёркивание и зачёркивание',
    'интервалы между абзацами'
  ];
  function pickLost(seed, n) {
    var out = [], pool = LOST.slice(), k;
    for (k = 0; k < n && pool.length; k++) out.push(pool.splice((seed + k * 7) % pool.length, 1)[0]);
    return out;
  }
  function shuffle(arr, seed) {
    var s = seed || 1, i, j, t;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (i = arr.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function makeSlidesFrom(got, seed) {
    return got.map(function (g, i) {
      var body = String(g.text || '');
      if (((seed + i) % 3) === 0) {
        body = body.split('\n').map(function (l) {
          return /^\s*•/.test(l) ? '• ' + l.replace(/^\s*•\s*/, '') : l;
        }).join('\n');
      }
      return norm({
        title: (g.title || 'Слайд ' + (i + 1)).slice(0, 70),
        text: body.slice(0, 6000),
        design: DESIGNS[(seed + i * 3) % DESIGNS.length].id,
        font: [FONTS[0], FONTS[1], FONTS[2]][(seed + i) % 3],
        size: [18, 22, 26, 30][(seed + i) % 4],
        trans: TRANS[(seed + i * 5) % TRANS.length]
      });
    });
  }
  function dryRunOn() { var b = $('dryRun'); return !!(b && b.checked); }
  function finishImport(next, fname, title, extraLines) {
    if (!next.length) {
      report('ТЕКСТ НЕ НАЙДЕН\nфайл: ' + fname + '\n\nСлайды в программе НЕ ТРОГАЛИ.');
      alert('В файле не нашлось ни одного слайда с текстом.\nТекущая презентация цела.');
      return false;
    }
    if (showOpen) { alert('Сначала выйди из показа (ESC), потом импортируй.'); return false; }
    if (dryRunOn()) {
      report((extraLines || []) .concat([
        '',
        'РЕЖИМ «ТОЛЬКО ПОСОТРЕТЬ»: в программу ничего НЕ добавлено.'
      ]).join('\n'));
      return false;
    }
    pushUndo(title);
    slides = next;
    if ($('fName')) $('fName').value = String(fname || '').replace(/\.(pptx|ppt|xml|txt|ppsx|potx)$/i, '');
    sel = 0;
    draft = copy(slides[0]);
    fillForm(draft);
    tab('editor');
    renderAll();
    queueSave();
    return true;
  }

  /* ==================================================================
     ИМПОРТ POWERPOINT
     ================================================================== */
  function importPptx(buf, fname) {
    tab('ppt');
    report('ЧИТАЕМ «' + fname + '»\nраспаковываем zip-архив...');
    var v = new Uint8Array(buf);
    readZip(v).then(function (entries) {
      var names = entries.map(function (e) { return e.name; });
      var slideNames = names.filter(function (nm) { return /^ppt\/slides\/slide\d+\.xml$/.test(nm); })
        .sort(function (a, b) {
          return (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0);
        });
      if (!slideNames.length) {
        report('СТРАШНАЯ ОШИБКА\n\nВ файле «' + fname + '» слайдов не найдено.\n\n' +
          'Возможно это не презентация.\nВозможно она повреждена.\nВозможно мы просто не смогли.\n\n' +
          'Слайды в программе не тронуты.');
        alert('Слайдов в файле не найдено. Текущая презентация цела.');
        return;
      }
      var got = [], broken = 0, k, e;
      for (k = 0; k < slideNames.length; k++) {
        e = null;
        for (var j = 0; j < entries.length; j++) if (entries[j].name === slideNames[k]) e = entries[j];
        if (!e || !e.data || !e.data.length) { broken++; continue; }
        try {
          var parsed = parseSlideXml(txt(e.data));
          got.push(parsed);
        } catch (err) { broken++; }
      }
      var seed = hash(fname);
      var orderNote = 'порядок слайдов: угадан по именам файлов (вроде верно)';
      var box = $('keepOrder');
      if (box && !box.checked) { shuffle(got, seed); orderNote = 'порядок слайдов: ПЕРЕПУТАН. вы сами выключили угадывание.'; }

      var media = names.filter(function (nm) { return /^ppt\/media\//.test(nm); });
      var fonts = collectFonts(entries);
      var pics = countTag(entries, 'pic');
      var shapes = countTag(entries, 'sp');
      var tables = countTag(entries, 'tbl');
      var anims = countTag(entries, 'anim') + countTag(entries, 'animEffect');
      var timings = countTag(entries, 'timing');
      var charts = names.filter(function (nm) { return /^ppt\/charts\//.test(nm); }).length;
      var videos = media.filter(function (nm) { return /\.(mp4|wmv|avi|mov|m4v|mpg|mpeg)$/i.test(nm); }).length;
      var masters = names.filter(function (nm) { return /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(nm); }).length;
      var layouts = names.filter(function (nm) { return /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(nm); }).length;
      var notes = names.filter(function (nm) { return /^ppt\/notesSlides\//.test(nm); }).length;
      var mediaBytes = 0;
      for (k = 0; k < entries.length; k++) if (/^ppt\/media\//.test(entries[k].name)) mediaBytes += (entries[k].size || 0);

      var L = [];
      L.push('ОТЧЁТ О КОНВЕРТАЦИИ «' + fname + '»');
      L.push('движок: Монолит-Import v0.9 (prefix-agnostic, свой inflate)');
      L.push('дата: ' + new Date().toLocaleString('ru-RU'));
      L.push('------------------------------------------------');
      L.push('[OK] архив распакован, записей: ' + entries.length);
      L.push('[OK] слайдов найдено: ' + slideNames.length);
      L.push('[OK] слайдов прочитано: ' + got.length);
      if (broken) L.push('[!!] слайдов выброшено (текста нет или битые): ' + broken);
      L.push('');
      L.push('ЧТО НЕ ПЕРЕНЕСЕНО:');
      L.push('  - файлов медиа: ' + media.length + ' (' + Math.round(mediaBytes / 1024) + ' КБ) -> перенесено 0 (хранить негде)');
      L.push('  - картинок на слайдах: ' + pics + ' -> вместо них пусто');
      if (videos) L.push('  - видео: ' + videos + ' -> удалено сразу и безвозвратно');
      L.push('  - фигур и текстовых блоков: ' + shapes + ' -> слиплись в один текст');
      if (tables) L.push('  - таблиц: ' + tables + ' -> стали строчками текста');
      if (charts) L.push('  - диаграмм (' + charts + ' шт.): стали строчками текста');
      if (anims) L.push('  - анимаций появления: ' + anims + ' -> удалены (у нас анимаций нет)');
      if (timings) L.push('  - блоков timing: ' + timings + ' -> даже не читались');
      if (notes) L.push('  - примечаний докладчика: ' + notes + ' -> не читали и не будем');
      L.push('  - мастеров слайдов: ' + masters + ', разметок: ' + layouts + ' -> не используются');
      L.push('');
      L.push('ШРИФТЫ:');
      if (fonts.length) {
        L.push('  в файле: ' + fonts.slice(0, 14).join(', '));
        L.push('  у нас есть: Comic Sans MS, Times New Roman, Impact,');
        L.push('              Arial, Courier New (всё, извините)');
        L.push('  -> ВСЕ шрифты заменены. Совпадение маловероятно.');
      } else L.push('  шрифты не распознаны. поставили свои.');
      L.push('');
      L.push('ПРОЧЕЕ ПОТЕРЯНО:');
      pickLost(seed, 4).forEach(function (x) { L.push('  * ' + x); });
      L.push('  * дизайн: назначен нами, а не автором презентации');
      L.push('');
      L.push(orderNote);

      var ok = finishImport(makeSlidesFrom(got, seed), fname, 'импорт .pptx', L);
      L.push('');
      L.push(ok ? '>>> загружено в редактор. слева ' + slides.length + ' слайдов. жми ПОКАЗ!!!'
        : '>>> в редактор НЕ загружено: ' + (dryRunOn() ? 'жалкий режим' : 'текста не нашлось'));
      report(L.join('\n'));
      if (ok) { beep(500); setTimeout(function () { beep(760); }, 110); }
    }, function (err) {
      var msg = (err && err.message === 'no-inflate')
        ? 'ОШИБКА РАСПАКОВКИ\n\nБраузер совсем не умеет распаковывать.\nСовет: открой .pptx архиватором и притащи сюда\nppt\\slides\\slide1.xml — мы и так поймём.\nИли поставь свежий Chrome.'
        : 'Файл не похож на нормальный .pptx.\n\nМы не смогли его распаковать.\nПопробуй: PowerPoint -> сохранить как .pptx.\n\nТекущие слайды не тронуты.';
      report(msg);
      alert(msg);
    });
  }

  function importPptBinary(buf, fname) {
    tab('ppt');
    report('ЧИТАЕМ «' + fname + '»\nстарый .ppt — ищем текст по байтам...');
    var v = new Uint8Array(buf), dv = new DataView(buf);
    var blocks = [], i, c, n = 0, uni = 0, ansi = 0;
    for (i = 0; i + 8 < v.length; i++) {
      var id = dv.getUint16(i, true);
      if (id !== 0x0FA0 && id !== 0x0FA8) continue;
      var len = dv.getUint32(i + 4, true);
      if (len <= 0 || len >= 400000 || i + 8 + len > v.length) continue;
      var s = '';
      if (id === 0x0FA0) {
        for (c = 0; c + 1 < len; c += 2) s += String.fromCharCode(dv.getUint16(i + 8 + c, true));
        uni++;
      } else {
        for (c = 0; c < len; c++) s += String.fromCharCode(v[i + 8 + c]);
        ansi++;
      }
      s = s.replace(/\r/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
      if (s) blocks.push(s);
      n++;
    }
    var pics = 0;
    for (i = 0; i + 3 < v.length; i++) {
      if (v[i] === 0xFF && v[i + 1] === 0xD8) pics++;
      else if (v[i] === 0x89 && v[i + 1] === 0x50 && v[i + 2] === 0x4E) pics++;
    }
    if (!blocks.length) {
      report('НЕ ПОНЯЛ ФАЙЛ «' + fname + '»\n\nСтарый .ppt — бинарный, мы читаем его поиском\nпо байтам и часто не угадываем.\n\nЧто делать:\n1) открыть в PowerPoint\n2) сохранить как .pptx (новый формат)\n3) принести снова.\n\nИзвиняемся. Слайды не тронуты.');
      return;
    }
    var got = [], cur = null;
    blocks.forEach(function (b) {
      var lines = b.split('\n').filter(function (x) { return x.trim(); });
      if (!lines.length) return;
      var shortOne = (lines[0].length <= 46 && lines.length === 1);
      if (!cur || (shortOne && cur.title)) {
        cur = { title: shortOne ? lines[0] : 'Слайд', text: shortOne ? '' : lines.join('\n') };
        got.push(cur);
      } else if (!cur.title && shortOne) cur.title = lines[0];
      else cur.text = (cur.text ? cur.text + '\n' : '') + lines.join('\n');
    });
    var seed = hash(fname);
    var box = $('keepOrder');
    if (box && !box.checked) shuffle(got, seed);

    var L = [];
    L.push('ОТЧЁТ О КОНВЕРТАЦИИ СТАРОГО ФАЙЛА «' + fname + '»');
    L.push('движок: Монолит-Import v0.5 (бинарный, на глазок)');
    L.push('дата: ' + new Date().toLocaleString('ru-RU'));
    L.push('------------------------------------------------');
    L.push('формат: PowerPoint 97-2003 (OLE2, бинарный)');
    L.push('текстовых атомов найдено: ' + n + ' (юникод ' + uni + ', однобайтных ' + ansi + ')');
    L.push('слайдов НАГАДАНО: ' + got.length + ' (настоящее число могло быть другим)');
    L.push('');
    L.push('ВНИМАНИЕ: .ppt читается поиском по байтам, поэтому');
    L.push('возможно: слайды склеились, порядок неверный, часть');
    L.push('текста ушла не в тот слайд, заголовки не там.');
    L.push('');
    L.push('ЧТО НЕ ПЕРЕНЕСЕНО:');
    L.push('  - картинок (сигнатур найдено ~' + pics + '): перенесено 0');
    L.push('  - шрифтов: все заменены на наши 5');
    L.push('  - цветов фона: заменены на наши 8 дизайнов');
    L.push('  - анимаций: у нас анимаций нет');
    L.push('  - таблиц, фигур, диаграмм: стали текстом или исчезли');
    L.push('  - примечаний докладчика: не читали');
    L.push('  - вставленных OLE-объектов: не читали');

    var ok = finishImport(makeSlidesFrom(got, seed), fname, 'импорт .ppt', L);
    L.push('');
    L.push(ok ? '>>> загружено. проверяй руками, честно.' : '>>> в редактор НЕ загружено: ' + (dryRunOn() ? 'жалкий режим' : 'текста не нашлось'));
    report(L.join('\n'));
    if (ok) beep(380);
  }

  function importXml(s, fname) {
    var got = [], doc;
    try { doc = new DOMParser().parseFromString(s, 'application/xml'); } catch (e) { doc = null; }
    if (doc && doc.documentElement) {
      var slds = descendants(doc.documentElement, 'sld');
      for (var i = 0; i < slds.length; i++) {
        try { got.push(parseSlideXml(new XMLSerializer().serializeToString(slds[i]))); } catch (e2) { }
      }
    }
    if (!got.length) {
      /* это обычный XML или текст внутри — собираем абзацы */
      var lines = [];
      if (doc && doc.documentElement) {
        var ps = descendants(doc.documentElement, 'p');
        if (ps.length) {
          for (var k = 0; k < ps.length; k++) { var t = paraText(ps[k]); if (t) lines.push(t); }
        } else {
          (function walk(n) {
            for (var c = n.firstChild; c; c = c.nextSibling) {
              if (c.nodeType === 3) { var tx = c.nodeValue.trim(); if (tx) lines.push(tx); }
              else if (c.nodeType === 1) walk(c);
            }
          })(doc.documentElement);
        }
      } else {
        lines = s.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      }
      var cur = { title: '', text: '' };
      lines.forEach(function (l) {
        if (!cur.title && l.length < 45) cur.title = l;
        else if (l.length < 45 && cur.title && cur.text) { got.push(cur); cur = { title: l, text: '' }; }
        else cur.text += (cur.text ? '\n' : '') + l;
      });
      if (cur.title || cur.text) got.push(cur);
    }
    tab('ppt');
    var L = ['ОТЧЁТ «' + fname + '» (XML/текст)', 'распознано слайдов: ' + got.length,
      'шрифты, цвета и картинки потеряны, как всегда.'];
    var ok = finishImport(makeSlidesFrom(got, hash(fname)), fname, 'импорт .xml', L);
    L.push(ok ? '>>> загружено ' + slides.length + ' слайдов.' : '>>> в редактор НЕ загружено.');
    report(L.join('\n'));
  }

  function importTxt(s, fname) {
    var parts = s.replace(/\r\n/g, '\n').split(/\n[ \t]*\n|^-{3,}[ \t]*$|^={3,}[ \t]*$/m);
    var got = parts.map(function (p) {
      var ls = p.split('\n').filter(function (x) { return x.trim(); });
      if (!ls.length) return null;
      return { title: ls[0].replace(/^[#*\-•\s]+/, '').slice(0, 70), text: ls.slice(1).join('\n') };
    }).filter(Boolean);
    tab('ppt');
    var L = ['ОТЧЁТ «' + fname + '» (текстовик)', 'это не PowerPoint, это текст.',
      'разбили по пустым строчкам: ' + got.length + ' слайдов.', 'красоты всё равно не будет.'];
    var ok = finishImport(makeSlidesFrom(got, hash(fname)), fname, 'импорт .txt', L);
    L.push(ok ? '>>> загружено ' + slides.length + ' слайдов.' : '>>> в редактор НЕ загружено: ' + (dryRunOn() ? 'жалкий режим' : 'пусто'));
    report(L.join('\n'));
  }

  function unknownFile(fname, why) {
    tab('ppt');
    report('Файл «' + fname + '» непонятный.\n' + (why ? why + '\n\n' : '') +
      'Мы понимаем:\n  .pptx  (новый PowerPoint)\n  .ppt   (старый PowerPoint 97-2003)\n' +
      '  .xml   (Office XML Presentation)\n  .txt   (просто текст)\n  .mono  (наш формат)\n' +
      '  .htm   (наш показ)\n\n.doc не читаем. .pdf не читаем. .key не читаем тем более.\n\n' +
      'Текущие слайды не тронуты.');
  }
  function handleFile(f) {
    if (!f) return;
    var name = f.name || 'файл', low = name.toLowerCase();
    if (/\.(mono|json)$/.test(low)) { openMonoFile(f); return; }
    if (/\.htm?$/.test(low)) { openMonoFile(f); return; }
    if (/\.txt$/.test(low)) { readTextFile(f, function (t, e) { if (e) { unknownFile(name, e); } else importTxt(t, name); }); return; }
    if (/\.xml$/.test(low)) { readTextFile(f, function (t, e) { if (e) { unknownFile(name, e); } else importXml(t, name); }); return; }
    var r = new FileReader();
    r.onload = function () {
      var buf = r.result;
      if (!buf || !buf.byteLength) { unknownFile(name, 'Файл пустой (0 байт).'); return; }
      var v = new Uint8Array(buf);
      var isZip = (v[0] === 0x50 && v[1] === 0x4B && (v[2] === 0x03 || v[2] === 0x05 || v[2] === 0x07));
      var isOle = (v[0] === 0xD0 && v[1] === 0xCF && v[2] === 0x11 && v[3] === 0xE0);
      var head = txt(v.subarray(0, 400));
      if (isZip) importPptx(buf, name);
      else if (isOle) importPptBinary(buf, name);
      else if (/^\s*<\?xml/i.test(head) || /^\s*<[\w:]+/.test(head) || head.indexOf('{') >= 0) {
        unknownFile(name, 'Это похоже на простой текст, хотя расширение другое. Переименуй в .txt и принеси.');
      } else unknownFile(name);
    };
    r.onerror = function () { unknownFile(name, 'Браузер не смог прочитать файл (запрещён или повреждён).'); };
    r.readAsArrayBuffer(f);
  }

  /* ==================================================================
     ПОКАЗ
     ================================================================== */
  function openShow() {
    if (!slides.length) { alert('Слайдов нет. Какой показ?'); return; }
    /* текст пишется прямо на слайде, поэтому перед показом просто
       переносим живой черновик в модель — без всяких «применить» */
    if (draftDiffers()) applyDraft();
    if (showIdx > slides.length - 1 || showIdx < 0) showIdx = 0;
    if (sel >= 0) showIdx = sel;
    showOpen = true;
    showBlack = false; showHelp = false; showNotes = false;
    var sh = $('show');
    if (sh) sh.className = 'show on';
    if ($('pBlack')) $('pBlack').innerHTML = 'ЧЁРНЫЙ (B)';
    if ($('pHelp')) $('pHelp').className = 'phelp';
    if ($('showNotes')) { $('showNotes').className = 'pnotes hidden'; $('showNotes').innerHTML = ''; }
    showTimerStart = Date.now(); showTimer = 0;
    if (window.showTimerInterval) clearInterval(window.showTimerInterval);
    window.showTimerInterval = setInterval(updateShowTimer, 500);
    updateShowTimer();
    drawShow();
    beep(1000, 0.12);
  }
  function drawShow() {
    if (!slides.length) { closeShow(); return; }
    if (showIdx > slides.length - 1) showIdx = slides.length - 1;
    if (showIdx < 0) showIdx = 0;
    rAF(function () {
      var el = $('slide');
      if (!el) return;
      el.className = 'slide t-' + (slides[showIdx].trans || 'none');
      void el.offsetWidth;                    /* перезапуск анимации */
      el.className = 'slide t-' + (slides[showIdx].trans || 'none') + ' entering';
      var k = mount(el, slides[showIdx], showIdx + 1, slides.length, 800);
      el.style.height = Math.round(Math.min(window.innerHeight * 0.72, VH * k)) + 'px';
      if ($('pNum')) $('pNum').innerHTML = showIdx + 1;
      if ($('pAll')) $('pAll').innerHTML = slides.length;
      if (showNotes) renderNotes();
    });
  }
  function next() {
    if (!slides.length) return;
    if (showIdx < slides.length - 1) { showIdx++; drawShow(); beep(900); }
    else alert('Это последний слайд.\nСпасибо за внимание!\n(автор просит пятёрку)');
  }
  function prev() {
    if (showIdx > 0) { showIdx--; drawShow(); beep(560); }
  }
  function formatTime(s) {
    var sec = Math.floor(s / 1000);
    var m = Math.floor(sec / 60);
    var ss = sec % 60;
    return pad(m, 2) + ':' + pad(ss, 2);
  }
  function updateShowTimer() {
    var el = $('pTimer');
    if (!el || !showTimerStart) return;
    showTimer = Date.now() - showTimerStart;
    el.innerHTML = formatTime(showTimer);
  }
  function closeShow() {
    showOpen = false;
    showBlack = false;
    showHelp = false;
    var sh = $('show');
    if (sh) sh.className = 'show';
    if ($('pHelp')) $('pHelp').className = 'phelp';
    if ($('showNotes')) { $('showNotes').className = 'pnotes hidden'; $('showNotes').innerHTML = ''; }
    if (window.showTimerInterval) { clearInterval(window.showTimerInterval); window.showTimerInterval = null; }
  }
  function renderNotes() {
    var el = $('showNotes');
    if (!el || !showOpen) return;
    var s = slides[showIdx] || {}, n = String(s.notes || '').trim();
    el.innerHTML = '<b>Заметки — слайд ' + (showIdx + 1) + '</b><br>' +
      (n ? esc(n).replace(/\n/g, '<br>') : '<i>заметок нет</i>');
  }
  function toggleBlack() {
    if (!showOpen) return;
    showBlack = !showBlack;
    var sh = $('show');
    if (sh) sh.className = 'show on' + (showBlack ? ' black' : '');
    if ($('pBlack')) $('pBlack').innerHTML = (showBlack ? 'ПОКАЗАТЬ' : 'ЧЁРНЫЙ') + ' (B)';
    beep(showBlack ? 300 : 900, 0.05);
  }
  function toggleHelp() {
    if (!showOpen) return;
    showHelp = !showHelp;
    if ($('pHelp')) $('pHelp').className = 'phelp' + (showHelp ? ' on' : '');
  }
  function toggleNotes() {
    if (!showOpen) return;
    showNotes = !showNotes;
    var el = $('showNotes');
    if (!el) return;
    if (showNotes) { renderNotes(); el.className = 'pnotes'; }
    else { el.className = 'pnotes hidden'; }
  }

  /* ==================================================================
     ЛОГОТИП: свой PNG — главный, нет — встроенный SVG
     ================================================================== */
  var FAVICON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230b5aa8'/%3E%3Crect x='7' y='7' width='50' height='50' fill='%23fff'/%3E%3Ctext x='30' y='49' text-anchor='middle' fill='%230b5aa8' font-family='Times New Roman' font-weight='bold' font-size='46'%3E%D0%9C%3C/text%3E%3Cpath d='M39 20 60 13 60 33 39 40z' fill='%23ff8a00'/%3E%3C/svg%3E";
  function setFavicon(href, type) {
    var link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'icon');
      document.head.appendChild(link);
    }
    link.setAttribute('type', type);
    link.setAttribute('href', href);
  }
  function initLogo() {
    var img = $('logoImg'), svg = $('logoSvg');
    if (!img) { logoReady = true; return; }
    function usePng() {
      logoReady = true;
      img.style.display = 'block';
      if (svg) svg.style.display = 'none';
      setFavicon('img/favicon-32.png', 'image/png');
      note('логотип: img/logo.png');
    }
    function useSvg() {
      logoReady = true;
      img.style.display = 'none';
      if (svg) svg.style.display = '';
      setFavicon(FAVICON_SVG, 'image/svg+xml');
    }
    img.onload = usePng;
    img.onerror = useSvg;
    if (img.complete) {
      if (img.naturalWidth > 0) usePng(); else useSvg();
    }
  }

  /* ==================================================================
     ГОСТЕВАЯ + СЧЁТЧИК + ВКЛАДКИ
     ================================================================== */
  var DEFAULT_GUEST = [
    { n: 'xXx_Химик_хXx', t: 'качал 3 часа. работает. спасибо!!!', d: '12.05.2003' },
    { n: 'Администратор', t: 'открыл pptx — слетели все шрифты. так и задумано?', d: '13.05.2003' },
    { n: 'Оля_228', t: 'презентация по биологии за 5 минут, 5+++ из 5', d: '17.05.2003' },
    { n: 'pentium_133', t: 'у меня пень 133, монолит летает. винда нет', d: '02.06.2003' }
  ];
  function guestAll() {
    var raw = lsGet(LS.guest), g = null;
    if (raw) { try { g = JSON.parse(raw); } catch (e) { g = null; } }
    return (g && g.length) ? g : deep(DEFAULT_GUEST);
  }
  function renderGuest() {
    var g = guestAll(), h = '', k;
    for (k = 0; k < g.length; k++) {
      h += '<div class="grec"><span class="dt">' + esc(g[k].d) + '</span><b>' + esc(g[k].n) +
        '</b>: ' + esc(g[k].t) + '</div>';
    }
    if ($('guestList')) $('guestList').innerHTML = h || '<div class="small">никто не расписался. будь первым!</div>';
    if ($('gCnt')) $('gCnt').innerHTML = g.length;
  }
  function addGuest() {
    var n = ($('gName').value || '').trim() || 'аноним';
    var t = ($('gText').value || '').trim();
    if (!t) { alert('Хоть отзыв напишите. Ник — не отзыв.'); return; }
    var g = guestAll();
    g.unshift({ n: n, t: t, d: new Date().toLocaleDateString('ru-RU') });
    if (g.length > 200) g = g.slice(0, 200);
    lsSet(LS.guest, JSON.stringify(g));
    $('gText').value = '';
    renderGuest();
    beep(1400, 0.09);
    note('записано в гостивую');
  }
  function hits() {
    var raw = lsGet(LS.hits);
    var n = (parseInt(raw, 10) || 41000) + 1;
    lsSet(LS.hits, String(n));
    if ($('hits')) $('hits').innerHTML = pad(n, 6);
  }
  /* вкладки ленты: .rtab + .rpanel (как в Документах) */
  function tab(name) {
    var bs = document.querySelectorAll('.rtab'), ps = document.querySelectorAll('.rpanel'), i;
    if (!bs.length) return;
    for (i = 0; i < bs.length; i++) {
      bs[i].className = 'rtab' + (bs[i].getAttribute('data-tab') === name ? ' on' : '');
      bs[i].setAttribute('aria-selected', bs[i].getAttribute('data-tab') === name ? 'true' : 'false');
    }
    for (i = 0; i < ps.length; i++) {
      ps[i].className = 'rpanel' + (ps[i].getAttribute('data-panel') === name ? ' on' : '');
    }
    rAF(drawCanvas);
  }
  function activeTab() {
    var b = document.querySelector('.rtab.on');
    return b ? b.getAttribute('data-tab') : 'home';
  }

  /* ==================================================================
     ПРИМЕР
     ================================================================== */
  var SAMPLE = [
    { title: 'КИСЛОТЫ И ЩЕЛОЧИ', text: 'доклад по химии\nученика 9 "Б" класса\n2003 год', design: 'd-blue', font: FONTS[1], size: 32, trans: 'blinds' },
    { title: 'ЧТО ТАКОЕ КИСЛОТА', text: 'это вещество, которое даёт ион H+\nкрасит лакмус в красный цвет\nшипит, если бросить цинк\n\n- лимонную кислоту есть можно\n- серную - нельзя', design: 'd-white', font: FONTS[0], size: 24, trans: 'slide' },
    { title: 'ФОРМУЛЫ', text: 'HCl  - соляная кислота\nH2SO4 - серная кислота\nHNO3 - азотная кислота\nNaOH - щёлочь\nKOH  - тоже щёлочь', design: 'd-green', font: FONTS[4], size: 26, trans: 'zoom' },
    { title: 'ОПЫТ', text: 'налили кислоту в колбу\nбросили цинк\nпошли пузырьки\nвсё прошло хорошо\n\nВЫВОД: реакция идёт', design: 'd-star', font: FONTS[2], size: 26, trans: 'blinkit' },
    { title: 'СПАСИБО ЗА ВНИМАНИЕ', text: 'оцените пожалуйста на 5\n\nпрезентация сделана в\nПРЕЗЕНТАЦИИ МОНОЛИТ 2000', design: 'd-red', font: FONTS[0], size: 30, trans: 'blinds' }
  ];

  /* ==================================================================
     СТАРТ
     ================================================================== */
  function need(id) {
    var el = $(id);
    if (!el) throw new Error('нет элемента #' + id);
    return el;
  }
  function injectTools() {
    var host = $('btnRevert');
    if (host && host.parentNode && !$('btnUndo')) {
      var b = document.createElement('button');
      b.className = 'btn98'; b.id = 'btnUndo';
      b.title = 'отменить последнее действие (Ctrl+Z)';
      b.innerHTML = '&#8630; Ctrl+Z';
      b.onclick = undo;
      host.parentNode.insertBefore(b, host.nextSibling);
    }
  }
  /* кнопка есть не в каждой вкладке — вешаем обработчик только если нашли */
  function on(id, fn) {
    var el = $(id);
    if (el) el.onclick = fn;
    return el;
  }
  function init() {
    var k;
    buildStatus();
    try { setInterval(tick, 1000); } catch (e) {}
    tick();

    /* выпадающие списки конструктора */
    var sel1 = $('fDesign');
    if (sel1) {
      for (k = 0; k < DESIGNS.length; k++) {
        var o = document.createElement('option');
        o.value = DESIGNS[k].id;
        o.innerHTML = esc(DESIGNS[k].name);
        sel1.appendChild(o);
      }
    }
    loadAutoFlag();
    if ($('autoState')) $('autoState').innerHTML = auto ? 'вкл' : 'выкл';

    /* --- восстановление из автосохранения --- */
    var restored = loadStored();
    if (sel < 0 && restored) sel = 0;
    renderGuest();
    hits();
    initLogo();
    if (restored && slides.length) {
      sel = 0;
      draft = copy(slides[0]);
      fillForm(draft);
      renderAll();
      note('восстановлено из автосохранения: слайдов ' + slides.length, true);
    } else {
      sel = -1;
      draft = blank();
      fillForm(draft);
      renderAll();
    }
    updateStatus();

    /* вкладки ленты */
    var bs = document.querySelectorAll('.rtab');
    for (k = 0; k < bs.length; k++) {
      (function (b) { b.onclick = function () { tab(b.getAttribute('data-tab')); beep(600); }; })(bs[k]);
    }
    if (bs.length) tab(bs[0].getAttribute('data-tab'));

    /* поля конструктора — живое превью */
    ['fTitle', 'fText', 'fDesign', 'fFont', 'fSize', 'fTrans', 'fPage', 'fStamp', 'fNotes'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.oninput = onFormChange;
      el.onchange = onFormChange;
    });
    if ($('fTitle')) {
      $('fTitle').onkeydown = function (e) {
        if (e.keyCode === 13) { e.preventDefault(); if ($('fText')) $('fText').focus(); }
      };
    }

    /* слайды */
    on('btnNew', newSlide);
    on('btnShow', openShow);
    on('btnDup', dupSlide);
    on('btnUp', function () { moveSlide(-1); });
    on('btnDown', function () { moveSlide(1); });
    on('btnDel', delSlide);
    on('btnTpl', function () {
      if (showOpen) { alert('Сначала выйди из показа.'); return; }
      if (slides.length && !confirm('Пример перезапишет то, что есть. Ладно?')) return;
      pushUndo('загрузка примера');
      slides = deep(SAMPLE);
      for (k = 0; k < slides.length; k++) {
        slides[k] = norm(slides[k]);
        if (!slides[k].blocks.length) slides[k].blocks = defBlocks(slides[k]);
        syncText(slides[k]);
      }
      if ($('fName')) $('fName').value = 'Кислоты и щелочи';
      sel = 0; draft = copy(slides[0]); fillForm(draft);
      renderAll(); queueSave();
      note('загружен пример: ' + slides.length + ' слайдов');
      beep(1200);
    });
    on('btnAll', function () { clearAll(false); });
    on('btnUndo', undo);

    /* блоки на слайде */
    on('btnAddBlk', function () { addBlock(); });
    on('btnDelBlk', delBlock);
    on('btnClearBlk', function () {
      if (selBlk < 0) { note('блок не выбран'); return; }
      pushUndo('очистка блока');
      blkPatch({ t: '' }, 'очистка блока');
    });
    on('btnCenterBlk', function () { blkAlign('center'); });
    on('btnMidBlk', function () {
      var b = blkAt(selBlk);
      if (!b) { note('сначала выбери блок'); return; }
      /* по центру по горизонтали и вертикали сразу */
      pushUndo('блок в центр');
      blkPatch({ x: Math.round((100 - b.w) / 2 * 10) / 10, y: Math.round((100 - b.h) / 2 * 10) / 10 }, 'блок в центр');
    });

    /* конструктор (старые кнопки, если есть) */
    on('btnApply', apply);
    on('btnAddAfter', addAfter);
    on('btnRevert', revert);
    injectTools();

    /* файл */
    on('btnSaveMono', saveMono);
    on('btnSaveTxt', saveTxt);
    on('btnSaveHtm', saveHtm);
    on('btnOpenMono', function () { var f = $('fileMono'); if (f) f.click(); });
    if ($('fileMono')) $('fileMono').onchange = function () { handleFile(this.files[0]); this.value = ''; };
    on('btnAuto', function () {
      auto = !auto;
      if ($('autoState')) $('autoState').innerHTML = auto ? 'вкл' : 'выкл';
      saveAutoFlag();
      updateStatus();
      if (auto) { saveNow(); note('автосохранение включено'); } else note('автосохранение выключено');
    });
    if ($('fName')) $('fName').onchange = function () { queueSave(); updateStatus(); };

    /* импорт */
    if ($('filePpt')) $('filePpt').onchange = function () { handleFile(this.files[0]); this.value = ''; };
    on('btnQuick', function () { var f = $('filePpt'); if (f) f.click(); });
    var dz = $('drop');
    if (dz) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.className = 'drop hot'; });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.className = 'drop'; });
      });
    }

    /* глобальный drag&drop с оверлеем */
    var ov = $('dropOv'), depth = 0;
    function hasFiles(e) {
      var t = e.dataTransfer && e.dataTransfer.types;
      if (!t) return false;
      for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true;
      return false;
    }
    window.addEventListener('dragenter', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth++;
      if (ov) ov.className = 'dropov on';
    });
    window.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', function () {
      depth = Math.max(0, depth - 1);
      if (!depth && ov) ov.className = 'dropov';
    });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      if (ov) ov.className = 'dropov';
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f); else note('файл не найден в перетаскивании');
    });

    /* гостевая */
    on('btnGuest', addGuest);
    if ($('gText')) $('gText').onkeydown = function (e) { if (e.keyCode === 13) addGuest(); };
    if ($('lnkTop')) $('lnkTop').onclick = function () { window.scrollTo(0, 0); return false; };

    /* показ */
    on('pNext', next);
    on('pPrev', prev);
    on('pExit', closeShow);
    on('pBlack', toggleBlack);
    on('pNotes', toggleNotes);
    on('pHelpClose', toggleHelp);
    if ($('slide')) $('slide').onclick = next;

    /* горячие клавиши */
    document.addEventListener('keydown', function (e) {
      var k = e.keyCode, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement ?
        document.activeElement.tagName : '');
      if (showOpen) {
        if (k === 27) { closeShow(); return; }
        if (k === 66) { e.preventDefault(); toggleBlack(); return; }
        if (k === 78) { e.preventDefault(); toggleNotes(); return; }
        if (k === 112) { e.preventDefault(); toggleHelp(); return; }
        if (showHelp && (k === 39 || k === 32 || k === 13 || k === 34)) { e.preventDefault(); toggleHelp(); return; }
        if (k === 39 || k === 32 || k === 13 || k === 34) { e.preventDefault(); next(); return; }
        if (k === 37 || k === 33) { e.preventDefault(); prev(); return; }
        if (k === 36) { e.preventDefault(); showIdx = 0; drawShow(); return; }
        if (k === 35) { e.preventDefault(); showIdx = slides.length - 1; drawShow(); return; }
        return;
      }
      /* печатаем внутри блока — отдаём клавиши редактору текста */
      var inBlk = /btx/.test(document.activeElement ? String(document.activeElement.className) : '');
      if (e.ctrlKey || e.metaKey) {
        if (k === 90) { e.preventDefault(); undo(); return; }
        if (inBlk && (k === 66 || k === 73 || k === 85)) { return; }   /* Ctrl+B/I/U — браузер сам */
        if (typing) return;
        if (k === 78) { e.preventDefault(); newSlide(); return; }
        if (k === 83) { e.preventDefault(); saveMono(); return; }
        if (k === 69) { e.preventDefault(); saveMono(); return; }
        if (k === 79) { e.preventDefault(); var fp = $('filePpt'); if (fp) fp.click(); return; }
        if (k === 80) { e.preventDefault(); openShow(); return; }
        if (k === 68) { e.preventDefault(); if (selBlk >= 0) blkAlign('center'); return; }
        if (k === 76) { e.preventDefault(); if (selBlk >= 0) blkAlign('left'); return; }
        if (k === 82) { e.preventDefault(); if (selBlk >= 0) blkAlign('right'); return; }
        return;
      }
      if (inBlk) return;
      if (typing) return;
      if (k === 46 && sel >= 0) {
        e.preventDefault();
        if (selBlk >= 0) delBlock(); else delSlide();
      }
      if (k === 9 && sel >= 0) { e.preventDefault(); addBlock(); }
    });

    /* перерисовка после layout'а и при изменении размеров окна.
       Размеры сцены меняются не только при resize окна: полосы ленты
       переключаются, панель блоков появляется — поэтому слушаем и их. */
    var rz = null;
    function refit() {
      if (rz) clearTimeout(rz);
      rz = setTimeout(function () {
        drawCanvas();
        if (showOpen) drawShow();
      }, 60);
    }
    window.addEventListener('resize', function () {
      if (rz) clearTimeout(rz);
      rz = setTimeout(function () {
        renderList();
        drawCanvas();
        if (showOpen) drawShow();
      }, 80);
    });
    if (window.ResizeObserver) {
      try {
        var ro = new ResizeObserver(refit);
        var sw = document.querySelector('.stagewrap');
        if (sw) ro.observe(sw);
      } catch (e) { }
    }
    window.addEventListener('load', function () {
      renderList();
      rAF(drawCanvas);
      if (showOpen) drawShow();
    });
    rAF(function () { renderList(); drawCanvas(); updateStatus(); });

    /* ===== публичный доступ для ленты (presentation/js/ribbon.js) ===== */
    window.MonolitPres = {
      state: function () {
        var b = blkAt(selBlk);
        return {
          slides: slides.length, sel: sel, blk: selBlk, tab: activeTab(),
          design: draft ? draft.design : '', font: draft ? draft.font : '', size: draft ? draft.size : 24,
          trans: draft ? draft.trans : '', page: draft ? draft.page : true, stamp: draft ? draft.stamp : true,
          blocks: curBlocks().length,
          block: b ? copy(b) : null,
          differs: draftDiffers(), showOpen: showOpen
        };
      },
      doc: function () { return slides; },
      blocks: curBlocks,
      select: select,
      newSlide: newSlide, addAfter: addAfter, dupSlide: dupSlide,
      moveSlide: moveSlide, delSlide: delSlide, undo: undo,
      addBlock: addBlock, delBlock: delBlock, clearBlk: function () {
        if (selBlk < 0) { note('блок не выбран'); return; }
        pushUndo('очистка блока');
        blkPatch({ t: '' }, 'очистка блока');
      },
      mark: blkMark, align: blkAlign, blkFont: blkFont, blkColor: blkColor, blkSize: blkSize,
      autofit: autofitBlock,
      selBlk: function (i) {
        selBlk = num(i);
        if (selBlk < 0 || selBlk >= curBlocks().length) selBlk = -1;
        paintBlk();
      },
      setDesign: function (d) {
        var el = $('fDesign');
        if (el) el.value = d;
        onFormChange({ target: { id: 'fDesign' } });
      },
      setFont: function (f) {
        var el = $('fFont');
        if (el) el.value = f;
        onFormChange({ target: { id: 'fFont' } });
      },
      setSize: function (v) {
        var el = $('fSize');
        if (el) el.value = v;
        onFormChange({ target: { id: 'fSize' } });
      },
      setTrans: function (t) {
        var el = $('fTrans');
        if (el) el.value = t;
        onFormChange({ target: { id: 'fTrans' } });
      },
      setPage: function (v) { var el = $('fPage'); if (el) el.checked = !!v; onFormChange({ target: { id: 'fPage' } }); },
      setStamp: function (v) { var el = $('fStamp'); if (el) el.checked = !!v; onFormChange({ target: { id: 'fStamp' } }); },
      show: openShow, next: next, prev: prev, closeShow: closeShow,
      saveMono: saveMono, saveHtm: saveHtm, saveTxt: saveTxt,
      openFile: function () { var f = $('fileMono'); if (f) f.click(); },
      quick: function () { var f = $('filePpt'); if (f) f.click(); },
      template: function () { var b = $('btnTpl'); if (b) b.onclick && b.onclick(); },
      wipe: function () { clearAll(false); },
      tab: tab, redraw: drawCanvas, refresh: renderAll,
      grid: function (on) {
        var si = stageSlide();
        if (!si) return;
        if (on) { if (si.className.indexOf('grid') < 0) si.className += ' grid'; }
        else si.className = String(si.className).replace(/\s*grid\b/g, '');
      },
      paintBlk: paintBlk,
      note: note
    };
  }

  try { init(); }
  catch (e) {
    /* движок упал — показываем, но не молча */
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:99999;background:#400;color:#fff;' +
      'font:12px Tahoma;padding:8px;border:2px solid #f00';
    box.textContent = 'Монолит не запустился: ' + (e && e.message ? e.message : e) +
      '. Открой консоль (F12) или напиши разработчику.';
    document.body.appendChild(box);
    if (window.console && console.error) console.error(e);
  }
})();
