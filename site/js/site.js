(function () {
  'use strict';

  var DIRS = {
    documents: '../documents/index.html',
    tables: '../tables/index.html',
    presentation: '../presentation/index.html'
  };

  function go(key) {
    var href = DIRS[key];
    if (!href) return;
    if (window.MonolitLoader && window.MonolitLoader.show) {
      window.MonolitLoader.show(key, false);
      return;
    }
    window.location.href = href;
  }

  function dropPhoneWarn() {
    var ovs = document.querySelectorAll('.mo-phone'), i;
    for (i = 0; i < ovs.length; i++) {
      if (ovs[i].parentNode) ovs[i].parentNode.removeChild(ovs[i]);
    }
  }

  function wireOpenButtons() {
    var btns = document.querySelectorAll('[data-open]'), i;
    for (i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          go(b.getAttribute('data-open'));
        });
      })(btns[i]);
    }
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function startClock() {
    var out = document.getElementById('tbTime');
    if (!out) return;
    function tick() {
      var d = new Date();
      out.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    tick();
    setInterval(tick, 30000);
  }

  function markNav() {
    var links = document.querySelectorAll('.nav a'), i;
    var map = {}, ids = ['apps', 'features', 'formats', 'run'];
    for (i = 0; i < links.length; i++) {
      var id = (links[i].getAttribute('href') || '').replace('#', '');
      if (id) map[id] = links[i];
    }
    function clear() {
      for (var j in map) {
        if (map.hasOwnProperty(j)) map[j].classList.remove('on');
      }
    }
    if (!('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      var seen = [];
      entries.forEach(function (en) {
        if (en.isIntersecting) seen.push(en.target.id);
      });
      if (!seen.length) return;
      clear();
      seen.sort();
      if (map[seen[0]]) map[seen[0]].classList.add('on');
    }, { rootMargin: '-25% 0px -65% 0px' });
    ids.forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) obs.observe(sec);
    });
  }

  function init() {
    dropPhoneWarn();
    wireOpenButtons();
    startClock();
    markNav();
    var ls = document.getElementById('langSwitch');
    if (ls && window.MonolitI18n && window.MonolitI18n.switchLang) {
      window.MonolitI18n.switchLang(ls);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})();