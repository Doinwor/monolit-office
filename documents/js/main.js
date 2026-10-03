/* ==================================================================
   ДОКУМЕНТЫ МОНОЛИТ 2000 — редактор. Блокнот. Windows 98.
   Формат: .mono (наш) + открываем .docx/.htm/.txt + сохраняем .docx.
   ================================================================== */
(function () {
  'use strict';

  var LS = { doc: 'monolit-doc-v1', auto: 'monolit-doc-auto' };
  var MAXUNDO = 40;
  var MAXBLOCKS = 4000;

  var FONTS = {
    tah: 'Tahoma, Verdana, Arial, sans-serif',
    times: "'Times New Roman', serif",
    comic: "'Comic Sans MS', cursive",
    arial: 'Arial, Helvetica, sans-serif',
    impact: 'Impact, fantasy',
    courier: "'Courier New', monospace"
  };
  var FONT_KEYS = {
    'tahoma': 'tah', 'times new roman': 'times', 'comic sans ms': 'comic',
    'arial': 'arial', 'helvetica': 'arial', 'impact': 'impact', 'courier new': 'courier',
    'verdana': 'tah'
  };
  var STYLE_OK = { p: 1, h1: 1, h2: 1, h3: 1, li: 1, ol: 1, quote: 1, pre: 1 };
  var AL_OK = { left: 1, center: 1, right: 1, just: 1 };
  var FONT_OK = { tah: 1, times: 1, comic: 1, arial: 1, impact: 1, courier: 1 };
  var HEX_OK = /^#[0-9a-fA-F]{6}$/;
  var LINK_OK = /^(https?:\/\/|mailto:|tel:|#|\/|\.\/)[^\s]*$/i;

  var doc = null;
  var sel = 0;
  var draft = null;
  var dirty = false;
  var auto = true;
  var saveTimer = null;
  var undoStack = [], redoStack = [];
  var lastPush = 0;
  var sound = true;
  var rafPending = 0;
  var noteTimer = 0;
  var clockTimer = 0;
  var findPos = 0;
  var findAt = 0;
  var zoomPct = 100;
  var pageMode = 'port';
  var guides = false;
  var ruler = true;
  var marks = true;

  function $(id) { return document.getElementById(id); }
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
  function clamp(v, a, b) { v = num(v); if (v < a) v = a; if (v > b) v = b; return v; }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) || !isFinite(n) ? null : n; }
  function on(v) { return v === true || v === 1 || v === '1' || v === 'on' || v === 'да'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function deBom(s) { return String(s == null ? '' : s).replace(/^\ufeff/, ''); }
  function rAF(fn) {
    if (rafPending) return;
    rafPending = requestAnimationFrame(function () { rafPending = 0; fn(); });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function beep(f, d) {
    if (!sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      beep.ctx = beep.ctx || new AC();
      var ctx = beep.ctx;
      if (ctx.state === 'suspended') ctx.resume();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f || 720;
      g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (d || 0.04));
      o.stop(ctx.currentTime + (d || 0.04) + 0.01);
    } catch (e) { }
  }

  /* ==================================================================
     МОДЕЛЬ
     ================================================================== */
  function blankBlock() {
    return { t: '', s: 'p', b: 0, i: 0, u: 0, sup: 0, sub: 0, st: 0, hl: 0,
      al: 'left', f: 'tah', z: 12, c: '', sp: 0, lh: 0, ind: 0, href: '', img: '' };
  }
  function normBlock(b) {
    b = (b && typeof b === 'object') ? b : {};
    return {
      t: String(b.t == null ? '' : b.t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''),
      s: STYLE_OK[b.s] ? b.s : 'p',
      b: on(b.b) ? 1 : 0,
      i: on(b.i) ? 1 : 0,
      u: on(b.u) ? 1 : 0,
      sup: on(b.sup) ? 1 : 0,
      sub: on(b.sub) ? 1 : 0,
      st: on(b.st) ? 1 : 0,
      hl: on(b.hl) ? 1 : 0,
      al: AL_OK[b.al] ? b.al : 'left',
      f: FONT_OK[b.f] ? b.f : 'tah',
      z: clamp(num(b.z) == null ? 12 : num(b.z), 9, 40),
      c: (typeof b.c === 'string' && HEX_OK.test(b.c)) ? b.c.toLowerCase() : '',
      sp: clamp(num(b.sp) == null ? 0 : num(b.sp), 0, 40),
      lh: clamp(num(b.lh) == null ? 0 : num(b.lh), 0, 300),
      ind: clamp(num(b.ind) == null ? 0 : num(b.ind), 0, 120),
      href: (typeof b.href === 'string' && b.href.length <= 300 && LINK_OK.test(b.href)) ? b.href : '',
      img: (typeof b.img === 'string' && b.img.length < 6000000 && /^data:image\//.test(b.img)) ? b.img : ''
    };
  }
  function normAll(list) {
    var out = [], k;
    if (!Array.isArray(list)) return out;
    for (k = 0; k < list.length && out.length < MAXBLOCKS; k++) out.push(normBlock(list[k]));
    return out;
  }
  function blankDoc() {
    return { v: 1, title: 'Мой документ', blocks: [normBlock({ t: 'Первый абзац. Печатай тут.' })] };
  }
  function normDoc(o) {
    o = (o && typeof o === 'object') ? o : {};
    var blocks = normAll(o.blocks);
    if (!blocks.length) blocks = [blankBlock()];
    return {
      v: 1,
      title: String(o.title == null ? 'Мой документ' : o.title).slice(0, 70) || 'Мой документ',
      blocks: blocks
    };
  }
  function styleName(id) {
    return { p: 'обычный', h1: 'заголовок 1', h2: 'заголовок 2', h3: 'заголовок 3',
      li: 'точками', ol: 'номерами', quote: 'цитата', pre: 'моно' }[id] || id;
  }
  function countWords(blocks) {
    var n = 0, k, j, parts;
    for (k = 0; k < blocks.length; k++) {
      parts = String(blocks[k].t || '').split(/\s+/);
      for (j = 0; j < parts.length; j++) if (parts[j]) n++;
    }
    return n;
  }
  function countChars(blocks) {
    var n = 0, k;
    for (k = 0; k < blocks.length; k++) n += String(blocks[k].t || '').length;
    return n;
  }
  function textOf(blocks) {
    var out = [], k, b, lines, j, n = 0;
    for (k = 0; k < blocks.length; k++) {
      b = blocks[k];
      if (b.s === 'ol') {
        n++;
        lines = String(b.t).split('\n');
        for (j = 0; j < lines.length; j++) out.push(n + '. ' + lines[j]);
      } else if (b.s === 'li') {
        lines = String(b.t).split('\n');
        for (j = 0; j < lines.length; j++) out.push('• ' + lines[j]);
      } else {
        out.push(String(b.t));
      }
    }
    return out.join('\n');
  }
  function outlineText(b, max) {
    var t = String(b.t || '').replace(/\s+/g, ' ').trim();
    if (!t) t = '(' + styleName(b.s) + ')';
    if (t.length > max) t = t.slice(0, max - 1) + '…';
    return t;
  }

  /* ==================================================================
     СТАТУС-БАР
     ================================================================== */
  function buildStatus() {
    if ($('stBar')) return;
    var d = document.createElement('div');
    d.className = 'statusbar'; d.id = 'stBar';
    d.innerHTML = '<span id="stName">документ</span>' +
      '<span id="stCount">абзацев: 0</span>' +
      '<span id="stWords">слов: 0</span>' +
      '<span id="stChars">знаков: 0</span>' +
      '<span id="stTime">0 мин</span>' +
      '<span id="stSel">абзац: —</span>' +
      '<span id="stDirty">сохранено</span>' +
      '<span id="stAuto">автосохр: вкл</span>' +
      '<span id="stNote"></span>' +
      '<span id="stClock">--:--:--</span>';
    /* строка состояния должна быть последней внутри приложения,
       иначе при body{overflow:hidden} её не будет видно */
    var app = document.querySelector('.app');
    if (app) {
      var marq = document.querySelector('.marq');
      if (marq && marq.parentNode === app) app.insertBefore(d, marq);
      else app.appendChild(d);
    } else {
      document.body.appendChild(d);
    }
  }
  function note(t, sticky) {
    var el = $('stNote');
    if (!el) return;
    el.innerHTML = esc(t);
    if (noteTimer) clearTimeout(noteTimer);
    if (t && !sticky) noteTimer = setTimeout(function () { el.innerHTML = ''; }, 4000);
  }
  function draftDiffers() {
    if (!draft) return false;
    var a = normBlock(draft), b = normBlock(doc.blocks[sel]);
    return a.t !== b.t || a.s !== b.s || a.b !== b.b || a.i !== b.i || a.u !== b.u ||
      a.al !== b.al || a.f !== b.f || a.z !== b.z || a.c !== b.c ||
      a.sp !== b.sp || a.ind !== b.ind;
  }
  function updateStatus() {
    var nm = $('fName'), d;
    if ($('stName')) $('stName').innerHTML = esc((nm && nm.value) || 'документ') + ' <b>.mono</b>';
    if ($('stCount')) $('stCount').innerHTML = 'абзацев: ' + doc.blocks.length;
    if ($('stWords')) $('stWords').innerHTML = 'слов: ' + countWords(doc.blocks);
    if ($('stSel')) $('stSel').innerHTML = 'абзац: ' + (sel >= 0 && sel < doc.blocks.length ? (sel + 1) : '—');
    d = $('stDirty');
    if (d) {
      if (draftDiffers()) { d.className = 'rd'; d.innerHTML = 'правки не применены'; }
      else if (dirty) { d.className = 'rd'; d.innerHTML = 'НЕ СОХРАНЕНО'; }
      else { d.className = 'gr'; d.innerHTML = 'сохранено'; }
    }
    if ($('stAuto')) $('stAuto').innerHTML = 'автосохр: ' + (auto ? 'вкл' : 'выкл');
  }
  function tick() {
    var d = new Date(), el = $('stClock');
    if (el) el.innerHTML = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }
  function updateCounters() {
    /* счётчики живут в строке состояния */
    var w = $('stWords');
    if (w) w.innerHTML = 'слов: ' + countWords(doc.blocks);
    var ch = $('stChars');
    if (ch) ch.innerHTML = 'знаков: ' + countChars(doc.blocks);
    var pa = $('stCount');
    if (pa) pa.innerHTML = 'абзацев: ' + doc.blocks.length;
    var tm = $('stTime');
    if (tm) tm.innerHTML = 'читать: ' + Math.max(1, Math.round(countWords(doc.blocks) / 130)) + ' мин';
    updateStatus();
  }

  /* ==================================================================
     ОТКАТ
     ================================================================== */
  function snapshot() {
    return JSON.stringify({ title: doc.title, blocks: doc.blocks });
  }
  function pushUndo(force) {
    var now = new Date().getTime();
    if (!force && now - lastPush < 700 && undoStack.length) return;
    lastPush = now;
    undoStack.push(snapshot());
    if (undoStack.length > MAXUNDO) undoStack.shift();
    redoStack.length = 0;
  }
  /* для набора текста: снимок делается ДО изменения модели, курсор печатает сериями */
  function typingUndo() {
    var now = new Date().getTime();
    if (undoStack.length && now - lastPush < 700) return;
    lastPush = now;
    undoStack.push(snapshot());
    if (undoStack.length > MAXUNDO) undoStack.shift();
    redoStack.length = 0;
  }
  function applySnapshot(s) {
    var o;
    try { o = JSON.parse(s); } catch (e) { return; }
    doc.blocks = normAll(o.blocks);
    doc.title = String(o.title == null ? doc.title : o.title).slice(0, 70) || 'Мой документ';
    if (sel >= doc.blocks.length) sel = doc.blocks.length - 1;
    if (sel < 0) sel = 0;
    renderAll();
  }
  function undo() {
    if (!undoStack.length) { note('отменять нечего'); return; }
    redoStack.push(snapshot());
    applySnapshot(undoStack.pop());
    markDirty();
    note('отменено. осталось ' + undoStack.length);
    beep(300, 0.03);
  }
  function redo() {
    if (!redoStack.length) { note('возвращать нечего'); return; }
    undoStack.push(snapshot());
    applySnapshot(redoStack.pop());
    markDirty();
    note('возвращено');
    beep(520, 0.03);
  }

  /* ==================================================================
     АВТОСОХРАНЕНИЕ
     ================================================================== */
  function markDirty() { dirty = true; queueSave(); updateStatus(); }
  function packNow() {
    return JSON.stringify({ v: 1, when: new Date().getTime(), title: doc.title, blocks: doc.blocks });
  }
  function saveNow(quiet) {
    if (!auto && !quiet) { note('автосохранение выключено', true); return false; }
    var okSave = lsSet(LS.doc, packNow());
    if (okSave) {
      dirty = false;
      if (!quiet) note('сохранено у нас в программе');
    } else if (!quiet) {
      note('не смогли сохранить: память браузера кончилась', true);
    }
    updateStatus();
    return okSave;
  }
  function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = 0; saveNow(true); }, 700);
  }
  function loadStored() {
    var raw = lsGet(LS.doc);
    if (!raw) return false;
    try {
      var o = JSON.parse(raw);
      if (!o || !o.blocks || !o.blocks.length) return false;
      doc = normDoc(o);
      return true;
    } catch (e) { return false; }
  }
  function loadAutoFlag() {
    var v = lsGet(LS.auto);
    auto = (v === 'off') ? false : true;
  }
  function saveAutoFlag() { lsSet(LS.auto, auto ? 'on' : 'off'); }

  /* ==================================================================
     ЛИСТ А4
     ================================================================== */
  function blockClass(b, num) {
    var c = 'blk s-' + b.s;
    if (b.b) c += ' b';
    if (b.i) c += ' i';
    if (b.u) c += ' u';
    if (b.sup) c += ' sup';
    if (b.sub) c += ' sub';
    if (b.st) c += ' st';
    if (b.hl) c += ' hl';
    c += ' al-' + b.al;
    return c;
  }
  function blockStyle(b) {
    var s = 'font-size:' + b.z + 'pt;font-family:' + FONTS[b.f];
    if (b.c) s += ';color:' + b.c;
    if (b.ind) s += ';margin-left:' + b.ind + 'px';
    if (b.sp) s += ';margin-top:' + b.sp + 'px';
    if (b.lh) s += ';line-height:' + (b.lh / 100);
    return s;
  }
  function blockHtml(b, i, num) {
    if (b.img) {
      return '<div class="' + blockClass(b, num) + ' s-img" data-i="' + i + '" style="' + blockStyle(b) +
        '" contenteditable="false"><img src="' + esc(b.img) + '" alt="изображение"></div>';
    }
    var t = esc(b.t).replace(/\n/g, '<br>');
    if (b.s === 'ol') t = '<span class="olnum">' + num + '.</span>' + t;
    var inner = t || '<br>';
    if (b.href) inner = '<a class="blk-link" href="' + esc(b.href) + '" target="_blank" rel="noopener">' + inner + '</a>';
    return '<div class="' + blockClass(b, num) + '" data-i="' + i + '" style="' + blockStyle(b) + '">' + inner + '</div>';
  }
  function pageHtml(blocks) {
    var out = [], k, n = 0;
    for (k = 0; k < blocks.length; k++) {
      if (blocks[k].s === 'ol') n++; else n = 0;
      out.push(blockHtml(blocks[k], k, n));
    }
    return out.join('');
  }
  function renderPage() {
    var page = $('page');
    if (!page) return;
    var sc = page.scrollTop;
    var keep = saveCaret();
    page.innerHTML = pageHtml(doc.blocks);
    page.scrollTop = sc;
    var pr = $('printPage');
    if (pr) pr.innerHTML = pageHtml(doc.blocks);
    applySelClass();
    if (keep) setCaret(keep.i, keep.off);
  }
  function blockEl(i) {
    var els = $('page') ? $('page').getElementsByTagName('div') : [], k;
    for (k = 0; k < els.length; k++) if (num(els[k].getAttribute('data-i')) === i) return els[k];
    return null;
  }
  /* перерисовать один абзац на месте: курсор при этом не теряется */
  function updateBlockDom(i) {
    var el = blockEl(i), b = doc.blocks[i], n = 0, k;
    if (!el || !b) return;
    /* номер считаем по такой же логике, как в pageHtml: подряд идущие ol */
    for (k = i - 1; k >= 0 && doc.blocks[k] && doc.blocks[k].s === 'ol'; k--) n++;
    n = n + 1;
    el.className = blockClass(b, n) + (i === sel ? ' sel' : '');
    el.style.cssText = blockStyle(b);
    var old = el.getElementsByTagName('span')[0];
    if (b.s === 'ol') {
      if (old && old.className === 'olnum') old.innerHTML = n + '.';
      else el.insertBefore(sp('olnum', n + '.'), el.firstChild);
    } else if (old && old.className === 'olnum') {
      el.removeChild(old);
    }
  }
  function sp(cls, html) {
    var s = document.createElement('span');
    s.className = cls;
    s.innerHTML = html;
    return s;
  }
  /* ---- курсор: запомнить и вернуть после перерисовки ---- */
  function saveCaret() {
    var page = $('page');
    if (!page) return null;
    var s = null;
    try { s = window.getSelection(); } catch (e) { return null; }
    if (!s || !s.rangeCount) return null;
    var r = s.getRangeAt(0);
    if (!page.contains(r.startContainer) && r.startContainer !== page) return null;
    var el = blockOf(r.startContainer);
    if (!el) return null;
    return { i: num(el.getAttribute('data-i')), off: offsetIn(el, r) };
  }
  function setCaret(i, off) {
    var el = blockEl(i);
    if (!el) return false;
    try {
      el.focus();
      var r = document.createRange();
      var at = pointAt(el, Math.max(0, off || 0));
      r.setStart(at.node, at.off);
      r.collapse(true);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      return true;
    } catch (e) { return false; }
  }
  function blockOf(node) {
    var page = $('page');
    while (node && node !== page) {
      if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-i') != null) return node;
      node = node.parentNode;
    }
    return null;
  }
  function textNodes(el, out) {
    out = out || [];
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) out.push(c);
      else if (c.nodeType === 1) textNodes(c, out);
    }
    return out;
  }
  function offsetIn(el, range) {
    var nodes = textNodes(el), seen = 0, k;
    for (k = 0; k < nodes.length; k++) {
      if (nodes[k] === range.startContainer) return seen + range.startOffset;
      seen += String(nodes[k].nodeValue || '').length;
    }
    return seen;
  }
  function pointAt(el, off) {
    var nodes = textNodes(el), seen = 0, k, n;
    for (k = 0; k < nodes.length; k++) {
      n = String(nodes[k].nodeValue || '').length;
      if (seen + n >= off) return { node: nodes[k], off: Math.max(0, off - seen) };
      seen += n;
    }
    if (nodes.length) return { node: nodes[nodes.length - 1], off: String(nodes[nodes.length - 1].nodeValue || '').length };
    return { node: el, off: 0 };
  }
  /* диапазон выделенных абзацев: [первый..последний] */
  function selRange() {
    var page = $('page');
    var a = null, b = null, s = null;
    if (page) { try { s = window.getSelection(); } catch (e) { } }
    if (s && s.rangeCount) {
      var r = s.getRangeAt(0);
      var e1 = blockOf(r.startContainer), e2 = blockOf(r.endContainer);
      if (e1) a = num(e1.getAttribute('data-i'));
      if (e2) b = num(e2.getAttribute('data-i'));
    }
    /* текущий абзац (тот, что подсвечен лентой) всегда входит в диапазон —
       иначе оформление уходит не туда, куда смотрит пользователь */
    if (a == null) a = sel; else if (sel < a) a = sel;
    if (b == null) b = sel; else if (sel > b) b = sel;
    if (a > b) { var t = a; a = b; b = t; }
    return { a: a, b: b };
  }
  function applySelClass() {
    var els = $('page') ? $('page').getElementsByTagName('div') : [], k;
    for (k = 0; k < els.length; k++) {
      var i = num(els[k].getAttribute('data-i'));
      if (i === null) continue;
      if (i === sel) els[k].className = els[k].className.replace(/\s*sel\b/, '') + ' sel';
      else els[k].className = els[k].className.replace(/\s*sel\b/, '');
    }
  }
  function fitPage() {
    var wrap = $('paperScale'), page = $('page');
    if (!wrap || !page) return;
    var avail = (page.parentNode.parentNode.clientWidth || 700) - 16;
    var w = page.offsetWidth || 640;
    /* вписывание — только если пользователь не выставил свой масштаб */
    var fit = avail > 0 ? Math.min(1, avail / w) : 1;
    var k = fit * (zoomPct / 100);
    wrap.style.transform = 'scale(' + k + ')';
    if ($('zoomOut')) $('zoomOut').innerHTML = zoomPct;
    if ($('rbZoom')) $('rbZoom').innerHTML = zoomPct;
    var wrap2 = $('paperScale2');
    if (wrap2) wrap2.style.transform = 'scale(' + k + ')';
    var pg = $('page');
    if (pg) {
      pg.style.background = guides
        ? 'repeating-linear-gradient(90deg,transparent 0 31px,#e8eef8 31px 32px)'
        : '#fff';
    }
  }
  function renderOutline() {
    var box = $('outline'), k, out = [];
    if (!box) return;
    for (k = 0; k < doc.blocks.length; k++) {
      out.push('<span class="ol s-' + doc.blocks[k].s + (k === sel ? ' sel' : '') +
        '" data-i="' + k + '">' + esc(outlineText(doc.blocks[k], 34)) + '</span>');
    }
    box.innerHTML = out.join('');
    if ($('cnt')) $('cnt').innerHTML = doc.blocks.length;
    if ($('emptyNote')) $('emptyNote').style.display = doc.blocks.length ? 'none' : '';
  }
  function renderAll() {
    renderPage();
    renderOutline();
    fillForm();
    updateCounters();
    fitPage();
  }

  /* ==================================================================
     ВЫБОР И ПРАВКА
     ================================================================== */
  function select(i, noFocus) {
    if (i < 0 || i >= doc.blocks.length) return;
    if (draft && draftDiffers()) { draft = null; }
    sel = i;
    fillForm();
    applySelClass();
    renderOutline();
    updateStatus();
    curInfo();
    if ($('ctorTitle')) {
      $('ctorTitle').innerHTML = 'КОНСТРУКТОР — абзац ' + (i + 1) + ' из ' + doc.blocks.length +
        ' (' + styleName(doc.blocks[i].s) + ')';
    }
    if (!noFocus) {
      var els = $('page').getElementsByTagName('div'), k;
      for (k = 0; k < els.length; k++) {
        if (num(els[k].getAttribute('data-i')) === i) {
          try { els[k].scrollIntoView({ block: 'nearest' }); } catch (e) { }
          break;
        }
      }
    }
  }
  /* оформление абзаца читается из панели и применяется сразу, как в ворде */
  function formPatch() {
    var st = $('fStyle'), al = $('fAl'), fo = $('fFont'), co = $('fColor');
    var sz = $('fSize'), ind = $('fInd'), lh = $('fLh');
    var b = doc.blocks[sel] || blankBlock();
    return {
      s: st ? st.value : 'p',
      al: al ? al.value : 'left',
      f: fo ? fo.value : 'tah',
      z: sz ? clamp(num(sz.value), 9, 40) : 12,
      c: (co && /^#[0-9a-fA-F]{6}$/.test(co.value)) ? co.value.toLowerCase() : '',
      ind: ind ? clamp(num(ind.value), 0, 120) : 0,
      lh: lh ? clamp(num(lh.value), 0, 300) : 0,
      sp: b.sp || 0
    };
  }
  function readForm() {
    var p = formPatch(), r = selRange(), k, n, changed = false;
    pushUndo(false);
    for (k = r.a; k <= r.b && k < doc.blocks.length; k++) {
      if (!doc.blocks[k]) continue;
      n = normBlock({
        t: doc.blocks[k].t, s: p.s, al: p.al, f: p.f, z: p.z, c: p.c,
        sp: p.sp, ind: p.ind, lh: p.lh,
        b: doc.blocks[k].b, i: doc.blocks[k].i, u: doc.blocks[k].u,
        sup: doc.blocks[k].sup, sub: doc.blocks[k].sub, st: doc.blocks[k].st, hl: doc.blocks[k].hl,
        href: doc.blocks[k].href, img: doc.blocks[k].img
      });
      if (JSON.stringify(n) !== JSON.stringify(doc.blocks[k])) {
        doc.blocks[k] = n;
        updateBlockDom(k);
        changed = true;
      }
    }
    if (changed) {
      markDirty();
      renderOutline();
      var pr = $('printPage');
      if (pr) pr.innerHTML = pageHtml(doc.blocks);
    }
    if ($('sizeOut')) $('sizeOut').innerHTML = p.z;
    if ($('indOut')) $('indOut').innerHTML = p.ind;
    curInfo();
    updateStatus();
    return changed;
  }
  function fillForm() {
    var b = doc.blocks[sel];
    if (!b) return;
    draft = normBlock(b);
    if ($('fStyle')) $('fStyle').value = b.s;
    if ($('fAl')) $('fAl').value = b.al;
    if ($('fFont')) $('fFont').value = b.f;
    if ($('fSize')) $('fSize').value = b.z;
    if ($('fColor')) $('fColor').value = b.c || '#000000';
    if ($('fInd')) $('fInd').value = b.ind;
    if ($('fLh')) $('fLh').value = b.lh || 0;
    if ($('sizeOut')) $('sizeOut').innerHTML = b.z;
    if ($('indOut')) $('indOut').innerHTML = b.ind;
    if ($('bBold')) $('bBold').className = 'btn98 tg' + (b.b ? ' on' : '');
    if ($('bIt')) $('bIt').className = 'btn98 tg' + (b.i ? ' on' : '');
    if ($('bUn')) $('bUn').className = 'btn98 tg' + (b.u ? ' on' : '');
    if ($('editNote')) $('editNote').innerHTML = '(абзац ' + (sel + 1) + ')';
    curInfo();
    updateStatus();
  }
  function curInfo() {
    var el = $('curInfo2') || $('curInfo');
    if (!el) return;
    var b = doc.blocks[sel], r = selRange();
    if (!b) { el.innerHTML = '&nbsp;'; return; }
    var more = (r.b > r.a) ? (' — выбрано абзацев: ' + (r.b - r.a + 1)) : '';
    el.innerHTML = '<b>абзац ' + (sel + 1) + '</b> из ' + doc.blocks.length +
      ' &bull; ' + esc(styleName(b.s)) + ' &bull; ' + b.z + ' pt' + more;
  }
  function apply() {
    if (readForm()) { note('оформление применено'); beep(880, 0.04); }
    else note('здесь менять нечего');
  }
  function toggleFlag(what) {
    var r = selRange(), k, changed = false;
    pushUndo(false);
    for (k = r.a; k <= r.b && k < doc.blocks.length; k++) {
      if (!doc.blocks[k]) continue;
      var b = normBlock(doc.blocks[k]);
      b[what] = b[what] ? 0 : 1;
      /* надстрочный и подстрочный одновременно не бывают */
      if (what === 'sup' && b.sup) b.sub = 0;
      if (what === 'sub' && b.sub) b.sup = 0;
      doc.blocks[k] = b;
      updateBlockDom(k);
      changed = true;
    }
    if (changed) {
      markDirty();
      fillForm();
      var pr = $('printPage');
      if (pr) pr.innerHTML = pageHtml(doc.blocks);
    }
    return changed;
  }
  function clearChar() {
    var r = selRange(), k, changed = false;
    pushUndo(false);
    for (k = r.a; k <= r.b && k < doc.blocks.length; k++) {
      if (!doc.blocks[k]) continue;
      var b = normBlock(doc.blocks[k]);
      b.b = 0; b.i = 0; b.u = 0; b.sup = 0; b.sub = 0; b.st = 0; b.hl = 0;
      doc.blocks[k] = b;
      updateBlockDom(k);
      changed = true;
    }
    if (changed) {
      markDirty();
      fillForm();
      var pr = $('printPage');
      if (pr) pr.innerHTML = pageHtml(doc.blocks);
      note('оформление символов сброшено');
    }
    return changed;
  }
  function makeLink() {
    if (!doc.blocks[sel]) return;
    var cur = doc.blocks[sel].href || '';
    var u = window.prompt('Адрес ссылки (пусто или «-», чтобы убрать):', cur || 'https://');
    if (u == null) return;
    u = String(u).trim();
    if (u === 'https://' || u === 'http://' || u === '-') u = '';
    pushUndo(true);
    var b = normBlock(doc.blocks[sel]);
    b.href = u;
    doc.blocks[sel] = b;
    renderAll();
    markDirty();
    select(sel, true);
    if (u && !b.href) note('такой адрес не годится (нужен http://, https:// или mailto:)');
    else note(b.href ? ('ссылка: ' + b.href) : 'ссылка убрана');
    beep(700, 0.03);
  }
  function insertImageBlock(src, name) {
    if (doc.blocks.length >= MAXBLOCKS) { note('документ слишком большой'); return; }
    var nb = normBlock({ t: '', s: 'p', al: 'center', img: src });
    if (!nb.img) { note('эта картинка не подошла'); return; }
    pushUndo(true);
    doc.blocks.splice(sel + 1, 0, nb);
    sel = sel + 1;
    renderAll();
    markDirty();
    select(sel, true);
    note('картинка вставлена' + (name ? ': ' + name : ''));
    beep(880, 0.04);
  }
  function imageFile(f) {
    if (!f) return;
    if (!/^image\//.test(String(f.type || ''))) { note('это не картинка'); return; }
    if (f.size > 4 * 1024 * 1024) { note('картинка больше 4 МБ — не возьмём'); return; }
    var rd = new FileReader();
    rd.onload = function () { insertImageBlock(String(rd.result), f.name); };
    rd.onerror = function () { note('не смогли прочитать картинку'); };
    rd.readAsDataURL(f);
  }
  function pickImage() { var f = $('fileImg'); if (f) f.click(); }
  function countMatches(q) {
    if (!q) return 0;
    var n = 0, k, t, lq = q.toLowerCase(), at;
    for (k = 0; k < doc.blocks.length; k++) {
      t = String(doc.blocks[k].t).toLowerCase();
      at = t.indexOf(lq);
      while (at >= 0) { n++; at = t.indexOf(lq, at + lq.length); }
    }
    return n;
  }
  function revert() {
    var r = selRange(), k, changed = false;
    pushUndo(true);
    for (k = r.a; k <= r.b && k < doc.blocks.length; k++) {
      if (!doc.blocks[k]) continue;
      var keep = doc.blocks[k].t;
      doc.blocks[k] = normBlock({ t: keep });
      updateBlockDom(k);
      changed = true;
    }
    if (changed) {
      fillForm();
      renderOutline();
      markDirty();
      var pr = $('printPage');
      if (pr) pr.innerHTML = pageHtml(doc.blocks);
      note('оформление сброшено, текст на месте');
      beep(220, 0.05);
    }
  }
  function addAfter() {
    if (doc.blocks.length >= MAXBLOCKS) { note('документ слишком большой'); return; }
    pushUndo(true);
    var src = doc.blocks[sel] || blankBlock();
    var nb = normBlock({ t: '', s: src.s === 'h1' || src.s === 'h2' || src.s === 'h3' ? 'p' : src.s, f: src.f, z: src.z, al: src.al });
    doc.blocks.splice(sel + 1, 0, nb);
    sel = sel + 1;
    renderAll();
    markDirty();
    focusBlock(sel, true);
  }
  function newBlock() { addAfter(); }
  function focusBlock(i, atEnd) {
    var el = blockEl(i);
    if (!el) return;
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { }
    if (atEnd) {
      try { el.focus(); placeCaretEnd(el); } catch (e) { }
    } else {
      var m = saveCaret();
      setCaret(i, (m && m.i === i) ? m.off : 0);
    }
  }
  function placeCaretEnd(el) {
    try {
      var r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (e) { }
  }
  function readBlockText(el) {
    var t = (el.innerText != null && el.innerText !== undefined) ? el.innerText : el.textContent;
    t = String(t == null ? '' : t).replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
    if (t === '\n' || t === '\n\n') t = '';
    return t.replace(/\n+$/, '');
  }
  function caretSplit(el) {
    var full = readBlockText(el), sel2 = window.getSelection ? window.getSelection() : null;
    if (!sel2 || !sel2.rangeCount) return { pre: full, post: '' };
    var r = sel2.getRangeAt(0);
    if (!el.contains(r.startContainer) && r.startContainer !== el) return { pre: full, post: '' };
    try {
      var r2 = document.createRange();
      r2.setStart(el, 0);
      r2.setEnd(r.startContainer, r.startOffset);
      var tmp = document.createElement('div');
      tmp.appendChild(r2.cloneContents());
      var pre = (tmp.innerText != null && tmp.innerText !== undefined) ? tmp.innerText : tmp.textContent;
      pre = String(pre).replace(/\r\n/g, '\n');
      if (full.indexOf(pre) !== 0) return { pre: full, post: '' };
      return { pre: pre, post: full.slice(pre.length) };
    } catch (e) {
      return { pre: full, post: '' };
    }
  }
  function splitHere(i, el) {
    var parts = caretSplit(el), src = doc.blocks[i];
    pushUndo(true);
    doc.blocks[i].t = parts.pre;
    var nb;
    if (!parts.post && (src.s === 'li' || src.s === 'ol')) {
      nb = normBlock({ t: '', s: 'p', f: src.f, z: src.z, al: src.al });
    } else {
      nb = normBlock({ t: parts.post, s: src.s, f: src.f, z: src.z, al: src.al,
        b: src.b, i: src.i, u: src.u, sup: src.sup, sub: src.sub, st: src.st, hl: src.hl,
        c: src.c, ind: src.ind, sp: src.sp, lh: src.lh, href: src.href });
    }
    doc.blocks.splice(i + 1, 0, nb);
    sel = i + 1;
    renderAll();
    markDirty();
    setCaret(sel, 0);
    beep(660, 0.03);
  }
  function mergeBack(i) {
    if (i <= 0) return false;
    var prev = doc.blocks[i - 1], cur = doc.blocks[i];
    pushUndo(true);
    var at = String(prev.t || '').length;
    prev.t = prev.t ? (prev.t + '\n' + cur.t) : cur.t;
    if (prev.s === 'h1' || prev.s === 'h2' || prev.s === 'h3') prev.s = 'p';
    doc.blocks.splice(i, 1);
    sel = i - 1;
    renderAll();
    markDirty();
    setCaret(sel, at);
    return true;
  }
  function revert() {
    if (!draft || !draftDiffers()) { note('правок не было'); return; }
    fillForm();
    note('правки отменены');
  }
  function clearAll(quiet) {
    pushUndo(true);
    doc = blankDoc();
    sel = 0;
    draft = null;
    renderAll();
    if (!quiet) {
      markDirty();
      note('начат новый документ');
      beep(240, 0.06);
    }
  }
  function dupBlock() {
    if (sel < 0 || sel >= doc.blocks.length) return;
    pushUndo(true);
    var b = normBlock(doc.blocks[sel]);
    b.t = b.t ? (b.t + ' (копия)') : '(копия)';
    doc.blocks.splice(sel + 1, 0, b);
    sel = sel + 1;
    renderAll();
    markDirty();
    note('абзац ' + sel + ' — копия');
  }
  function moveBlock(d) {
    var to = sel + d;
    if (sel < 0 || to < 0 || to >= doc.blocks.length) return;
    pushUndo(true);
    var b = doc.blocks.splice(sel, 1)[0];
    doc.blocks.splice(to, 0, b);
    sel = to;
    renderAll();
    markDirty();
  }
  function delBlock() {
    if (doc.blocks.length <= 1) { clearAll(); return; }
    if (sel < 0 || sel >= doc.blocks.length) return;
    pushUndo(true);
    doc.blocks.splice(sel, 1);
    if (sel >= doc.blocks.length) sel = doc.blocks.length - 1;
    if (sel < 0) sel = 0;
    draft = null;
    renderAll();
    markDirty();
    note('абзац удалён');
    beep(200, 0.05);
  }

  /* ==================================================================
     ПОИСК И ЗАМЕНА
     ================================================================== */
  /* чистый поиск: ничего не меняет, отдаёт номер абзаца (или -1) */
  function findNext(q, from) {
    if (!q) return -1;
    var joined = [], map = [], k, j, base = 0, lines;
    for (k = 0; k < doc.blocks.length; k++) {
      lines = String(doc.blocks[k].t).split('\n');
      for (j = 0; j < lines.length; j++) {
        joined.push(lines[j]);
        map.push({ b: k, pos: base });
        base += lines[j].length + 1;
      }
    }
    var all = joined.join('\n');
    var lq = q.toLowerCase();
    var at = all.toLowerCase().indexOf(lq, from || 0);
    if (at < 0 && from) at = all.toLowerCase().indexOf(lq, 0);
    if (at < 0) return -1;
    var found = 0;
    for (k = 0; k < map.length; k++) {
      if (map[k].pos <= at) found = map[k].b;
      else break;
    }
    findAt = at;
    return found;
  }
  /* подсветить найденное прямо на странице */
  function selectFound(q) {
    if (!q) return;
    var el = blockEl(sel), k, seen = 0, nodes, base;
    if (!el) return;
    nodes = textNodes(el);
    var off = 0;
    for (k = 0; k < nodes.length; k++) {
      base = seen;
      seen += String(nodes[k].nodeValue || '').length;
      var piece = String(nodes[k].nodeValue || '');
      var at = piece.toLowerCase().indexOf(q.toLowerCase());
      if (at >= 0) { off = base + at; break; }
    }
    if (!q.length) return;
    try {
      var a = pointAt(el, off), b = pointAt(el, off + q.length);
      var r = document.createRange();
      r.setStart(a.node, a.off);
      r.setEnd(b.node, b.off);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      el.focus();
    } catch (e) { }
  }
  function replaceAllBlocks(q, to) {
    var n = 0, k;
    if (!q) return 0;
    for (k = 0; k < doc.blocks.length; k++) {
      var t = String(doc.blocks[k].t);
      if (t.toLowerCase().indexOf(q.toLowerCase()) < 0) continue;
      var parts = t.split(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
      doc.blocks[k].t = parts.join(to);
      n += parts.length - 1;
    }
    return n;
  }
  function replaceInBlock(i, q, to) {
    if (!q || i < 0 || i >= doc.blocks.length) return 0;
    var t = String(doc.blocks[i].t);
    var parts = t.split(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    if (parts.length < 2) return 0;
    doc.blocks[i].t = parts.join(to);
    return parts.length - 1;
  }

  /* ==================================================================
     ФАЙЛЫ: СОХРАНЕНИЕ
     ================================================================== */
  function downloadBytes(name, bytes, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }
  function download(name, text, mime) {
    downloadBytes(name, new TextEncoder().encode(text), mime || 'text/plain;charset=utf-8');
  }
  function safeName(ext) {
    var base = (($('fName') && $('fName').value) || 'документ').toString();
    base = base.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
    if (!base) base = 'документ';
    if (base.length > 60) base = base.slice(0, 60);
    return base + ext;
  }
  function exportData() {
    return { v: 1, app: 'monolit-docs', title: doc.title, blocks: doc.blocks, when: new Date().toISOString() };
  }
  function saveMono() {
    var nm = $('fName');
    if (nm && nm.value.trim()) doc.title = nm.value.trim();
    download(safeName('.mono'), JSON.stringify(exportData(), null, 1), 'application/json;charset=utf-8');
    dirty = false;
    updateStatus();
    note('сохранено: ' + safeName('.mono'));
    beep(980, 0.05);
  }
  function saveTxt() {
    download(safeName('.txt'), textOf(doc.blocks), 'text/plain;charset=utf-8');
    note('сохранено: ' + safeName('.txt'));
  }
  function htmlShell(title, bodyHtml) {
    var css = [
      'body{margin:0;padding:24px;background:#c0c0c0;font-family:Tahoma,Verdana,Arial,sans-serif}',
      '.page{width:640px;min-height:860px;box-sizing:border-box;margin:0 auto;background:#fff;padding:48px 56px;',
      'font-size:12pt;line-height:1.5;color:#111;box-shadow:4px 4px 10px rgba(0,0,0,.4)}',
      '.blk{margin:0 0 2px;white-space:pre-wrap;word-wrap:break-word}',
      '.s-h1{font-family:Impact,serif;font-size:2em;color:#8a3c00;margin:14px 0 6px}',
      '.s-h2{font-size:1.5em;font-weight:bold;color:#b25000;margin:12px 0 5px}',
      '.s-h3{font-size:1.2em;font-weight:bold;color:#d06a00;margin:10px 0 4px}',
      '.s-li{margin-left:26px}.s-ol{margin-left:26px}',
      '.s-quote{margin-left:20px;border-left:4px solid #ff8a00;padding-left:10px;font-style:italic;color:#503c28}',
      '.s-pre{font-family:Courier New,monospace;font-size:.9em;background:#fff6ec;padding:6px 8px;border:1px solid #d0a060}',
      '.b{font-weight:bold}.i{font-style:italic}.u{text-decoration:underline}',
      '.sup{font-size:.72em;position:relative;top:-.45em}',
      '.sub{font-size:.72em;position:relative;top:.32em}',
      '.st{text-decoration:line-through}.hl{background:#fff59d}',
      '.blk-link{color:#b25000}',
      '.s-img{text-align:center}.s-img img{max-width:100%;height:auto}',
      '.al-center{text-align:center}.al-right{text-align:right}.al-just{text-align:justify}',
      '.olnum{display:inline-block;min-width:22px;color:#b25000;font-weight:bold}',
      '@media print{body{background:#fff;padding:0}.page{box-shadow:none;width:auto;padding:0}@page{size:A4;margin:18mm 14mm}}'
    ].join('');
    return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<title>' + esc(title) +
      '</title>\n<style>' + css + '</style>\n</head>\n<body>\n<div class="page">\n' + bodyHtml +
      '\n</div>\n</body>\n</html>';
  }
  function saveHtm() {
    download(safeName('.htm'), htmlShell(doc.title, pageHtml(doc.blocks)), 'text/html;charset=utf-8');
    note('сохранено: ' + safeName('.htm'));
  }

  /* ==================================================================
     ТЕКСТОВЫЕ ИМПОРТЫ
     ================================================================== */
  function txtToBlocks(s) {
    var out = [], paras, k, j, lines, first, m;
    paras = String(s == null ? '' : s).replace(/\r\n/g, '\n').split(/\n{2,}/);
    for (k = 0; k < paras.length; k++) {
      lines = paras[k].split('\n');
      first = lines[0] || '';
      m = first.match(/^(#{1,3})\s+(.*)$/);
      if (m) {
        out.push(normBlock({ t: lines.map(function (x, j2) { return j2 === 0 ? m[2] : x; }).join('\n'),
          s: 'h' + m[1].length }));
        continue;
      }
      if (/^\s*>\s?/.test(first)) {
        out.push(normBlock({ t: lines.map(function (x) { return x.replace(/^\s*>\s?/, ''); }).join('\n'), s: 'quote' }));
        continue;
      }
      if (/^\s{4,}\S/.test(first) || /^\t/.test(first)) {
        out.push(normBlock({ t: lines.map(function (x) { return x.replace(/^(\s{4}|\t)/, ''); }).join('\n'), s: 'pre' }));
        continue;
      }
      if (/^\s*([-*•●▪])\s+/.test(first) || /^\s*\d+[.)]\s+/.test(first)) {
        var isOl = /^\s*\d+[.)]\s+/.test(first);
        for (j = 0; j < lines.length; j++) {
          var one = String(lines[j]).replace(/^\s*([-*•●▪]|\d+[.)])\s+/, '');
          out.push(normBlock({ t: one, s: isOl ? 'ol' : 'li' }));
        }
        continue;
      }
      out.push(normBlock({ t: lines.join('\n'), s: 'p' }));
    }
    return out;
  }
  function htmlToBlocks(s) {
    var doc2 = new DOMParser().parseFromString(String(s), 'text/html');
    var body = doc2 && doc2.body ? doc2.body : null;
    if (!body) throw new Error('html не прочитан');
    var out = [], node, tag, b;
    function txt(node) {
      var t = (node.textContent == null ? '' : node.textContent);
      return String(t).replace(/\u00a0/g, ' ');
    }
    function alOf(node) {
      var a = (node.getAttribute && node.getAttribute('align')) || '';
      a = String(a).toLowerCase();
      if (a === 'center') return 'center';
      if (a === 'right') return 'right';
      if (a === 'justify') return 'just';
      return 'left';
    }
    function styleOf(node) {
      var st = String(node.getAttribute ? (node.getAttribute('style') || '') : '').toLowerCase();
      var m = st.match(/font-size:\s*([\d.]+)pt/);
      var z = m ? clamp(Math.round(parseFloat(m[1])), 9, 40) : 0;
      var m2 = st.match(/font-family:\s*([^;]+)/);
      var f = m2 ? (FONT_KEYS[String(m2[1]).replace(/["']/g, '').trim().toLowerCase()] || '') : '';
      var c = st.match(/color:\s*(#[0-9a-f]{3,6})/);
      return { z: z, f: f, c: (c && HEX_OK.test(c[1])) ? c[1] : '' };
    }
    function one(node, forced) {
      var st = styleOf(node);
      var al = alOf(node);
      b = normBlock({
        t: txt(node),
        s: forced || 'p',
        al: al,
        z: st.z || undefined,
        f: st.f || undefined,
        c: st.c || undefined
      });
      out.push(b);
    }
    function listOf(node, kind) {
      var items = node.getElementsByTagName('li'), k;
      for (k = 0; k < items.length; k++) {
        if (insideOtherList(items[k], node)) continue;
        one(items[k], kind === 'ol' ? 'ol' : 'li');
      }
    }
    function insideOtherList(item, owner) {
      var p = item.parentNode;
      while (p && p.nodeType === 1) {
        var t = ln(p).toLowerCase();
        if (t === 'ul' || t === 'ol') return p !== owner;
        if (t === 'body' || t === 'div') return false;
        p = p.parentNode;
      }
      return false;
    }
    var kids = body.children, k;
    for (k = 0; k < kids.length; k++) {
      node = kids[k];
      tag = ln(node).toLowerCase();
      if (tag === 'h1') one(node, 'h1');
      else if (tag === 'h2') one(node, 'h2');
      else if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') one(node, 'h3');
      else if (tag === 'p') one(node, 'p');
      else if (tag === 'blockquote' || tag === 'q') one(node, 'quote');
      else if (tag === 'pre') one(node, 'pre');
      else if (tag === 'ul' || tag === 'ol') listOf(node, tag);
      else if (tag === 'hr') out.push(normBlock({ t: '— — —', s: 'p', al: 'center' }));
      else if (tag === 'div') {
        var sub = node.children, j, hasBlock = false;
        for (j = 0; j < sub.length; j++) {
          var st2 = ln(sub[j]).toLowerCase();
          if (/^(h1|h2|h3|h4|h5|h6|p|ul|ol|blockquote|pre|div|table)$/.test(st2)) { hasBlock = true; break; }
        }
        if (hasBlock) {
          walkDiv(node);
          continue;
        }
        one(node, 'p');
      }
      else one(node, 'p');
    }
    function walkDiv(node) {
      var sub = node.children, j;
      for (j = 0; j < sub.length; j++) {
        var st3 = ln(sub[j]).toLowerCase();
        if (/^(h1|h2|h3|h4|h5|h6|p|ul|ol|blockquote|pre)$/.test(st3)) {
          if (st3 === 'h1' || st3 === 'h2') one(sub[j], st3);
          else if (st3 === 'h3' || st3 === 'h4' || st3 === 'h5' || st3 === 'h6') one(sub[j], 'h3');
          else if (st3 === 'p') one(sub[j], 'p');
          else if (st3 === 'blockquote') one(sub[j], 'quote');
          else if (st3 === 'pre') one(sub[j], 'pre');
          else listOf(sub[j], st3);
        } else if (st3 === 'div') walkDiv(sub[j]);
        else one(sub[j], 'p');
      }
    }
    if (!out.length) throw new Error('в html не нашлось текста');
    var any = 0, q;
    for (q = 0; q < out.length; q++) if (String(out[q].t).trim()) { any = 1; break; }
    if (!any) throw new Error('в html только пустые абзацы');
    return out;
  }
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
    if (from < 0 || to <= from) return { error: 'В файле не нашлось фигурных скобок. Это вообще .mono?' };
    s = s.slice(from, to + 1);
    try { return { obj: JSON.parse(s) }; }
    catch (e) {
      try { return { obj: JSON.parse(s.replace(/,(\s*[}\]])/g, '$1')) }; }
      catch (e2) { return { error: 'JSON битый: ' + (e2.message || 'непонятно') }; }
    }
  }

  /* ==================================================================
     ZIP: ЧТЕНИЕ (для .docx) — движок из Презентаций Монолит
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
        if (z >= 0 && z + 56 < v.length && u32(v, z) === 0x06054b50) {
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
      if (/^word\/media\//.test(e.name)) { res.push({ name: e.name, data: null, size: e.usize || e.csize }); return; }
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
     ZIP: ЗАПИСЬ (без сжатия — Word такой архив читает)
     ================================================================== */
  function Out(n) { this.b = new Uint8Array(n || 1 << 17); this.n = 0; }
  Out.prototype.need = function (k) {
    if (this.n + k <= this.b.length) return;
    var cap = this.b.length;
    while (cap < this.n + k) cap <<= 1;
    var b = new Uint8Array(cap);
    b.set(this.b.subarray(0, this.n));
    this.b = b;
  };
  Out.prototype.u8 = function (v) { this.need(1); this.b[this.n++] = v & 0xFF; };
  Out.prototype.u16 = function (v) { this.u8(v); this.u8(v >>> 8); };
  Out.prototype.u32 = function (v) { this.u8(v); this.u8(v >>> 8); this.u8(v >>> 16); this.u8(v >>> 24); };
  Out.prototype.asc = function (s) {
    var k;
    for (k = 0; k < s.length; k++) this.u8(s.charCodeAt(k) & 0xFF);
  };
  Out.prototype.bytes = function (u8) { this.need(u8.length); this.b.set(u8, this.n); this.n += u8.length; };
  Out.prototype.done = function () { return this.b.slice(0, this.n); };
  function zipStore(files) {
    var o = new Out(1 << 17), central = [], k;
    for (k = 0; k < files.length; k++) {
      var f = files[k];
      var name = String(f.name);
      var data = (typeof f.data === 'string') ? new TextEncoder().encode(f.data) : f.data;
      if (!data || !data.length) data = new Uint8Array(0);
      var crc = crc32(data);
      var off = o.n;
      o.u32(0x04034b50); o.u16(20); o.u16(0x0800); o.u16(0); o.u16(0); o.u16(0x2821);
      o.u32(crc); o.u32(data.length); o.u32(data.length);
      o.u16(name.length); o.u16(0);
      o.asc(name);
      o.bytes(data);
      central.push({ name: name, crc: crc, size: data.length, off: off });
    }
    var cdStart = o.n;
    for (k = 0; k < central.length; k++) {
      var c = central[k];
      o.u32(0x02014b50); o.u16(20); o.u16(20); o.u16(0x0800); o.u16(0); o.u16(0); o.u16(0x2821);
      o.u32(c.crc); o.u32(c.size); o.u32(c.size);
      o.u16(c.name.length); o.u16(0); o.u16(0); o.u16(0); o.u16(0); o.u32(0); o.u32(c.off);
      o.asc(c.name);
    }
    var cdSize = o.n - cdStart;
    o.u32(0x06054b50); o.u16(0); o.u16(0); o.u16(files.length); o.u16(files.length);
    o.u32(cdSize); o.u32(cdStart); o.u16(0);
    return o.done();
  }

  /* ==================================================================
     РАЗБОР XML — ТОЛЬКО ПО ЛОКАЛЬНЫМ ИМЕНАМ
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
  function attr(node, name) {
    if (!node || !node.getAttribute) return null;
    var v = node.getAttribute(name);
    if (v != null) return v;
    /* в OOXML атрибуты с префиксом: w:val, w:left, w:ascii... getAttribute('val') их не видит */
    var list = node.attributes, k, an;
    if (list) {
      for (k = 0; k < list.length; k++) {
        an = String(list[k].name || list[k]);
        if (an.replace(/^[^:]*:/, '') === name) {
          var got = node.getAttribute(an);
          if (got != null) return got;
        }
      }
    }
    return null;
  }
  function has(node, name) {
    return descendants(node, name).length > 0;
  }

  function wParaText(p) {
    var s = '';
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { s += c.nodeValue; continue; }
        if (c.nodeType !== 1) continue;
        var t = ln(c);
        if (t === 'tab') { s += '\t'; continue; }
        if (t === 'br' || t === 'cr') { s += '\n'; continue; }
        if (t === 'noBreakHyphen') { s += '-'; continue; }
        if (t === 't') {
          for (var d = c.firstChild; d; d = d.nextSibling) if (d.nodeType === 3) s += d.nodeValue;
          continue;
        }
        walk(c);
      }
    })(p);
    return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  }
  function styleOfP(p) {
    var pPr = firstNamed(p, 'pPr'), s = 'p', al = 'left', z = 0, ind = 0, sp = 0;
    if (pPr) {
      var ps = firstNamed(pPr, 'pStyle');
      var v = ps ? String(attr(ps, 'val') || '') : '';
      var lv = v.toLowerCase();
      if (lv === 'title' || lv === 'heading1') s = 'h1';
      else if (lv === 'heading2') s = 'h2';
      else if (lv.indexOf('heading') === 0) s = 'h3';
      else if (lv === 'listnumber' || lv === 'listnum') s = 'ol';
      else if (lv === 'listbullet' || lv === 'listpara') s = 'li';
      else if (lv.indexOf('quote') >= 0) s = 'quote';
      else if (lv.indexOf('pre') >= 0) s = 'pre';
      else if (lv.indexOf('list') >= 0) s = 'li';
      else if (lv.indexOf('title') >= 0) s = 'h1';
      if (has(pPr, 'numPr') && s === 'p') s = 'li';
      var jc = firstNamed(pPr, 'jc');
      if (jc) {
        var j = String(attr(jc, 'val') || '').toLowerCase();
        if (j === 'center') al = 'center';
        else if (j === 'right' || j === 'end') al = 'right';
        else if (j === 'both' || j === 'distribute') al = 'just';
        else al = 'left';
      }
      var indn = firstNamed(pPr, 'ind');
      if (indn) {
        var iv = num(attr(indn, 'left') || attr(indn, 'start'));
        if (iv != null) ind = clamp(Math.round(iv / 20), 0, 120);
      }
      var spn = firstNamed(pPr, 'spacing');
      if (spn) {
        var sv = num(attr(spn, 'before'));
        if (sv != null) sp = clamp(Math.round(sv / 20), 0, 40);
      }
    }
    return { s: s, al: al, z: z, ind: ind, sp: sp };
  }
  function runFmt(p) {
    var runs = descendants(p, 'r'), i, r, rPr, out = { b: 0, i: 0, u: 0, z: 0, f: '', c: '' };
    for (i = 0; i < runs.length; i++) {
      r = runs[i];
      rPr = firstNamed(r, 'rPr');
      if (!rPr) continue;
      if (!out.b && firstNamed(rPr, 'b') && attr(firstNamed(rPr, 'b'), 'val') !== '0') out.b = 1;
      if (!out.i && firstNamed(rPr, 'i') && attr(firstNamed(rPr, 'i'), 'val') !== '0') out.i = 1;
      if (!out.u && firstNamed(rPr, 'u') && attr(firstNamed(rPr, 'u'), 'val') !== 'none') out.u = 1;
      if (!out.z) {
        var sz = firstNamed(rPr, 'sz');
        if (sz) {
          var v = num(attr(sz, 'val'));
          if (v != null) out.z = clamp(Math.round(v / 2), 9, 40);
        }
      }
      if (!out.f) {
        var rf = firstNamed(rPr, 'rFonts');
        if (rf) {
          var nm = String(attr(rf, 'ascii') || attr(rf, 'hAnsi') || '').toLowerCase();
          if (nm && FONT_KEYS[nm]) out.f = FONT_KEYS[nm];
        }
      }
      if (!out.c) {
        var cc = firstNamed(rPr, 'color');
        if (cc) {
          var cv = String(attr(cc, 'val') || '').toLowerCase();
          if (/^[0-9a-f]{6}$/.test(cv) && cv !== 'auto') out.c = '#' + cv;
        }
      }
    }
    return out;
  }
  function parseDocxXml(xml) {
    var d = new DOMParser().parseFromString(String(xml), 'application/xml');
    if (!d || !d.documentElement) throw new Error('плохой xml');
    var body = firstNamed(d.documentElement, 'body') || d.documentElement;
    var ps = descendants(body, 'p'), out = [], k, p, st, fm, t, inTable;
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      t = wParaText(p);
      inTable = false;
      for (var q = p.parentNode; q && q.nodeType === 1; q = q.parentNode) {
        var lq = ln(q);
        if (lq === 'tc' || lq === 'tbl') { inTable = true; break; }
        if (lq === 'body') break;
      }
      if (inTable) {
        var firstInCell = true;
        for (q = p.parentNode; q && q.nodeType === 1; q = q.parentNode) {
          if (ln(q) === 'tc') {
            firstInCell = (firstNamed(q, 'p') === p);
            break;
          }
        }
        if (firstInCell && t) t = '| ' + t;
      }
      if (!t.trim() && !st) continue;
      st = styleOfP(p);
      fm = runFmt(p);
      if (!t.trim()) continue;
      out.push(normBlock({
        t: t,
        s: st.s,
        al: st.al,
        z: fm.z || st.z || undefined,
        f: fm.f || undefined,
        c: fm.c || undefined,
        b: fm.b, i: fm.i, u: fm.u,
        ind: st.ind, sp: st.sp
      }));
    }
    if (!out.length) throw new Error('в документе не нашлось ни одного слова');
    return out;
  }

  /* ==================================================================
     ЭКСПОРТ В WORD
     ================================================================== */
  var W_STYLE = { p: '', h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', li: 'ListBullet', ol: 'ListNumber', quote: 'Quote', pre: 'Preformatted' };
  var W_FONT = {
    tah: 'Tahoma', times: 'Times New Roman', comic: 'Comic Sans MS',
    arial: 'Arial', impact: 'Impact', courier: 'Courier New'
  };
  function runXml(b, text) {
    var rPr = '';
    if (b.b) rPr += '<w:b/>';
    if (b.i) rPr += '<w:i/>';
    if (b.u) rPr += '<w:u w:val="single"/>';
    if (b.f) rPr += '<w:rFonts w:ascii="' + W_FONT[b.f] + '" w:hAnsi="' + W_FONT[b.f] + '"/>';
    if (b.z) rPr += '<w:sz w:val="' + Math.max(9, Math.min(40, b.z)) * 2 + '"/>';
    if (b.c) rPr += '<w:color w:val="' + b.c.replace('#', '').toUpperCase() + '"/>';
    var body = '';
    var lines = String(text).split('\n'), j;
    for (j = 0; j < lines.length; j++) {
      if (j) body += '<w:br/>';
      if (lines[j]) body += '<w:t xml:space="preserve">' + esc(lines[j]) + '</w:t>';
    }
    if (!body) body = '<w:t xml:space="preserve"></w:t>';
    return '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + body + '</w:r>';
  }
  function paraXml(b, text) {
    var pPr = '';
    var st = W_STYLE[b.s] || '';
    if (st) pPr += '<w:pStyle w:val="' + st + '"/>';
    if (b.s === 'ol') pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>';
    else if (b.s === 'li') pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (b.al && b.al !== 'left') {
      pPr += '<w:jc w:val="' + (b.al === 'just' ? 'both' : b.al) + '"/>';
    }
    if (b.sp) pPr += '<w:spacing w:before="' + b.sp * 20 + '"/>';
    if (b.ind) pPr += '<w:ind w:left="' + b.ind * 20 + '"/>';
    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + runXml(b, text) + '</w:p>';
  }
  function docxDocumentXml(blocks) {
    var out = [], k;
    for (k = 0; k < blocks.length; k++) out.push(paraXml(normBlock(blocks[k]), blocks[k].t));
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + out.join('') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }
  function docxStylesXml() {
    function style(id, name, basedOn, pPr, rPr) {
      return '<w:style w:type="paragraph" w:styleId="' + id + '">' +
        '<w:name w:val="' + name + '"/>' + (basedOn ? '<w:basedOn w:val="' + basedOn + '"/>' : '') +
        (pPr || '') + (rPr || '') + '</w:style>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/><w:sz w:val="24"/><w:szCs w:val="24"/>' +
      '</w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
      '</w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      style('Heading1', 'heading 1', 'Normal', '<w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="280" w:after="120"/></w:pPr>',
        '<w:rPr><w:rFonts w:ascii="Impact" w:hAnsi="Impact"/><w:b/><w:color w:val="8A3C00"/><w:sz w:val="48"/></w:rPr>') +
      style('Heading2', 'heading 2', 'Normal', '<w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="240" w:after="100"/></w:pPr>',
        '<w:rPr><w:b/><w:color w:val="B25000"/><w:sz w:val="36"/></w:rPr>') +
      style('Heading3', 'heading 3', 'Normal', '<w:pPr><w:outlineLvl w:val="2"/><w:spacing w:before="200" w:after="80"/></w:pPr>',
        '<w:rPr><w:b/><w:color w:val="D06A00"/><w:sz w:val="30"/></w:rPr>') +
      style('ListParagraph', 'List Paragraph', 'Normal', '<w:pPr><w:ind w:left="360"/></w:pPr>', '') +
      style('ListBullet', 'List Bullet', 'ListParagraph', '', '') +
      style('ListNumber', 'List Number', 'ListParagraph', '', '') +
      style('Quote', 'Quote', 'Normal', '<w:pPr><w:ind w:left="400"/></w:pPr>',
        '<w:rPr><w:i/><w:color w:val="503C28"/></w:rPr>') +
      style('Preformatted', 'HTML Preformatted', 'Normal', '<w:pPr><w:shd w:val="clear" w:fill="FFF6EC"/></w:pPr>',
        '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="22"/></w:rPr>') +
      '</w:styles>';
  }
  function docxNumberingXml() {
    function lvl(i, fmt, txt) {
      return '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/>' +
        '<w:lvlText w:val="' + txt + '"/><w:lvlJc w:val="left"/>' +
        '<w:pPr><w:ind w:left="' + (720 + i * 360) + '" w:hanging="360"/></w:pPr></w:lvl>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:abstractNum w:abstractNumId="0">' + lvl(0, 'bullet', '•') + lvl(1, 'bullet', '◦') + '</w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="1">' + lvl(0, 'decimal', '%1.') + lvl(1, 'lowerLetter', '%2)') + '</w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
      '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
      '</w:numbering>';
  }
  function buildDocx(blocks, title) {
    var files = [];
    files.push({
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>'
    });
    files.push({
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>'
    });
    files.push({
      name: 'docProps/core.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
        '<dc:title>' + esc(title || 'Документ') + '</dc:title>' +
        '<dc:creator>МОНОЛИТ 2000</dc:creator>' +
        '</cp:coreProperties>'
    });
    files.push({
      name: 'word/_rels/document.xml.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
        '</Relationships>'
    });
    files.push({ name: 'word/styles.xml', data: docxStylesXml() });
    files.push({ name: 'word/numbering.xml', data: docxNumberingXml() });
    files.push({ name: 'word/document.xml', data: docxDocumentXml(blocks) });
    return zipStore(files);
  }
  function saveDocx() {
    var nm = $('fName');
    if (nm && nm.value.trim()) doc.title = nm.value.trim();
    var bytes;
    try {
      bytes = buildDocx(doc.blocks, doc.title);
    } catch (e) {
      report('СОХРАНЕНИЕ НЕ УДАЛОСЬ\n' + (e && e.message ? e.message : e));
      return;
    }
    downloadBytes(safeName('.docx'), bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    dirty = false;
    updateStatus();
    note('сохранено: ' + safeName('.docx') + ' (' + Math.round(bytes.length / 1024) + ' КБ)');
    beep(1200, 0.05);
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
  function findEntry(entries, re) {
    var k;
    for (k = 0; k < entries.length; k++) if (re.test(entries[k].name)) return entries[k];
    return null;
  }
  function dryRunOn() { var b = $('dryRun'); return !!(b && b.checked); }
  function finishImport(blocks, fname, extra) {
    var head = 'ОТКЁТ О КОНВЕРТАЦИИ\nфайл: ' + fname + '\n';
    var lost = [
      'картинки и рисунки — не переносятся',
      'колонтитулы и нумерация страниц — выброшены',
      'таблицы — стали строчками текста',
      'шрифты — заменены на наши (6 штук)'
    ];
    if (!blocks || !blocks.length) {
      report(head + '\nВ файле не нашлось текста. Текущий документ не тронут.');
      return;
    }
    var body = 'абзацев найдено: ' + blocks.length + '\n' +
      'слов: ' + countWords(blocks) + '\n' +
      'знаков: ' + countChars(blocks) + '\n' +
      'заголовков: ' + blocks.filter(function (b) { return b.s === 'h1' || b.s === 'h2' || b.s === 'h3'; }).length + '\n' +
      'списков: ' + blocks.filter(function (b) { return b.s === 'li' || b.s === 'ol'; }).length + '\n\n' +
      'ПОТЕРЯНО ПО ДОРОГЕ:\n' + lost.map(function (x) { return ' - ' + x; }).join('\n') + '\n' +
      (extra ? '\n' + extra + '\n' : '') + '\nТекст перенесён целиком. Остальное — как повезёт.';
    if (dryRunOn()) {
      report(head + '\n' + body + '\n\nЖАЛКИЙ РЕЖИМ: документ не тронут.');
      note('жалкий режим: ничего не меняли');
      return;
    }
    pushUndo(true);
    doc.blocks = normAll(blocks);
    if (fname) doc.title = String(fname).replace(/\.[^.]+$/, '').slice(0, 70);
    if ($('fName')) $('fName').value = doc.title;
    sel = 0;
    draft = null;
    renderAll();
    markDirty();
    report(head + '\n' + body);
    note('импортировано абзацев: ' + blocks.length);
    beep(760, 0.06);
  }
  function importDocx(buf, fname) {
    readZip(new Uint8Array(buf)).then(function (entries) {
      var main = findEntry(entries, /^word\/document\.xml$/i);
      var styles = findEntry(entries, /^word\/styles\.xml$/i);
      var broken = entries.filter(function (e) { return !e.data && e.err; });
      if (!main || !main.data) {
        report('ЭТО НЕ WORD\nфайл: ' + fname + '\nв архиве нет word/document.xml\n\n' +
          'Что было внутри:\n' + entries.slice(0, 20).map(function (e) {
            return ' - ' + e.name + (e.err ? ' (' + e.err + ')' : '');
          }).join('\n') + '\n\nТекущий документ не тронут.');
        return;
      }
      var extra = 'картинок в архиве: ' + entries.filter(function (e) { return /^word\/media\//i.test(e.name); }).length + ' (не переносим)\n' +
        'стилей в архиве: ' + (styles ? 'есть' : 'нет') +
        (broken.length ? '\nбитых кусков: ' + broken.length : '');
      try {
        finishImport(parseDocxXml(txt(main.data)), fname, extra);
      } catch (e) {
        report('РАЗБОР НЕ УДАЛСЯ\nфайл: ' + fname + '\n' + (e && e.message ? e.message : e) +
          '\n\nТекущий документ не тронут.');
      }
    }, function (e) {
      report('ЭТО НЕ АРХИВ WORD\nфайл: ' + fname + '\n' + (e && e.message ? e.message : e) +
        '\n\nСтарый .doc (1997–2003) мы не читаем. Сохрани в .docx — и приходи.');
    });
  }
  function importXmlText(s, fname) {
    try { finishImport(parseDocxXml(s), fname); }
    catch (e) {
      report('ЭТО НЕ XML WORD\nфайл: ' + fname + '\n' + (e && e.message ? e.message : e) +
        '\n\nТекущий документ не тронут.');
    }
  }
  function importTxt(s, fname) {
    try { finishImport(txtToBlocks(s), fname); }
    catch (e) {
      report('НЕ ЧИТАЕТСЯ\nфайл: ' + fname + '\n' + (e && e.message ? e.message : e));
    }
  }
  function importHtm(s, fname) {
    try { finishImport(htmlToBlocks(s), fname); }
    catch (e) {
      report('HTML НЕ РАЗОБРАЛСЯ\nфайл: ' + fname + '\n' + (e && e.message ? e.message : e) +
        '\n\nТекущий документ не тронут.');
    }
  }
  function applyJson(res, fname) {
    if (res.error) {
      report('ОТКРЫТИЕ НЕ УДАЛОСЬ\nфайл: ' + fname + '\n' + res.error + '\n\nТекущий документ не тронут.');
      return;
    }
    var o = res.obj;
    var list = (o && o.blocks) ? o.blocks : (Array.isArray(o) ? o : null);
    if (!list || !list.length) {
      report('В ФАЙЛЕ НЕТ АБЗАЦЕВ\nфайл: ' + fname + '\n\nТекущий документ не тронут.');
      return;
    }
    var blocks = normAll(list);
    pushUndo(true);
    doc.blocks = blocks;
    if (o.title) { doc.title = String(o.title).slice(0, 70); }
    if (fname) doc.title = String(fname).replace(/\.[^.]+$/, '').slice(0, 70);
    if ($('fName')) $('fName').value = doc.title;
    sel = 0;
    draft = null;
    renderAll();
    markDirty();
    report('ОТКРЫТ ФАЙЛ\nфайл: ' + fname + '\nабзацев: ' + blocks.length +
      '\nслов: ' + countWords(blocks) + '\n\nПрограмма рада. Пользуйся.');
    note('открыто: ' + blocks.length + ' абзацев');
  }
  function readTextFile(f, then) {
    var r = new FileReader();
    r.onload = function () { then(deBom(String(r.result)), null); };
    r.onerror = function () { then(null, 'Файл не читается: ' + f.name); };
    r.readAsText(f, 'utf-8');
  }
  function readBinFile(f, then) {
    var r = new FileReader();
    r.onload = function () { then(new Uint8Array(r.result), null); };
    r.onerror = function () { then(null, 'Файл не читается: ' + f.name); };
    r.readAsArrayBuffer(f);
  }
  function unknownFile(fname, why) {
    report('НЕ ПОНИМАЮ ФАЙЛ\nфайл: ' + fname + '\n' + why +
      '\n\nУмею: .docx .xml .mono .json .htm .html .txt\n\nТекущий документ не тронут.');
  }
  function handleFile(f) {
    if (!f) return;
    if (/^image\//.test(String(f.type || ''))) { imageFile(f); return; }
    var low = String(f.name || '').toLowerCase();
    if (/\.docx$|\.docm$|\.dotx$/.test(low)) {
      report('ЧИТАЕМ WORD...\nфайл: ' + f.name + '\n(это может занять пару секунд)');
      readBinFile(f, function (buf, err) {
        if (err) { report(err); return; }
        importDocx(buf, f.name);
      });
      return;
    }
    readTextFile(f, function (text, err) {
      if (err) { report(err); return; }
      if (/\.xml$/.test(low)) { importXmlText(text, f.name); return; }
      if (/\.mono$|\.json$/.test(low)) { applyJson(extractJson(text), f.name); return; }
      if (/\.htm$|\.html$/.test(low)) {
        if (/<script[^>]*application\/x-mono/i.test(text)) { applyJson(extractJson(text), f.name); return; }
        importHtm(text, f.name);
        return;
      }
      if (/\.txt$/.test(low)) { importTxt(text, f.name); return; }
      unknownFile(f.name, 'расширение незнакомое');
    });
  }

  /* ==================================================================
     ШАБЛОН
     ================================================================== */
  function template() {
    var t = [
      ['КИСЛОТЫ И ОСНОВАНИЯ', 'h1', 0, 0, 0, 'center', 'impact', 26, '', 10, 0],
      ['Реферат для 9 класса. Сделано в Документах Монолит.', 'p', 0, 1, 0, 'center', 'times', 12, '#404040', 6, 0],
      ['Что такое кислоты', 'h2', 0, 0, 0, 'left', 'tah', 18, '', 4, 0],
      ['Кислоты — это вещества, которые при растворении в воде дают кислые растворы. ' +
        'В их молекулах есть атомы водорода, которые легко заменяются на металл.', 'p', 0, 0, 0, 'just', 'tah', 12, '', 0, 0],
      ['Главные признаки', 'h3', 0, 0, 0, 'left', 'tah', 14, '', 3, 0],
      ['кислый вкус (пробовать не надо!)', 'li', 0, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['красят лакмус в красный цвет', 'li', 0, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['реагируют с металлами с выделением водорода', 'li', 0, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['Zn + 2HCl  ->  ZnCl2 + H2 (водород выделяется)', 'pre', 0, 0, 0, 'left', 'courier', 11, '', 2, 0],
      ['Основания', 'h2', 0, 0, 0, 'left', 'tah', 18, '', 4, 0],
      ['Основания — наоборот: их растворы щелочные и красят лакмус в синий. ' +
        'Гашёная известь Ca(OH)2 и едкий натр NaOH — самые известные.', 'p', 0, 0, 0, 'just', 'tah', 12, '', 0, 0],
      ['Классификация', 'h3', 0, 0, 0, 'left', 'tah', 14, '', 3, 0],
      ['1. Одновалентные: NaOH, KOH', 'ol', 0, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['2. Двухвалентные: Ca(OH)2, Mg(OH)2', 'ol', 0, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['3. Трёхвалентные: Al(OH)3, Fe(OH)3', 'ol', 0, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['Не все основания растворимы: гидроксид алюминия не растворяется и выпадает в осадок.', 'li', 0, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['«Не ртуть, а ртуть из пробирки»', 'quote', 0, 1, 0, 'left', 'times', 13, '#8a3c00', 4, 0],
      ['Проверь себя', 'h2', 0, 0, 0, 'left', 'tah', 18, '', 4, 0],
      ['Что выдаёт кислоту?', 'li', 1, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['Что выдаёт основание?', 'li', 1, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['Чем отличается соль от кислоты?', 'li', 1, 0, 0, 'left', 'tah', 12, '', 0, 0],
      ['Итог', 'h2', 0, 0, 0, 'left', 'tah', 18, '', 4, 0],
      ['Кислоты бывают кислые, основания — щелочные, а соли — это то, что получилось, ' +
        'когда они встретились. Вот и вся химия, дальше только запоминать.', 'p', 0, 0, 0, 'just', 'tah', 12, '', 0, 0]
    ];
    var out = [], k, r;
    for (k = 0; k < t.length; k++) {
      r = t[k];
      out.push(normBlock({ t: r[0], s: r[1], b: r[2], i: r[3], u: r[4], al: r[5], f: r[6], z: r[7], c: r[8], sp: r[9], ind: r[10] }));
    }
    return out;
  }
  function loadTemplate() {
    if (countWords(doc.blocks) > 0 && !confirm('Текущий документ будет заменён примером. Продолжить?')) return;
    pushUndo(true);
    doc.blocks = template();
    doc.title = 'Кислоты и основания';
    if ($('fName')) $('fName').value = doc.title;
    sel = 0;
    draft = null;
    renderAll();
    markDirty();
    note('загружен пример. смотри и правь.');
  }

  /* ==================================================================
     ЛОГОТИП
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
    if (!img) return;
    function usePng() {
      img.style.display = 'block';
      if (svg) svg.style.display = 'none';
      setFavicon('img/favicon-32.png', 'image/png');
    }
    function useSvg() {
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
     ВКЛАДКИ, СЧЁТЧИК, ПЕЧАТЬ
     ================================================================== */
  function tab(name) {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane'), k;
    for (k = 0; k < tabs.length; k++) {
      if (tabs[k].getAttribute('data-tab') === name) tabs[k].className = 'tab on';
      else tabs[k].className = 'tab';
    }
    for (k = 0; k < panes.length; k++) {
      if (panes[k].id === 'tab-' + name) panes[k].className = 'tabpane on';
      else panes[k].className = 'tabpane';
    }
    if (name === 'print') fillPrint();
    rAF(fitPage);
  }
  function fillPrint() {
    var pr = $('printPage');
    if (pr) pr.innerHTML = pageHtml(doc.blocks);
  }
  function doPrint() {
    fillPrint();
    /* старая вкладка больше не используется */
    setTimeout(function () { window.print(); }, 60);
  }
  function hits() {
    var el = $('hits'), n;
    if (!el) return;
    n = num(lsGet('monolit-doc-hits')) || 0;
    n = n + 1 + (hash(String(new Date().getDate())) % 7);
    lsSet('monolit-doc-hits', String(n));
    el.innerHTML = pad(n, 6);
  }

  /* ==================================================================
     СОБЫТИЯ
     ================================================================== */
  function need(id) { if (!$(id)) note('нет кнопки ' + id + ' — зови программиста'); }
  function onClick(id, fn) { var el = $(id); if (el) el.onclick = fn; else need(id); }

  function pageEvents() {
    var page = $('page');
    if (!page) return;
    var sync = 0;
    function blockFromEvent(ev) {
      var t = ev.target;
      while (t && t !== page && (!t.getAttribute || t.getAttribute('data-i') == null)) t = t.parentNode;
      if (!t || t === page) return null;
      return t;
    }
    function softUpdate() {
      if (sync) return;
      sync = setTimeout(function () { sync = 0; renderOutline(); curInfo(); updateCounters(); }, 400);
    }
    page.onclick = function (ev) {
      var t = blockFromEvent(ev);
      if (!t) return;
      var i = num(t.getAttribute('data-i'));
      if (i != null && i !== sel) { select(i, true); }
    };
    page.oninput = function (ev) {
      var t = ev.target;
      while (t && t !== page && t.getAttribute && t.getAttribute('data-i') == null) t = t.parentNode;
      if (!t || t === page) return;
      var i = num(t.getAttribute('data-i'));
      if (i == null || !doc.blocks[i]) return;
      typingUndo();
      doc.blocks[i].t = readBlockText(t);
      if (draft) draft.t = doc.blocks[i].t;
      sel = i;
      markDirty();
      applySelClass();
      softUpdate();
    };
    page.onkeyup = function (ev) {
      var t = blockFromEvent(ev);
      if (!t) return;
      var i = num(t.getAttribute('data-i'));
      if (i != null && i !== sel) { sel = i; fillForm(); applySelClass(); curInfo(); }
    };
    page.onkeydown = function (ev) {
      var t = blockFromEvent(ev);
      var i = (t) ? num(t.getAttribute('data-i')) : null;
      var code = ev.keyCode;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (code === 13 && !ev.shiftKey && i != null) { ev.preventDefault(); splitHere(i, t); return; }
      if (code === 9 && i != null) {
        ev.preventDefault();
        typingUndo();
        try { document.execCommand('insertText', false, '    '); } catch (e) { }
        return;
      }
      if (code === 8 && i != null && i > 0 && caretAtStart(t)) { ev.preventDefault(); mergeBack(i); return; }
      if (code === 46 && i != null && i < doc.blocks.length - 1 && caretAtEnd(t)) {
        ev.preventDefault();
        var at = String(doc.blocks[i].t || '').length;
        pushUndo(true);
        doc.blocks[i].t = (doc.blocks[i].t ? doc.blocks[i].t + '\n' : '') + doc.blocks[i + 1].t;
        doc.blocks.splice(i + 1, 1);
        renderAll();
        markDirty();
        setCaret(i, at);
      }
    };
    page.onpaste = function (ev) {
      ev.preventDefault();
      var s = '';
      try { s = (ev.clipboardData || window.clipboardData).getData('text'); } catch (e) { }
      s = String(s).replace(/\r\n/g, '\n').replace(/\t/g, '    ');
      try { document.execCommand('insertText', false, s); }
      catch (e) { }
    };
    page.ondrop = function (ev) {
      var t = ev.target, dt = ev.dataTransfer;
      if (t && dt && dt.files && dt.files.length) return;
      ev.preventDefault();
      var s = '';
      try { s = dt.getData('text'); } catch (e) { }
      if (s) { try { document.execCommand('insertText', false, s.replace(/\r\n/g, '\n')); } catch (e) { } }
    };
    document.addEventListener('selectionchange', function () {
      if (!$('page')) return;
      var a = document.activeElement;
      if (!a || !($('page') === a || $('page').contains(a))) return;
      var m = saveCaret();
      if (m && m.i !== sel) {
        sel = m.i;
        applySelClass();
        fillForm();
        renderOutline();
        curInfo();
        updateStatus();
      }
    });
  }
  function caretAtStart(el) {
    try {
      var s = window.getSelection();
      if (!s || !s.rangeCount) return false;
      var r = s.getRangeAt(0);
      if (!r.collapsed) return false;
      return offsetIn(el, r) === 0;
    } catch (e) { return false; }
  }
  function caretAtEnd(el) {
    try {
      var s = window.getSelection();
      if (!s || !s.rangeCount) return false;
      var r = s.getRangeAt(0);
      if (!r.collapsed) return false;
      return offsetIn(el, r) === readBlockText(el).length;
    } catch (e) { return false; }
  }

  function outlineEvents() {
    var box = $('outline');
    if (!box) return;
    box.onclick = function (ev) {
      var t = ev.target, i;
      while (t && t !== box && (!t.getAttribute || t.getAttribute('data-i') == null)) t = t.parentNode;
      if (!t || t === box) return;
      i = num(t.getAttribute('data-i'));
      if (i != null) { select(i); focusBlock(i, false); beep(620, 0.02); }
    };
  }

  function fileEvents() {
    onClick('fileDoc', function () { var f = this.files && this.files[0]; if (f) handleFile(f); this.value = ''; });
    onClick('fileMono', function () { var f = this.files && this.files[0]; if (f) handleFile(f); this.value = ''; });
    var fi = $('fileImg');
    if (fi) fi.onchange = function () { var f = this.files && this.files[0]; if (f) imageFile(f); this.value = ''; };
  }
  function dragEvents() {
    var ov = $('dropOv'), depth = 0, drop = $('drop');
    function show(on) { if (ov) ov.className = 'dropov' + (on ? ' on' : ''); if (drop) drop.className = 'drop' + (on ? ' hot' : ''); }
    window.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    window.addEventListener('dragenter', function (ev) {
      ev.preventDefault();
      depth++;
      show(true);
    });
    window.addEventListener('dragleave', function (ev) {
      ev.preventDefault();
      depth--;
      if (depth <= 0) { depth = 0; show(false); }
    });
    window.addEventListener('drop', function (ev) {
      ev.preventDefault();
      depth = 0;
      show(false);
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }
  function hotkeys() {
    document.addEventListener('keydown', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey)) {
        if (ev.keyCode === 27 && ev.target && ev.target.blur) ev.target.blur();
        return;
      }
      var k = String(ev.key || '').toLowerCase();
      var code = ev.keyCode;
      if (k === 's' || code === 83) { ev.preventDefault(); saveMono(); }
      else if (k === 'o' || code === 79) { ev.preventDefault(); var f = $('fileMono'); if (f) f.click(); }
      else if (k === 'p' || code === 80) { ev.preventDefault(); doPrint(); }
      else if (k === 'n' || code === 78) { ev.preventDefault(); newBlock(); }
      else if (k === 'b' || code === 66) { ev.preventDefault(); if ($('bBold')) $('bBold').click(); }
      else if (k === 'i' || code === 73) { ev.preventDefault(); if ($('bIt')) $('bIt').click(); }
      else if (k === 'u' || code === 85) { ev.preventDefault(); if ($('bUn')) $('bUn').click(); }
      else if (k === 'k' || code === 75) { ev.preventDefault(); makeLink(); }
      else if (k === 'z' || code === 90) {
        ev.preventDefault();
        if (ev.shiftKey) redo(); else undo();
      }
      else if (k === 'y' || code === 89) { ev.preventDefault(); redo(); }
      else if (k === 'f' || code === 70) {
        ev.preventDefault();
        tab('editor');
        if ($('fFind')) $('fFind').focus();
      }
    });
  }
  function findEvents() {
    onClick('btnFind', function () {
      var q = $('fFind') ? $('fFind').value : '';
      if (!q) { note('а что ищем-то?'); return; }
      findPos = 0;
      var i = findNext(q, 0);
      if (i < 0) { if ($('findNote')) $('findNote').innerHTML = '<b>не нашли</b>'; return; }
      if ($('findNote')) $('findNote').innerHTML = 'нашли в абзаце ' + (i + 1) + ' • всего ' + countMatches(q);
      sel = i;
      renderAll();
      select(i, true);
      focusBlock(i, false);
      selectFound(q);
    });
    onClick('btnFindNext', function () {
      var q = $('fFind') ? $('fFind').value : '';
      if (!q) { note('а что ищем-то?'); return; }
      var i = findNext(q, findPos + 1);
      if (i < 0) { if ($('findNote')) $('findNote').innerHTML = 'больше нет • всего ' + countMatches(q); return; }
      findPos = findAt + q.length;
      if ($('findNote')) $('findNote').innerHTML = 'абзац ' + (i + 1) + ' • всего ' + countMatches(q);
      sel = i;
      renderAll();
      select(i, true);
      focusBlock(i, false);
      selectFound(q);
    });
    onClick('btnRepl', function () {
      var q = $('fFind') ? $('fFind').value : '';
      if (!q) { note('а что менять-то?'); return; }
      var to = window.prompt('на что менять «' + q + '»?', q);
      if (to == null) return;
      pushUndo(true);
      var n = replaceInBlock(sel, q, to);
      renderAll();
      markDirty();
      if ($('findNote')) $('findNote').innerHTML = n ? ('заменено: ' + n) : 'в этом абзаце не нашлось';
    });
  }
  function formEvents() {
    var ids = ['fStyle', 'fAl', 'fFont', 'fSize', 'fInd', 'fColor', 'fLh'];
    var k;
    for (k = 0; k < ids.length; k++) {
      (function (id) {
        var el = $(id);
        if (!el) return;
        el.oninput = function () { readForm(); };
        el.onchange = function () { readForm(); };
      })(ids[k]);
    }
    onClick('bBold', function () { toggleFlag('b'); });
    onClick('bIt', function () { toggleFlag('i'); });
    onClick('bUn', function () { toggleFlag('u'); });
    onClick('btnSpace', function () {
      var r = selRange(), k2, on2 = !(doc.blocks[sel] && doc.blocks[sel].sp);
      pushUndo(false);
      for (k2 = r.a; k2 <= r.b && k2 < doc.blocks.length; k2++) {
        if (!doc.blocks[k2]) continue;
        doc.blocks[k2] = normBlock({ t: doc.blocks[k2].t, s: doc.blocks[k2].s, al: doc.blocks[k2].al,
          f: doc.blocks[k2].f, z: doc.blocks[k2].z, c: doc.blocks[k2].c, b: doc.blocks[k2].b,
          i: doc.blocks[k2].i, u: doc.blocks[k2].u, ind: doc.blocks[k2].ind, sp: on2 ? 10 : 0 });
        updateBlockDom(k2);
      }
      markDirty();
      var pr = $('printPage');
      if (pr) pr.innerHTML = pageHtml(doc.blocks);
      note(on2 ? 'интервал перед абзацем: 10 px' : 'интервал убран');
      curInfo();
    });
    onClick('btnSup', function () { toggleFlag('sup'); });
    onClick('btnSub', function () { toggleFlag('sub'); });
    onClick('btnStrike', function () { toggleFlag('st'); });
    onClick('btnMark', function () { toggleFlag('hl'); });
    onClick('btnClearFmt', function () { clearChar(); });
    onClick('btnImg', function () { pickImage(); });
    onClick('btnLink', function () { makeLink(); });
  }

  /* ==================================================================
     ВИД: МАСШТАБ, ПОЛЯ, ЛИНЕЙКА, ЗНАКИ АБЗАЦЕВ
     ================================================================== */
  function pageCss() {
    var m = pageMode;
    if (m === 'land') return 'width:880px;min-height:620px;padding:44px 48px;';
    if (m === 'narrow') return 'width:640px;min-height:880px;padding:40px 32px;';
    if (m === 'wide') return 'width:640px;min-height:880px;padding:32px 64px;';
    return 'width:640px;min-height:880px;padding:48px 56px;';
  }
  function setPageMode(m) {
    pageMode = (m === 'land' || m === 'narrow' || m === 'wide') ? m : 'port';
    applyPageMode();
    return pageMode;
  }
  function applyPageMode() {
    var pg = $('page');
    if (!pg) return;
    pg.style.cssText = pageCss();
    var ruler = $('rulerRow');
    if (ruler) {
      var inner = ruler.firstElementChild;
      if (inner) inner.style.width = (pageMode === 'land' ? '768' : '528') + 'px';
    }
    var pr = $('printPage');
    if (pr && pr.parentNode) pr.parentNode.style.cssText = pageCss();
    fillPrint();
  }
  function setZoom(pct) {
    zoomPct = clamp(num(pct) || 100, 25, 400);
    fitPage();
    if ($('rbZoom')) $('rbZoom').innerHTML = zoomPct;
    return zoomPct;
  }
  function zoomBy(d) { return setZoom(zoomPct + (num(d) || 0)); }

  /* знаки абзацев: рисуем их по флажку */
  function applyMarks() {
    var pg = $('page');
    if (pg) pg.className = marks ? 'page showmarks' : 'page';
    var pp = $('printPage');
    if (pp) pp.className = marks ? 'page showmarks' : 'page';
  }

  function findCmd(q, all) {
    if (!q) { note('а что ищем-то?'); return -1; }
    var i = findNext(q, all ? 0 : findPos + 1);
    if (i < 0) { note('больше нет: «' + q + '»'); return -1; }
    findPos = findAt + q.length;
    sel = i;
    renderAll();
    select(i, true);
    focusBlock(i, false);
    selectFound(q);
    note('нашли: абзац ' + (i + 1) + ' из ' + doc.blocks.length + ', всего совпадений: ' + countMatches(q));
    return i;
  }
  function replaceAllCmd(q, to) {
    if (!q) { note('а что менять-то?'); return 0; }
    if (to == null) to = q;
    var n = replaceAllBlocks(q, to);
    if (n) { renderAll(); markDirty(); }
    note(n ? ('заменено: ' + n) : 'ничего не нашлось');
    return n;
  }
  function replaceOneCmd(q, to) {
    if (!q) { note('а что менять-то?'); return 0; }
    if (to == null) to = q;
    var n = replaceInBlock(sel, q, to);
    if (n) { renderAll(); markDirty(); }
    note(n ? ('в этом абзаце заменено: ' + n) : 'в этом абзаце не нашлось');
    return n;
  }

  /* ==================================================================
     ПУБЛИЧНЫЙ API — им управляется лента Word
     ================================================================== */
  var API = {
    get: function () { return { doc: doc, sel: sel, dirty: dirty, auto: auto }; },
    doc: function () { return doc; },
    state: function () { return doc.blocks[sel] || null; },
    select: function (i, scroll) { select(i, !!scroll); },
    apply: function () { apply(); },
    readForm: function () { readForm(); },
    fillForm: function () { fillForm(); },
    curInfo: function () { curInfo(); },
    undo: function () { undo(); },
    redo: function () { redo(); },
    toggleFlag: function (f) { toggleFlag(f); },
    clearChar: function () { clearChar(); },
    makeLink: function () { makeLink(); },
    insertImage: function () { pickImage(); },
    matches: function (q) { return countMatches(q); },
    revert: function () { revert(); },
    addAfter: function () { addAfter(); },
    clearAll: function () { clearAll(); },
    loadTemplate: function () { loadTemplate(); },
    moveBlock: function (d) { moveBlock(d); },
    dupBlock: function () { dupBlock(); },
    delBlock: function () { delBlock(); },
    saveMono: function () { saveMono(); },
    saveDocx: function () { saveDocx(); },
    saveHtm: function () { saveHtm(); },
    saveTxt: function () { saveTxt(); },
    openMono: function () { var f = $('fileMono'); if (f) f.click(); },
    openAny: function () { var f = $('fileDoc'); if (f) f.click(); },
    doPrint: function () { doPrint(); },
    toggleAuto: function () { if ($('btnAuto')) $('btnAuto').click(); },
    zoom: function (delta) { zoomBy(delta); },
    zoomReset: function () { setZoom(100); },
    zoomGet: function () { return zoomPct; },
    fit: function () { fitPage(); },
    find: function (q, all) { return findCmd(q, !!all); },
    replaceAll: function (q, to) { return replaceAllCmd(q, to); },
    replaceHere: function (q, to) { return replaceOneCmd(q, to); },
    setPages: function (m) { setPageMode(m); },
    pageMode: function () { return pageMode; },
    setGuides: function (on) { guides = !!on; fitPage(); },
    hasGuides: function () { return guides; },
    setMarks: function (on) { marks = !!on; applyMarks(); },
    hasMarks: function () { return marks; },
    applyPageMode: applyPageMode,
    setRuler: function (on) { ruler = !!on; $('rulerRow').className = on ? '' : 'off'; },
    hasRuler: function () { return ruler; },
    status: updateStatus,
    note: note,
    beep: beep
  };
  if (typeof window !== 'undefined') window.MonolitDoc = API;

  /* ==================================================================
     ЗАПУСК
     ================================================================== */
  function init() {
    buildStatus();
    loadAutoFlag();
    doc = blankDoc();
    var restored = loadStored();
    if (restored) note('восстановили твой документ из автосохранения');
    if ($('fName') && doc.title) $('fName').value = doc.title;
    initLogo();
    hits();

    var tabs = document.querySelectorAll('.tab'), k;
    for (k = 0; k < tabs.length; k++) {
      tabs[k].onclick = (function (t) {
        return function () { tab(t.getAttribute('data-tab')); beep(540, 0.02); };
      })(tabs[k]);
    }

    onClick('btnNew', function () { clearAll(); });
    onClick('btnTpl', function () { loadTemplate(); });
    onClick('btnAll', function () {
      if (confirm('Стереть весь документ? Отменить можно через Ctrl+Z.')) clearAll();
    });
    onClick('btnUp', function () { moveBlock(-1); });
    onClick('btnDown', function () { moveBlock(1); });
    onClick('btnDup', function () { dupBlock(); });
    onClick('btnDel', function () { delBlock(); });
    onClick('btnApply', function () { apply(); });
    onClick('btnAddAfter', function () { addAfter(); });
    onClick('btnRevert', function () { revert(); });
    onClick('btnSaveMono', function () { saveMono(); });
    onClick('btnOpenMono', function () { var f = $('fileMono'); if (f) f.click(); });
    onClick('btnSaveHtm', function () { saveHtm(); });
    onClick('btnSaveTxt', function () { saveTxt(); });
    onClick('btnSaveDocx', function () { saveDocx(); });
    onClick('btnPrint', function () { doPrint(); });
    onClick('btnAuto', function () {
      auto = !auto;
      saveAutoFlag();
      if (auto) { saveNow(true); note('автосохранение включено'); }
      else note('автосохранение выключено');
      if ($('autoState')) $('autoState').innerHTML = auto ? 'вкл' : 'выкл';
      updateStatus();
    });
    onClick('sndOn', function () { sound = this.checked; if (sound) beep(700, 0.03); });
    var top = $('lnkTop');
    if (top) top.onclick = function () { window.scrollTo(0, 0); return false; };

    pageEvents();
    outlineEvents();
    fileEvents();
    dragEvents();
    formEvents();
    findEvents();
    hotkeys();

    window.addEventListener('resize', function () { rAF(fitPage); });
    window.addEventListener('beforeunload', function () { if (dirty) saveNow(true); });

    renderAll();
    applyPageMode();
    applyMarks();
    if ($('autoState')) $('autoState').innerHTML = auto ? 'вкл' : 'выкл';
    if ($('sndState')) $('sndState').innerHTML = sound ? 'вкл' : 'выкл';
    if ($('stBar')) $('stBar').style.display = 'flex';
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(tick, 1000);
    tick();
    updateStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
