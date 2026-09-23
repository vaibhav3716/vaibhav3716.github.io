(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;

  /* ---------------------------------------------------------------
     Theme toggle
  ---------------------------------------------------------------- */
  var themeBtn = document.querySelector('.theme-toggle');
  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function syncThemeLabel() {
    if (!themeBtn) return;
    themeBtn.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  function applyTheme(next) {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncThemeLabel();
    drawSED();
    drawPageStars();
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      // Turn the hero sky to match (it jumps straight to the end if the hero is off-screen)
      if (window.Sky) window.Sky.set(next, true);
      if (!document.startViewTransition || reduceMotion.matches) { applyTheme(next); return; }
      var r = themeBtn.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var vt = document.startViewTransition(function () { applyTheme(next); });
      vt.ready.then(function () {
        document.documentElement.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 750, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' }
        );
      });
    });
    syncThemeLabel();
  }

  /* ---------------------------------------------------------------
     Mobile menu
  ---------------------------------------------------------------- */
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('nav-links');
  function setMenu(open) {
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navToggle.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
  }
  function closeMenu() { setMenu(false); }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      setMenu(!navLinks.classList.contains('open'));
    });
    navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) { closeMenu(); navToggle.focus(); }
    });
  }

  /* ---------------------------------------------------------------
     Highlight the current section in the nav
  ---------------------------------------------------------------- */
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
  var navSections = navAnchors.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var navTicking = false;
  var where = document.querySelector('.nav-where'), whereText = where && where.querySelector('span'), whereNow = null;
  function setWhere(text) {
    if (!where || text === whereNow) return;
    whereNow = text;
    where.classList.toggle('none', !text);
    where.classList.add('swap');
    requestAnimationFrame(function () { whereText.textContent = text; requestAnimationFrame(function () { where.classList.remove('swap'); }); });
  }
  function updateCurrent() {
    navTicking = false;
    var line = window.scrollY + window.innerHeight * 0.4;
    var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    var idx = -1;
    navSections.forEach(function (sec, i) { if (sec && sec.offsetTop <= line) idx = i; });
    if (atBottom) idx = navSections.length - 1;
    navAnchors.forEach(function (a, i) {
      if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    setWhere(idx >= 0 ? navAnchors[idx].textContent : '');
  }
  if (navAnchors.length) {
    window.addEventListener('scroll', function () {
      if (!navTicking) { navTicking = true; requestAnimationFrame(updateCurrent); }
    }, { passive: true });
    window.addEventListener('resize', updateCurrent);
    updateCurrent();
  }

  /* ---------------------------------------------------------------
     SED explorer: two blackbodies, F_lambda ∝ R² B_lambda(T)
  ---------------------------------------------------------------- */
  var svg = document.getElementById('sed-svg');
  var tWd = document.getElementById('t-wd');
  var tMs = document.getElementById('t-ms');
  var C2 = 1.4388e8; // hc/k in Å·K
  var R_WD = 0.013;  // solar radii
  // Approximate main-sequence radius (R_sun) against effective temperature (K)
  var msTable = [[3000, 0.18], [3500, 0.42], [4000, 0.62], [4750, 0.74], [5500, 0.92], [6000, 1.1], [6500, 1.3]];
  function msRadius(T) {
    for (var i = 1; i < msTable.length; i++) {
      if (T <= msTable[i][0]) {
        var a = msTable[i - 1], b = msTable[i], f = (T - a[0]) / (b[0] - a[0]);
        return a[1] + f * (b[1] - a[1]);
      }
    }
    return msTable[msTable.length - 1][1];
  }
  function planck(lam, T) {
    var x = C2 / (lam * T);
    if (x > 700) return 0;
    return Math.pow(lam, -5) / (Math.expm1(x));
  }
  function flux(lam, T, R) { return R * R * planck(lam, T); }
  function bandShare(lo, hi, Tw, Tm, Rm) {
    var n = 40, wd = 0, ms = 0;
    for (var i = 0; i <= n; i++) {
      var lam = lo + (hi - lo) * i / n;
      wd += flux(lam, Tw, R_WD);
      ms += flux(lam, Tm, Rm);
    }
    return wd / (wd + ms);
  }
  function fmtPct(v) {
    var p = v * 100;
    if (p >= 99.5) return '> 99%';
    if (p < 0.1) return '< 0.1%';
    return (p < 10 ? p.toFixed(1) : Math.round(p)) + '%';
  }
  function fmtK(v) { return Number(v).toLocaleString('en-US') + ' K'; }
  function el(name, attrs, text) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  var W = 640, H = 360, M = { l: 44, r: 14, t: 18, b: 44 };
  function sizeSED() {
    // Narrow screens get a smaller drawing area so the text stays legible
    var narrow = svg.clientWidth && svg.clientWidth < 520;
    W = narrow ? 420 : 640; H = narrow ? 300 : 360;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  var LMIN = 1000, LMAX = 30000;
  var lx0 = Math.log10(LMIN), lx1 = Math.log10(LMAX);
  function X(lam) { return M.l + (Math.log10(lam) - lx0) / (lx1 - lx0) * (W - M.l - M.r); }

  function drawSED() {
    if (!svg || !tWd || !tMs) return;
    sizeSED();
    var Tw = +tWd.value, Tm = +tMs.value, Rm = msRadius(Tm);
    document.getElementById('t-wd-out').textContent = fmtK(Tw);
    document.getElementById('t-ms-out').textContent = fmtK(Tm);

    // Sample curves on a log grid
    var N = 220, pts = [], ymax = -Infinity;
    for (var i = 0; i <= N; i++) {
      var lam = Math.pow(10, lx0 + (lx1 - lx0) * i / N);
      var fw = flux(lam, Tw, R_WD), fm = flux(lam, Tm, Rm);
      var ls = Math.log10(fw + fm);
      if (ls > ymax) ymax = ls;
      pts.push([lam, fw, fm]);
    }
    var y1 = Math.ceil(ymax + 0.2), y0 = y1 - 6;
    function Y(logf) { return M.t + (y1 - Math.max(logf, y0)) / (y1 - y0) * (H - M.t - M.b); }
    function path(idx) {
      var d = '';
      for (var j = 0; j < pts.length; j++) {
        var f = idx === 3 ? pts[j][1] + pts[j][2] : pts[j][idx];
        var lf = f > 0 ? Math.log10(f) : y0 - 1;
        d += (j ? 'L' : 'M') + X(pts[j][0]).toFixed(1) + ' ' + Y(lf).toFixed(1);
      }
      return d;
    }

    // Keep the <title>, clear the rest
    while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
    var top = M.t, bottom = H - M.b;

    // Photometric bands
    var bands = [
      { lo: 1344, hi: 1786, cls: 'band-fuv', label: 'FUV' },
      { lo: 1771, hi: 2831, cls: 'band-nuv', label: 'NUV' },
      { lo: 3300, hi: 10500, cls: 'band-opt', label: 'Gaia G' },
      { lo: 10800, hi: 23500, cls: 'band-ir', label: W < 500 ? 'JHK' : '2MASS J H K' }
    ];
    bands.forEach(function (b) {
      svg.appendChild(el('rect', { x: X(b.lo), y: top, width: X(b.hi) - X(b.lo), height: bottom - top, 'class': b.cls }));
      svg.appendChild(el('text', { x: (X(b.lo) + X(b.hi)) / 2, y: top + 14, 'text-anchor': 'middle', 'class': 'band-label' }, b.label));
    });

    // Grid and axes
    for (var d = y0; d <= y1; d++) {
      svg.appendChild(el('line', { x1: M.l, x2: W - M.r, y1: Y(d), y2: Y(d), 'class': 'grid' }));
    }
    svg.appendChild(el('line', { x1: M.l, x2: W - M.r, y1: bottom, y2: bottom, 'class': 'axis' }));
    svg.appendChild(el('line', { x1: M.l, x2: M.l, y1: top, y2: bottom, 'class': 'axis' }));
    (W < 500 ? [1000, 3000, 10000, 30000] : [1000, 2000, 3000, 5000, 10000, 20000, 30000]).forEach(function (lam) {
      var x = X(lam);
      svg.appendChild(el('line', { x1: x, x2: x, y1: bottom, y2: bottom + 5, 'class': 'axis' }));
      svg.appendChild(el('text', { x: x, y: bottom + 19, 'text-anchor': 'middle', 'class': 'tick' }, lam.toLocaleString('en-US')));
    });
    svg.appendChild(el('text', { x: (M.l + W - M.r) / 2, y: H - 4, 'text-anchor': 'middle', 'class': 'axis-label' }, 'Wavelength (Å)'));
    var yl = el('text', { x: 0, y: 0, 'text-anchor': 'middle', 'class': 'axis-label', transform: 'translate(14 ' + ((top + bottom) / 2) + ') rotate(-90)' }, 'Flux (log scale)');
    svg.appendChild(yl);

    // Crossover: first wavelength where the companion overtakes the WD
    var cross = null;
    for (var k = 1; k < pts.length; k++) {
      if (pts[k - 1][1] >= pts[k - 1][2] && pts[k][1] < pts[k][2]) { cross = pts[k][0]; break; }
    }
    if (cross) {
      var cx = X(cross);
      svg.appendChild(el('line', { x1: cx, x2: cx, y1: top + 22, y2: bottom, 'class': 'cross' }));
      var anchorEnd = cx > W * 0.6;
      svg.appendChild(el('text', { x: cx + (anchorEnd ? -6 : 6), y: top + 36, 'text-anchor': anchorEnd ? 'end' : 'start', 'class': 'cross-label' }, '≈ ' + Math.round(cross / 100) * 100 + ' Å'));
    }

    // Curves
    svg.appendChild(el('path', { d: path(2), 'class': 'curve-ms' }));
    svg.appendChild(el('path', { d: path(1), 'class': 'curve-wd' }));
    svg.appendChild(el('path', { d: path(3), 'class': 'curve-sum' }));

    // Legend (bottom right)
    var lgx = W - M.r - 150, lgy = bottom - 58;
    [['curve-wd', 'White dwarf'], ['curve-ms', 'Companion'], ['curve-sum', 'What we observe']].forEach(function (item, i) {
      var y = lgy + i * 18;
      svg.appendChild(el('line', { x1: lgx, x2: lgx + 22, y1: y, y2: y, 'class': item[0] }));
      svg.appendChild(el('text', { x: lgx + 30, y: y + 4, 'class': 'legend' }, item[1]));
    });

    // Readouts
    document.getElementById('share-fuv').textContent = fmtPct(bandShare(1344, 1786, Tw, Tm, Rm));
    document.getElementById('share-g').textContent = fmtPct(bandShare(3300, 10500, Tw, Tm, Rm));
    document.getElementById('crossover').textContent = cross ? '≈ ' + (Math.round(cross / 100) * 100).toLocaleString('en-US') + ' Å' : (pts[0][1] < pts[0][2] ? 'never, in this range' : 'the whole range');
  }
  if (tWd && tMs) {
    tWd.addEventListener('input', drawSED);
    tMs.addEventListener('input', drawSED);
    var sedTimer;
    window.addEventListener('resize', function () { clearTimeout(sedTimer); sedTimer = setTimeout(drawSED, 150); });
    drawSED();
  }

  /* ---------------------------------------------------------------
     Figure lightbox
  ---------------------------------------------------------------- */
  var dlg = document.getElementById('lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    var dlgImg = document.getElementById('lightbox-img');
    var dlgCap = document.getElementById('lightbox-cap');
    var lastTrigger = null;
    document.querySelectorAll('[data-lightbox]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var img = a.querySelector('img');
        var cap = a.parentElement.querySelector('figcaption');
        dlgImg.src = a.getAttribute('href');
        dlgImg.alt = img ? img.alt : '';
        dlgCap.textContent = cap ? cap.textContent : '';
        lastTrigger = a;
        dlg.showModal();
      });
    });
    dlg.querySelector('.lightbox-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { if (lastTrigger) lastTrigger.focus(); });
  }

  /* ---------------------------------------------------------------
     Latest blog posts from Blogger (JSONP). The static list in the
     HTML stays if this fails.
  ---------------------------------------------------------------- */
  var blogList = document.getElementById('blog-list');
  if (blogList) {
    window.__renderBlog = function (data) {
      try {
        var entries = (data && data.feed && data.feed.entry) || [];
        if (!entries.length) return;
        var frag = document.createDocumentFragment();
        entries.slice(0, 3).forEach(function (entry) {
          var link = (entry.link || []).filter(function (l) { return l.rel === 'alternate'; })[0];
          if (!link) return;
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = link.href; a.target = '_blank'; a.rel = 'noopener';
          a.textContent = (entry.title && entry.title.$t || '').trim();
          var time = document.createElement('time');
          var iso = entry.published && entry.published.$t;
          if (iso) {
            time.dateTime = iso.slice(0, 10);
            time.textContent = new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
          li.appendChild(a);
          li.appendChild(time);
          frag.appendChild(li);
        });
        if (frag.childNodes.length) { blogList.innerHTML = ''; blogList.appendChild(frag); }
      } catch (e) { /* keep the static list */ }
    };
    var s = document.createElement('script');
    s.src = 'https://astrologs3142.blogspot.com/feeds/posts/default?alt=json-in-script&max-results=3&callback=__renderBlog';
    s.async = true;
    document.body.appendChild(s);
  }


  /* ---------------------------------------------------------------
     Scroll reveal. Only elements that start below the fold are
     hidden, so nothing flashes and nothing stays hidden without JS.
  ---------------------------------------------------------------- */
  var revealGroups = [
    ['.section h2, .feature-title, .section-intro, .meta-line', ''],
    ['.prose, .interests, .portrait, .paper-card, .side-project, .results h4, .pipeline h4, .sed-card, .blog, .coursework, .gallery-title', ''],
    ['.interest-list li, .steps li, .result-list li, .project, .pub-list li, .plain-list li, .semesters > li, .course-feature, .edu-list li, .skills div, .contact-links li, .blog-list li', 'stagger'],
    ['.fig, .g-item', 'scale-stagger'],
    ['.quote-panel blockquote, .quote-panel figcaption', 'fade'],
    ['.andromeda-quote blockquote, .andromeda-quote figcaption', 'fade']
  ];
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    var fold = window.innerHeight;
    revealGroups.forEach(function (group) {
      var els = document.querySelectorAll(group[0]);
      var lastParent = null, idx = 0;
      Array.prototype.forEach.call(els, function (el) {
        if (el.getBoundingClientRect().top < fold) return;
        el.classList.add('reveal');
        if (group[1].indexOf('scale') === 0) el.classList.add('reveal-scale');
        if (group[1] === 'left') el.classList.add('reveal-left');
        if (group[1] === 'fade') el.classList.add('reveal-fade');
        if (group[1].indexOf('stagger') !== -1) {
          idx = el.parentElement === lastParent ? idx + 1 : 0;
          lastParent = el.parentElement;
          el.style.setProperty('--rd', Math.min(idx, 6) * 80 + 'ms');
        }
        revealObserver.observe(el);
      });
    });
  }

  /* Count the selection numbers up when they come into view */
  function countUp(el) {
    var target = +el.dataset.count, start = null, dur = 1400;
    function step(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * e).toLocaleString('en-US');
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('.steps .n');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countObserver.unobserve(entry.target);
        countUp(entry.target);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(counters, function (el) {
      var value = parseInt(el.textContent.replace(/,/g, ''), 10);
      if (!value || el.getBoundingClientRect().top < window.innerHeight) return;
      el.dataset.count = value;
      el.setAttribute('aria-label', value.toLocaleString('en-US'));
      countObserver.observe(el);
    });
  }


  /* ---------------------------------------------------------------
     "See the sky above you": uses the browser's location, which
     stays on the device.
  ---------------------------------------------------------------- */
  var hereBtn = document.getElementById('sky-here');
  if (hereBtn) {
    var usingHere = false;
    var hereLabel = hereBtn.querySelector('span');
    if (!('geolocation' in navigator)) hereBtn.hidden = true;
    hereBtn.addEventListener('click', function () {
      if (!window.Sky) return;
      if (usingHere) {
        window.Sky.useMumbai(); usingHere = false;
        hereLabel.textContent = 'See the sky above you'; hereBtn.setAttribute('aria-pressed', 'false');
        return;
      }
      hereLabel.textContent = 'Finding you…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        // Rounded to about 10 km: plenty for the sky, and it never leaves the page
        var lat = Math.round(pos.coords.latitude * 10) / 10, lon = Math.round(pos.coords.longitude * 10) / 10;
        window.Sky.useLocation(lat, lon); usingHere = true;
        hereLabel.textContent = 'Back to Mumbai'; hereBtn.setAttribute('aria-pressed', 'true');
      }, function () {
        hereLabel.textContent = 'Location not available';
        setTimeout(function () { hereLabel.textContent = 'See the sky above you'; }, 2500);
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    });
  }

  /* ---------------------------------------------------------------
     Scroll progress bar and the Andromeda parallax
  ---------------------------------------------------------------- */
  var bar = document.querySelector('.progress span');
  var parallax = Array.prototype.map.call(document.querySelectorAll('.andromeda, .quote-panel'), function (box) {
    return { box: box, img: box.querySelector('.andromeda-img, .quote-panel-img') };
  });
  var scrollTick = false;
  function onScrollFrame() {
    scrollTick = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
    // Safety net for fast scrolling: reveal anything that has reached or passed the viewport
    var pending = document.querySelectorAll('.reveal:not(.in)');
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].getBoundingClientRect().top < window.innerHeight * 0.92) pending[i].classList.add('in');
    }
    if (!reduceMotion.matches) {
      parallax.forEach(function (item) {
        var r = item.box.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        var prog = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        item.img.style.transform = 'translate3d(0,' + (prog * -50).toFixed(1) + 'px,0) scale(1.04)';
      });
    }
  }
  window.addEventListener('scroll', function () {
    if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();


  /* ---------------------------------------------------------------
     A faint star field behind the whole page. It stays fixed while
     the content scrolls over it.
  ---------------------------------------------------------------- */
  var pageStars = document.querySelector('.page-stars');
  function drawPageStars() {
    if (!pageStars || !pageStars.getContext) return;
    var c = pageStars.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = pageStars.clientWidth, h = pageStars.clientHeight;
    pageStars.width = Math.round(w * dpr); pageStars.height = Math.round(h * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var dark = currentTheme() === 'dark';
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var n = Math.round(w * h / 3200);
    for (var i = 0; i < n; i++) {
      var x = rnd() * w, y = rnd() * h, m = rnd(), r = 0.35 + Math.pow(m, 6) * 1.6;
      var a = dark ? 0.12 + m * 0.5 : 0.08 + m * 0.22;
      var warm = rnd() < 0.3;
      c.fillStyle = dark ? (warm ? 'rgba(255,220,190,' : 'rgba(215,226,255,') + a + ')' : (warm ? 'rgba(150,100,40,' : 'rgba(50,80,140,') + a + ')';
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    }
  }
  drawPageStars();
  var psTimer;
  window.addEventListener('resize', function () { clearTimeout(psTimer); psTimer = setTimeout(drawPageStars, 200); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawPageStars);

  /* ---------------------------------------------------------------
     Smooth, momentum scrolling for mouse and trackpad (Lenis).
     Touch devices and reduced-motion users keep native scrolling.
  ---------------------------------------------------------------- */
  if (window.Lenis && !reduceMotion.matches && window.matchMedia('(pointer: fine)').matches) {
    try {
      new window.Lenis({ autoRaf: true, lerp: 0.11, anchors: { offset: -72 } });
    } catch (e) { /* native scrolling still works */ }
  }

  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
