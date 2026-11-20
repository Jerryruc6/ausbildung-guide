/* Schaum 沫 · 德国地图交互 (Hero)
   IIFE，不设全局变量。鼠标 / 触摸 / 键盘三路。
   丝滑：州高亮 fill / 描边 320ms 缓动过渡；信息卡是常驻 body 交叉淡入淡出
   （出 180ms / 入 320ms cubic-bezier(0.22, 1, 0.36, 1)），连续悬停只保留
   最新一次；州与州之间直接移动不闪提示。减弱动效时直接切换，无动画。
   岗位数字来源：~/workspace/interactions-work/state-stats.json（2026-11-20 更新）。
   低语言数用 low_language_live（看板实时口径：A2直接 / B1直接 /
   B1入学培训期内到B2 / B1+免费B2课 四档，16 州合计 176），不用旧 low_language。
   总数 total 与 top_occupations 第一名不变。
   文案三语：按 <html lang> 渲染 zh/de/en；三语切换协调员翻译 MAP_I18N 即可，
   不要改类名、id 与数据。语言切换时派发 document 事件 schaum:langchange
   （detail.lang 可选）；若整块 Hero 被重渲染，派发 schaum:map-reinit 重新绑定。 */
(function () {
  'use strict';

  /* ---- 数据：州名（德文）-> 中文名 / 首府 / 岗位总数 / 低语言岗数 / 最多方向 ---- */
  var DATA = {
    'Baden-Württemberg':      { zh: '巴登-符腾堡', capital: 'Stuttgart',   total: 262, low: 47, top: 'Eisenbahner:in in der Zugverkehrssteuerung', topN: 32 },
    'Bayern':                 { zh: '巴伐利亚',   capital: 'München',     total: 301, low: 25, top: 'Pflegefachfrau/-mann', topN: 26 },
    'Berlin':                 { zh: '柏林',       capital: 'Berlin',      total: 60,  low: 4,  top: 'Pflegefachfrau/-mann', topN: 7 },
    'Brandenburg':            { zh: '勃兰登堡',   capital: 'Potsdam',     total: 44,  low: 4,  top: 'Lokführer:in (Eisenbahner:in im Betriebsdienst)', topN: 5 },
    'Bremen':                 { zh: '不来梅',     capital: 'Bremen',      total: 18,  low: 0,  top: 'Mechatroniker', topN: 2 },
    'Hamburg':                { zh: '汉堡',       capital: 'Hamburg',     total: 39,  low: 1,  top: 'Pflegefachkraft', topN: 6 },
    'Hessen':                 { zh: '黑森',       capital: 'Wiesbaden',   total: 142, low: 10, top: 'Gleisbauer:in', topN: 8 },
    'Mecklenburg-Vorpommern': { zh: '梅克伦堡-前波美拉尼亚', capital: 'Schwerin', total: 30, low: 0, top: 'Eisenbahner:in in der Zugverkehrssteuerung', topN: 4 },
    'Niedersachsen':          { zh: '下萨克森',   capital: 'Hannover',    total: 148, low: 7,  top: 'Mechatroniker', topN: 11 },
    'Nordrhein-Westfalen':    { zh: '北莱茵-威斯特法伦', capital: 'Düsseldorf', total: 299, low: 10, top: 'Pflegefachfrau/-mann', topN: 23 },
    'Rheinland-Pfalz':        { zh: '莱茵兰-普法尔茨', capital: 'Mainz',   total: 87,  low: 1,  top: 'Verkäufer/Kaufmann im Einzelhandel', topN: 8 },
    'Saarland':               { zh: '萨尔',       capital: 'Saarbrücken', total: 12,  low: 1,  top: 'Industriemechaniker', topN: 2 },
    'Sachsen':                { zh: '萨克森',     capital: 'Dresden',     total: 120, low: 17, top: 'Pflegefachassistenz', topN: 12 },
    'Sachsen-Anhalt':         { zh: '萨克森-安哈尔特', capital: 'Magdeburg', total: 67, low: 30, top: 'Elektroniker:in für Betriebstechnik', topN: 9 },
    'Schleswig-Holstein':     { zh: '石勒苏益格-荷尔斯泰因', capital: 'Kiel', total: 51, low: 1,  top: 'Pflegefachfrau/-mann', topN: 7 },
    'Thüringen':              { zh: '图林根',     capital: 'Erfurt',      total: 61,  low: 18, top: 'Elektroniker:in für Betriebstechnik', topN: 7 }
  };

  /* ---- 界面文案：zh / de / en（由三语切换协调员维护翻译） ---- */
  var I18N = {
    zh: {
      hint: '把鼠标移到某个州上，或点一个州，看看那里的岗位。',
      capital: '首府',
      total: '岗位总数',
      low: '低语言岗位',
      top: '最多方向',
      posts: '条',
      foot: '另有 30 条岗位地点未核实或跨多州，其中低语言岗位 6 条。',
      close: '收起'
    },
    de: {
      hint: 'Bewege die Maus über ein Bundesland oder tippe darauf, um die Stellen dort zu sehen.',
      capital: 'Hauptstadt',
      total: 'Stellen gesamt',
      low: 'Stellen mit niedrigen Sprachanforderungen',
      top: 'Häufigste Richtung',
      posts: 'Stellen',
      foot: 'Weitere 30 Stellen: Ort nicht geprüft oder mehrere Bundesländer, davon 6 mit niedrigen Sprachanforderungen.',
      close: 'Schließen'
    },
    en: {
      hint: 'Hover over a state, or tap one, to see its positions.',
      capital: 'Capital',
      total: 'Positions in total',
      low: 'Low-language positions',
      top: 'Most common field',
      posts: 'positions',
      foot: 'Another 30 positions have an unverified location or span several states, including 6 low-language ones.',
      close: 'Close'
    }
  };

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'zh').toLowerCase();
    if (l.indexOf('de') === 0) return 'de';
    if (l.indexOf('en') === 0) return 'en';
    return 'zh';
  }

  function t(key) {
    var pack = I18N[lang()] || I18N.zh;
    return pack[key];
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function init() {
    var root = document.querySelector('.map-wrap');
    if (!root || root.dataset.mapBound === '1') return;
    var svg = root.querySelector('.map-svg');
    if (!svg) return;
    root.dataset.mapBound = '1';

    var states = Array.prototype.slice.call(svg.querySelectorAll('.map-state'));
    var card = root.querySelector('.map-card');
    if (!card) {
      card = el('div', 'map-card');
      card.id = 'mapCard';
      root.appendChild(card);
    }
    card.setAttribute('aria-live', 'polite');

    /* 常驻 body：把服务端直出的提示（或空卡片）包进来，之后只换它的子节点，
       不再每次重建 body（旧做法每次悬停都重播一次入场动画，会闪）。 */
    var cardBody = el('div', 'map-card-body'); /* 唯一常驻的 body，内容切换只换它的子节点 */
    while (card.firstChild) cardBody.appendChild(card.firstChild);
    card.appendChild(cardBody);

    var pinned = null;   /* 点按固定的州 path */
    var hovered = null;  /* 当前悬停 / 聚焦的州 path */
    var swapTimer = null;
    var swapSeq = 0;
    var firstRender = true;
    var OUT_MS = 180; /* 淡出时长，与 map.css 的 --map-dur-out 一致 */

    function reduceMotion() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* 内容切换：先淡出（180ms），再换内容淡入（320ms 丝滑曲线）。
       连续悬停只保留最新一次，不排队；减弱动效或首次渲染时直接换，无动画。 */
    function render(build) {
      if (firstRender || reduceMotion() || !cardBody.hasChildNodes()) {
        firstRender = false;
        cardBody.textContent = '';
        build(cardBody);
        return;
      }
      var token = ++swapSeq;
      cardBody.classList.add('is-out');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(function () {
        if (token !== swapSeq) return;
        cardBody.textContent = '';
        build(cardBody);
        void cardBody.offsetWidth; /* 强制重排，让淡入过渡真正跑起来 */
        cardBody.classList.remove('is-out');
      }, OUT_MS);
    }

    function buildHint(target) {
      target.appendChild(el('p', 'map-card-hint', t('hint')));
    }

    function buildState(target, path) {
      var name = path.getAttribute('data-state');
      var d = DATA[name];
      if (!d) { buildHint(target); return; }

      var head = el('h3', 'map-card-head');
      head.appendChild(el('span', 'map-card-de', name));
      head.appendChild(el('span', 'map-card-zh', d.zh));
      target.appendChild(head);
      target.appendChild(el('p', 'map-card-cap', t('capital') + ' ' + d.capital));

      var stats = el('dl', 'map-card-stats');
      var g1 = el('div');
      g1.appendChild(el('dt', null, t('total')));
      g1.appendChild(el('dd', null, String(d.total)));
      var g2 = el('div');
      g2.appendChild(el('dt', null, t('low')));
      g2.appendChild(el('dd', 'map-card-low', String(d.low)));
      stats.appendChild(g1);
      stats.appendChild(g2);
      target.appendChild(stats);

      var top = el('p', 'map-card-top');
      top.appendChild(document.createTextNode(t('top') + '：'));
      top.appendChild(el('b', null, d.top));
      top.appendChild(document.createTextNode(' · ' + d.topN + ' ' + t('posts')));
      target.appendChild(top);

      target.appendChild(el('p', 'map-card-foot', t('foot')));
      target.appendChild(el('button', 'map-card-close', t('close'))).setAttribute('type', 'button');
    }

    function showHint() { render(buildHint); }

    function showState(path) {
      render(function (target) { buildState(target, path); });
    }

    function refresh() {
      if (hovered) { showState(hovered); return; }
      if (pinned) { showState(pinned); return; }
      showHint();
    }

    function setPinned(path) {
      if (pinned) {
        pinned.classList.remove('is-active');
        pinned.setAttribute('aria-pressed', 'false');
      }
      pinned = path;
      if (pinned) {
        pinned.classList.add('is-active');
        pinned.setAttribute('aria-pressed', 'true');
      }
      refresh();
    }

    function hoverOn(path) {
      hovered = path;
      path.classList.add('is-hover');
      showState(path);
    }

    function hoverOff(path, e) {
      hovered = null;
      path.classList.remove('is-hover');
      /* 直接移到相邻州上时，不经过提示闪一下：进来的 mouseenter / focus 会渲染新州 */
      if (e && e.relatedTarget && e.relatedTarget.classList &&
          e.relatedTarget.classList.contains('map-state')) return;
      refresh();
    }

    states.forEach(function (path) {
      path.setAttribute('aria-pressed', 'false');
      path.addEventListener('mouseenter', function () { hoverOn(path); });
      path.addEventListener('mouseleave', function (e) { hoverOff(path, e); });
      path.addEventListener('focus', function () { hoverOn(path); });
      path.addEventListener('blur', function (e) { hoverOff(path, e); });
      path.addEventListener('click', function () {
        setPinned(pinned === path ? null : path);
      });
      path.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setPinned(pinned === path ? null : path);
        }
      });
    });

    card.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('map-card-close')) setPinned(null);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pinned) setPinned(null);
    });

    document.addEventListener('click', function (e) {
      if (pinned && !root.contains(e.target)) setPinned(null);
    });

    document.addEventListener('schaum:langchange', function () { refresh(); });

    showHint();
  }

  /* Hero 被整块重渲染时，三语协调员派发 schaum:map-reinit 即可重新绑定。 */
  document.addEventListener('schaum:map-reinit', init);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
