/* ==================================================================
   ТАБЛИЦЫ МОНОЛИТ 2000 — ядро: модель, формулы, геометрия, отрисовка.
   Отдаёт всё наружу через window.MonolitCore (см. js/main.js).
   ================================================================== */
(function () {
  'use strict';

  var MAXROWS = 500;
  var DEFCOLS = 26;
  var DEF_CW = 92;
  var DEF_RH = 22;
  var MIN_CW = 34;
  var MAX_CW = 340;
  var MAX_RH = 96;
  var HEADH = 20;
  var ROWHW = 46;

  var E_DIV = '#ДЕЛ0!';
  var E_NAME = '#ИМЯ?';
  var E_REF = '#ССЫЛКА!';
  var E_VAL = '#ЗНАЧ!';
  var E_NUM = '#ЧИСЛО!';
  var E_CIRC = '#ЦИРЛ!';

  /* ---------- состояние ---------- */
  var sheet = null;
  var sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
  var anchor = { r: 0, c: 0 };
  var edit = null;
  var zoomPct = 100;
  var xoff = [], yoff = [], totalW = 0, totalH = 0;
  var cellEls = {}, selEls = [], headEls = [], rowEls = [], rowHeadEls = [];
  var vcache = {}, vdeps = null, vstack = null, curKey = null;
  var showFill = true, showHead = true, showGrid = true;

  function $(id) { return document.getElementById(id); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function num(v) { var n = parseInt(v, 10); return (isNaN(n) || !isFinite(n)) ? null : n; }
  function on(v) { return v === true || v === 1 || v === '1' || v === 'on' || v === 'да'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clampN(v, a, b) { v = num(v); if (v == null) v = a; if (v < a) v = a; if (v > b) v = b; return v; }

  /* ==================================================================
     АДРЕСА
     ================================================================== */
  function colName(i) {
    var s = '';
    i = i | 0;
    do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
  }
  function colIdx(s) {
    var n = 0, i, code;
    s = String(s).toUpperCase();
    for (i = 0; i < s.length; i++) {
      code = s.charCodeAt(i);
      if (code < 65 || code > 90) return -1;
      n = n * 26 + (code - 64);
    }
    return n - 1;
  }
  function key(r, c) { return colName(c) + (r + 1); }
  function addr(r, c) { return colName(c) + (r + 1); }
  var RE_REF = /^\$?([A-Za-z]{1,3})\$?([0-9]{1,7})$/;
  function parseRef(s) {
    var m = RE_REF.exec(String(s == null ? '' : s).trim());
    if (!m) return null;
    var c = colIdx(m[1]);
    var r = parseInt(m[2], 10) - 1;
    if (r < 0 || c < 0 || c >= DEFCOLS || r >= MAXROWS) return null;
    var t = String(s).trim();
    return { r: r, c: c, ac: t.charAt(0) === '$', ar: t.indexOf('$', 1) >= 0 };
  }
  function refText(p) {
    return (p.ac ? '$' : '') + colName(p.c) + (p.ar ? '$' : '') + (p.r + 1);
  }

  /* ==================================================================
     МОДЕЛЬ
     ================================================================== */
  var FMT_OK = { gen: 1, int: 1, num: 1, cur: 1, pct: 1 };
  var AL_OK = { '': 1, left: 1, center: 1, right: 1 };
  var HEX_OK = /^#[0-9a-fA-F]{6}$/;

  function blankCell() { return { v: '', b: 0, i: 0, u: 0, al: '', c: '', bg: '', f: 'gen', cf: '' }; }
  function normCell(o) {
    o = (o && typeof o === 'object') ? o : {};
    return {
      v: String(o.v == null ? '' : o.v).replace(/[\u0000-\u001f]/g, ' ').slice(0, 4000),
      b: on(o.b) ? 1 : 0,
      i: on(o.i) ? 1 : 0,
      u: on(o.u) ? 1 : 0,
      al: AL_OK[String(o.al == null ? '' : o.al)] ? String(o.al) : '',
      c: (typeof o.c === 'string' && HEX_OK.test(o.c)) ? o.c.toLowerCase() : '',
      bg: (typeof o.bg === 'string' && HEX_OK.test(o.bg)) ? o.bg.toLowerCase() : '',
      f: FMT_OK[o.f] ? o.f : 'gen',
      cf: normRuleRef(o.cf)
    };
  }
  function emptySheet() {
    var s = { v: 1, title: 'Моя таблица', rows: 100, cols: DEFCOLS, cells: {}, w: {}, h: {}, merges: [], names: [] };
    s.w[0] = 300; s.w[1] = 110; s.w[2] = 110; s.w[3] = 80; s.w[4] = 100; s.w[5] = 110;
    return s;
  }
  function blankSheet() {
    var s = emptySheet();
    s.title = 'Моя таблица';
    s.cells['A1'] = { v: 'Таблицы Монолит', b: 1, i: 0, u: 0, al: '', c: '#006400', bg: '', f: 'gen' };
    s.cells['A2'] = { v: 'Жми на ячейку и печатай. Формула начинается со знака =', b: 0, i: 1, u: 0, al: '', c: '#444444', bg: '', f: 'gen' };
    s.cells['A4'] = { v: 'Цена', b: 1, i: 0, u: 0, al: 'center', c: '#004d00', bg: '#dff0e2', f: 'gen' };
    s.cells['B4'] = { v: 'Кол-во', b: 1, i: 0, u: 0, al: 'center', c: '#004d00', bg: '#dff0e2', f: 'gen' };
    s.cells['C4'] = { v: 'Сумма', b: 1, i: 0, u: 0, al: 'center', c: '#004d00', bg: '#dff0e2', f: 'gen' };
    s.cells['A5'] = { v: 'Реактив', b: 0, i: 0, u: 0, al: '', c: '', bg: '', f: 'gen' };
    s.cells['B5'] = { v: '2', b: 0, i: 0, u: 0, al: '', c: '', bg: '', f: 'int' };
    s.cells['C5'] = { v: '=B5*120', b: 0, i: 0, u: 0, al: '', c: '', bg: '', f: 'cur' };
    s.cells['A6'] = { v: 'Прибор', b: 0, i: 0, u: 0, al: '', c: '', bg: '', f: 'gen' };
    s.cells['B6'] = { v: '1', b: 0, i: 0, u: 0, al: '', c: '', bg: '', f: 'int' };
    s.cells['C6'] = { v: '=B6*840', b: 0, i: 0, u: 0, al: '', c: '', bg: '', f: 'cur' };
    s.cells['A8'] = { v: 'Итого', b: 1, i: 0, u: 0, al: '', c: '#004d00', bg: '#eef7f0', f: 'gen' };
    s.cells['C8'] = { v: '=СУММ(C5:C6)', b: 1, i: 0, u: 0, al: '', c: '#004d00', bg: '#eef7f0', f: 'cur' };
    return s;
  }
  function normSheet(o) {
    o = (o && typeof o === 'object') ? o : {};
    var out = {
      v: 1,
      title: String(o.title == null ? 'Моя таблица' : o.title).slice(0, 70) || 'Моя таблица',
      rows: clampN(o.rows == null ? 100 : o.rows, 1, MAXROWS),
      cols: clampN(o.cols == null ? DEFCOLS : o.cols, 1, DEFCOLS),
      cells: {}, w: {}, h: {}, merges: [], names: []
    };
    var src = (o.cells && typeof o.cells === 'object') ? o.cells : {};
    var k, p, c;
    for (k in src) {
      if (!has(src, k)) continue;
      p = parseRef(k);
      if (!p || p.r >= out.rows || p.c >= out.cols) continue;
      c = normCell(src[k]);
      if (!c.v && !c.b && !c.i && !c.u && !c.al && !c.c && !c.bg && !c.cf && c.f === 'gen') continue;
      out.cells[key(p.r, p.c)] = c;
    }
    var ws = (o.w && typeof o.w === 'object') ? o.w : {}, hs = (o.h && typeof o.h === 'object') ? o.h : {};
    for (k in ws) if (has(ws, k)) out.w[k] = clampN(ws[k], MIN_CW, MAX_CW);
    for (k in hs) if (has(hs, k)) out.h[k] = clampN(hs[k], 14, MAX_RH);
    out.merges = normMerges(o.merges, out.rows, out.cols);
    out.names = normNames(o.names, out.rows, out.cols);
    return out;
  }
  function cellAt(r, c) { var k = key(r, c); return has(sheet.cells, k) ? sheet.cells[k] : null; }
  function rawAt(r, c) { var cell = cellAt(r, c); return cell ? String(cell.v) : ''; }
  function setRaw(r, c, text) {
    if (r < 0 || c < 0 || r >= sheet.rows || c >= sheet.cols) return;
    var k = key(r, c), cell = cellAt(r, c);
    text = String(text == null ? '' : text).slice(0, 4000);
    if (text === '' && !cell) return;
    if (!cell) { cell = blankCell(); sheet.cells[k] = cell; }
    if (cell.v === text) return;
    cell.v = text;
    resetCalc();
    if (text === '') delete sheet.cells[k];
  }
  function usedRange() {
    var r1 = -1, c1 = -1, r2 = -1, c2 = -1, k, p;
    for (k in sheet.cells) {
      if (!has(sheet.cells, k)) continue;
      p = parseRef(k);
      if (!p) continue;
      if (r1 < 0 || p.r < r1) r1 = p.r;
      if (c1 < 0 || p.c < c1) c1 = p.c;
      if (p.r > r2) r2 = p.r;
      if (p.c > c2) c2 = p.c;
    }
    return { r1: r1, c1: c1, r2: r2, c2: c2, none: r1 < 0 };
  }
  function cellCount() {
    var n = 0, k;
    for (k in sheet.cells) if (has(sheet.cells, k)) n++;
    return n;
  }
  function put(r, c, v, st) {
    var cell = normCell(st || {});
    cell.v = v;
    sheet.cells[key(r, c)] = cell;
    resetCalc();
  }

  /* ==================================================================
     ОБЪЕДИНЕНИЯ, ИМЕНА ДИАПАЗОНОВ, УСЛОВНОЕ ФОРМАТИРОВАНИЕ
     ================================================================== */
  var CF_OP = { gt: 1, lt: 1, eq: 1 };
  var RE_CF = /^([0-9]+(?:\.[0-9]+)?):((?:#[0-9a-fA-F]{6})|(?:#[0-9a-fA-F]{6})(?:#[0-9a-fA-F]{6})?)$/;

  function refLoose(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t) return null;
    return parseRef(t.replace(/\$/g, ''));
  }
  /* подчищает любые данные о слиянии: неверные и пересекающиеся молча выбрасываем */
  function normMerges(list, rows, cols) {
    var out = [], i, m, p1, p2;
    if (Object.prototype.toString.call(list) !== '[object Array]') return out;
    for (i = 0; i < list.length && out.length < 4000; i++) {
      m = list[i];
      if (!m || typeof m !== 'object') continue;
      p1 = refLoose(m.r1 != null ? m.r1 : m.a);
      p2 = refLoose(m.r2 != null ? m.r2 : m.b);
      if (!p1 || !p2) continue;
      if (p1.r > p2.r) { var tr = p1.r; p1.r = p2.r; p2.r = tr; }
      if (p1.c > p2.c) { var tc = p1.c; p1.c = p2.c; p2.c = tc; }
      if (p1.r >= rows || p1.c >= cols) continue;
      if (p2.r >= rows) p2.r = rows - 1;
      if (p2.c >= cols) p2.c = cols - 1;
      if (p1.r === p2.r && p1.c === p2.c) continue;
      if (mergeHit(out, p1, p2, p1.r, p1.c, p2.r, p2.c)) continue;
      out.push({ r1: p1.r, c1: p1.c, r2: p2.r, c2: p2.c });
    }
    return out;
  }
  function mergeHit(list, add, ar1, ac1, ar2, ac2) {
    var i, m;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (ar1 <= m.r2 && ar2 >= m.r1 && ac1 <= m.c2 && ac2 >= m.c1) return true;
    }
    return false;
  }
  function normRuleRef(o) {
    var m, y, txt2, a1, a2, len;
    if (typeof o === 'string') {
      o = o.replace(/\s+/g, '').toUpperCase();
      if (o.charAt(0) !== '!') o = '!' + o;
      txt2 = o.slice(1);
      if (txt2.charAt(0) === '=') txt2 = txt2.slice(1);
      if (!CF_OP[o.charAt(1)]) return '';
      len = txt2.length;
      a1 = 0;
      while (a1 < len && /[0-9.,+\- ]/.test(txt2.charAt(a1))) a1++;
      a2 = a1;
      while (a2 < len && /[0-9]/.test(txt2.charAt(a2))) a2++;
      if (a2 <= a1) return '';
      return o.slice(0, 2) + txt2.slice(0, a2);
    }
    if (!o || typeof o !== 'object') return '';
    if (!CF_OP[o.op]) return '';
    m = RE_CF.exec(String(o.val == null ? '' : o.val).replace(/\s+/g, ''));
    if (!m) return '';
    y = String(o.y || '').replace(/\s+/g, '');
    if (!y) return '';
    return o.op + ':' + m[1] + ':' + m[2] + y;
  }
  function normNames(list, rows, cols) {
    var out = [], i, n, p1, p2, nm, low, j, dup;
    if (Object.prototype.toString.call(list) !== '[object Array]') return out;
    for (i = 0; i < list.length && out.length < 500; i++) {
      n = list[i];
      if (!n || typeof n !== 'object') continue;
      nm = String(n.name == null ? '' : n.name).trim();
      if (!RE_NAME.test(nm)) continue;
      if (n.r1 == null && n.r != null) { n = { name: nm, r1: n.r, c1: n.c, r2: n.r, c2: n.c }; }
      p1 = refLoose(n.r1);
      if (!p1) continue;
      p2 = (n.r2 == null) ? { r: p1.r, c: p1.c } : refLoose(n.r2);
      if (!p2) continue;
      if (p1.r > p2.r) { var tr = p1.r; p1.r = p2.r; p2.r = tr; }
      if (p1.c > p2.c) { var tc = p1.c; p1.c = p2.c; p2.c = tc; }
      if (p1.r >= rows || p1.c >= cols) continue;
      if (p2.r >= rows) p2.r = rows - 1;
      if (p2.c >= cols) p2.c = cols - 1;
      dup = false;
      low = nm.toLowerCase();
      for (j = 0; j < out.length; j++) {
        if (out[j].name.toLowerCase() === low) { dup = true; break; }
      }
      if (dup) continue;
      out.push({ name: nm, r1: p1.r, c1: p1.c, r2: p2.r, c2: p2.c });
    }
    return out;
  }
  var RE_NAME = /^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]{0,39}$/;

  /* ---------- объединения ---------- */
  function merges() { return (sheet && sheet.merges) ? sheet.merges : []; }
  function mergeAt(r, c) {
    var list = merges(), i, m;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m;
    }
    return null;
  }
  /* что видит пользователь и куда пишем: левый верхний угол слияния */
  function ownPos(r, c) {
    var m = mergeAt(r, c);
    return m ? { r: m.r1, c: m.c1 } : { r: r, c: c };
  }
  function putRawOwn(r, c, text) { var o = ownPos(r, c); setRaw(o.r, o.c, text); }
  function addMerge(r1, c1, r2, c2) {
    var list = merges(), i, m;
    r1 = Math.max(0, Math.min(r1, r2)); r2 = Math.min(sheet.rows - 1, Math.max(r1, r2));
    c1 = Math.max(0, Math.min(c1, c2)); c2 = Math.min(sheet.cols - 1, Math.max(c1, c2));
    if (r1 >= sheet.rows || c1 >= sheet.cols) return false;
    if (r1 === r2 && c1 === c2) return false;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (r1 === m.r1 && c1 === m.c1 && r2 === m.r2 && c2 === m.c2) return false;
      if (r1 <= m.r2 && r2 >= m.r1 && c1 <= m.c2 && c2 >= m.c1) return false;
    }
    list.push({ r1: r1, c1: c1, r2: r2, c2: c2 });
    return true;
  }
  /* можно ли слить этот прямоугольник: не одна ячейка и ни одно слияние не задето */
  function canMerge(r1, c1, r2, c2) {
    var list = merges(), i, m;
    r1 = Math.max(0, Math.min(r1, r2)); r2 = Math.min(sheet.rows - 1, Math.max(r1, r2));
    c1 = Math.max(0, Math.min(c1, c2)); c2 = Math.min(sheet.cols - 1, Math.max(c1, c2));
    if (r1 >= sheet.rows || c1 >= sheet.cols) return false;
    if (r1 === r2 && c1 === c2) return false;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (r1 <= m.r2 && r2 >= m.r1 && c1 <= m.c2 && c2 >= m.c1) return false;
    }
    return true;
  }
  /* слитые соседи уходят вглубь, значение с одного из них поднимаем наверх */
  function liftMergeValues(r1, c1, r2, c2) {
    var r, c, k, moved = '', t;
    if (!has(sheet.cells, key(r1, c1))) {
      for (r = r1; r <= r2 && !moved; r++) {
        for (c = c1; c <= c2; c++) {
          if (r === r1 && c === c1) continue;
          k = key(r, c);
          if (has(sheet.cells, k)) { t = String(sheet.cells[k].v); if (t) moved = t; break; }
        }
      }
      if (moved) setRaw(r1, c1, moved);
    }
    if (!moved) moved = String(rawAt(r1, c1));
    for (r = r1; r <= r2; r++) {
      for (c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        k = key(r, c);
        if (!has(sheet.cells, k)) continue;
        if (String(sheet.cells[k].v) !== moved) setRaw(r, c, '');
      }
    }
    return moved ? 1 : 0;
  }
  function unmergeRange(r1, c1, r2, c2) {
    var list = merges(), i, m, out = [], hit = 0, r, c, k, ck, take, src, moved;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (m.r1 > r2 || m.r2 < r1 || m.c1 > c2 || m.c2 < c1) { out.push(m); continue; }
      hit++;
      moved = liftMergeValues(m.r1, m.c1, m.r2, m.c2);
      if (!moved) continue;
      /* значение переехало в угол — переносим и оформление */
      take = has(sheet.cells, key(m.r1, m.c1)) ? sheet.cells[key(m.r1, m.c1)] : null;
      if (!take) continue;
      for (r = m.r1; r <= m.r2; r++) {
        for (c = m.c1; c <= m.c2; c++) {
          if (r === m.r1 && c === m.c1) continue;
          ck = key(r, c);
          if (!has(sheet.cells, ck)) continue;
          src = sheet.cells[ck];
          if (String(src.v) !== String(take.v)) continue;
          src.b = take.b; src.i = take.i; src.u = take.u;
          src.al = take.al; src.c = take.c; src.bg = take.bg; src.f = take.f; src.cf = take.cf;
        }
      }
    }
    sheet.merges = out;
    return hit;
  }
  function refSelText(s) {
    if (s.r1 === s.r2 && s.c1 === s.c2) return addr(s.r1, s.c1);
    return addr(s.r1, s.c1) + ':' + addr(s.r2, s.c2);
  }

  /* ---------- имена диапазонов ---------- */
  function namesList() { return (sheet && sheet.names) ? sheet.names : []; }
  function findName(nm) {
    var list = namesList(), t = String(nm == null ? '' : nm).trim(), i;
    for (i = 0; i < list.length; i++) if (list[i].name === t) return list[i];
    for (i = 0; i < list.length; i++) {
      if (list[i].name.toLowerCase() === t.toLowerCase()) return list[i];
    }
    return null;
  }
  function setName(nm, s) {
    var list = namesList(), t = String(nm == null ? '' : nm).trim(), i;
    if (!RE_NAME.test(t)) return { ok: false, why: 'имя может быть буквами, цифрами и _ — начни с буквы' };
    if (String(rawAt(s.r1, s.c1)).charAt(0) === '=') {
      return { ok: false, why: 'ячейка с формулой именем не станет' };
    }
    for (i = 0; i < list.length; i++) {
      if (list[i].name === t) { list[i] = { name: t, r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 }; return { ok: true, name: t }; }
    }
    list.push({ name: t, r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 });
    return { ok: true, name: t };
  }
  function delName(nm) {
    var list = namesList(), t = String(nm == null ? '' : nm).trim(), i, out = [], hit = 0;
    for (i = 0; i < list.length; i++) {
      if (list[i].name === t || list[i].name.toLowerCase() === t.toLowerCase()) { hit++; continue; }
      out.push(list[i]);
    }
    sheet.names = out;
    return hit;
  }
  /* имя разрешаем и в формулах, и в строке имён */
  function resolveRef(text) {
    var t = String(text == null ? '' : text).trim(), n, i, parts, out = '';
    if (!t) return null;
    if (t.charAt(0) === '$' || t.charAt(0) === '!' || refLoose(t)) return null;
    parts = t.split(':');
    n = findName(parts[0]);
    if (!n) return null;
    out = addr(n.r1, n.c1);
    if (n.r1 !== n.r2 || n.c1 !== n.c2) out += ':' + addr(n.r2, n.c2);
    for (i = 1; i < parts.length; i++) {
      n = findName(parts[i]);
      if (!n) return null;
      out += ':' + addr(n.r1, n.c1);
      if (n.r1 !== n.r2 || n.c1 !== n.c2) out += ':' + addr(n.r2, n.c2);
    }
    return out;
  }
  /* ссылки на ячейки и имена в тексте формулы */
  function expandRefs(src) {
    var tk = tokenize(String(src == null ? '' : src));
    var out = '', i, t, nm;
    if (!Array.isArray(tk)) return String(src);
    for (i = 0; i < tk.length; i++) {
      t = tk[i];
      if (t.t === 'id' && RE_NAME.test(t.v)) {
        nm = findName(t.v);
        if (nm) {
          out += addr(nm.r1, nm.c1);
          if (nm.r1 !== nm.r2 || nm.c1 !== nm.c2) out += ':' + addr(nm.r2, nm.c2);
          continue;
        }
      }
      out += t.x;
    }
    return out;
  }

  /* ---------- условное форматирование ---------- */
  function cfTest(v, rule) {
    var p, a, b;
    if (!rule) return false;
    p = rule.split(':');
    if (p.length < 3) return false;
    a = Number(String(p[1]).replace(',', '.'));
    b = nval(v);
    if (!isFinite(a) || b == null) return false;
    if (p[0] === 'gt') return b > a;
    if (p[0] === 'lt') return b < a;
    return b === a;
  }
  function cfStyle(v, rule) {
    var p, fc, bc;
    if (!cfTest(v, rule)) return null;
    p = rule.split(':');
    fc = HEX_OK.test(p[2]) ? p[2].toLowerCase() : '';
    bc = p.length > 3 && HEX_OK.test(p[3]) ? p[3].toLowerCase() : '';
    return { c: fc, bg: bc };
  }

  /* ==================================================================
     ЗНАЧЕНИЯ
     ================================================================== */
  function VN(v) { return { t: 'n', v: v }; }
  function VS(v) { return { t: 's', v: String(v) }; }
  function VE(v) { return { t: 'e', v: v }; }
  function nval(v) { return (v && v.t === 'n' && isFinite(v.v)) ? v.v : null; }
  function sval(v) { return (v && v.t === 's') ? v.v : (v && v.t === 'n' ? numToStr(v.v) : ''); }

  function numToStr(n) {
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e11 || a < 1e-9) return n.toExponential(6).replace(/\.?0+e/, 'e');
    var s = String(Math.round(n * 1e10) / 1e10);
    return s;
  }
  function ru(n, dec) {
    dec = dec == null ? 2 : dec;
    if (!isFinite(n)) return numToStr(n);
    var neg = n < 0;
    n = Math.abs(n);
    var parts = n.toFixed(dec).split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return (neg ? '-' : '') + intPart + (parts[1] ? ',' + parts[1] : '');
  }
  function fmtVal(v, f) {
    if (v && v.t === 'e') return v.v;
    if (!v || v.t === 's') return v ? v.v : '';
    var n = v.v;
    switch (f) {
      case 'int': return ru(n, 0);
      case 'num': return ru(n, 2);
      case 'cur': return ru(n, 2) + ' \u20bd';
      case 'pct': return ru(n * 100, 2) + ' %';
      default: return numToStr(n);
    }
  }
  function fmtPlain(v) {
    if (v && v.t === 'e') return v.v;
    if (!v || v.t === 's') return v ? v.v : '';
    return numToStr(v.v);
  }

  /* ==================================================================
     ФОРМУЛЫ
     ================================================================== */
  function resetCalc() { vcache = {}; vdeps = {}; vstack = null; curKey = null; }

  function literal(raw) {
    var t = String(raw).trim();
    if (t === '') return VS('');
    if (t.charAt(0) === "'") return VS(t.slice(1));
    var norm = t.replace(',', '.');
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(norm)) {
      var n = Number(norm);
      if (isFinite(n)) return VN(n);
    }
    if (/^[-+]?(#DIV\/0!|#NAME\?|#REF!|#VALUE!|#NUM!|#CIRC!|#Н\/Д)$/i.test(t)) return VE(t.toUpperCase());
    return VS(t);
  }

  function tokenize(src) {
    var toks = [], i = 0, n = src.length, c, two, m, j, s, code;
    while (i < n) {
      c = src.charAt(i);
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if (c === '"') {
        j = i + 1; s = '';
        while (j < n) {
          if (src.charAt(j) === '"') {
            if (src.charAt(j + 1) === '"') { s += '"'; j += 2; continue; }
            break;
          }
          s += src.charAt(j); j++;
        }
        if (j >= n) return { err: E_VAL };
        toks.push({ t: 'str', v: s, x: src.slice(i, j + 1) }); i = j + 1; continue;
      }
      code = c.charCodeAt(0);
      if ((code >= 48 && code <= 57) || (c === '.' && src.charCodeAt(i + 1) >= 48 && src.charCodeAt(i + 1) <= 57)) {
        m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
        if (!m) return { err: E_VAL };
        toks.push({ t: 'num', v: parseFloat(m[0]), x: m[0] }); i += m[0].length; continue;
      }
      if (c === '#') {
        m = /^(#DIV\/0!|#NAME\?|#REF!|#VALUE!|#NUM!|#CIRC!|#Н\/Д)/i.exec(src.slice(i));
        if (!m) return { err: E_VAL };
        toks.push({ t: 'err', v: m[1].toUpperCase(), x: m[1] }); i += m[1].length; continue;
      }
      m = /^\$?[A-Za-zА-Яа-яЁё]{1,3}\$?[0-9]{1,7}(?![A-Za-zА-Яа-яЁё0-9_])/.exec(src.slice(i));
      if (m) { toks.push({ t: 'ref', v: m[0], x: m[0] }); i += m[0].length; continue; }
      m = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9_.]*/.exec(src.slice(i));
      if (m) { toks.push({ t: 'id', v: m[0], x: m[0] }); i += m[0].length; continue; }
      two = src.substr(i, 2);
      if (two === '<=' || two === '>=' || two === '<>') { toks.push({ t: 'op', v: two, x: two }); i += 2; continue; }
      if ('+-*/^&%(),;:='.indexOf(c) >= 0 || c === '<' || c === '>') { toks.push({ t: 'op', v: c, x: c }); i++; continue; }
      return { err: E_VAL };
    }
    return toks;
  }

  function Parser(toks) { this.toks = toks; this.i = 0; }
  Parser.prototype.peek = function () { return this.i < this.toks.length ? this.toks[this.i] : null; };
  Parser.prototype.isOp = function (v) { var t = this.peek(); return !!t && t.t === 'op' && t.v === v; };
  Parser.prototype.take = function () { return this.i < this.toks.length ? this.toks[this.i++] : null; };
  Parser.prototype.eat = function (v) { if (this.isOp(v)) { this.i++; return true; } return false; };
  Parser.prototype.parse = function () {
    var v = this.pCmp();
    if (this.i < this.toks.length) return VE(E_VAL);
    return v;
  };
  Parser.prototype.pCmp = function () {
    var l = this.pCat(), op, r;
    while (this.peek() && this.peek().t === 'op' && '<>='.indexOf(this.peek().v) >= 0) {
      op = this.take().v;
      r = this.pCat();
      l = cmpVals(l, r, op);
    }
    return l;
  };
  Parser.prototype.pCat = function () {
    var l = this.pAdd(), r;
    while (this.eat('&')) { r = this.pAdd(); l = VS(sval(l) + sval(r)); }
    return l;
  };
  Parser.prototype.pAdd = function () {
    var l = this.pMul(), r, a, b, op, t;
    while (this.peek() && this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) {
      op = this.take().v;
      r = this.pMul();
      a = nval(l); b = nval(r);
      if (a == null && sval(l) === '') a = 0;
      if (b == null && sval(r) === '') b = 0;
      if (a == null || b == null) {
        t = l && l.t === 'e' ? l : (r && r.t === 'e' ? r : null);
        if (t) { l = t; continue; }
        if (op === '+' && l && r && (l.t === 's' || r.t === 's')) { l = VS(sval(l) + sval(r)); continue; }
        l = VE(E_VAL);
        continue;
      }
      l = VN(op === '+' ? a + b : a - b);
    }
    return l;
  };
  Parser.prototype.pMul = function () {
    var l = this.pPow(), r, a, b, op, t;
    while (this.peek() && this.peek().t === 'op' && (this.peek().v === '*' || this.peek().v === '/')) {
      op = this.take().v;
      r = this.pPow();
      a = nval(l); b = nval(r);
      if (a == null || b == null) {
        t = l && l.t === 'e' ? l : (r && r.t === 'e' ? r : null);
        l = t || VE(E_VAL);
        continue;
      }
      if (op === '*') l = VN(a * b);
      else if (b === 0) l = VE(E_DIV);
      else l = VN(a / b);
    }
    return l;
  };
  Parser.prototype.pPow = function () {
    var base = this.pUnary(), e;
    if (this.eat('^')) { e = this.pPow(); return powVals(base, e); }
    return base;
  };
  Parser.prototype.pUnary = function () {
    var v, n;
    if (this.eat('-')) {
      v = this.pUnary();
      n = nval(v);
      if (n != null) return VN(-n);
      return (v && v.t === 'e') ? v : VE(E_VAL);
    }
    if (this.eat('+')) return this.pUnary();
    return this.pPost();
  };
  Parser.prototype.pPost = function () {
    var v = this.pPost2(), n;
    while (this.eat('%')) {
      n = nval(v);
      v = n == null ? VE(E_VAL) : VN(n / 100);
    }
    return v;
  };
  Parser.prototype.pPost2 = function () { return this.pPrim(); };
  Parser.prototype.pPrim = function () {
    var t = this.peek(), a, b, p1, p2, name, fn, args;
    if (!t) return VE(E_VAL);
    if (t.t === 'num') { this.take(); return VN(t.v); }
    if (t.t === 'str') { this.take(); return VS(t.v); }
    if (t.t === 'err') { this.take(); return VE(t.v); }
    if (t.t === 'op' && t.v === '(') {
      this.take();
      a = this.pCmp();
      if (!this.eat(')')) return VE(E_VAL);
      return a;
    }
    if (t.t === 'ref') {
      this.take();
      p1 = parseRef(t.v);
      if (!p1) return VE(E_REF);
      if (this.isOp(':')) {
        this.take();
        b = this.take();
        if (!b || b.t !== 'ref') return VE(E_REF);
        p2 = parseRef(b.v);
        if (!p2) return VE(E_REF);
        return rangeVal(p1, p2);
      }
      return refVal(p1);
    }
    if (t.t === 'id') {
      this.take();
      name = fnName(t.v);
      if (!this.eat('(')) return VE(E_NAME);
      args = [];
      if (!this.isOp(')')) {
        args.push(this.pCmp());
        while (this.eat(',') || this.eat(';')) args.push(this.pCmp());
      }
      if (!this.eat(')')) return VE(E_VAL);
      fn = FUNCS[name];
      if (!fn) return VE(E_NAME);
      if (fn.min != null && args.length < fn.min) return VE(E_VAL);
      if (fn.max != null && args.length > fn.max) return VE(E_VAL);
      return fn.run(args);
    }
    return VE(E_VAL);
  };

  function powVals(a, b) {
    var x = nval(a), y = nval(b);
    if (x == null || y == null) return VE(E_VAL);
    var r = Math.pow(x, y);
    return isFinite(r) ? VN(r) : VE(E_NUM);
  }
  function cmpVals(a, b, op) {
    var x, y, na, nb;
    if (a && a.t === 'e') return a;
    if (b && b.t === 'e') return b;
    na = nval(a); nb = nval(b);
    if (na != null && nb != null) { x = na; y = nb; }
    else if (a && a.t === 's' && b && b.t === 's') { x = a.v.toLowerCase(); y = b.v.toLowerCase(); }
    else if (na != null) { x = na; y = (b && b.t === 's') ? (b.v === '' ? 0 : 1) : 0; }
    else if (nb != null) { x = (a && a.t === 's') ? (a.v === '' ? 0 : 1) : 0; y = nb; }
    else { x = sval(a); y = sval(b); }
    switch (op) {
      case '=': return VN(x === y ? 1 : 0);
      case '<>': return VN(x !== y ? 1 : 0);
      case '<': return VN(x < y ? 1 : 0);
      case '>': return VN(x > y ? 1 : 0);
      case '<=': return VN(x <= y ? 1 : 0);
      case '>=': return VN(x >= y ? 1 : 0);
    }
    return VE(E_VAL);
  }

  function refVal(p) {
    var k = key(p.r, p.c), arr;
    if (vdeps && curKey) {
      arr = has(vdeps, curKey) ? vdeps[curKey] : (vdeps[curKey] = []);
      if (arr.indexOf(k) < 0) arr.push(k);
    }
    if (p.r >= sheet.rows || p.c >= sheet.cols) return VE(E_REF);
    return cellVal(p.r, p.c);
  }
  function rangeVal(p1, p2) {
    var r1 = Math.min(p1.r, p2.r), r2 = Math.max(p1.r, p2.r);
    var c1 = Math.min(p1.c, p2.c), c2 = Math.max(p1.c, p2.c);
    if (c1 >= sheet.cols || r1 >= sheet.rows) return VE(E_REF);
    if (r2 >= sheet.rows) r2 = sheet.rows - 1;
    if (c2 >= sheet.cols) c2 = sheet.cols - 1;
    var arr = [], i, j, k, dd;
    for (i = r1; i <= r2; i++) {
      for (j = c1; j <= c2; j++) {
        k = key(i, j);
        if (vdeps && curKey) {
          dd = has(vdeps, curKey) ? vdeps[curKey] : (vdeps[curKey] = []);
          if (dd.indexOf(k) < 0) dd.push(k);
        }
        arr.push(cellVal(i, j));
      }
    }
    return { t: 'r', v: arr };
  }
  function cellVal(r, c) {
    var k = key(r, c), raw, out, prevKey;
    if (has(vcache, k)) return vcache[k];
    if (vstack && vstack.indexOf(k) >= 0) return VE(E_CIRC);
    if (r >= sheet.rows || c >= sheet.cols) return VE(E_REF);
    raw = rawAt(r, c);
    if (!vstack) vstack = [];
    vstack.push(k);
    prevKey = curKey;
    curKey = k;
    if (raw.charAt(0) === '=') out = evalFx(raw.slice(1));
    else out = literal(raw);
    curKey = prevKey;
    vstack.pop();
    vcache[k] = out;
    return out;
  }
  function evalFx(src) {
    var tk = tokenize(String(src));
    if (!Array.isArray(tk)) return VE(tk.err);
    if (!tk.length) return VE(E_VAL);
    return new Parser(tk).parse();
  }
  function flatNums(args) {
    var out = [], i, j, v;
    for (i = 0; i < args.length; i++) {
      v = args[i];
      if (!v) continue;
      if (v.t === 'r') { for (j = 0; j < v.v.length; j++) if (v.v[j] && v.v[j].t === 'n') out.push(v.v[j].v); }
      else if (v.t === 'n') out.push(v.v);
      else if (v.t === 'e') return null;
    }
    return out;
  }
  function flatAll(args) {
    var out = [], i, j, v;
    for (i = 0; i < args.length; i++) {
      v = args[i];
      if (!v) continue;
      if (v.t === 'r') { for (j = 0; j < v.v.length; j++) if (v.v[j]) out.push(v.v[j]); }
      else out.push(v);
    }
    return out;
  }
  function firstErr(args) {
    var i;
    for (i = 0; i < args.length; i++) if (args[i] && args[i].t === 'e') return args[i];
    return null;
  }

  var F_ALIAS = {
    'СУММ': 'SUM', 'SUM': 'SUM',
    'СРЗНАЧ': 'AVERAGE', 'СРЕДНЕЕ': 'AVERAGE', 'AVERAGE': 'AVERAGE',
    'МИН': 'MIN', 'MIN': 'MIN', 'МАКС': 'MAX', 'MAX': 'MAX',
    'СЧЁТ': 'COUNT', 'СЧЕТ': 'COUNT', 'COUNT': 'COUNT',
    'СЧЁТЗ': 'COUNTA', 'СЧЕТЗ': 'COUNTA', 'COUNTA': 'COUNTA',
    'ПРОИЗВЕД': 'PRODUCT', 'PRODUCT': 'PRODUCT',
    'ОКРУГЛ': 'ROUND', 'ROUND': 'ROUND',
    'ОКРУГЛВНИЗ': 'ROUNDDOWN', 'ROUNDDOWN': 'ROUNDDOWN',
    'ОКРУГЛВВЕРХ': 'ROUNDUP', 'ROUNDUP': 'ROUNDUP',
    'ЦЕЛ': 'INT', 'INT': 'INT',
    'ОСТАТОК': 'MOD', 'МОД': 'MOD', 'MOD': 'MOD',
    'КОРЕНЬ': 'SQRT', 'SQRT': 'SQRT',
    'СТЕПЕНЬ': 'POWER', 'POWER': 'POWER',
    'ЗНАК': 'SIGN', 'SIGN': 'SIGN',
    'ПИ': 'PI', 'PI': 'PI',
    'ЕСЛИ': 'IF', 'IF': 'IF',
    'И': 'AND', 'AND': 'AND', 'ИЛИ': 'OR', 'OR': 'OR', 'НЕ': 'NOT', 'NOT': 'NOT',
    'ДЛИНА': 'LEN', 'LEN': 'LEN',
    'ЛЕВСИМВ': 'LEFT', 'LEFT': 'LEFT', 'ПРАВСИМВ': 'RIGHT', 'RIGHT': 'RIGHT',
    'СРЕДСИМв': 'MID', 'СРЕДСИМВ': 'MID', 'MID': 'MID',
    'ВЕРХНИЙ': 'UPPER', 'UPPER': 'UPPER', 'НИЖНИЙ': 'LOWER', 'LOWER': 'LOWER',
    'СЖАТЫЙ': 'TRIM', 'TRIM': 'TRIM',
    'СЦЕПИТЬ': 'CONCAT', 'CONCATENATE': 'CONCAT', 'CONCAT': 'CONCAT',
    'СЕГОДНЯ': 'TODAY', 'TODAY': 'TODAY',
    'ТЕОДАТА': 'NOW', 'СЕЙЧАС': 'NOW', 'NOW': 'NOW',
    'СЛУЧЧИСЛО': 'RAND', 'RAND': 'RAND'
  };
  function fnName(s) {
    var u = String(s).toUpperCase();
    return has(F_ALIAS, u) ? F_ALIAS[u] : null;
  }
  function txt(v) { return sval(v); }

  var FUNCS = {
    SUM: {
      min: 1, run: function (a) {
        var e = firstErr(a); if (e) return e;
        var ns = flatNums(a); if (!ns) return VE(E_VAL);
        var s = 0, i; for (i = 0; i < ns.length; i++) s += ns[i];
        return VN(s);
      }
    },
    PRODUCT: {
      min: 1, run: function (a) {
        var e = firstErr(a); if (e) return e;
        var ns = flatNums(a); if (!ns) return VE(E_VAL);
        if (!ns.length) return VN(0);
        var s = 1, i; for (i = 0; i < ns.length; i++) s *= ns[i];
        return VN(s);
      }
    },
    AVERAGE: {
      min: 1, run: function (a) {
        var e = firstErr(a); if (e) return e;
        var ns = flatNums(a); if (!ns || !ns.length) return VE(E_DIV);
        var s = 0, i; for (i = 0; i < ns.length; i++) s += ns[i];
        return VN(s / ns.length);
      }
    },
    MIN: {
      min: 1, run: function (a) {
        var e = firstErr(a); if (e) return e;
        var ns = flatNums(a); if (!ns) return VE(E_VAL);
        if (!ns.length) return VN(0);
        var m = ns[0], i; for (i = 1; i < ns.length; i++) if (ns[i] < m) m = ns[i];
        return VN(m);
      }
    },
    MAX: {
      min: 1, run: function (a) {
        var e = firstErr(a); if (e) return e;
        var ns = flatNums(a); if (!ns) return VE(E_VAL);
        if (!ns.length) return VN(0);
        var m = ns[0], i; for (i = 1; i < ns.length; i++) if (ns[i] > m) m = ns[i];
        return VN(m);
      }
    },
    COUNT: {
      min: 1, run: function (a) {
        var e = firstErr(a); if (e) return e;
        var ns = flatNums(a);
        return VN(ns ? ns.length : 0);
      }
    },
    COUNTA: {
      min: 1, run: function (a) {
        var all = flatAll(a), n = 0, i;
        for (i = 0; i < all.length; i++) if (all[i] && (all[i].t === 'n' || (all[i].t === 's' && all[i].v !== ''))) n++;
        return VN(n);
      }
    },
    ROUND: {
      min: 1, max: 2, run: function (a) {
        var x = nval(a[0]), d = a.length > 1 ? nval(a[1]) : 0;
        if (x == null || d == null) return VE(E_VAL);
        var f = Math.pow(10, Math.round(d));
        return VN(Math.round(x * f) / f);
      }
    },
    ROUNDDOWN: {
      min: 1, max: 2, run: function (a) {
        var x = nval(a[0]), d = a.length > 1 ? nval(a[1]) : 0;
        if (x == null || d == null) return VE(E_VAL);
        var f = Math.pow(10, Math.round(d));
        return VN(Math.floor(x * f) / f);
      }
    },
    ROUNDUP: {
      min: 1, max: 2, run: function (a) {
        var x = nval(a[0]), d = a.length > 1 ? nval(a[1]) : 0;
        if (x == null || d == null) return VE(E_VAL);
        var f = Math.pow(10, Math.round(d));
        return VN(Math.ceil(x * f) / f);
      }
    },
    INT: { min: 1, run: function (a) { var x = nval(a[0]); return x == null ? VE(E_VAL) : VN(Math.floor(x)); } },
    MOD: {
      min: 2, max: 2, run: function (a) {
        var x = nval(a[0]), y = nval(a[1]);
        if (x == null || y == null) return VE(E_VAL);
        if (y === 0) return VE(E_DIV);
        return VN(x - y * Math.floor(x / y));
      }
    },
    SQRT: {
      min: 1, run: function (a) {
        var x = nval(a[0]);
        if (x == null) return VE(E_VAL);
        return x < 0 ? VE(E_NUM) : VN(Math.sqrt(x));
      }
    },
    POWER: { min: 2, max: 2, run: function (a) { return powVals(a[0], a[1]); } },
    SIGN: {
      min: 1, run: function (a) {
        var x = nval(a[0]);
        if (x == null) return VE(E_VAL);
        return VN(x > 0 ? 1 : (x < 0 ? -1 : 0));
      }
    },
    PI: { min: 0, max: 0, run: function () { return VN(Math.PI); } },
    IF: {
      min: 2, max: 3, run: function (a) {
        var c = nval(a[0]);
        if (c == null) return VE(E_VAL);
        if (c !== 0) return a[1] || VS('');
        return a.length > 2 ? (a[2] || VS('')) : VN(0);
      }
    },
    AND: {
      min: 1, run: function (a) {
        var all = flatAll(a), i, saw = 0, v;
        for (i = 0; i < all.length; i++) {
          if (all[i].t === 'e') return all[i];
          v = nval(all[i]);
          if (v != null) { saw = 1; if (v === 0) return VN(0); }
          else if (all[i].t === 's' && all[i].v !== '') saw = 1;
        }
        return VN(saw ? 1 : 0);
      }
    },
    OR: {
      min: 1, run: function (a) {
        var all = flatAll(a), i, v;
        for (i = 0; i < all.length; i++) {
          if (all[i].t === 'e') return all[i];
          v = nval(all[i]);
          if (v != null && v !== 0) return VN(1);
          if (all[i].t === 's' && all[i].v !== '') return VN(1);
        }
        return VN(0);
      }
    },
    NOT: { min: 1, run: function (a) { var v = nval(a[0]); return v == null ? VE(E_VAL) : VN(v === 0 ? 1 : 0); } },
    LEN: { min: 1, run: function (a) { return VN(txt(a[0]).length); } },
    LEFT: {
      min: 1, max: 2, run: function (a) {
        var s = txt(a[0]), n = a.length > 1 ? nval(a[1]) : 1;
        if (a.length > 1 && n == null) return VE(E_VAL);
        n = Math.max(0, Math.round(n == null ? 1 : n));
        return VS(s.slice(0, n));
      }
    },
    RIGHT: {
      min: 1, max: 2, run: function (a) {
        var s = txt(a[0]), n = a.length > 1 ? nval(a[1]) : 1;
        if (a.length > 1 && n == null) return VE(E_VAL);
        n = Math.max(0, Math.round(n == null ? 1 : n));
        return VS(n === 0 ? '' : s.slice(-n));
      }
    },
    MID: {
      min: 3, max: 3, run: function (a) {
        var s = txt(a[0]), start = nval(a[1]), len = nval(a[2]);
        if (start == null || len == null) return VE(E_VAL);
        if (start < 1 || len < 0) return VE(E_VAL);
        return VS(s.substr(Math.round(start) - 1, Math.round(len)));
      }
    },
    UPPER: { min: 1, run: function (a) { return VS(txt(a[0]).toUpperCase()); } },
    LOWER: { min: 1, run: function (a) { return VS(txt(a[0]).toLowerCase()); } },
    TRIM: { min: 1, run: function (a) { return VS(txt(a[0]).replace(/\s+/g, ' ').replace(/^ | $/g, '')); } },
    CONCAT: {
      min: 1, run: function (a) {
        var all = flatAll(a), i, s = '';
        for (i = 0; i < all.length; i++) {
          if (all[i].t === 'e') return all[i];
          s += txt(all[i]);
        }
        return VS(s);
      }
    },
    TODAY: {
      min: 0, max: 0, run: function () {
        var d = new Date();
        return VS(pad(d.getDate(), 2) + '.' + pad(d.getMonth() + 1, 2) + '.' + d.getFullYear());
      }
    },
    NOW: {
      min: 0, max: 0, run: function () {
        var d = new Date();
        return VS(pad(d.getDate(), 2) + '.' + pad(d.getMonth() + 1, 2) + '.' + d.getFullYear() +
          ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2));
      }
    },
    RAND: { min: 0, max: 0, run: function () { return VN(Math.random()); } }
  };

  function shiftFormula(raw, dr, dc) {
    var src = String(raw), lead = '', tk, out = [], i, t, p, nr, nc;
    if (src.charAt(0) === '=') { lead = '='; src = src.slice(1); }
    tk = tokenize(src);
    if (!Array.isArray(tk)) return raw;
    for (i = 0; i < tk.length; i++) {
      t = tk[i];
      if (t.t === 'ref') {
        p = parseRef(t.v);
        if (!p) { out.push(t.x); continue; }
        nr = p.r + (p.ar ? 0 : dr);
        nc = p.c + (p.ac ? 0 : dc);
        if (nr < 0 || nc < 0 || nc >= DEFCOLS || nr >= MAXROWS) { out.push(E_REF); continue; }
        out.push(refText({ r: nr, c: nc, ac: p.ac, ar: p.ar }));
      } else out.push(t.x);
    }
    return lead + out.join('');
  }

  /* при переносе строк ссылки, ушедшие из сортируемой области, едут вместе с ячейкой;
     ссылки внутри области остаются как есть — они уже переехали */
  function shiftOutside(raw, dr, dc, box) {
    var src = String(raw), lead = '', tk, out = [], i, t, p, nr, nc, inside;
    if (src.charAt(0) === '=') { lead = '='; src = src.slice(1); }
    tk = tokenize(src);
    if (!Array.isArray(tk)) return raw;
    for (i = 0; i < tk.length; i++) {
      t = tk[i];
      if (t.t === 'ref' && box) {
        p = parseRef(t.v);
        if (!p) { out.push(t.x); continue; }
        inside = (p.r >= box.r1 && p.r <= box.r2 && p.c >= box.c1 && p.c <= box.c2);
        if (inside) { out.push(t.x); continue; }
        nr = p.r + (p.ar ? 0 : dr);
        nc = p.c + (p.ac ? 0 : dc);
        if (nr < 0 || nc < 0 || nc >= DEFCOLS || nr >= MAXROWS) { out.push(E_REF); continue; }
        out.push(refText({ r: nr, c: nc, ac: p.ac, ar: p.ar }));
        continue;
      }
      out.push(t.x);
    }
    return lead + out.join('');
  }

  /* ==================================================================
     ГЕОМЕТРИЯ
     ================================================================== */
  function Z() { return zoomPct / 100; }
  function cw(c) { return Math.max(MIN_CW, Math.round((sheet.w[c] || DEF_CW) * Z())); }
  function rh(r) { return Math.max(14, Math.round((sheet.h[r] || DEF_RH) * Z())); }
  function headH() { return Math.max(16, Math.round(HEADH * Z())); }
  function rowHeadW() { return Math.max(30, Math.round(ROWHW * Z())); }
  function layout() {
    var c, r, x = 0, y = 0;
    xoff = [];
    for (c = 0; c < sheet.cols; c++) { xoff[c] = x; x += cw(c); }
    xoff[sheet.cols] = x; totalW = x;
    yoff = [];
    for (r = 0; r < sheet.rows; r++) { yoff[r] = y; y += rh(r); }
    yoff[sheet.rows] = y; totalH = y;
  }
  function colAt(x) {
    var lo = 0, hi = sheet.cols - 1, mid;
    if (x < 0) return 0;
    if (x >= totalW) return sheet.cols - 1;
    while (lo < hi) {
      mid = (lo + hi + 1) >> 1;
      if (xoff[mid] <= x) lo = mid; else hi = mid - 1;
    }
    return lo;
  }
  function rowAt(y) {
    var lo = 0, hi = sheet.rows - 1, mid;
    if (y < 0) return 0;
    if (y >= totalH) return sheet.rows - 1;
    while (lo < hi) {
      mid = (lo + hi + 1) >> 1;
      if (yoff[mid] <= y) lo = mid; else hi = mid - 1;
    }
    return lo;
  }
  function cellFromPoint(cx, cy) {
    var sc = $('gScroll');
    if (!sc) return null;
    var r = sc.getBoundingClientRect();
    var x = cx - r.left + sc.scrollLeft;
    var y = cy - r.top + sc.scrollTop;
    if (x < 0 || y < 0) return null;
    return { r: rowAt(y), c: colAt(x) };
  }

  /* ==================================================================
     ПОСТРОЕНИЕ И ОТРИСОВКА
     ================================================================== */
  function buildGrid() {
    var head = $('gHead'), rowHead = $('gRowHead'), inner = $('gInner'), wrap = $('gridwrap');
    var c, r, d, cell, rowDiv, h, k, rz, old, mergeHost = {}, mg, i, r2, c2;
    if (!head || !rowHead || !inner) return;
    layout();
    head.innerHTML = '';
    rowHead.innerHTML = '';
    headEls = []; rowEls = []; rowHeadEls = []; cellEls = {}; selEls = [];
    old = inner.querySelectorAll('.g-row');
    for (k = 0; k < old.length; k++) if (old[k].parentNode) old[k].parentNode.removeChild(old[k]);

    for (c = 0; c < sheet.cols; c++) {
      d = document.createElement('div');
      d.className = 'g-ch';
      d.style.width = cw(c) + 'px';
      d.style.height = headH() + 'px';
      d.setAttribute('data-c', c);
      d.appendChild(document.createTextNode(colName(c)));
      rz = document.createElement('i');
      rz.className = 'g-crz';
      rz.setAttribute('data-c', c);
      d.appendChild(rz);
      head.appendChild(d);
      headEls.push(d);
    }

    /* слитые диапазоны: угол растягиваем на весь прямоугольник, остальные ячейки прячем */
    mg = merges();
    for (i = 0; i < mg.length; i++) mergeHost[key(mg[i].r1, mg[i].c1)] = mg[i];

    for (r = 0; r < sheet.rows; r++) {
      h = rh(r);
      var rhEl = document.createElement('div');
      rhEl.className = 'g-rh';
      rhEl.style.height = h + 'px';
      rhEl.style.width = rowHeadW() + 'px';
      rhEl.setAttribute('data-r', r);
      rhEl.appendChild(document.createTextNode(String(r + 1)));
      var rz2 = document.createElement('i');
      rz2.className = 'g-rrz';
      rz2.setAttribute('data-r', r);
      rhEl.appendChild(rz2);
      rowHead.appendChild(rhEl);
      rowHeadEls.push(rhEl);

      rowDiv = document.createElement('div');
      rowDiv.className = 'g-row';
      rowDiv.style.height = h + 'px';
      rowDiv.style.width = totalW + 'px';
      for (c = 0; c < sheet.cols; c++) {
        cell = document.createElement('div');
        cell.className = 'g-c';
        cell.style.width = cw(c) + 'px';
        cell.style.height = h + 'px';
        cell.setAttribute('data-r', r);
        cell.setAttribute('data-c', c);
        mg = mergeHost[key(r, c)];
        if (mg) {
          cell.className = 'g-c mg';
          for (r2 = mg.r1; r2 <= mg.r2 && r2 < sheet.rows; r2++) {
            for (c2 = (r2 === mg.r1 ? mg.c1 + 1 : mg.c1); c2 <= mg.c2 && c2 < sheet.cols; c2++) {
              cell.style.width += cw(c2) + 'px';
            }
            if (r2 > mg.r1) cell.style.height += rh(r2) + 'px';
          }
        }
        rowDiv.appendChild(cell);
        cellEls[key(r, c)] = cell;
      }
      inner.appendChild(rowDiv);
      rowEls.push(rowDiv);
    }

    head.style.height = headH() + 'px';
    head.style.width = totalW + 'px';
    rowHead.style.height = totalH + 'px';
    rowHead.style.width = rowHeadW() + 'px';
    inner.style.width = totalW + 'px';
    inner.style.height = totalH + 'px';
    if (wrap) wrap.style.fontSize = (11 * Z()).toFixed(2) + 'px';
    paintCells();
  }

  function paintCells() {
    var r, c, k, el, cell, v, out, f, al, tt, mg, cs;
    resetCalc();
    for (r = 0; r < sheet.rows; r++) {
      for (c = 0; c < sheet.cols; c++) {
        k = key(r, c);
        el = cellEls[k];
        if (!el) continue;
        mg = mergeAt(r, c);
        if (mg && (mg.r1 !== r || mg.c1 !== c)) {
          /* ячейка внутри слияния — её рисует угол */
          while (el.firstChild) el.removeChild(el.firstChild);
          el.className = 'g-c mgh';
          el.style.color = '';
          el.style.backgroundColor = '';
          el.title = '';
          continue;
        }
        if (!has(sheet.cells, k)) {
          while (el.firstChild) el.removeChild(el.firstChild);
          el.className = 'g-c' + (mg ? ' mg' : '');
          el.style.color = '';
          el.style.backgroundColor = '';
          el.title = '';
          continue;
        }
        cell = sheet.cells[k];
        v = cellVal(r, c);
        out = fmtVal(v, cell.f);
        while (el.firstChild) el.removeChild(el.firstChild);
        if (out !== '') el.appendChild(document.createTextNode(out));
        f = 'g-c' + (mg ? ' mg' : '');
        al = cell.al;
        if (!al) al = (v && v.t === 'n') ? 'right' : 'left';
        if (al === 'right') f += ' num';
        else if (al === 'center') f += ' ctr';
        if (v && v.t === 'e') f += ' err';
        if (cell.b) f += ' b';
        if (cell.i) f += ' i';
        if (cell.u) f += ' u';
        el.className = f;
        cs = cell.cf ? cfStyle(v, cell.cf) : null;
        el.style.color = (cs && cs.c) ? cs.c : (cell.c || '');
        el.style.backgroundColor = (cs && cs.bg) ? cs.bg : (cell.bg || '');
        tt = String(cell.v).charAt(0) === '=' ? expandRefs(String(cell.v)) : out;
        el.title = tt;
      }
    }
  }

  /* ---------- выделение ---------- */
  function normSel(r1, c1, r2, c2) {
    return {
      r1: Math.min(r1, r2), c1: Math.min(c1, c2),
      r2: Math.max(r1, r2), c2: Math.max(c1, c2)
    };
  }
  function clampSel(s) {
    s.r1 = Math.max(0, Math.min(s.r1, sheet.rows - 1));
    s.r2 = Math.max(0, Math.min(s.r2, sheet.rows - 1));
    s.c1 = Math.max(0, Math.min(s.c1, sheet.cols - 1));
    s.c2 = Math.max(0, Math.min(s.c2, sheet.cols - 1));
    return s;
  }
  function selRef() {
    if (!sel) return '';
    if (sel.r1 === sel.r2 && sel.c1 === sel.c2) return addr(sel.r1, sel.c1);
    return addr(sel.r1, sel.c1) + ':' + addr(sel.r2, sel.c2);
  }
  function setSel(r1, c1, r2, c2, noScroll) {
    sel = clampSel(snapSel(normSel(r1, c1, r2, c2)));
    paintSel();
    if (!noScroll) scrollIntoView(sel.r2, sel.c2);
    return sel;
  }
  function selectCell(r, c, extend) {
    if (extend) { setSel(anchor.r, anchor.c, r, c); return; }
    anchor = { r: r, c: c };
    setSel(r, c, r, c);
  }
  function clearSelClasses() {
    var i, e, cn;
    for (i = 0; i < selEls.length; i++) {
      e = selEls[i];
      if (!e) continue;
      cn = e.className.replace(/\bsel\b/g, '').replace(/\bcur\b/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
      e.className = cn || 'g-c';
    }
    selEls = [];
  }
  /* выделение слитого диапазона всегда показывает угол */
  function snapSel(s) {
    var a = ownPos(s.r1, s.c1), b = ownPos(s.r2, s.c2);
    s.r1 = Math.min(a.r, b.r); s.c1 = Math.min(a.c, b.c);
    s.r2 = Math.max(a.r, b.r); s.c2 = Math.max(a.c, b.c);
    return s;
  }
  function paintSel() {
    var r, c, k, e, i, box, fill, corner, sum = 0, nums = 0, v, n, cn;
    if (!sel) return;
    clearSelClasses();
    box = $('gSelBox');
    if (box) {
      box.style.left = xoff[sel.c1] + 'px';
      box.style.top = yoff[sel.r1] + 'px';
      box.style.width = (xoff[sel.c2 + 1] - xoff[sel.c1]) + 'px';
      box.style.height = (yoff[sel.r2 + 1] - yoff[sel.r1]) + 'px';
      box.className = 'g-selbox on';
    }
    fill = $('gFillBox');
    if (fill) {
      fill.style.left = (xoff[sel.c2 + 1] - 5) + 'px';
      fill.style.top = (yoff[sel.r2 + 1] - 5) + 'px';
      fill.className = 'g-fillbox' + (showFill ? ' on' : '');
    }
    for (r = sel.r1; r <= sel.r2; r++) {
      for (c = sel.c1; c <= sel.c2; c++) {
        e = cellEls[key(r, c)];
        if (!e) continue;
        cn = e.className.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        if (cn.indexOf('sel') < 0) cn += ' sel';
        if (r === sel.r1 && c === sel.c1) cn += ' cur';
        v = cellVal(r, c);
        n = nval(v);
        if (n != null) { sum += n; nums++; }
        e.className = cn;
        selEls.push(e);
      }
    }
    cn = sel.c2 > sel.c1;
    for (i = 0; i < headEls.length; i++) headEls[i].className = 'g-ch' + ((i >= sel.c1 && i <= sel.c2) ? ' hi on' : '');
    for (i = 0; i < rowHeadEls.length; i++) rowHeadEls[i].className = 'g-rh' + ((i >= sel.r1 && i <= sel.r2) ? ' hi on' : '');
    corner = $('gCorner');
    if (corner) {
      corner.className = 'g-corner' + (sel.r1 === 0 && sel.c1 === 0 && sel.r2 === sheet.rows - 1 && sel.c2 === sheet.cols - 1 ? ' on' : '');
    }
    if (C.onSel) C.onSel(sum, nums);
  }
  function scrollIntoView(r, c) {
    var sc = $('gScroll');
    if (!sc) return;
    var top = yoff[r], h = rh(r), left = xoff[c], w = cw(c);
    var hh = showHead ? headH() : 0, hw = showHead ? rowHeadW() : 0;
    if (top < sc.scrollTop + hh) sc.scrollTop = Math.max(0, top - hh);
    else if (top + h > sc.scrollTop + sc.clientHeight) sc.scrollTop = top + h - sc.clientHeight;
    if (left < sc.scrollLeft + hw) sc.scrollLeft = Math.max(0, left - hw);
    else if (left + w > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = left + w - sc.clientWidth;
  }

  /* ---------- редактор ячейки ---------- */
  function startEdit(seed) {
    var r = sel.r1, c = sel.c1, ed = $('cEdit'), sc = $('gScroll'), mg, w, h, r2, c2;
    if (!ed || !sel) return;
    if (edit) commitEdit(null);
    edit = { r: r, c: c, orig: rawAt(r, c) };
    mg = mergeAt(r, c);
    w = cw(c);
    h = rh(r);
    if (mg) {
      for (r2 = mg.r1; r2 <= mg.r2 && r2 < sheet.rows; r2++) {
        for (c2 = (r2 === mg.r1 ? mg.c1 + 1 : mg.c1); c2 <= mg.c2 && c2 < sheet.cols; c2++) {
          w += cw(c2);
        }
        if (r2 > mg.r1) h += rh(r2);
      }
    }
    ed.style.left = xoff[r] + 'px';
    ed.style.top = yoff[r] + 'px';
    ed.style.width = w + 'px';
    ed.style.height = h + 'px';
    ed.style.fontSize = (11 * Z()).toFixed(2) + 'px';
    ed.value = seed == null ? edit.orig : seed;
    ed.className = 'c-edit on';
    if (sc) sc.className = sc.className.replace(/\bediting\b/g, '').replace(/\s+/g, ' ').trim() + ' editing';
    try { ed.focus(); ed.select(); } catch (e) { }
    beep(880, 0.02);
  }
  function commitEdit(move) {
    var ed = $('cEdit'), text, r, c, was, sc, mg, i, r2, c2, k, cell;
    if (!edit) return false;
    r = edit.r; c = edit.c;
    text = ed ? ed.value : '';
    was = text !== edit.orig;
    edit = null;
    if (ed) { ed.className = 'c-edit'; ed.value = ''; }
    sc = $('gScroll');
    if (sc) sc.className = sc.className.replace(/\bediting\b/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (was) {
      if (C.beforeChange) C.beforeChange(true);
      mg = mergeAt(r, c);
      if (mg) {
        cell = cellAt(r, c);
        if (!cell) cell = blankCell();
        cell.v = text;
        sheet.cells[key(r, c)] = cell;
        resetCalc();
        for (r2 = mg.r1; r2 <= mg.r2; r2++) {
          for (c2 = mg.c1; c2 <= mg.c2; c2++) {
            if (r2 === r && c2 === c) continue;
            k = key(r2, c2);
            if (has(sheet.cells, k)) sheet.cells[k].v = '';
          }
        }
      } else setRaw(r, c, text);
      if (C.afterChange) C.afterChange();
    }
    if (move === 'down') selectCell(Math.min(sheet.rows - 1, r + 1), c);
    else if (move === 'up') selectCell(Math.max(0, r - 1), c);
    else if (move === 'right') selectCell(r, Math.min(sheet.cols - 1, c + 1));
    else if (move === 'left') selectCell(r, Math.max(0, c - 1));
    else { anchor = { r: r, c: c }; paintSel(); }
    if (was) beep(1180, 0.02);
    return was;
  }
  function cancelEdit() {
    var ed = $('cEdit'), sc = $('gScroll');
    edit = null;
    if (ed) { ed.className = 'c-edit'; ed.value = ''; }
    if (sc) sc.className = sc.className.replace(/\bediting\b/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    paintSel();
  }
  function isEditing() { return !!edit; }

  /* ==================================================================
     НАРУЖНЫЙ API
     ================================================================== */
  var C = {
    MAXROWS: MAXROWS, DEFCOLS: DEFCOLS, DEF_CW: DEF_CW, DEF_RH: DEF_RH,
    MIN_CW: MIN_CW, MAX_CW: MAX_CW, MAX_RH: MAX_RH, HEADH: HEADH, ROWHW: ROWHW,
    onSel: null, beforeChange: null, afterChange: null,
    $: $,
    get sheet() { return sheet; },
    set sheet(v) { sheet = v; },
    get sel() { return sel; },
    set sel(v) { sel = v; },
    get anchor() { return anchor; },
    set anchor(v) { anchor = v; },
    get edit() { return edit; },
    set edit(v) { edit = v; },
    get zoom() { return zoomPct; },
    set zoom(v) { zoomPct = v; },
    get showFill() { return showFill; },
    set showFill(v) { showFill = v; },
    get showHead() { return showHead; },
    set showHead(v) { showHead = v; },
    get showGrid() { return showGrid; },
    set showGrid(v) { showGrid = v; },
    cellEls: cellEls, headEls: headEls, rowEls: rowEls, rowHeadEls: rowHeadEls,
    selEls: selEls,
    has: has, pad: pad, num: num, on: on, clone: clone, clampN: clampN,
    colName: colName, colIdx: colIdx, key: key, addr: addr, parseRef: parseRef, refText: refText,
    blankCell: blankCell, normCell: normCell, blankSheet: blankSheet, emptySheet: emptySheet, normSheet: normSheet, put: put,
    cellAt: cellAt, rawAt: rawAt, setRaw: setRaw, usedRange: usedRange, cellCount: cellCount,
    VN: VN, VS: VS, VE: VE, nval: nval, sval: sval,
    numToStr: numToStr, ru: ru, fmtVal: fmtVal, fmtPlain: fmtPlain, literal: literal,
    cellVal: cellVal, evalFx: evalFx, shiftFormula: shiftFormula, resetCalc: resetCalc,
    tokenize: tokenize, fnName: fnName, FUNCS: FUNCS,
    Z: Z, cw: cw, rh: rh, headH: headH, rowHeadW: rowHeadW,
    get xoff() { return xoff; },
    get yoff() { return yoff; },
    get totalW() { return totalW; },
    get totalH() { return totalH; },
    layout: layout, colAt: colAt, rowAt: rowAt, cellFromPoint: cellFromPoint,
    buildGrid: buildGrid, paintCells: paintCells,
    normSel: normSel, clampSel: clampSel, selRef: selRef, setSel: setSel, selectCell: selectCell,
    paintSel: paintSel, clearSelClasses: clearSelClasses, scrollIntoView: scrollIntoView,
    snapSel: snapSel,
    merges: merges, mergeAt: mergeAt, ownPos: ownPos, putRawOwn: putRawOwn,
    addMerge: addMerge, canMerge: canMerge, unmergeRange: unmergeRange, liftMergeValues: liftMergeValues, refSelText: refSelText,
    shiftOutside: shiftOutside,
    namesList: namesList, findName: findName, setName: setName, delName: delName,
    resolveRef: resolveRef, expandRefs: expandRefs, RE_NAME: RE_NAME,
    normMerges: normMerges, normNames: normNames, normRuleRef: normRuleRef,
    cfTest: cfTest, cfStyle: cfStyle, CF_OPS: CF_OP,
    startEdit: startEdit, commitEdit: commitEdit, cancelEdit: cancelEdit, isEditing: isEditing
  };
  var showFill = true, showHead = true, showGrid = true;
  window.MonolitCore = C;
})();