/* ==========================================================
   МОНОЛИТ ОФИС — переход между программами. Общий модуль.
   Подключается в index.html каждой программы.

   Что делает:
   • кнопка «Монолит Офис» всегда висит в правом верхнем углу;
   • рядом — шестерёнка «Настройки и язык»;
   • при выборе программы на весь экран открывается загрузчик:
     градиентный фон в акцентных цветах, в центре по очереди
     сменяются иконки всех программ, последней остаётся
     иконка выбранной, затем страница открывается плавно.

   Разметка в index.html:
     <div class="mo-office-slot" data-base="." data-app="documents"></div>
   data-base — папка программы относительно страницы ('.' или '..'),
   чтобы работало и из file://, и с любой глубины.

   Тексты берутся из общего словаря js/i18n.js (window.MonolitI18n),
   поэтому модуль грузится после i18n.js.
   ========================================================== */
(function () {
  'use strict';

  function T(key, vars) {
    return (window.MonolitI18n && window.MonolitI18n.t) ? window.MonolitI18n.t(key, vars) : key;
  }

  var APPS = [
    { key: 'documents', dir: 'documents' },
    { key: 'tables', dir: 'tables' },
    { key: 'presentation', dir: 'presentation' }
  ];

  /* акцентные цвета программ — ими красим фон загрузчика */
  var TINT = {
    documents: ['#ff8a00', '#b25000', '#7a3200'],
    tables: ['#33b14a', '#009000', '#005a00'],
    presentation: ['#4a5ce8', '#0000e0', '#000070']
  };

  /* сколько иконок прокрутить перед выбранной и паузы между сменами */
  var SWAP_MS = 210;
  var LAST_HOLD = 700;
  var prev = null;        /* какая иконка была показана последней */

  function appName(a) { return T('app.' + a.key + '.name'); }
  function appDesc(a) { return T('app.' + a.key + '.desc'); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.appendChild(document.createTextNode(text));
    return e;
  }
  function img(src, alt) {
    var i = document.createElement('img');
    i.src = src;
    i.alt = alt || '';
    return i;
  }
  function iconOf(a, base, size) {
    return base + '/../' + a.dir + '/img/logo-' + (size || 24) + '.png';
  }

  /* ==========================================================
     ЗАГРУЗЧИК: полноэкранный экран со сменяющимися иконками
     ========================================================== */
  /* Показывает загрузчик для указанной программы. hold=true — без перехода. */
  function installLoader(base, currentKey) {
    var cur = null;
    window.MonolitLoader = {
      show: function (key, hold) {
        var a = null, i;
        for (i = 0; i < APPS.length; i++) if (APPS[i].key === key) a = APPS[i];
        if (!a) return false;
        cur = new Loader(base, a, currentKey, !!hold);
        cur.open();
        return true;
      },
      order: function () { return cur && cur.order ? cur.order.map(function (x) { return x.key; }) : []; },
      apps: function () { return APPS.map(function (x) { return x.key; }); }
    };
  }

  function Loader(base, target, currentKey, hold) {
    var self = this;
    var order = [];        /* последовательность показываемых иконок */
    var step = 0;
    var timer = null;

    /* порядок иконок собирает buildOrder ниже */
    /* Подряд одинаковые иконки повторяться не должны: следим за последней
       показанной и переставляем, если совпало. Последняя — всегда выбранная
       программа, на ней переход и заканчивается. */
    function pickRandom() {
      var pool = [], i;
      for (i = 0; i < APPS.length; i++) {
        if (APPS[i] !== prev) pool.push(APPS[i]);
      }
      if (!pool.length) return APPS[Math.floor(Math.random() * APPS.length)];
      return pool[Math.floor(Math.random() * pool.length)];
    }
    function buildOrder() {
      var n = 5 + Math.floor(Math.random() * 4), i;
      order = [];
      prev = null;
      /* первая иконка — та, из которой уходим */
      if (currentKey) {
        for (i = 0; i < APPS.length; i++) if (APPS[i].key === currentKey) prev = APPS[i];
        order.push(prev);
      }
      for (i = 0; i < n; i++) {
        prev = pickRandom();
        order.push(prev);
      }
      /* перед финальной не даём повториться */
      if (order[order.length - 1] === target) {
        order[order.length - 1] = pickRandom();
      }
      order.push(target);
      prev = target;
    }

    var ov = el('div', 'mo-load');
    ov.setAttribute('role', 'status');
    ov.setAttribute('aria-live', 'polite');
    ov.innerHTML = '';
    var grad = el('div', 'mo-load-grad');
    grad.style.background =
      'linear-gradient(135deg,' + TINT[target.key][0] + ' 0%,' + TINT[target.key][1] + ' 45%,' +
      TINT[target.key][2] + ' 100%)';
    ov.appendChild(grad);

    var box = el('div', 'mo-load-box');
    var title = el('div', 'mo-load-title');
    title.textContent = T('office.name');
    box.appendChild(title);
    var slot = el('div', 'mo-load-slot');
    var nameEl = el('div', 'mo-load-name');
    var subEl = el('div', 'mo-load-sub');
    var bar = el('div', 'mo-load-bar');
    var fill = el('i', 'mo-load-fill');
    bar.appendChild(fill);
    box.appendChild(slot);
    box.appendChild(nameEl);
    box.appendChild(subEl);
    box.appendChild(bar);
    ov.appendChild(box);

    var logo = el('div', 'mo-load-logo');
    logo.appendChild(img(base + '/img/office-128.png', T('office.name')));
    ov.appendChild(logo);

    function paintOne(a) {
      var old = slot.firstChild;
      var w = el('div', 'mo-load-ico' + (a === target ? ' last' : ''));
      w.appendChild(img(iconOf(a, base, 128), appName(a)));
      slot.appendChild(w);
      /* старую иконку убираем после анимации — так получается «смена» */
      if (old && old.parentNode) {
        setTimeout(function () {
          if (old.parentNode) old.parentNode.removeChild(old);
        }, 220);
      }
      nameEl.textContent = appName(a);
      subEl.textContent = appDesc(a);
      nameEl.className = a === target ? 'mo-load-name last' : 'mo-load-name';
    }

    function tickSwap() {
      var a;
      if (step >= order.length) {
        if (timer) { clearTimeout(timer); timer = null; }
        fill.style.width = '100%';
        timer = setTimeout(finish, LAST_HOLD);
        return;
      }
      a = order[step++];
      paintOne(a);
      fill.style.width = Math.round((step / (order.length + 0.6)) * 100) + '%';
      timer = setTimeout(tickSwap, step === order.length ? LAST_HOLD : SWAP_MS);
    }

    function finish() {
      /* hold=true — загрузчик показывается, но перехода нет
         (нужно для проверки в тестах и для предпросмотра) */
      if (hold) {
        if (timer) { clearTimeout(timer); timer = null; }
        fill.style.width = '100%';
        return;
      }
      /* плавно открываем интерфейс: сначала гасим загрузчик */
      ov.className = 'mo-load done';
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        document.body.className =
          String(document.body.className || '').replace(/\bmo-arriving\b/g, '').trim();
        window.location.href = base + '/../' + target.dir + '/index.html';
      }, 260);
    }

    this.open = function () {
      buildOrder();
      document.body.appendChild(ov);
      ov.className = 'mo-load show';
      tickSwap();
      self.order = order;
    };
  }

  /* ==========================================================
     КНОПКА, ШЕСТЕРЁНКА И МЕНЮ
     ========================================================== */
  function build(host) {
    var base = (host.getAttribute('data-base') || '.').replace(/\/+$/, '');
    var current = host.getAttribute('data-app') || '';
    /* тут же объявляем загрузчик: его можно вызвать из консоли и из тестов */
    installLoader(base, current);

    var root = el('div', 'mo-office');
    var btn = el('button', 'mo-office-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.appendChild(img(base + '/img/office-32.png', ''));
    var btnText = el('span', null, T('office.name'));
    btn.appendChild(btnText);
    btn.appendChild(el('i', 'mo-office-caret'));

    /* шестерёнка: окно настроек и выбора языка */
    var gear = el('button', 'mo-office-gear');
    gear.type = 'button';
    gear.innerHTML = '&#9881;';
    gear.onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (window.MonolitI18n && window.MonolitI18n.picker) window.MonolitI18n.picker();
    };

    var menu = el('div', 'mo-office-menu');
    var head = el('div', 'mo-head');
    head.appendChild(img(base + '/img/office-24.png', ''));
    var headText = el('span', null, T('office.name'));
    head.appendChild(headText);
    menu.appendChild(head);

    function go(a) {
      /* выбор программы: сначала загрузчик, потом переход */
      close();
      document.body.className =
        String(document.body.className || '').replace(/\bmo-arriving\b/g, '').trim();
      var ld = new Loader(base, a, current);
      ld.open();
    }

    function item(a) {
      var link = el('a', 'mo-item' + (a.key === current ? ' cur' : ''));
      link.href = base + '/../' + a.dir + '/index.html';
      link.setAttribute('data-app', a.key);
      if (a.key === current) link.setAttribute('aria-current', 'page');
      link.appendChild(img(iconOf(a, base, 24), appName(a)));
      var box = el('span');
      var t1 = el('span', 'mo-t', appName(a));
      var d1 = el('span', 'mo-d', appDesc(a));
      box.appendChild(t1);
      box.appendChild(d1);
      link.appendChild(box);
      link.onclick = function (ev) {
        if (a.key === current) { ev.preventDefault(); close(); return; }
        ev.preventDefault();
        go(a);
      };
      link._t = t1;
      link._d = d1;
      return link;
    }

    var items = [];
    for (var i = 0; i < APPS.length; i++) { var it = item(APPS[i]); items.push(it); menu.appendChild(it); }
    menu.appendChild(el('div', 'mo-sep'));
    var about = el('a', 'mo-item');
    about.href = base + '/index.html#about';
    about.appendChild(img(base + '/img/office-24.png', ''));
    var ab = el('span');
    var abT = el('span', 'mo-t', T('office.about'));
    var abD = el('span', 'mo-d', T('office.about.desc'));
    ab.appendChild(abT);
    ab.appendChild(abD);
    about.appendChild(ab);
    menu.appendChild(about);

    root.appendChild(btn);
    root.appendChild(gear);
    root.appendChild(menu);
    host.appendChild(root);

    function retranslate() {
      btn.title = T('office.switch');
      gear.title = T('office.settings');
      gear.setAttribute('aria-label', T('office.settings'));
      btnText.textContent = T('office.name');
      headText.textContent = T('office.name');
      for (var k = 0; k < items.length; k++) {
        var a = APPS[k];
        items[k]._t.textContent = appName(a);
        items[k]._d.textContent = appDesc(a);
        var im = items[k].querySelector('img');
        if (im) im.alt = appName(a);
      }
      abT.textContent = T('office.about');
      abD.textContent = T('office.about.desc');
    }
    retranslate();
    if (window.MonolitI18n && window.MonolitI18n.on) window.MonolitI18n.on(retranslate);

    function close() {
      menu.className = 'mo-office-menu';
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (menu.className.indexOf('open') >= 0) { close(); } else {
        menu.className = 'mo-office-menu open';
        btn.setAttribute('aria-expanded', 'true');
      }
    };
    document.addEventListener('click', function (ev) {
      if (root.contains(ev.target)) return;
      close();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') close();
    });
  }

  /* ==========================================================
     ТЕЛЕФОН: наши программы рассчитаны на компьютер.
     На узком экране показываем предупреждение, но оставляем
     возможность войти — вдруг надо посмотреть.
     ========================================================== */
  function isPhone() {
    var ua = navigator.userAgent || navigator.vendor || '';
    if (/Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|Mobile/i.test(ua)) return true;
    var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    if (coarse && Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 700) return true;
    return Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 540;
  }
  function phoneWarn() {
    if (document.querySelector('.mo-phone')) return;
    var ov = el('div', 'mo-phone');
    var box = el('div', 'mo-phone-box');

    var logo = el('div', 'mo-phone-logo');
    logo.appendChild(img(baseOf() + '/img/office-128.png', T('office.name')));
    box.appendChild(logo);
    box.appendChild(el('h1', null, T('phone.title')));
    box.appendChild(el('p', null, T('phone.body', { app: appNameOfCurrent() })));
    box.appendChild(el('p', 'mo-phone-hint', T('phone.hint')));

    var row = el('div', 'mo-phone-row');
    var ok = el('button', 'mo-phone-ok');
    ok.type = 'button';
    ok.textContent = T('phone.open');
    ok.onclick = function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    };
    row.appendChild(ok);
    box.appendChild(row);

    ov.appendChild(box);
    document.body.appendChild(ov);
  }
  function baseOf() {
    var h = document.querySelector('.mo-office-slot');
    return h ? (h.getAttribute('data-base') || '.').replace(/\/+$/, '') : '.';
  }
  function appNameOfCurrent() {
    var h = document.querySelector('.mo-office-slot');
    var k = h ? (h.getAttribute('data-app') || '') : '';
    for (var i = 0; i < APPS.length; i++) if (APPS[i].key === k) return appName(APPS[i]);
    return T('office.name');
  }

  /* ==========================================================
     ВКЛАДКА «НАСТРОЙКИ» В ЛЕНТЕ ПРОГРАММЫ
     Добавляется автоматически в каждую программу: там выбирается
     язык интерфейса. Разметка ленты отличается (в Документах и
     Таблицах — .rpane[data-pane], в Презентациях — .rpanel[data-panel]),
     поэтому подстраиваемся под ту, что есть на странице.
     ========================================================== */
  function settingsRibbon() {
    if (!window.MonolitI18n || !window.MonolitI18n.langs) return;
    var nav = document.querySelector('.rtabs');
    if (!nav || nav.querySelector('[data-tab="mo-settings"]')) return;

    var panes = document.querySelectorAll('.rpane');
    var panels = document.querySelectorAll('.rpanel');
    var isSection = panels.length && !panes.length;
    var pane;

    if (isSection) {
      pane = el('section', 'rpanel');
      pane.setAttribute('data-panel', 'mo-settings');
      nav.parentNode.insertBefore(pane, nav.nextSibling);
    } else {
      pane = el('div', 'rpane');
      pane.setAttribute('data-pane', 'mo-settings');
      var ribbon = document.getElementById('ribbon') || (panes.length ? panes[0].parentNode : nav.parentNode);
      ribbon.appendChild(pane);
    }

    var tab = el('button', 'rtab', T('ui.settings'));
    tab.type = 'button';
    tab.setAttribute('data-tab', 'mo-settings');
    /* программы по-разному подключают свои скрипты: где-то вкладки
       прошиваются до нас, где-то после. Свой обработчик — подстраховка
       (если приложение прошьёт вкладку позже, оно его перезапишет). */
    tab.onclick = function () {
      var all = document.querySelectorAll('.rtab'), a;
      for (a = 0; a < all.length; a++) all[a].className = 'rtab' + (all[a] === tab ? ' on' : '');
      var pn = document.querySelectorAll('.rpane, .rpanel'), b, key, base;
      for (b = 0; b < pn.length; b++) {
        key = pn[b].getAttribute('data-pane') || pn[b].getAttribute('data-panel');
        base = pn[b].className.indexOf('rpanel') >= 0 ? 'rpanel' : 'rpane';
        pn[b].className = base + (key === 'mo-settings' ? ' on' : '');
      }
    };
    nav.appendChild(tab);

    var group = el('div', 'rgroup mo-set');
    var head = el('div', 'rg-title', T('ui.langTitle'));
    group.appendChild(head);
    var body = el('div', 'rg-body');
    var col = el('div', 'rg-col');
    body.appendChild(col);

    var langs = window.MonolitI18n.langs();
    var btns = [], i;
    for (i = 0; i < langs.length; i++) {
      (function (L) {
        var b = el('button', 'rbtn wide', L.name);
        b.type = 'button';
        b.setAttribute('data-lang', L.key);
        b.onclick = function (ev) {
          if (ev) ev.preventDefault();
          window.MonolitI18n.set(L.key);
        };
        col.appendChild(b);
        btns.push(b);
      })(langs[i]);
    }
    var lead = el('div', 'mo-set-lead', T('ui.langLead'));
    body.appendChild(lead);
    group.appendChild(body);
    pane.appendChild(group);

    function refresh() {
      var curk = window.MonolitI18n.get();
      tab.textContent = T('ui.settings');
      head.textContent = T('ui.langTitle');
      lead.textContent = T('ui.langLead');
      for (var j = 0; j < btns.length; j++) {
        btns[j].className = 'rbtn wide' + (btns[j].getAttribute('data-lang') === curk ? ' on' : '');
      }
    }
    refresh();
    if (window.MonolitI18n.on) window.MonolitI18n.on(refresh);
  }

  function init() {
    if (isPhone()) phoneWarn();
    var hosts = document.querySelectorAll('.mo-office-slot');
    for (var i = 0; i < hosts.length; i++) build(hosts[i]);
    settingsRibbon();
    /* при прямом открытии страницы интерфейс проявляется плавно.
       Имя класса вешаем на body: на <html> анимация ломала расчёт
       высоты окна в браузере. */
    document.body.className = String(document.body.className || '').replace(/\bmo-arriving\b/g, '').trim() + ' mo-arriving';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
