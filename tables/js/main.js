/* ==================================================================
   ТАБЛИЦЫ МОНОЛИТ 2000 — операции, события, вкладки, запуск.
   Работает через window.MonolitCore (js/sheet.js).
   Публичный API: window.MonolitTable.
   ================================================================== */
(function () {
  'use strict';

  var LS = { sheet: 'monolit-tab-v1', auto: 'monolit-tab-auto' };
  var MAXUNDO = 60;

  function $(id) { return document.getElementById(id); }
  function C() { return window.MonolitCore; }

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
  function num(v) { var n = parseInt(v, 10); return (isNaN(n) || !isFinite(n)) ? null : n; }
  function on(v) { return v === true || v === 1 || v === '1' || v === 'on' || v === 'да'; }
  function deBom(s) { return String(s == null ? '' : s).replace(/^\ufeff/, ''); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rAF(fn) { requestAnimationFrame(fn); }
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
      g.gain.value = 0.035;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (d || 0.035));
      o.stop(ctx.currentTime + (d || 0.035) + 0.01);
    } catch (e) { }
  }
  function plural(n, one, few, many) {
    n = Math.abs(n) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }

  var dirty = false, auto = true, sound = true;
  var saveTimer = null, noteTimer = 0, clockTimer = 0;
  var undoStack = [], redoStack = [], lastPush = 0;
  var clip = null;
  var drag = null;          /* 'cells' | 'row' | 'col' | 'fill' | 'cw' | 'rh' */
  var fillTo = null, dragData = null;
  var findAt = 0;
  var putTarget = null;

  /* ==================================================================
     ОТКАТ И АВТОСОХРАНЕНИЕ
     ================================================================== */
  function snapshot() {
    var s = C().sheet;
    return JSON.stringify({
      title: s.title, rows: s.rows, cols: s.cols,
      cells: s.cells, w: s.w, h: s.h,
      merges: s.merges || [], names: s.names || []
    });
  }
  function pushUndo(force) {
    var now = new Date().getTime();
    if (!force && now - lastPush < 600 && undoStack.length) return;
    lastPush = now;
    undoStack.push(snapshot());
    if (undoStack.length > MAXUNDO) undoStack.shift();
    redoStack.length = 0;
  }
  function applySnapshot(s) {
    var o, ns, sh;
    try { o = JSON.parse(s); } catch (e) { return; }
    ns = C().normSheet(o);
    sh = C().sheet;
    sh.title = ns.title; sh.rows = ns.rows; sh.cols = ns.cols;
    sh.cells = ns.cells; sh.w = ns.w; sh.h = ns.h;
    sh.merges = ns.merges; sh.names = ns.names;
    if ($('fName')) $('fName').value = sh.title;
    C().clampSel(C().sel);
    C().buildGrid();
    C().paintSel();
    paintNames();
    updateStatus(0, 0);
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
  function markDirty() { dirty = true; queueSave(); paintDirty(); }
  function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(true); }, 1500);
  }
  function packNow() {
    var s = C().sheet;
    return JSON.stringify({
      v: 1, when: new Date().getTime(), title: s.title,
      rows: s.rows, cols: s.cols, cells: s.cells, w: s.w, h: s.h,
      merges: s.merges || [], names: s.names || []
    });
  }
  function saveNow(quiet) {
    if (!auto && !quiet) { note('автосохранение выключено', true); return false; }
    var ok = lsSet(LS.sheet, packNow());
    if (ok) { dirty = false; paintDirty(); if (!quiet) note('сохранено в браузере'); }
    else if (!quiet) note('браузер не дал сохранить');
    return ok;
  }
  function loadStored() {
    var s = lsGet(LS.sheet);
    if (!s) return false;
    try { C().sheet = C().normSheet(JSON.parse(s)); return true; } catch (e) { return false; }
  }
  function loadAutoFlag() { var s = lsGet(LS.auto); if (s != null) auto = on(s); }
  function saveAutoFlag() { lsSet(LS.auto, auto ? '1' : '0'); }
  function paintDirty() {
    var d = $('stDirty');
    if (!d) return;
    if (dirty) { d.className = 'rd'; d.innerHTML = 'НЕ СОХРАНЕНО'; }
    else { d.className = 'gr'; d.innerHTML = 'сохранено'; }
  }

  /* ==================================================================
     ОПЕРАЦИИ
     ================================================================== */
  function eachCell(s, fn) {
    var r, c;
    for (r = s.r1; r <= s.r2; r++) for (c = s.c1; c <= s.c2; c++) fn(r, c);
  }
  function commit() {
    markDirty();
    C().paintCells();
    C().paintSel();
  }
  function clearSelection(withStyle) {
    pushUndo();
    eachCell(C().sel, function (r, c) {
      var k = C().key(r, c), cell = C().sheet.cells[k];
      if (!cell) return;
      if (withStyle) delete C().sheet.cells[k];
      else { cell.v = ''; if (!cell.v) delete C().sheet.cells[k]; }
    });
    commit();
    note('очищено');
  }
  function styleEach(fn) {
    pushUndo();
    eachCell(C().sel, function (r, c) {
      var k = C().key(r, c), sh = C().sheet;
      if (!sh.cells[k]) sh.cells[k] = C().blankCell();
      fn(sh.cells[k]);
    });
    commit();
  }
  function toggleFlag(f) {
    var first = null, mixed = false, cell, v;
    eachCell(C().sel, function (r, c) {
      cell = C().cellAt(r, c);
      v = cell ? cell[f] : 0;
      if (first === null) first = v;
      else if (v !== first) mixed = true;
    });
    var want = mixed ? 1 : (first ? 0 : 1);
    styleEach(function (cell) { cell[f] = want; });
    return want;
  }
  function setAlign(al) { styleEach(function (cell) { cell.al = al; }); }
  function setColor(hex) { styleEach(function (cell) { cell.c = hex; }); }
  function setFillColor(hex) { styleEach(function (cell) { cell.bg = hex; }); }
  function noFill() { styleEach(function (cell) { cell.bg = ''; }); }
  function clearStyle() {
    styleEach(function (cell) {
      cell.b = 0; cell.i = 0; cell.u = 0; cell.al = ''; cell.c = ''; cell.bg = ''; cell.f = 'gen';
    });
  }
  function setFmt(f) {
    if (f !== 'gen' && f !== 'int' && f !== 'num' && f !== 'cur' && f !== 'pct') return;
    styleEach(function (cell) { cell.f = f; });
  }
  function flagsOfActive() {
    var cell = C().cellAt(C().sel.r1, C().sel.c1);
    return { b: cell ? cell.b : 0, i: cell ? cell.i : 0, u: cell ? cell.u : 0 };
  }
  function fmtOfActive() { var cell = C().cellAt(C().sel.r1, C().sel.c1); return cell ? cell.f : 'gen'; }
  function alignOfActive() { var cell = C().cellAt(C().sel.r1, C().sel.c1); return cell ? cell.al : ''; }

  /* ---------- строки и столбцы ---------- */
  function remapCells(mapFn) {
    var sh = C().sheet, out = {}, k, p, np;
    for (k in sh.cells) {
      if (!C().has(sh.cells, k)) continue;
      p = C().parseRef(k);
      if (!p) continue;
      np = mapFn(p.r, p.c);
      if (!np) continue;
      if (np.r >= sh.rows || np.c >= sh.cols) continue;
      out[C().key(np.r, np.c)] = sh.cells[k];
    }
    sh.cells = out;
  }
  function mapKeys(obj, mapFn) {
    var out = {}, k, np, n;
    for (k in obj) {
      if (!C().has(obj, k)) continue;
      n = parseInt(k, 10);
      if (isNaN(n)) continue;
      np = mapFn(n);
      if (np == null) continue;
      out[np] = obj[k];
    }
    return out;
  }
  /* слияния и имена диапазонов переезжают вместе со строками и столбцами */
  function remapMergeList(mapFn) {
    var list = C().sheet.merges || [], out = [], i, m, a, b, g;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      a = mapFn(m.r1, m.c1);
      b = mapFn(m.r2, m.c2);
      if (!a || !b) continue;
      g = { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
      if (g.r1 > g.r2) { var tr = g.r1; g.r1 = g.r2; g.r2 = tr; }
      if (g.c1 > g.c2) { var tc = g.c1; g.c1 = g.c2; g.c2 = tc; }
      if (g.r1 === g.r2 && g.c1 === g.c2) continue;
      out.push(g);
    }
    return C().normMerges(out, C().sheet.rows, C().sheet.cols);
  }
  function remapNameList(mapFn) {
    var list = C().sheet.names || [], out = [], i, n, a, b;
    for (i = 0; i < list.length; i++) {
      n = list[i];
      a = mapFn(n.r1, n.c1);
      b = mapFn(n.r2, n.c2);
      if (!a || !b) continue;
      out.push({ name: n.name, r1: a.r, c1: a.c, r2: b.r, c2: b.c });
    }
    return C().normNames(out, C().sheet.rows, C().sheet.cols);
  }
  function insertRows(at, count) {
    var sh = C().sheet, grow = function (r, c) { return { r: r >= at ? r + count : r, c: c }; };
    count = count || 1;
    if (sh.rows + count > C().MAXROWS) {
      count = C().MAXROWS - sh.rows;
      note('больше ' + C().MAXROWS + ' строк не будет');
    }
    if (count <= 0) return;
    pushUndo(true);
    remapCells(grow);
    sh.h = mapKeys(sh.h, function (r) { return r >= at ? r + count : r; });
    sh.rows += count;
    sh.merges = remapMergeList(grow);
    sh.names = remapNameList(grow);
    C().buildGrid();
    commit();
    paintNames();
    note('вставлено строк: ' + count);
  }
  function deleteRows(from, to) {
    var sh = C().sheet, count = to - from + 1, drop;
    if (count <= 0) return;
    drop = function (r, c) {
      if (r >= from && r <= to) return null;
      return { r: r > to ? r - count : r, c: c };
    };
    pushUndo(true);
    remapCells(drop);
    sh.h = mapKeys(sh.h, function (r) {
      if (r >= from && r <= to) return null;
      return r > to ? r - count : r;
    });
    sh.rows -= count;
    if (sh.rows < 1) sh.rows = 1;
    sh.merges = remapMergeList(drop);
    sh.names = remapNameList(drop);
    C().buildGrid();
    C().clampSel(C().sel);
    commit();
    paintNames();
    note('удалено строк: ' + count);
  }
  function insertCols(at, count) {
    var sh = C().sheet, grow = function (r, c) { return { r: r, c: c >= at ? c + count : c }; };
    count = count || 1;
    if (sh.cols + count > C().DEFCOLS) {
      count = C().DEFCOLS - sh.cols;
      note('больше ' + C().DEFCOLS + ' столбцов не будет');
    }
    if (count <= 0) return;
    pushUndo(true);
    remapCells(grow);
    sh.w = mapKeys(sh.w, function (c) { return c >= at ? c + count : c; });
    sh.cols += count;
    sh.merges = remapMergeList(grow);
    sh.names = remapNameList(grow);
    C().buildGrid();
    commit();
    paintNames();
    note('вставлено столбцов: ' + count);
  }
  function deleteCols(from, to) {
    var sh = C().sheet, count = to - from + 1, drop;
    if (count <= 0) return;
    drop = function (r, c) {
      if (c >= from && c <= to) return null;
      return { r: r, c: c > to ? c - count : c };
    };
    pushUndo(true);
    remapCells(drop);
    sh.w = mapKeys(sh.w, function (c) {
      if (c >= from && c <= to) return null;
      return c > to ? c - count : c;
    });
    sh.cols -= count;
    if (sh.cols < 1) sh.cols = 1;
    sh.merges = remapMergeList(drop);
    sh.names = remapNameList(drop);
    C().buildGrid();
    C().clampSel(C().sel);
    commit();
    paintNames();
    note('удалено столбцов: ' + count);
  }

  /* ---------- автозаполнение ---------- */
  function applyFill(from, to) {
    var fh = from.r2 - from.r1 + 1, fw = from.c2 - from.c1 + 1;
    var sh = C().sheet;
    var dr, dc, sr, scc, k, raw, cell, src;
    if (!to) return;
    pushUndo(true);
    for (dr = to.r1; dr <= to.r2; dr++) {
      for (dc = to.c1; dc <= to.c2; dc++) {
        if (dr >= from.r1 && dr <= from.r2 && dc >= from.c1 && dc <= from.c2) continue;
        sr = from.r1 + ((dr - from.r1) % fh);
        scc = from.c1 + ((dc - from.c1) % fw);
        k = C().key(sr, scc);
        src = C().has(sh.cells, k) ? sh.cells[k] : null;
        k = C().key(dr, dc);
        if (!src) { delete sh.cells[k]; continue; }
        cell = C().clone(src);
        raw = String(cell.v);
        if (raw.charAt(0) === '=') cell.v = C().shiftFormula(raw, dr - sr, dc - scc);
        sh.cells[k] = cell;
      }
    }
    commit();
    note('заполнено: ' + ((to.r2 - to.r1 + 1) * (to.c2 - to.c1 + 1)) + ' ' + plural((to.r2 - to.r1 + 1) * (to.c2 - to.c1 + 1), 'ячейка', 'ячейки', 'ячеек'));
  }

  /* ---------- буфер обмена ---------- */
  function selText() {
    var s = C().sel, lines = [], parts = [], r, c;
    for (r = s.r1; r <= s.r2; r++) {
      parts = [];
      for (c = s.c1; c <= s.c2; c++) parts.push(C().fmtPlain(C().cellVal(r, c)));
      lines.push(parts.join('\t'));
    }
    return lines.join('\n');
  }
  function copySel(cut) {
    var s = C().sel, sh = C().sheet;
    var r, c, rows = [], styles = [], k, cell;
    pushUndo(!!cut);
    for (r = s.r1; r <= s.r2; r++) {
      rows.push([]); styles.push([]);
      for (c = s.c1; c <= s.c2; c++) {
        k = C().key(r, c);
        cell = C().has(sh.cells, k) ? sh.cells[k] : null;
        rows[r - s.r1].push(cell ? cell.v : '');
        styles[r - s.r1].push(cell ? {
          b: cell.b, i: cell.i, u: cell.u, al: cell.al, c: cell.c, bg: cell.bg, f: cell.f
        } : null);
      }
    }
    clip = {
      rows: rows, styles: styles, cut: !!cut,
      h: rows.length, w: rows.length ? rows[0].length : 0,
      src: { r: s.r1, c: s.c1 }
    };
    if (cut) {
      for (r = s.r1; r <= s.r2; r++) for (c = s.c1; c <= s.c2; c++) {
        k = C().key(r, c);
        if (C().has(sh.cells, k)) sh.cells[k].v = '';
      }
      commit();
    }
    var text = selText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
      else legacyCopy(text);
    } catch (e) { legacyCopy(text); }
    note((cut ? 'вырезано' : 'скопировано') + ': ' + clip.h + '×' + clip.w);
    beep(660, 0.02);
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    if (ta.parentNode) ta.parentNode.removeChild(ta);
  }
  function legacyPaste() {
    var ta = document.createElement('textarea');
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    var ok = false;
    try { ok = document.execCommand('paste'); } catch (e) { }
    var text = ta.value;
    if (ta.parentNode) ta.parentNode.removeChild(ta);
    if (ta.focus) setTimeout(function () { C().selectCell(C().sel.r1, C().sel.c1); }, 0);
    if (ok && text) pasteText(text);
  }
  function pasteGrid(rows, styles, atR, atC, withStyles, srcR, srcC) {
    var h = rows.length, w = rows.length ? rows[0].length : 0;
    var sh = C().sheet;
    var r, c, i, j, tr, tc, raw, cell, k, st;
    if (!h || !w) return;
    if (srcR == null) { srcR = atR; srcC = atC; }
    pushUndo(true);
    for (r = 0; r < h; r++) {
      for (c = 0; c < w; c++) {
        tr = atR + r; tc = atC + c;
        if (tr >= sh.rows || tc >= sh.cols) continue;
        i = r; j = c;
        raw = String(rows[i][j] == null ? '' : rows[i][j]);
        st = withStyles && styles ? styles[i][j] : null;
        k = C().key(tr, tc);
        if (raw === '' && !st) { delete sh.cells[k]; continue; }
        cell = C().has(sh.cells, k) ? sh.cells[k] : C().blankCell();
        if (raw.charAt(0) === '=') {
          cell.v = C().shiftFormula(raw, tr - (srcR + i), tc - (srcC + j));
        } else cell.v = raw;
        if (st) {
          cell.b = st.b; cell.i = st.i; cell.u = st.u;
          cell.al = st.al; cell.c = st.c; cell.bg = st.bg; cell.f = st.f;
        }
        sh.cells[k] = cell;
      }
    }
    C().anchor = { r: atR, c: atC };
    C().setSel(atR, atC, Math.min(sh.rows - 1, atR + h - 1), Math.min(sh.cols - 1, atC + w - 1));
    commit();
  }
  function pasteClip() {
    if (!clip || !clip.rows.length) { note('буфер пуст'); legacyPaste(); return; }
    if (clip.cut) clip.cut = false;
    pasteGrid(clip.rows, clip.styles, C().sel.r1, C().sel.c1, true,
      clip.src ? clip.src.r : C().sel.r1, clip.src ? clip.src.c : C().sel.c1);
    note('вставлено');
  }
  function parseCsv(text) {
    var counts = { ',': 0, ';': 0, '\t': 0 }, best = ',', sep = ',', head, rows, row = [], cur = '', i, c, inQ = false;
    text = deBom(text);
    head = text.split(/\r?\n/).slice(0, 5).join('\n');
    counts[','] = (head.match(/,/g) || []).length;
    counts[';'] = (head.match(/;/g) || []).length;
    counts['\t'] = (head.match(/\t/g) || []).length;
    if (counts[';'] > counts[best]) best = ';';
    if (counts['\t'] > counts[best]) best = '\t';
    sep = best;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    rows = [];
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += c;
        continue;
      }
      if (c === '"') { inQ = true; continue; }
      if (c === sep) { row.push(cur); cur = ''; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      cur += c;
    }
    row.push(cur);
    rows.push(row);
    while (rows.length && rows[rows.length - 1].join('') === '') rows.pop();
    return rows;
  }
  function pasteText(text) {
    var rows = parseCsv(text);
    if (!rows.length) return;
    pasteGrid(rows, null, C().sel.r1, C().sel.c1, false);
    note('вставлено из буфера: ' + rows.length + ' строк');
  }
  function csvText() {
    var u = C().usedRange(), rows = [], parts = [], r, c, t;
    if (u.none) return '';
    for (r = u.r1; r <= u.r2; r++) {
      parts = [];
      for (c = u.c1; c <= u.c2; c++) {
        t = C().fmtPlain(C().cellVal(r, c));
        parts.push(/[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
      }
      rows.push(parts.join(';'));
    }
    return rows.join('\r\n');
  }

  /* ==================================================================
     СОРТИРОВКА
     ================================================================== */
  function sortKeyOf(r, c) {
    var v = C().cellVal(r, c), n = C().nval(v), s;
    if (n != null) return { t: 0, n: n, s: '' };
    s = C().sval(v);
    /* формулы, которые не посчитались в число, уходят в конец */
    if (String(C().rawAt(r, c)).charAt(0) === '=') return { t: 2, n: 0, s: s };
    return { t: 1, n: 0, s: s };
  }
  function cmpSort(a, b, dir) {
    var x, y;
    if (a.t !== b.t) return a.t < b.t ? -1 : 1;
    if (a.t === 0) { if (a.n === b.n) return 0; return (a.n < b.n ? -1 : 1) * dir; }
    x = a.s.toLowerCase(); y = b.s.toLowerCase();
    if (x === y) return 0;
    return (x < y ? -1 : 1) * dir;
  }
  function sortRange(asc) {
    var s = C().sel, sh = C().sheet, mg, i, r, c, cnt, order, keys, tmp, d, dr, dir, k, cell;
    s = C().snapSel(C().normSel(s.r1, s.c1, s.r2, s.c2));
    if (s.r1 === s.r2) {
      s.r1 = 0;
      s.r2 = sh.rows - 1;
      note('выделена одна строка — сортируем весь столбец');
    }
    cnt = s.r2 - s.r1 + 1;
    mg = C().merges();
    for (i = 0; i < mg.length; i++) {
      if (!(mg[i].r1 > s.r2 || mg[i].r2 < s.r1 || mg[i].c1 > s.c2 || mg[i].c2 < s.c1)) {
        note('строки не сортируем поверх объединения — сначала разъедини'); return;
      }
    }
    keys = []; order = [];
    for (r = s.r1; r <= s.r2; r++) {
      keys.push(sortKeyOf(r, s.c1));
      order.push(r);
    }
    dir = asc ? 1 : -1;
    order.sort(function (a, b) { return cmpSort(keys[a - s.r1], keys[b - s.r1], dir); });
    tmp = [];
    for (i = 0; i < cnt; i++) tmp.push(sortRowSlice(s, order[i]));
    pushUndo(true);
    for (i = 0; i < cnt; i++) {
      d = s.r1 + i;
      dr = d - order[i];
      sortRowPut(s, d, tmp[i]);
      /* ссылки, ушедшие из сортируемой области, едут вместе с ячейкой */
      for (c = s.c1; c <= s.c2; c++) {
        k = C().key(d, c);
        cell = C().has(sh.cells, k) ? sh.cells[k] : null;
        if (cell && String(cell.v).charAt(0) === '=') {
          cell.v = C().shiftOutside(cell.v, dr, 0, { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 });
        }
      }
    }
    commit();
    beep(600, 0.03);
    note('отсортировано строк: ' + cnt + ' по столбцу ' + C().colName(s.c1) +
      (asc ? ' по возрастанию' : ' по убыванию'));
  }
  function sortRowSlice(s, r) {
    var out = [], c, k, cell;
    for (c = s.c1; c <= s.c2; c++) {
      k = C().key(r, c);
      cell = C().has(C().sheet.cells, k) ? C().sheet.cells[k] : null;
      out.push(cell ? C().clone(cell) : null);
    }
    return out;
  }
  function sortRowPut(s, r, cells) {
    var c, k, sh = C().sheet;
    for (c = s.c1; c <= s.c2; c++) {
      k = C().key(r, c);
      if (cells[c - s.c1]) sh.cells[k] = cells[c - s.c1];
      else delete sh.cells[k];
    }
  }

  /* ==================================================================
     ОБЪЕДИНЕНИЕ ЯЧЕЕК
     ================================================================== */
  function mergeSel() {
    var s = C().snapSel(C().normSel(C().sel.r1, C().sel.c1, C().sel.r2, C().sel.c2));
    if (s.r1 === s.r2 && s.c1 === s.c2) { note('выдели больше одной ячейки'); return; }
    if (!C().canMerge(s.r1, s.c1, s.r2, s.c2)) {
      note('здесь уже объединено или рядом объединение'); return;
    }
    pushUndo(true);
    C().liftMergeValues(s.r1, s.c1, s.r2, s.c2);
    C().addMerge(s.r1, s.c1, s.r2, s.c2);
    C().buildGrid();
    C().anchor = { r: s.r1, c: s.c1 };
    C().setSel(s.r1, s.c1, s.r2, s.c2, true);
    commit();
    note('объединено: ' + C().refSelText(s));
    beep(700, 0.03);
  }
  function unmergeSel() {
    var s = C().normSel(C().sel.r1, C().sel.c1, C().sel.r2, C().sel.c2), hit;
    pushUndo(true);
    hit = C().unmergeRange(s.r1, s.c1, s.r2, s.c2);
    C().buildGrid();
    C().paintSel();
    commit();
    note(hit ? ('разъединено: ' + hit + ' ' + plural(hit, 'объединение', 'объединения', 'объединений'))
      : 'здесь объединений нет');
  }
  function mergeAllRows() {
    var s = C().sel, u = C().usedRange(), sh = C().sheet, c1, c2, r, c, added = 0, has2;
    if (u.none) { note('таблица пуста'); return; }
    c1 = (s.c2 > s.c1) ? s.c1 : u.c1;
    c2 = (s.c2 > s.c1) ? s.c2 : u.c2;
    pushUndo(true);
    for (r = u.r1; r <= u.r2; r++) {
      has2 = false;
      for (c = c1; c <= c2; c++) if (C().has(sh.cells, C().key(r, c))) { has2 = true; break; }
      if (!has2) continue;
      if (!C().canMerge(r, c1, r, c2)) continue;
      C().liftMergeValues(r, c1, r, c2);
      if (C().addMerge(r, c1, r, c2)) added++;
    }
    C().buildGrid();
    C().paintSel();
    commit();
    note('объединено строк в один столбец: ' + added);
  }
  function unmergeAll() {
    var sh = C().sheet, hit;
    if (!(sh.merges || []).length) { note('на листе ничего не объединено'); return; }
    pushUndo(true);
    hit = C().unmergeRange(0, 0, sh.rows - 1, sh.cols - 1);
    C().buildGrid();
    C().paintSel();
    commit();
    note('разъединено всего: ' + hit);
  }

  /* ==================================================================
     ИМЕНА ДИАПАЗОНОВ
     ================================================================== */
  function paintNames() {
    var dl = $('nmList'), list, i, h = '';
    if (!dl) return;
    list = C().namesList();
    for (i = 0; i < list.length; i++) h += '<option value="' + esc(list[i].name) + '"></option>';
    dl.innerHTML = h;
  }
  function nameSave() {
    var el = $('nmName'), nm = el ? String(el.value).trim() : '', s = C().sel, res;
    if (!nm) { note('впиши имя диапазона — например, Итого'); return; }
    res = C().setName(nm, C().normSel(s.r1, s.c1, s.r2, s.c2));
    if (!res.ok) { note(res.why); return; }
    pushUndo(true);
    markDirty();
    paintNames();
    note('имя «' + nm + '» → ' + C().refSelText(s));
    beep(880, 0.03);
  }
  function nameGo() {
    var el = $('nmName'), nm = el ? String(el.value).trim() : '', n;
    if (!nm) { note('впиши имя диапазона'); return; }
    n = C().findName(nm);
    if (!n) { note('имени «' + nm + '» нет'); return; }
    C().anchor = { r: n.r1, c: n.c1 };
    C().setSel(n.r1, n.c1, n.r2, n.c2);
    note('имя «' + n.name + '» → ' + C().refSelText(n));
    beep(660, 0.02);
  }
  function nameDel() {
    var el = $('nmName'), nm = el ? String(el.value).trim() : '', hit;
    if (!nm) { note('впиши имя диапазона'); return; }
    pushUndo(true);
    hit = C().delName(nm);
    markDirty();
    paintNames();
    note(hit ? 'имя «' + nm + '» забыто' : 'такого имени не было');
  }

  /* ==================================================================
     УСЛОВНОЕ ФОРМАТИРОВАНИЕ
     ================================================================== */
  function cfApply() {
    var op = $('cfOp') ? $('cfOp').value : 'gt';
    var raw = $('cfVal') ? String($('cfVal').value).trim() : '';
    var fc = $('cfColor') ? String($('cfColor').value).toLowerCase() : '';
    var bg = $('cfFill') ? String($('cfFill').value).toLowerCase() : '';
    var rule, s = C().sel, r, c, k, cell, sh = C().sheet, n = 0;
    if (!C().CF_OPS[op]) { note('выбери условие'); return; }
    raw = raw.replace(/\s+/g, '').replace(/^-/, '').replace(',', '.');
    if (!/^[0-9]+(\.[0-9]+)?$/.test(raw)) { note('значение должно быть числом'); return; }
    rule = op + ':' + raw + ':' + (fc || '#000000') + (bg || '');
    pushUndo(true);
    for (r = s.r1; r <= s.r2; r++) {
      for (c = s.c1; c <= s.c2; c++) {
        k = C().key(r, c);
        cell = C().has(sh.cells, k) ? sh.cells[k] : null;
        if (!cell) { cell = C().blankCell(); sh.cells[k] = cell; }
        cell.cf = rule;
        n++;
      }
    }
    commit();
    var words = { gt: 'больше', lt: 'меньше', eq: 'равно' };
    note('правило «' + words[op] + ' ' + raw + '» на ' + n + ' ' + plural(n, 'ячейку', 'ячейки', 'ячеек'));
  }
  function cfOff() {
    var s = C().sel, r, c, k, cell, sh = C().sheet, n = 0;
    pushUndo(true);
    for (r = s.r1; r <= s.r2; r++) {
      for (c = s.c1; c <= s.c2; c++) {
        k = C().key(r, c);
        cell = C().has(sh.cells, k) ? sh.cells[k] : null;
        if (!cell || !cell.cf) continue;
        cell.cf = '';
        n++;
      }
    }
    commit();
    note(n ? 'правило убрано с ' + n + ' ' + plural(n, 'ячейки', 'ячеек', 'ячеек') : 'правил на выделении нет');
  }

  /* ==================================================================
     НАЙТИ И ЗАМЕНИТЬ
     ================================================================== */
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  function optsFor(q) {
    var ckC = $('ckCase'), ckF = $('ckFx'), rp = $('fRepl'), el = $('fFind');
    var t = (q == null) ? (el ? String(el.value) : '') : String(q);
    var o = {
      cs: !!(ckC && ckC.checked),
      fx: !(ckF && !ckF.checked),
      raw: t,
      up: t.toUpperCase(),
      lo: t.toLowerCase(),
      repl: rp ? String(rp.value) : ''
    };
    o.needle = o.cs ? o.up : o.lo;
    return t ? o : null;
  }
  function normHay(s, o) { return o.cs ? String(s).toUpperCase() : String(s).toLowerCase(); }
  function cellHay(r, c, o) {
    var out = C().fmtPlain(C().cellVal(r, c));
    if (o.fx) out += '\u0000' + C().rawAt(r, c);
    return normHay(out, o);
  }
  function rawIsHit(r, c, o) {
    var raw = String(C().rawAt(r, c));
    var body = raw.charAt(0) === '=' ? raw.slice(1) : raw;
    var re = new RegExp(escRe(o.needle), 'i');
    return re.test(o.cs ? body.toUpperCase() : body.toLowerCase());
  }
  function replRaw(r, c, o) {
    var raw = String(C().rawAt(r, c)), isFx = raw.charAt(0) === '=';
    var body = isFx ? raw.slice(1) : raw;
    var re = new RegExp(escRe(o.needle), 'gi');
    var out = body.replace(re, (function () {
      return function (m) {
        var key = o.cs ? m.toUpperCase() : m.toLowerCase();
        return key === o.needle ? o.repl : m;
      };
    })());
    return isFx ? '=' + out : out;
  }
  function replaceOne() {
    var o = optsFor(null), sh, total, i, idx, r, c, cur;
    if (!o) { note('впиши, что ищем'); return; }
    sh = C().sheet;
    cur = C().sel.r2 * sh.cols + C().sel.c2;
    total = sh.rows * sh.cols;
    for (i = 0; i < total; i++) {
      idx = (cur + i) % total;
      r = Math.floor(idx / sh.cols);
      c = idx % sh.cols;
      if (cellHay(r, c, o).indexOf(o.needle) < 0) continue;
      C().anchor = { r: r, c: c };
      C().setSel(r, c, r, c);
      if (!rawIsHit(r, c, o)) {
        findAt = idx;
        note('в ' + C().addr(r, c) + ' это вычисленное значение — правится вручную');
        return;
      }
      pushUndo(true);
      C().putRawOwn(r, c, replRaw(r, c, o));
      commit();
      findAt = idx;
      note('заменено в ' + C().addr(r, c));
      return;
    }
    note('больше нет: ' + o.raw);
  }
  function replaceAll() {
    var o = optsFor(null), u = C().usedRange(), r, c, n = 0;
    if (!o) { note('впиши, что ищем'); return; }
    if (u.none) { note('таблица пуста'); return; }
    pushUndo(true);
    for (r = u.r1; r <= u.r2; r++) {
      for (c = u.c1; c <= u.c2; c++) {
        if (cellHay(r, c, o).indexOf(o.needle) < 0) continue;
        if (!rawIsHit(r, c, o)) continue;
        C().putRawOwn(r, c, replRaw(r, c, o));
        n++;
      }
    }
    commit();
    note('заменено ячеек: ' + n + (n ? '' : ' — ничего не подошло под «' + o.raw + '»'));
  }
  function findOpen() {
    var el = $('fFind');
    tab('view');
    if (el) { try { el.focus(); el.select(); } catch (e) { el.focus(); } }
  }

  /* ---------- быстрые функции ---------- */
  function insertFx(name, label) {
    var s = C().sel, c = s.c1, top = s.r1 - 1, bottom = s.r2;
    var r, guard = 0, target, arg;
    while (top >= 0 && guard++ < 400 && C().rawAt(top, c) !== '') top--;
    top++;
    if (bottom < top) bottom = top - 1;
    if (bottom >= C().sheet.rows - 1) {
      insertRows(C().sheet.rows, 1);
      bottom = C().sheet.rows - 2;
      s = C().sel;
      c = s.c1;
    }
    target = bottom + 1;
    if (top > bottom) arg = C().addr(top, c);
    else if (top === bottom) arg = C().addr(top, c);
    else arg = C().addr(top, c) + ':' + C().addr(bottom, c);
    var f = '=' + name + '(' + arg + ')';
    pushUndo(true);
    C().setRaw(target, c, f);
    C().anchor = { r: target, c: c };
    C().setSel(target, c, target, c);
    commit();
    note(label + ' → ' + f);
  }
  function insertSeries() {
    var s = C().sel, c = s.c1, r, n = 1;
    pushUndo(true);
    for (r = s.r1; r <= s.r2; r++) C().setRaw(r, c, String(n++));
    commit();
    note('ряд 1,2,3… готов');
  }
  function insertOnes() {
    var s = C().sel, r, c;
    pushUndo(true);
    for (r = s.r1; r <= s.r2; r++) for (c = s.c1; c <= s.c2; c++) C().setRaw(r, c, '1');
    commit();
    note('единицы на месте');
  }
  function insertDate() {
    var d = new Date();
    pushUndo(true);
    C().setRaw(C().sel.r1, C().sel.c1, '=СЕГОДНЯ()');
    commit();
    note('сегодня: ' + pad(d.getDate(), 2) + '.' + pad(d.getMonth() + 1, 2) + '.' + d.getFullYear());
  }
  function insertCustom(text) {
    var t = String(text || '').trim();
    if (!t) { note('вставь формулу, например =СУММ(B1:B9)'); return; }
    if (t.charAt(0) !== '=') t = '=' + t;
    pushUndo(true);
    C().setRaw(C().sel.r1, C().sel.c1, t);
    C().anchor = { r: C().sel.r1, c: C().sel.c1 };
    commit();
    C().startEdit();
    note('формула вставлена — допиши скобки');
  }
  function findCmd(q, again) {
    var o = optsFor(q == null ? null : q), sh, total, i, idx, r, c, cur;
    if (!o) { note('впиши, что ищем'); return false; }
    sh = C().sheet;
    cur = C().sel.r2 * sh.cols + C().sel.c2;
    if (!again) findAt = cur;
    total = sh.rows * sh.cols;
    for (i = 1; i <= total; i++) {
      idx = (findAt + i) % total;
      r = Math.floor(idx / sh.cols);
      c = idx % sh.cols;
      if (cellHay(r, c, o).indexOf(o.needle) >= 0) {
        findAt = idx;
        C().anchor = { r: r, c: c };
        C().setSel(r, c, r, c);
        note('нашли: ' + C().addr(r, c));
        return true;
      }
    }
    note('больше нет: ' + o.raw);
    return false;
  }

  /* ---------- размеры ---------- */
  var mctx = null;
  function measure(text, bold) {
    if (!mctx) { try { mctx = document.createElement('canvas').getContext('2d'); } catch (e) { mctx = null; } }
    if (!mctx) return String(text).length * 7;
    mctx.font = (bold ? 'bold ' : '') + '11px Tahoma, Verdana, Arial, sans-serif';
    return mctx.measureText(String(text)).width + 14;
  }
  function autoWidth() {
    var u = C().usedRange(), sh = C().sheet, c, r, best, cell, w;
    if (u.none) { note('таблица пуста'); return; }
    pushUndo(true);
    for (c = u.c1; c <= u.c2; c++) {
      best = 48;
      for (r = u.r1; r <= u.r2; r++) {
        cell = C().cellAt(r, c);
        if (!cell) continue;
        w = measure(C().fmtPlain(C().cellVal(r, c)), cell.b);
        if (w > best) best = w;
      }
      sh.w[c] = Math.max(C().MIN_CW, Math.min(C().MAX_CW, Math.round(best)));
    }
    C().buildGrid();
    commit();
    note('ширины столбцов по содержимому');
  }
  function autoHeight() {
    var u = C().usedRange(), sh = C().sheet, r, c, best, cell;
    if (u.none) { note('таблица пуста'); return; }
    pushUndo(true);
    for (r = u.r1; r <= u.r2; r++) {
      best = C().DEF_RH;
      for (c = u.c1; c <= u.c2; c++) {
        cell = C().cellAt(r, c);
        if (!cell) continue;
        if (measure(C().fmtPlain(C().cellVal(r, c)), cell.b) > C().cw(c) - 8) best = 44;
      }
      sh.h[r] = best;
    }
    C().buildGrid();
    commit();
    note('высоты строк по содержимому');
  }

  /* ==================================================================
     ФАЙЛЫ
     ================================================================== */
  function fileStem() {
    var t = ($('fName') && $('fName').value) || C().sheet.title || 'таблица';
    return String(t).replace(/[\\/:*?"<>|]/g, '_').slice(0, 48) || 'таблица';
  }
  function download(name, text, mime) {
    try {
      var blob = new Blob(['\ufeff' + text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
      return true;
    } catch (e) { note('сохранить не вышло: браузер запретил'); return false; }
  }
  function saveMono() {
    var s = C().sheet;
    if ($('fName')) s.title = $('fName').value;
    if (download(fileStem() + '.mono', packNow(), 'application/json')) {
      dirty = false; paintDirty();
      note('сохранили ' + fileStem() + '.mono');
      beep(1320, 0.04);
    }
  }
  function saveCsv() {
    var text = csvText();
    if (!text) { note('таблица пуста — нечего сохранять'); return; }
    if (download(fileStem() + '.csv', text, 'text/csv')) note('сохранили CSV');
  }
  function openFile(cb) {
    var f = $('fileMono');
    if (!f) { note('нет поля для файла'); return; }
    f.onchange = function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () { cb(String(rd.result || ''), file.name); };
      rd.onerror = function () { note('не смог прочитать файл'); };
      rd.readAsText(file);
    };
    f.click();
  }
  function loadInto(s, title) {
    pushUndo(true);
    C().sheet = s;
    if (!s.merges) s.merges = [];
    if (!s.names) s.names = [];
    if ($('fName')) $('fName').value = title || s.title;
    C().anchor = { r: 0, c: 0 };
    C().sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
    C().buildGrid();
    C().setSel(0, 0, 0, 0);
    paintNames();
    commit();
  }
  function openMono() {
    openFile(function (text, name) {
      var data = null;
      try { data = JSON.parse(text); } catch (e) { data = null; }
      if (data && typeof data === 'object' && (data.cells || data.rows || data.cols)) {
        loadInto(C().normSheet(data));
        note('открыли ' + name);
        beep(700, 0.04);
      } else loadCsvText(text, name);
    });
  }
  function openCsv() { openFile(function (text, name) { loadCsvText(text, name); }); }
  function loadCsvText(text, name) {
    var rows = parseCsv(text), r, c, i, s, v, t, n;
    if (!rows.length) { note('файл пустой'); return; }
    s = C().blankSheet();
    s.cells = {};
    s.title = name ? name.replace(/\.[^.]+$/, '') : 'Таблица';
    for (r = 0; r < rows.length && r < C().MAXROWS; r++) {
      for (c = 0; c < rows[r].length && c < C().DEFCOLS; c++) {
        t = rows[r][c];
        if (t === '' || t == null) continue;
        C().put(r, c, t);
        n = Number(String(t).replace(',', '.'));
        if (isFinite(n) && /^[+-]?[\d.,]+$/.test(String(t).trim())) s.cells[C().key(r, c)].f = 'num';
      }
    }
    loadInto(s, s.title);
    note('загрузили ' + name + ' (' + rows.length + ' строк)');
    beep(700, 0.04);
  }

  /* ---------- печать ---------- */
  function printTable() {
    var u = C().usedRange(), pa = $('printArea'), sh = C().sheet;
    var h = '', c, r, i, cell, v, al, style, w;
    if (!pa) return false;
    if (u.none) { note('печатать нечего — таблица пуста'); return false; }
    w = u.c2 - u.c1 + 1;
    h = '<p class="pr-t">' + esc(sh.title || 'Таблица') + '</p><table><colgroup>';
    for (i = 0; i < w; i++) h += '<col>';
    h += '</colgroup><tr class="pr-h">';
    for (c = u.c1; c <= u.c2; c++) h += '<td>' + C().colName(c) + '</td>';
    h += '</tr>';
    for (r = u.r1; r <= u.r2; r++) {
      h += '<tr><td class="pr-n">' + (r + 1) + '</td>';
      for (c = u.c1; c <= u.c2; c++) {
        cell = C().cellAt(r, c);
        v = C().cellVal(r, c);
        style = '';
        if (cell) {
          if (cell.b) style += 'font-weight:bold;';
          if (cell.i) style += 'font-style:italic;';
          if (cell.u) style += 'text-decoration:underline;';
          if (cell.c) style += 'color:' + cell.c + ';';
          if (cell.bg) style += 'background:' + cell.bg + ';';
          al = cell.al || ((v && v.t === 'n') ? 'right' : 'left');
          style += 'text-align:' + (al === 'center' ? 'center' : (al === 'right' ? 'right' : 'left')) + ';';
        }
        h += '<td style="' + style + '">' + esc(C().fmtVal(v, cell ? cell.f : 'gen')) + '</td>';
      }
      h += '</tr>';
    }
    h += '</table>';
    pa.innerHTML = h;
    return true;
  }
  function doPrint() {
    if (!printTable()) return;
    setTimeout(function () { window.print(); }, 60);
  }

  /* ==================================================================
     ШАБЛОНЫ
     ================================================================== */
  function buildSmeta() {
    var s = C().blankSheet();
    s.title = 'Смета (химия)';
    s.cells = {};
    s.rows = 60;
    s.w = { 0: 210, 1: 96, 2: 96, 3: 72, 4: 96, 5: 112 };
    var head = { b: 1, bg: '#dff0e2', c: '#004d00', al: 'center' };
    putTarget = s;
    var i, r, last;
    put(0, 0, 'Вещество', head);
    put(0, 1, 'Формула', head);
    put(0, 2, 'М, г/моль', head);
    put(0, 3, 'Кол-во', head);
    put(0, 4, 'Цена, ₽', head);
    put(0, 5, 'Сумма, ₽', head);
    var items = [
      ['Серная кислота', 'H2SO4', 98, 3, 420],
      ['Гидроксид натрия', 'NaOH', 40, 5, 180],
      ['Хлорид натрия', 'NaCl', 58.5, 12, 45],
      ['Этанол 96%', 'C2H5OH', 46, 2, 610],
      ['Азотная кислота', 'HNO3', 63, 4, 520],
      ['Карбонат кальция', 'CaCO3', 100, 8, 95]
    ];
    for (i = 0; i < items.length; i++) {
      r = i + 1;
      put(r, 0, items[i][0]);
      put(r, 1, items[i][1], { al: 'center' });
      put(r, 2, String(items[i][2]), { f: 'num' });
      put(r, 3, String(items[i][3]), { f: 'int' });
      put(r, 4, String(items[i][4]), { f: 'cur' });
      put(r, 5, '=D' + (r + 1) + '*E' + (r + 1), { f: 'cur' });
    }
    last = items.length;
    var lastRow = last + 1;
    put(last + 1, 0, 'Итого', { b: 1, bg: '#eef7f0' });
    put(last + 1, 5, '=СУММ(F2:F' + lastRow + ')', { b: 1, f: 'cur', bg: '#eef7f0' });
    put(last + 3, 0, 'Средняя цена', { i: 1 });
    put(last + 3, 4, '=СРЗНАЧ(E2:E' + lastRow + ')', { f: 'cur' });
    put(last + 4, 0, 'Самая дорогая', { i: 1 });
    put(last + 4, 4, '=МАКС(E2:E' + lastRow + ')', { f: 'cur' });
    put(last + 5, 0, 'Позиций', { i: 1 });
    put(last + 5, 4, '=СЧЁТЗ(A2:A' + lastRow + ')', { f: 'int' });
    put(last + 6, 0, 'Проверка ЕСЛИ', { i: 1 });
    put(last + 6, 4, '=ЕСЛИ(F' + (last + 2) + '>2000;"дорого";"ок")');
    return s;
  }
  function buildSale() {
    var s = C().blankSheet();
    s.title = 'Продажи по месяцам';
    s.cells = {};
    s.rows = 60;
    s.w = { 0: 150 };
    var months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь'];
    var goods = ['Таблица', 'Документ', 'Презентация'];
    var m, g, lastCol;
    putTarget = s;
    put(0, 0, 'Товар', { b: 1, bg: '#dff0e2', c: '#004d00', al: 'center' });
    for (m = 0; m < months.length; m++) {
      s.w[m + 1] = 78;
      put(0, m + 1, months[m], { b: 1, bg: '#dff0e2', al: 'center' });
    }
    s.w[months.length + 1] = 92;
    put(0, months.length + 1, 'Всего', { b: 1, bg: '#dff0e2', al: 'center' });
    lastCol = C().colName(months.length);
    for (g = 0; g < goods.length; g++) {
      put(g + 1, 0, goods[g], { b: 1 });
      for (m = 0; m < months.length; m++) put(g + 1, m + 1, String(10 + ((g * 7 + m * 13) % 45)), { f: 'int' });
      put(g + 1, months.length + 1, '=СУММ(B' + (g + 2) + ':' + lastCol + (g + 2) + ')', { b: 1, f: 'num' });
    }
    var tr = goods.length + 2;
    put(tr, 0, 'Итого за месяц', { b: 1, bg: '#eef7f0' });
    for (m = 0; m <= months.length; m++) {
      put(tr, m + 1, '=СУММ(' + C().colName(m + 1) + '2:' + C().colName(m + 1) + (goods.length + 1) + ')',
        { b: 1, f: 'num', bg: '#eef7f0' });
    }
    put(tr + 2, 0, 'Среднее', { i: 1 });
    put(tr + 2, 1, '=СРЗНАЧ(B' + (tr + 1) + ':' + lastCol + (tr + 1) + ')', { f: 'num' });
    put(tr + 3, 0, 'Максимум', { i: 1 });
    put(tr + 3, 1, '=МАКС(B' + (tr + 1) + ':' + lastCol + (tr + 1) + ')', { f: 'num' });
    put(tr + 4, 0, 'Проверка И', { i: 1 });
    put(tr + 4, 1, '=ЕСЛИ(И(B' + (tr + 1) + '>0;B' + (tr + 3) + '>0);"есть продажи";"пусто")');
    return s;
  }
  function put(r, c, v, st) {
    var cell = C().normCell(st || {});
    cell.v = v;
    (putTarget || C().sheet).cells[C().key(r, c)] = cell;
  }
  function loadTemplate(which) {
    var built = which === 'sale' ? buildSale() : buildSmeta();
    putTarget = null;
    loadInto(built);
    note('пример загружен: ' + C().sheet.title);
    beep(880, 0.05);
  }
  function clearAll() {
    pushUndo(true);
    loadInto(C().emptySheet());
    note('таблица очищена. отменить — Ctrl+Z');
  }

  /* ==================================================================
     СТРОКА СОСТОЯНИЯ
     ================================================================== */
  function buildStatus() {
    if ($('stBar')) return;
    var d = document.createElement('div');
    d.className = 'statusbar';
    d.id = 'stBar';
    d.innerHTML = '<span id="stSheet">Лист1</span>' +
      '<span id="stRef">A1</span>' +
      '<span id="stSel">ячеек: 1</span>' +
      '<span id="stSum">сумма: 0</span>' +
      '<span id="stAvg">среднее: 0</span>' +
      '<span id="stDirty">сохранено</span>' +
      '<span id="stAuto">автосохр: вкл</span>' +
      '<span id="stNote"></span>' +
      '<span id="stClock">--:--:--</span>';
    var app = document.querySelector('.app');
    if (app) {
      var marq = document.querySelector('.marq');
      if (marq && marq.parentNode === app) app.insertBefore(d, marq);
      else app.appendChild(d);
    } else document.body.appendChild(d);
  }
  function note(t, sticky) {
    var el = $('stNote');
    if (!el) return;
    el.innerHTML = esc(t);
    if (noteTimer) clearTimeout(noteTimer);
    if (t && !sticky) noteTimer = setTimeout(function () { el.innerHTML = ''; }, 4500);
  }
  function updateStatus(sum, nums) {
    var cells = 0, sh = C().sheet;
    if (C().sel) cells = (C().sel.r2 - C().sel.r1 + 1) * (C().sel.c2 - C().sel.c1 + 1);
    if ($('stRef')) $('stRef').innerHTML = esc(C().selRef());
    if ($('stSel')) $('stSel').innerHTML = 'ячеек: ' + cells;
    if ($('stSum')) $('stSum').innerHTML = 'сумма: ' + (sum ? C().ru(sum, 2) : '0');
    if ($('stAvg')) $('stAvg').innerHTML = 'среднее: ' + (nums ? C().ru(sum / nums, 2) : '0');
    if ($('stAuto')) $('stAuto').innerHTML = 'автосохр: ' + (auto ? 'вкл' : 'выкл');
    if ($('rbUsed')) $('rbUsed').innerHTML = sh ? C().cellCount() : 0;
    if ($('rbZoom')) $('rbZoom').innerHTML = C().zoom;
    if ($('stUsed')) $('stUsed').innerHTML = sh ? C().cellCount() : 0;
  }
  function onSel(sum, nums) {
    updateStatus(sum, nums);
    var s = C().sel, nb = $('nameBox'), fb = $('fbText'), si = $('selInfo'), cells, nm;
    if (nb && document.activeElement !== nb) nb.value = C().selRef();
    if (fb && document.activeElement !== fb && !C().isEditing()) fb.value = cellText(C().sel.r1, C().sel.c1);
    if (si) {
      cells = (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1);
      si.innerHTML = esc(C().selRef()) + ' &mdash; ' + cells + ' ' + plural(cells, 'ячейка', 'ячейки', 'ячеек');
    }
    nm = nameForSel(C().sel);
    var nmEl = $('nmName');
    if (nmEl && document.activeElement !== nmEl) nmEl.value = nm ? nm.name : '';
  }
  /* имя, которое точно совпадает с выделением */
  function nameForSel(s) {
    var list = C().namesList(), i;
    for (i = 0; i < list.length; i++) {
      if (list[i].r1 === s.r1 && list[i].c1 === s.c1 && list[i].r2 === s.r2 && list[i].c2 === s.c2) return list[i];
    }
    return null;
  }
  /* содержимое ячейки для строки формул: имена диапазонов разворачиваем в ссылки */
  function cellText(r, c) {
    var raw = C().rawAt(r, c);
    return String(raw).charAt(0) === '=' ? C().expandRefs(raw) : raw;
  }
  function tick() {
    var d = new Date(), el = $('stClock');
    if (el) el.innerHTML = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }
  function hits() {
    var el = $('hits'), n;
    if (!el) return;
    n = num(lsGet('monolit-tab-hits')) || 0;
    n = n + 1 + (hash(String(new Date().getDate())) % 7);
    lsSet('monolit-tab-hits', String(n));
    el.innerHTML = pad(n, 6);
  }

  /* ==================================================================
     МАСШТАБ И ОБЛАСТИ
     ================================================================== */
  function setZoom(z) {
    z = C().clampN(z, 50, 200);
    if (z === C().zoom) return;
    C().zoom = z;
    C().buildGrid();
    C().paintSel();
    if ($('rbZoom')) $('rbZoom').innerHTML = z;
    note('масштаб ' + z + '%');
  }
  function applyToggles() {
    var inner = $('gInner'), wrap = $('gridwrap'), ck, ch, cf;
    if (inner) inner.className = 'g-inner' + (C().showGrid ? '' : ' nogrid');
    if (wrap) wrap.className = 'gridwrap' + (C().showFill ? '' : ' nofill') + (C().showHead ? '' : ' nohead');
    ck = $('ckGrid'); if (ck) ck.checked = C().showGrid;
    ch = $('ckHead'); if (ch) ch.checked = C().showHead;
    cf = $('ckFill'); if (cf) cf.checked = C().showFill;
    var sc = $('gScroll');
    if (sc) syncScroll();
  }
  function syncScroll() {
    var sc = $('gScroll'), head = $('gHead'), rh = $('gRowHead');
    if (!sc) return;
    if (head) head.style.left = (-sc.scrollLeft) + 'px';
    if (rh) rh.style.top = (-sc.scrollTop) + 'px';
  }

  /* ==================================================================
     МЫШЬ
     ================================================================== */
  function closestOf(node, cls) {
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains(cls)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function gridMouseDown(e) {
    var t = e.target, cc, ch, rh, pt, c, r;
    if (t.classList && t.classList.contains('g-crz')) { startColResize(e, num(t.getAttribute('data-c'))); return; }
    if (t.classList && t.classList.contains('g-rrz')) { startRowResize(e, num(t.getAttribute('data-r'))); return; }
    if (t.classList && t.classList.contains('g-fillbox')) { startFillDrag(e); return; }
    ch = closestOf(t, 'g-ch');
    if (ch) {
      c = num(ch.getAttribute('data-c'));
      if (c == null) return;
      if (C().isEditing()) C().commitEdit(null);
      C().anchor = { r: 0, c: c };
      C().setSel(0, c, C().sheet.rows - 1, c);
      drag = 'col';
      dragData = { base: C().sel.r1 };
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragUp);
      beep(600, 0.02);
      return;
    }
    rh = closestOf(t, 'g-rh');
    if (rh) {
      r = num(rh.getAttribute('data-r'));
      if (r == null) return;
      if (C().isEditing()) C().commitEdit(null);
      C().anchor = { r: r, c: 0 };
      C().setSel(r, 0, r, C().sheet.cols - 1);
      drag = 'row';
      dragData = { base: C().sel.c1 };
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragUp);
      beep(600, 0.02);
      return;
    }
    cc = closestOf(t, 'g-c');
    if (!cc) return;
    r = num(cc.getAttribute('data-r'));
    c = num(cc.getAttribute('data-c'));
    if (r == null || c == null) return;
    if (C().isEditing()) C().commitEdit(null);
    if (e.shiftKey) C().selectCell(r, c, true);
    else C().selectCell(r, c, false);
    drag = 'cells';
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
    focusGrid();
  }
  function focusGrid() {
    var sc = $('gScroll');
    if (sc && document.activeElement !== sc && !C().isEditing()) {
      try { sc.focus({ preventScroll: true }); } catch (e) { sc.focus(); }
    }
  }
  function onDragMove(e) {
    var pt;
    if (!drag) return;
    if (drag === 'cw') { doColResize(e); return; }
    if (drag === 'rh') { doRowResize(e); return; }
    pt = C().cellFromPoint(e.clientX, e.clientY);
    if (!pt) return;
    if (drag === 'cells') C().setSel(C().anchor.r, C().anchor.c, pt.r, pt.c);
    else if (drag === 'col') C().setSel(0, C().anchor.c, pt.r, C().anchor.c);
    else if (drag === 'row') C().setSel(C().anchor.r, 0, C().anchor.r, pt.c);
    else if (drag === 'fill') {
      fillTo = C().normSel(C().sel.r1, C().sel.c1, pt.r, pt.c);
      fillTo = C().clampSel(fillTo);
      var box = $('gSelBox');
      if (box) {
        box.style.left = C().xoff[fillTo.c1] + 'px';
        box.style.top = C().yoff[fillTo.r1] + 'px';
        box.style.width = (C().xoff[fillTo.c2 + 1] - C().xoff[fillTo.c1]) + 'px';
        box.style.height = (C().yoff[fillTo.r2 + 1] - C().yoff[fillTo.r1]) + 'px';
        box.className = 'g-selbox on preview';
      }
    }
  }
  function onDragUp(e) {
    var from, to;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    if (!drag) return;
    if (drag === 'cw') { endColResize(); drag = null; dragData = null; return; }
    if (drag === 'rh') { endRowResize(); drag = null; dragData = null; return; }
    if (drag === 'fill') {
      from = C().normSel(C().sel.r1, C().sel.c1, C().sel.r2, C().sel.c2);
      to = fillTo;
      fillTo = null;
      drag = null;
      if (to && (to.r2 > from.r2 || to.c2 > from.c2 || to.r1 < from.r1 || to.c1 < from.c1)) {
        applyFill(from, to);
        beep(760, 0.03);
      } else C().paintSel();
      return;
    }
    drag = null;
  }
  function startFillDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (C().isEditing()) C().commitEdit(null);
    drag = 'fill';
    fillTo = null;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
  }

  /* ---------- изменение размеров ---------- */
  function startColResize(e, c) {
    var el;
    e.preventDefault();
    e.stopPropagation();
    if (c == null) return;
    drag = 'cw';
    dragData = {
      c: c, x0: e.clientX,
      w0: C().sheet.w[c] || C().DEF_CW, el: C().headEls[c]
    };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
    el = dragData.el;
    el.style.position = 'relative';
  }
  function doColResize(e) {
    var d = dragData, w, all;
    if (!d || d.c == null) return;
    w = d.w0 + (e.clientX - d.x0) / C().Z();
    w = Math.max(C().MIN_CW, Math.min(C().MAX_CW, Math.round(w)));
    C().sheet.w[d.c] = w;
    /* на лету двигаем только шапку — сетку перестроим в конце */
    if (d.el) {
      all = C().headEls;
      if (all[d.c]) all[d.c].style.width = C().cw(d.c) + 'px';
    }
  }
  function endColResize() {
    var d = dragData;
    if (d && d.c != null) {
      pushUndo(true);
      C().buildGrid();
      commit();
      note('ширина столбца ' + C().colName(d.c) + ': ' + Math.round(d.w0 + 0) + ' → ' + C().sheet.w[d.c]);
    }
  }
  function startRowResize(e, r) {
    e.preventDefault();
    e.stopPropagation();
    if (r == null) return;
    drag = 'rh';
    dragData = {
      r: r, y0: e.clientY,
      h0: C().sheet.h[r] || C().DEF_RH, el: C().rowHeadEls[r]
    };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
  }
  function doRowResize(e) {
    var d = dragData, h, i;
    if (!d || d.r == null) return;
    h = d.h0 + (e.clientY - d.y0) / C().Z();
    h = Math.max(14, Math.min(C().MAX_RH, Math.round(h)));
    C().sheet.h[d.r] = h;
    if (d.el) d.el.style.height = C().rh(d.r) + 'px';
    for (i = 0; i < C().rowEls.length; i++) {
      if (C().rowEls[i]) C().rowEls[i].style.height = C().rh(i) + 'px';
    }
  }
  function endRowResize() {
    var d = dragData;
    if (d && d.r != null) {
      pushUndo(true);
      C().buildGrid();
      commit();
      note('высота строки ' + (d.r + 1) + ': ' + C().sheet.h[d.r]);
    }
  }

  /* ---------- двойной клик и уголок ---------- */
  function gridDblClick(e) {
    var t = e.target, cc, ch, rh, c, r, best;
    if (t.classList && t.classList.contains('g-crz')) {
      c = num(t.getAttribute('data-c'));
      if (c != null) { autoWidthOne(c); }
      return;
    }
    if (t.classList && t.classList.contains('g-rrz')) {
      r = num(t.getAttribute('data-r'));
      if (r != null) autoHeightOne(r);
      return;
    }
    ch = closestOf(t, 'g-ch');
    if (ch) { c = num(ch.getAttribute('data-c')); if (c != null) autoWidthOne(c); return; }
    rh = closestOf(t, 'g-rh');
    if (rh) { r = num(rh.getAttribute('data-r')); if (r != null) autoHeightOne(r); return; }
    cc = closestOf(t, 'g-c');
    if (cc) {
      r = num(cc.getAttribute('data-r'));
      c = num(cc.getAttribute('data-c'));
      if (r == null || c == null) return;
      best = 48;
      var u = C().usedRange();
      var r2 = u.none ? r : u.r2;
      for (var i = (u.none ? r : u.r1); i <= r2; i++) {
        var cell = C().cellAt(i, c);
        if (!cell) continue;
        var w = measure(C().fmtPlain(C().cellVal(i, c)), cell.b);
        if (w > best) best = w;
      }
      pushUndo(true);
      C().sheet.w[c] = Math.max(C().MIN_CW, Math.min(C().MAX_CW, Math.round(best)));
      C().buildGrid();
      C().setSel(r, c, r, c);
      commit();
      note('столбец ' + C().colName(c) + ' подогнан');
    }
  }
  function autoWidthOne(c) {
    var u = C().usedRange(), best = 48, r, cell, w;
    pushUndo(true);
    for (r = (u.none ? 0 : u.r1); r <= (u.none ? C().sheet.rows - 1 : u.r2); r++) {
      cell = C().cellAt(r, c);
      if (!cell) continue;
      w = measure(C().fmtPlain(C().cellVal(r, c)), cell.b);
      if (w > best) best = w;
    }
    C().sheet.w[c] = Math.max(C().MIN_CW, Math.min(C().MAX_CW, Math.round(best)));
    C().buildGrid();
    commit();
  }
  function autoHeightOne(r) {
    var u = C().usedRange(), best = C().DEF_RH, c, cell;
    pushUndo(true);
    for (c = (u.none ? 0 : u.c1); c <= (u.none ? C().sheet.cols - 1 : u.c2); c++) {
      cell = C().cellAt(r, c);
      if (!cell) continue;
      if (measure(C().fmtPlain(C().cellVal(r, c)), cell.b) > C().cw(c) - 8) best = 44;
    }
    C().sheet.h[r] = best;
    C().buildGrid();
    commit();
  }
  function cornerClick() {
    if (C().isEditing()) C().commitEdit(null);
    C().anchor = { r: 0, c: 0 };
    C().setSel(0, 0, C().sheet.rows - 1, C().sheet.cols - 1, true);
    note('выделен весь лист');
  }

  /* ==================================================================
     КЛАВИАТУРА
     ================================================================== */
  function inField(e) {
    var t = e.target;
    if (!t) return false;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }
  function edgeOf(r, c, dr, dc) {
    var sh = C().sheet, u = C().usedRange();
    var r2 = u.none ? sh.rows - 1 : u.r2;
    var c2 = u.none ? sh.cols - 1 : u.c2;
    if (dr < 0) return { r: 0, c: c };
    if (dr > 0) return { r: r2, c: c };
    if (dc < 0) return { r: r, c: 0 };
    return { r: r, c: c2 };
  }
  function move(dr, dc, extend, jump) {
    var s = C().sel, r, c, e;
    r = s.r2; c = s.c2;
    if (jump) {
      if (dr < 0) r = 0;
      else if (dr > 0) { e = edgeOf(r, c, 1, 0); r = e.r; }
      if (dc < 0) c = 0;
      else if (dc > 0) { e = edgeOf(r, c, 0, 1); c = e.c; }
    } else {
      r += dr; c += dc;
    }
    r = Math.max(0, Math.min(C().sheet.rows - 1, r));
    c = Math.max(0, Math.min(C().sheet.cols - 1, c));
    if (extend) C().setSel(C().anchor.r, C().anchor.c, r, c);
    else C().selectCell(r, c, false);
  }
  function onKeyDown(e) {
    var s, k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (C().isEditing()) return;
    if (inField(e)) {
      /* поля ввода обрабатывают себя, но Ctrl+S/Ctrl+P нужны везде */
      if (ctrl && (k === 's' || k === 'S')) { e.preventDefault(); saveMono(); }
      if (ctrl && (k === 'p' || k === 'P')) { e.preventDefault(); doPrint(); }
      if (ctrl && (k === 'z' || k === 'Z') && e.target.id === 'fbText') { e.preventDefault(); undo(); }
      return;
    }
    s = C().sel;
    if (ctrl) {
      switch (k.toLowerCase()) {
        case 'z': e.preventDefault(); if (e.shiftKey) redo(); else undo(); return;
        case 'y': e.preventDefault(); redo(); return;
        case 'c': e.preventDefault(); copySel(false); return;
        case 'x': e.preventDefault(); copySel(true); return;
        case 'v': e.preventDefault(); pasteClip(); return;
        case 'a': e.preventDefault(); C().anchor = { r: 0, c: 0 }; C().setSel(0, 0, C().sheet.rows - 1, C().sheet.cols - 1, true); return;
        case 's': e.preventDefault(); saveMono(); return;
        case 'p': e.preventDefault(); doPrint(); return;
        case 'o': e.preventDefault(); openMono(); return;
        case 'f': e.preventDefault(); findOpen(); return;
        case 'h': e.preventDefault(); findOpen(); if ($('fRepl')) { try { $('fRepl').focus(); } catch (e2) { } } return;
        case 'm': e.preventDefault(); if (e.shiftKey) unmergeSel(); else mergeSel(); return;
        case 'b': e.preventDefault(); toggleFlag('b'); ribbonPaint(); return;
        case 'i': e.preventDefault(); toggleFlag('i'); ribbonPaint(); return;
        case 'u': e.preventDefault(); toggleFlag('u'); ribbonPaint(); return;
        case 'home': e.preventDefault(); C().anchor = { r: 0, c: 0 }; C().setSel(0, 0, 0, 0); return;
        case 'end': {
          e.preventDefault();
          var u = C().usedRange();
          var rr = u.none ? 0 : u.r2, cc = u.none ? 0 : u.c2;
          C().anchor = { r: rr, c: cc };
          C().setSel(rr, cc, rr, cc);
          return;
        }
      }
      if (k === 'ArrowDown') { e.preventDefault(); move(1, 0, e.shiftKey, true); return; }
      if (k === 'ArrowUp') { e.preventDefault(); move(-1, 0, e.shiftKey, true); return; }
      if (k === 'ArrowLeft') { e.preventDefault(); move(0, -1, e.shiftKey, true); return; }
      if (k === 'ArrowRight') { e.preventDefault(); move(0, 1, e.shiftKey, true); return; }
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); move(1, 0, e.shiftKey, false); return;
      case 'ArrowUp': e.preventDefault(); move(-1, 0, e.shiftKey, false); return;
      case 'ArrowLeft': e.preventDefault(); move(0, -1, e.shiftKey, false); return;
      case 'ArrowRight': e.preventDefault(); move(0, 1, e.shiftKey, false); return;
      case 'Tab': e.preventDefault(); move(0, e.shiftKey ? -1 : 1, false, false); return;
      case 'Enter': e.preventDefault(); C().startEdit(); return;
      case 'F2': e.preventDefault(); C().startEdit(); return;
      case 'Delete': case 'Backspace': e.preventDefault(); clearSelection(false); return;
      case 'Escape':
        e.preventDefault();
        C().selectCell(s.r1, s.c1, false);
        return;
      case 'Home': e.preventDefault(); C().anchor = { r: s.r1, c: 0 }; C().setSel(s.r1, 0, s.r1, 0); return;
      case 'End': {
        e.preventDefault();
        var uu = C().usedRange();
        var cc2 = uu.none ? 0 : uu.c2;
        C().anchor = { r: s.r1, c: cc2 };
        C().setSel(s.r1, cc2, s.r1, cc2);
        return;
      }
      case 'PageDown': e.preventDefault(); move(20, 0, e.shiftKey, false); return;
      case 'PageUp': e.preventDefault(); move(-20, 0, e.shiftKey, false); return;
    }
    /* печать с буквы начинаем править ячейку */
    if (k && k.length === 1 && !ctrl && !e.altKey) {
      e.preventDefault();
      C().startEdit(k);
    }
  }

  /* ---------- редактор ячейки ---------- */
  function editorKeyDown(e) {
    var ed = $('cEdit');
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); C().commitEdit(e.shiftKey ? 'up' : 'down'); focusGrid(); }
    else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); C().commitEdit(e.shiftKey ? 'left' : 'right'); focusGrid(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); C().cancelEdit(); focusGrid(); }
    else e.stopPropagation();
  }

  /* ---------- строка формул ---------- */
  function commitBars(thenEdit) {
    var fb = $('fbText'), text, r, c, was;
    if (!fb) return false;
    if (C().isEditing()) {
      var ed = $('cEdit');
      if (ed) ed.value = fb.value;
      return true;
    }
    text = fb.value;
    r = C().sel.r1; c = C().sel.c1;
    if (String(text).charAt(0) === '=') text = C().expandRefs(text);
    if (text === C().rawAt(r, c)) return false;
    pushUndo(true);
    was = true;
    C().setRaw(r, c, text);
    commit();
    if (fb) fb.value = C().rawAt(r, c);
    if (thenEdit) C().startEdit();
    return was;
  }
  function barsKeyDown(e) {
    var fb = $('fbText'), nb = $('nameBox'), nm = $('nmName');
    if (e.target === nm) {
      if (e.key === 'Enter') { e.preventDefault(); nameGo(); focusGrid(); }
      else if (e.key === 'Escape') {
        e.preventDefault();
        var found = nameForSel(C().sel);
        nm.value = found ? found.name : '';
        focusGrid();
      }
      return;
    }
    if (e.target === nb) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!gotoRef(nb.value)) note('не понял: ' + nb.value);
        else nb.value = C().selRef();
        focusGrid();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        nb.value = C().selRef();
        focusGrid();
      }
      return;
    }
    if (e.target === fb) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitBars(false);
        C().selectCell(Math.min(C().sheet.rows - 1, C().sel.r1 + 1), C().sel.c1);
        focusGrid();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        fb.value = cellText(C().sel.r1, C().sel.c1);
        focusGrid();
      }
    }
  }
  function gotoRef(text) {
    var s = String(text || '').trim();
    var parts, a, b, byName;
    if (!s) return false;
    byName = C().resolveRef(s);
    if (byName) s = byName;
    else s = s.toUpperCase().replace(/\$/g, '');
    parts = s.split(':');
    a = C().parseRef(parts[0]);
    if (!a) return false;
    if (parts.length > 1) {
      b = C().parseRef(parts[1]);
      if (!b) return false;
      C().anchor = { r: a.r, c: a.c };
      C().setSel(a.r, a.c, b.r, b.c);
    } else {
      C().anchor = { r: a.r, c: a.c };
      C().setSel(a.r, a.c, a.r, a.c);
    }
    return true;
  }

  /* ---------- вставка из системного буфера ---------- */
  function onPaste(e) {
    if (C().isEditing() || inField(e)) return;
    var text = '';
    try { text = (e.clipboardData || window.clipboardData).getData('text'); } catch (err) { text = ''; }
    if (!text) return;
    e.preventDefault();
    pasteText(text);
  }

  /* ---------- имя файла ---------- */
  function nameChanged() {
    var s = C().sheet;
    if (!s) return;
    s.title = $('fName').value;
    markDirty();
  }

  /* ---------- вкладки ленты ---------- */
  function tab(name) {
    var tabs = document.querySelectorAll('.rtab'), panes = document.querySelectorAll('.rpane'), k;
    for (k = 0; k < tabs.length; k++) {
      if (tabs[k].getAttribute('data-tab') === name) tabs[k].className = 'rtab on';
      else tabs[k].className = 'rtab';
    }
    for (k = 0; k < panes.length; k++) {
      if (panes[k].getAttribute('data-pane') === name) panes[k].className = 'rpane on';
      else panes[k].className = 'rpane';
    }
    syncScroll();
  }
  function onClick(id, fn) {
    var el = $(id);
    if (el) el.onclick = fn;
  }

  /* ==================================================================
     ЛЕНТА — состояние кнопок
     ================================================================== */
  function setOn(id, v) {
    var el = $(id);
    if (!el) return;
    el.className = (el.className.replace(/\bon\b/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '')) + (v ? ' on' : '');
  }
  function ribbonPaint() {
    var f = flagsOfActive(), al = alignOfActive(), fmt = fmtOfActive(), el;
    setOn('bBold', !!f.b);
    setOn('bIt', !!f.i);
    setOn('bUn', !!f.u);
    setOn('btnAlAuto', al === '');
    setOn('btnAlLeft', al === 'left');
    setOn('btnAlCenter', al === 'center');
    setOn('btnAlRight', al === 'right');
    el = $('fFmt'); if (el && el.value !== fmt) el.value = fmt;
    el = $('fColor');
    if (el) {
      var cell = C().cellAt(C().sel.r1, C().sel.c1);
      var want = (cell && cell.c) || '#000000';
      if (el.value.toLowerCase() !== want) el.value = want;
    }
    el = $('fFill');
    if (el) {
      var cell2 = C().cellAt(C().sel.r1, C().sel.c1);
      var want2 = (cell2 && cell2.bg) || '#ffffff';
      if (el.value.toLowerCase() !== want2) el.value = want2;
    }
  }

  /* ==================================================================
     ЗАПУСК
     ================================================================== */
  function init() {
    var core = C();
    if (!core) { note('ядро не загрузилось'); return; }
    buildStatus();
    loadAutoFlag();
    core.sheet = core.blankSheet();
    var restored = loadStored();
    core.onSel = onSel;
    core.beforeChange = pushUndo;
    core.afterChange = commit;
    core.buildGrid();
    applyToggles();
    core.anchor = { r: 0, c: 0 };
    core.setSel(0, 0, 0, 0, true);
    if ($('fName')) $('fName').value = core.sheet.title;
    hits();
    if (restored) note('восстановили твою таблицу из автосохранения');

    /* вкладки ленты */
    var tabs = document.querySelectorAll('.rtab'), k;
    for (k = 0; k < tabs.length; k++) {
      tabs[k].onclick = (function (t) {
        return function () { tab(t.getAttribute('data-tab')); beep(540, 0.02); };
      })(tabs[k]);
    }

    /* панель быстрого доступа */
    onClick('qbNew', function () { clearAll(); });
    onClick('qbOpen', function () { openMono(); });
    onClick('qbSave', function () { saveMono(); });
    onClick('qbCsv', function () { saveCsv(); });
    onClick('qbPrint', function () { doPrint(); });
    onClick('qbUndo', function () { undo(); });
    onClick('qbRedo', function () { redo(); });
    onClick('qbSum', function () { insertFx('СУММ', 'сумма'); });

    /* сетка */
    var sc = $('gScroll');
    if (sc) {
      sc.addEventListener('mousedown', gridMouseDown);
      sc.addEventListener('dblclick', gridDblClick);
      sc.addEventListener('scroll', syncScroll, { passive: true });
    }
    var corner = $('gCorner');
    if (corner) corner.onclick = cornerClick;
    var ed = $('cEdit');
    if (ed) ed.addEventListener('keydown', editorKeyDown);

    /* поля */
    var fbar = document.querySelector('.fbar');
    if (fbar) fbar.addEventListener('keydown', barsKeyDown);
    var nb = $('nameBox');
    if (nb) {
      nb.addEventListener('focus', function () { nb.value = C().selRef(); });
      nb.addEventListener('blur', function () { nb.value = C().selRef(); });
    }
    var fn = $('fName');
    if (fn) {
      fn.addEventListener('change', nameChanged);
      fn.addEventListener('keydown', function (e) { if (e.key === 'Enter') fn.blur(); });
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('paste', onPaste);
    window.addEventListener('beforeunload', function () { if (dirty) saveNow(true); });
    window.addEventListener('resize', function () { rAF(function () { syncScroll(); }); });

    /* лента */
    ribbonWire();
    ribbonPaint();
    paintNames();

    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(tick, 1000);
    tick();
    updateStatus(0, 0);
    paintDirty();
    if ($('autoState')) $('autoState').innerHTML = auto ? 'вкл' : 'выкл';
    if ($('sndState')) $('sndState').innerHTML = sound ? 'вкл' : 'выкл';
    focusGrid();
  }

  /* ---------- кнопки ленты ---------- */
  function ribbonWire() {
    var i, list, el;

    onClick('btnNew', function () { clearAll(); });
    onClick('btnTplSmeta', function () { loadTemplate('smeta'); });
    onClick('btnTplSale', function () { loadTemplate('sale'); });
    onClick('btnAll', function () {
      if (confirm('Стереть всю таблицу? Отменить можно через Ctrl+Z.')) clearAll();
    });
    onClick('btnAuto', function () {
      auto = !auto;
      saveAutoFlag();
      if (auto) { saveNow(true); note('автосохранение включено'); }
      else note('автосохранение выключено');
      if ($('autoState')) $('autoState').innerHTML = auto ? 'вкл' : 'выкл';
      updateStatus(0, 0);
    });
    onClick('btnSound', function () {
      sound = !sound;
      if ($('sndState')) $('sndState').innerHTML = sound ? 'вкл' : 'выкл';
      if ($('sndOn')) $('sndOn').checked = sound;
      if (sound) beep(700, 0.03);
      note('звук: ' + (sound ? 'вкл' : 'выкл'));
    });
    var sndOn = $('sndOn');
    if (sndOn) {
      sndOn.onclick = function () { sound = !!this.checked; if (sound) beep(700, 0.03); };
    }

    /* шрифт */
    onClick('bBold', function () { toggleFlag('b'); ribbonPaint(); });
    onClick('bIt', function () { toggleFlag('i'); ribbonPaint(); });
    onClick('bUn', function () { toggleFlag('u'); ribbonPaint(); });
    onClick('bNone', function () { clearStyle(); ribbonPaint(); note('оформление снято'); });
    var fc = $('fColor');
    if (fc) fc.oninput = function () { setColor(this.value); };
    if (fc) fc.onchange = function () { setColor(this.value); ribbonPaint(); };

    /* выравнивание */
    onClick('btnAlAuto', function () { setAlign(''); ribbonPaint(); });
    onClick('btnAlLeft', function () { setAlign('left'); ribbonPaint(); });
    onClick('btnAlCenter', function () { setAlign('center'); ribbonPaint(); });
    onClick('btnAlRight', function () { setAlign('right'); ribbonPaint(); });

    /* число и заливка */
    var ff = $('fFmt');
    if (ff) ff.onchange = function () { setFmt(this.value); note('формат: ' + this.options[this.selectedIndex].text); };
    var ff2 = $('fFill');
    if (ff2) ff2.oninput = function () { setFillColor(this.value); };
    if (ff2) ff2.onchange = function () { setFillColor(this.value); };
    onClick('btnNoFill', function () { noFill(); if ($('fFill')) $('fFill').value = '#ffffff'; });

    /* ячейки */
    onClick('btnClearCell', function () { clearSelection(false); });
    onClick('btnInsRow', function () { insertRows(C().sel.r1, 1); });
    onClick('btnDelRow', function () { deleteRows(C().sel.r1, C().sel.r2); });
    onClick('btnInsCol', function () { insertCols(C().sel.c1, 1); });
    onClick('btnDelCol', function () { deleteCols(C().sel.c1, C().sel.c2); });
    onClick('btnCopy', function () { copySel(false); });
    onClick('btnCut', function () { copySel(true); });
    onClick('btnPaste', function () { pasteClip(); });

    /* сортировка */
    onClick('btnSortAsc', function () { sortRange(true); });
    onClick('btnSortDesc', function () { sortRange(false); });

    /* объединение */
    onClick('btnMerge', function () { mergeSel(); });
    onClick('btnUnmerge', function () { unmergeSel(); });
    onClick('btnMergeAll', function () { mergeAllRows(); });
    onClick('btnMergeNone', function () { unmergeAll(); });

    /* вставка */
    onClick('btnInsFx', function () { insertCustom(''); });
    onClick('btnInsFxGo', function () { insertCustom($('fxText') ? $('fxText').value : ''); });
    onClick('btnInsDate', function () { insertDate(); });
    onClick('btnInsOne', function () { insertOnes(); });
    onClick('btnInsSeries', function () { insertSeries(); });
    onClick('btnOpenCsv', function () { openCsv(); });
    onClick('btnOpenCsv2', function () { openCsv(); });

    /* формулы */
    onClick('fxSum', function () { insertFx('СУММ', 'сумма'); });
    onClick('fxAvg', function () { insertFx('СРЗНАЧ', 'среднее'); });
    onClick('fxMin', function () { insertFx('МИН', 'минимум'); });
    onClick('fxMax', function () { insertFx('МАКС', 'максимум'); });
    onClick('fxCount', function () { insertFx('СЧЁТ', 'счёт'); });
    list = document.querySelectorAll('[data-fx]');
    for (i = 0; i < list.length; i++) {
      list[i].onclick = (function (b) {
        return function () { insertCustom(b.getAttribute('data-fx')); };
      })(list[i]);
    }
    onClick('btnFx', function () { insertCustom('=СУММ()'); });

    /* условное форматирование */
    onClick('btnCfApply', function () { cfApply(); });
    onClick('btnCfOff', function () { cfOff(); });
    var cfOp = $('cfOp');
    if (cfOp) {
      cfOp.onchange = function () {
        var words = { gt: 'больше', lt: 'меньше', eq: 'равно' };
        note('условие: значение ' + words[this.value] + ' указанного числа');
      };
    }

    /* имена диапазонов */
    onClick('nmSave', function () { nameSave(); });
    onClick('nmGo', function () { nameGo(); });
    onClick('nmDel', function () { nameDel(); });

    /* вид */
    onClick('zOut', function () { setZoom(C().zoom - 10); });
    onClick('zIn', function () { setZoom(C().zoom + 10); });
    onClick('z100', function () { setZoom(100); });
    onClick('btnRowAuto', function () { autoHeight(); });
    onClick('btnColAuto', function () { autoWidth(); });
    onClick('btnFind', function () { findCmd(null, false); });
    onClick('btnFindNext', function () { findCmd(null, true); });
    onClick('btnReplOne', function () { replaceOne(); });
    onClick('btnReplAll', function () { replaceAll(); });
    var fFindEl = $('fFind');
    if (fFindEl) {
      fFindEl.onkeydown = function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        findCmd(null, false);
        var nx = $('fFind');
        if (nx && nx.select) nx.select();
      };
    }
    var fReplEl = $('fRepl');
    if (fReplEl) {
      fReplEl.onkeydown = function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        replaceOne();
      };
    }
    var ck = $('ckGrid');
    if (ck) ck.onchange = function () { C().showGrid = !!this.checked; applyToggles(); };
    var ch2 = $('ckHead');
    if (ch2) ch2.onchange = function () { C().showHead = !!this.checked; applyToggles(); C().paintSel(); };
    var cf = $('ckFill');
    if (cf) cf.onchange = function () { C().showFill = !!this.checked; applyToggles(); C().paintSel(); };

    /* прочее */
    onClick('qbOpen2', function () { openMono(); });
    onClick('btnSaveMono', function () { saveMono(); });
    onClick('btnSaveCsv', function () { saveCsv(); });
    onClick('btnPrint', function () { doPrint(); });
    onClick('btnOkFx', function () { commitBars(true); focusGrid(); });
    onClick('btnCancelFx', function () {
      var fb = $('fbText');
      if (C().isEditing()) C().cancelEdit();
      if (fb) fb.value = cellText(C().sel.r1, C().sel.c1);
      focusGrid();
    });
  }

  /* ==================================================================
     ПУБЛИЧНЫЙ API
     ================================================================== */
  window.MonolitTable = {
    get: function () { return { sel: C().sel, dirty: dirty, auto: auto }; },
    sheet: function () { return C().sheet; },
    sel: function () { return C().sel; },
    cell: function (r, c) { return C().cellAt(r, c); },
    raw: function (r, c) { return C().rawAt(r, c); },
    setRaw: function (r, c, v) { pushUndo(true); C().setRaw(r, c, v); commit(); },
    select: function (r, c, r2, c2) {
      if (r2 == null) C().selectCell(r, c);
      else { C().anchor = { r: r, c: c }; C().setSel(r, c, r2, c2); }
    },
    goto: gotoRef,
    startEdit: function (v) { C().startEdit(v); },
    commitEdit: function (m) { return C().commitEdit(m); },
    isEditing: function () { return C().isEditing(); },
    clear: function () { clearSelection(false); },
    clearAllStyle: function () { clearStyle(); },
    toggleFlag: toggleFlag,
    setAlign: setAlign,
    setColor: setColor,
    setFill: setFillColor,
    noFill: noFill,
    setFmt: setFmt,
    copy: function () { copySel(false); },
    cut: function () { copySel(true); },
    paste: pasteClip,
    undo: undo,
    redo: redo,
    insertRows: insertRows,
    insertCols: insertCols,
    deleteRows: deleteRows,
    deleteCols: deleteCols,
    insertFx: insertFx,
    insertCustom: insertCustom,
    insertSeries: insertSeries,
    insertOnes: insertOnes,
    insertDate: insertDate,
    autoSum: function () { insertFx('СУММ', 'сумма'); },
    avg: function () { insertFx('СРЗНАЧ', 'среднее'); },
    min: function () { insertFx('МИН', 'минимум'); },
    max: function () { insertFx('МАКС', 'максимум'); },
    count: function () { insertFx('СЧЁТ', 'счёт'); },
    find: findCmd,
    findReplace: replaceAll,
    replace: replaceOne,
    sort: sortRange,
    sortAsc: function () { sortRange(true); },
    sortDesc: function () { sortRange(false); },
    merge: mergeSel,
    unmerge: unmergeSel,
    mergeAllRows: mergeAllRows,
    unmergeAll: unmergeAll,
    merges: function () { return C().merges(); },
    names: function () { return C().namesList(); },
    name: function (nm) { return C().findName(nm); },
    nameAdd: function (nm) { if ($('nmName')) $('nmName').value = nm; nameSave(); },
    nameGo: nameGo,
    nameDel: nameDel,
    condFormat: cfApply,
    condFormatOff: cfOff,
    autoWidth: autoWidth,
    autoHeight: autoHeight,
    zoom: setZoom,
    zoomGet: function () { return C().zoom; },
    zoomReset: function () { setZoom(100); },
    saveMono: saveMono,
    saveCsv: saveCsv,
    openMono: openMono,
    openCsv: openCsv,
    print: doPrint,
    newSheet: clearAll,
    template: loadTemplate,
    toggleAuto: function () { if ($('btnAuto')) $('btnAuto').click(); },
    paint: ribbonPaint,
    status: updateStatus,
    note: note,
    beep: beep,
    selectAll: function () { C().anchor = { r: 0, c: 0 }; C().setSel(0, 0, C().sheet.rows - 1, C().sheet.cols - 1, true); },
    usedRange: function () { return C().usedRange(); },
    evaluate: function (r, c) { return C().cellVal(r, c); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})();