/* ------------------------------------------------------------------
   About: the portrait at the centre of an engraved solar system.

   Drawn in a single ink colour, like an old engraving: black on the
   paper theme, white on the dark theme. Dash-dot orbits circle the
   portrait and six line-art planets revolve slowly, shaded with
   engraved hatching as if lit from the upper left.

   The orbits are spaced from the planets' sizes (the Moon and
   Saturn's rings included), so neighbours pass each other with a
   clear gap and can never overlap.

   When the section scrolls into view the photo grows from a point,
   then the planets pop out from behind it one by one, each pushing
   its orbit out with it, and once in place they begin to revolve.
------------------------------------------------------------------- */
(function () {
  'use strict';

  var stage = document.querySelector('.orbit-stage');
  if (!stage) return;
  var canvas = stage.querySelector('.orbit-canvas');
  var portrait = stage.querySelector('.portrait');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var TAU = Math.PI * 2;

  // size = relative radius, period = seconds for one orbit (inner planets are faster, as in Kepler's third law)
  var PLANETS = [
    { kind: 'craters', size: 0.55, period: 80, start: 0.4 },     // Mercury
    { kind: 'swirl', size: 0.8, period: 120, start: 2.6 },        // Venus
    { kind: 'earth', size: 0.85, period: 165, start: 4.9, moon: true },
    { kind: 'stipple', size: 0.65, period: 225, start: 1.5 },     // Mars
    { kind: 'bands', size: 1.6, period: 320, start: 3.7 },        // Jupiter
    { kind: 'saturn', size: 1.25, period: 440, start: 5.6 }       // Saturn
  ];
  var MOON_ORBIT = 1.55, MOON_SIZE = 0.27, MOON_PERIOD = 28;   // relative to Earth's radius
  var RING = [2.1, 1.88, 1.62, 1.4];                           // Saturn's rings, relative to its radius

  var CS = 0, R = 0, PR = 0, dpr = 1, ink = '#1E1A13', paper = '#F3ECDA';
  var rimSprite = null;
  var LIGHT = Math.PI * 0.25;   // shading as if lit from the upper left
  var started = false, t0 = 0, visible = false, running = false, raf = 0;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeOutBack(t, c1) { var c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  // Time spent revolving, easing in so a planet starts moving gently rather than all at once
  function spinUp(tau) { var k = 2; return tau <= 0 ? 0 : tau - k * (1 - Math.exp(-tau / k)); }
  function isDark() {
    var d = document.documentElement.dataset.theme;
    return d ? d === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  // Seeded random numbers, so each planet always looks the same
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function sprite(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    return { c: c, g: g, w: w, h: h };
  }

  // ---------------------------------------------------------------
  // Engraved textures
  // ---------------------------------------------------------------
  function spiral(g, x, y, size, turns, phase, dir) {
    g.beginPath();
    for (var i = 0; i <= 36; i++) {
      var t = i / 36, a = phase + dir * t * turns * TAU, rr = size * t;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.stroke();
  }
  function blobPoints(x, y, size, rand) {
    var pts = [];
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * TAU, rr = size * (0.6 + rand() * 0.55);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]);
    }
    return pts;
  }
  function blob(g, pts) {
    var n = pts.length;
    g.beginPath();
    var m0 = [(pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2];
    g.moveTo(m0[0], m0[1]);
    for (var j = 0; j < n; j++) {
      var p = pts[j], q = pts[(j + 1) % n];
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.closePath();
  }
  function hatch(g, x, y, r, gap, angle) {
    g.save(); g.translate(x, y); g.rotate(angle);
    g.beginPath();
    for (var k = -r; k <= r; k += gap) { g.moveTo(-r, k); g.lineTo(r, k); }
    g.stroke(); g.restore();
  }

  function paintTexture(g, x, y, r, kind, rand) {
    var lw = Math.max(0.55, r * 0.045);
    g.lineWidth = lw; g.strokeStyle = ink; g.fillStyle = ink;
    if (kind === 'swirl') {
      var n = Math.max(3, Math.round(r * r / 14));
      for (var i = 0; i < n; i++) {
        var a = rand() * TAU, d = Math.sqrt(rand()) * r * 0.9;
        spiral(g, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.18 + rand() * 0.2), 1.6 + rand(), rand() * TAU, rand() < 0.5 ? 1 : -1);
      }
    } else if (kind === 'bands' || kind === 'saturn') {
      var bands = kind === 'bands' ? 7 : 5;
      for (var b = 1; b < bands; b++) {
        var yy = y - r + (2 * r) * b / bands + (rand() - 0.5) * r * 0.08;
        g.beginPath();
        for (var s = 0; s <= 30; s++) {
          var xx = x - r + 2 * r * s / 30;
          var py = yy + Math.sin(s * 0.9 + b * 1.7) * r * 0.035;
          if (s) g.lineTo(xx, py); else g.moveTo(xx, py);
        }
        g.stroke();
      }
      var curls = kind === 'bands' ? Math.round(r * 0.8) : Math.round(r * 0.4);
      for (var c = 0; c < curls; c++) {
        var cx = x + (rand() - 0.5) * 1.8 * r, cy = y + (rand() - 0.5) * 1.6 * r;
        spiral(g, cx, cy, r * (0.08 + rand() * 0.1), 1.3, rand() * TAU, rand() < 0.5 ? 1 : -1);
      }
      if (kind === 'bands') {       // the Great Red Spot, as an engraved oval
        g.beginPath(); g.ellipse(x + r * 0.3, y + r * 0.38, r * 0.24, r * 0.13, 0, 0, TAU); g.stroke();
        g.beginPath(); g.ellipse(x + r * 0.3, y + r * 0.38, r * 0.13, r * 0.06, 0, 0, TAU); g.stroke();
      }
    } else if (kind === 'craters') {
      var cn = Math.max(4, Math.round(r * 0.9));
      for (var k = 0; k < cn; k++) {
        var ca = rand() * TAU, cd = Math.sqrt(rand()) * r * 0.85, cr = r * (0.08 + rand() * 0.16);
        var kx = x + Math.cos(ca) * cd, ky = y + Math.sin(ca) * cd;
        g.beginPath(); g.arc(kx, ky, cr, 0, TAU); g.stroke();
        g.beginPath(); g.arc(kx + cr * 0.2, ky + cr * 0.2, cr * 0.7, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
      }
      for (var sd = 0; sd < r * 3; sd++) {
        var sa = rand() * TAU, sdd = Math.sqrt(rand()) * r;
        g.fillRect(x + Math.cos(sa) * sdd, y + Math.sin(sa) * sdd, lw * 0.9, lw * 0.9);
      }
    } else if (kind === 'stipple') {
      for (var st = 0; st < r * r * 1.1; st++) {
        var pa = rand() * TAU, pd = Math.sqrt(rand()) * r;
        var px = x + Math.cos(pa) * pd, py2 = y + Math.sin(pa) * pd;
        if (py2 < y - r * 0.72) continue;                  // leave the polar cap clean
        g.beginPath(); g.arc(px, py2, lw * (0.4 + rand() * 0.5), 0, TAU); g.fill();
      }
      g.beginPath(); g.arc(x, y - r * 0.2, r * 0.95, Math.PI * 1.22, Math.PI * 1.78); g.stroke();   // edge of the cap
      for (var mk = 0; mk < 3; mk++) {
        var ma = rand() * TAU, md = rand() * r * 0.6;
        g.beginPath(); g.arc(x + Math.cos(ma) * md, y + Math.sin(ma) * md, r * 0.14, 0, TAU); g.stroke();
      }
    } else if (kind === 'earth') {
      // Oceans: short wave strokes. Continents: outlined and hatched.
      for (var w = 0; w < r * 1.2; w++) {
        var wx = x + (rand() - 0.5) * 1.8 * r, wy = y + (rand() - 0.5) * 1.8 * r, wl = r * 0.16;
        g.beginPath(); g.moveTo(wx - wl, wy); g.quadraticCurveTo(wx - wl / 2, wy - wl * 0.35, wx, wy); g.quadraticCurveTo(wx + wl / 2, wy + wl * 0.35, wx + wl, wy); g.stroke();
      }
      [[-0.35, -0.3, 0.42], [0.35, 0.05, 0.5], [0.1, 0.6, 0.22]].forEach(function (cn) {
        var pts = blobPoints(x + cn[0] * r, y + cn[1] * r, cn[2] * r, rand);
        g.save();
        blob(g, pts); g.fillStyle = paper; g.fill(); g.clip();
        hatch(g, x, y, r, Math.max(1.6, r * 0.12), -0.7);
        g.restore();
        blob(g, pts); g.stroke();
      });
      g.beginPath(); g.ellipse(x, y - r * 0.92, r * 0.45, r * 0.12, 0, 0, TAU); g.stroke();   // polar ice
    }
  }

  function paintPlanet(p, i) {
    var r = p.rp, rand = rng(101 + i * 7919);
    var ring = p.kind === 'saturn';
    var w = ring ? r * RING[0] * 2 + 8 : r * 2 + 6, h = ring ? r * 2.4 + 6 : r * 2 + 6;
    var s = sprite(w, h), g = s.g, x = w / 2, y = h / 2;
    var tilt = -0.32;
    function ringPath(front) {
      g.save(); g.translate(x, y); g.rotate(tilt);
      RING.forEach(function (k, i) {
        g.lineWidth = i === 1 ? Math.max(0.9, r * 0.07) : Math.max(0.55, r * 0.04);
        g.beginPath(); g.ellipse(0, 0, r * k, r * k * 0.28, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
      });
      g.restore();
    }
    if (ring) {
      // Paper fill between the rings hides the orbit lines behind them
      g.save(); g.translate(x, y); g.rotate(tilt);
      g.beginPath(); g.ellipse(0, 0, r * RING[0], r * RING[0] * 0.28, 0, 0, TAU); g.ellipse(0, 0, r * RING[3], r * RING[3] * 0.28, 0, 0, TAU);
      g.fillStyle = paper; g.fill('evenodd'); g.restore();
      g.strokeStyle = ink; ringPath(false);
    }
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = paper; g.fill();
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    paintTexture(g, x, y, r, p.kind, rand);
    g.restore();
    g.strokeStyle = ink; g.lineWidth = Math.max(0.9, r * 0.06);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    if (ring) { g.strokeStyle = ink; ringPath(true); }
    p.sprite = s;

    // Shadow side: engraved hatching on the +x side (turned to face away from the light when drawn)
    var sh = sprite(r * 2 + 6, r * 2 + 6), hg = sh.g, hx = sh.w / 2, hy = sh.h / 2;
    hg.save();
    hg.beginPath(); hg.arc(hx, hy, r, 0, TAU); hg.clip();
    hg.beginPath(); hg.rect(0, 0, sh.w, sh.h); hg.arc(hx - r * 0.55, hy, r * 1.02, 0, TAU, true); hg.clip('evenodd');
    hg.strokeStyle = ink; hg.lineWidth = Math.max(0.5, r * 0.045);
    hatch(hg, hx, hy, r * 1.5, Math.max(1.5, r * 0.11), 0.9);
    hatch(hg, hx + r * 0.35, hy, r * 1.5, Math.max(2.2, r * 0.16), -0.9);
    hg.restore();
    p.shade = sh;
  }

  function paintRim() {
    // A thin double rim around the photo
    var s = sprite(CS, CS), g = s.g, c = CS / 2;
    g.strokeStyle = ink;
    g.globalAlpha = 0.9; g.lineWidth = 1.2;
    g.beginPath(); g.arc(c, c, PR + 3, 0, TAU); g.stroke();
    g.globalAlpha = 0.55; g.lineWidth = 0.7;
    g.beginPath(); g.arc(c, c, PR + 7.5, 0, TAU); g.stroke();
    g.globalAlpha = 1;
    rimSprite = s;
  }

  function paintAll() {
    var dark = isDark();
    ink = dark ? '#F2F0EA' : '#1E1A13';
    paper = (getComputedStyle(document.documentElement).getPropertyValue('--bg') || '').trim() || (dark ? '#000000' : '#F3ECDA');
    paintRim();
    PLANETS.forEach(paintPlanet);
  }

  // How far a planet reaches from its orbit, its moon or rings included (in units of its radius)
  function reach(p) { return p.moon ? MOON_ORBIT + MOON_SIZE : p.kind === 'saturn' ? RING[0] : 1; }

  // Fit the six orbits between the photo's rim and the edge of the canvas. Each orbit sits
  // a clear gap beyond everything the planet inside it can reach, so no two ever touch.
  function layout() {
    var inner = PR + 13, outer = CS / 2 - 3;
    var gap = Math.max(3, R * 0.016), span = 0;
    PLANETS.forEach(function (p) { span += 2 * p.size * reach(p); });
    var unit = Math.max(1, (outer - inner - gap * (PLANETS.length - 1)) / span);
    var at = inner;
    PLANETS.forEach(function (p) {
      var out = p.size * reach(p) * unit;
      p.rp = p.size * unit;
      p.orbit = at + out;
      at = p.orbit + out + gap;
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    CS = canvas.clientWidth;
    R = stage.clientWidth / 2;
    PR = portrait.offsetWidth / 2;
    canvas.width = Math.round(CS * dpr); canvas.height = Math.round(CS * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    paintAll();
  }

  // ---------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------
  var PHOTO = 0.9;                  // seconds for the photo to grow
  var POP = 0.55, STAGGER = 0.16;   // when the first planet pops out, and the gap between planets
  var FLY = 1.1;                    // seconds for a planet to reach its orbit

  function draw(now) {
    if (!CS) return;
    ctx.clearRect(0, 0, CS, CS);
    var t = started ? (now - t0) / 1000 : 0;
    if (reduceMotion.matches && started) t = 10;
    var c = CS / 2;

    // 1. The photo grows from a point, overshooting a touch
    var m = started ? easeOutBack(clamp01(t / PHOTO), 1.3) : 0;
    portrait.style.setProperty('--ps', m.toFixed(4));
    if (!started) return;

    // 2. The rim grows with it
    if (m > 0) {
      ctx.save();
      ctx.globalAlpha = clamp01(m);
      ctx.translate(c, c); ctx.scale(m, m);
      ctx.drawImage(rimSprite.c, -c, -c, CS, CS);
      ctx.restore();
    }

    // 3. Planets pop out from behind the photo, each pushing its orbit out with it, then revolve
    var live = [];
    PLANETS.forEach(function (p, i) {
      var q = clamp01((t - POP - i * STAGGER) / FLY);
      if (q > 0) live.push({ p: p, q: q, d: lerp(PR * 0.3, p.orbit, easeOutBack(q, 1.1)),
        tau: reduceMotion.matches ? 0 : spinUp(t - POP - i * STAGGER - FLY) });
    });
    // Orbits first, so a ring on its way out never crosses over a planet
    ctx.strokeStyle = ink; ctx.lineWidth = 0.9;
    ctx.setLineDash([12, 5, 2.5, 5]);
    live.forEach(function (o) {
      ctx.globalAlpha = 0.55 * clamp01(o.q * 2);
      ctx.beginPath(); ctx.arc(c, c, o.d, 0, TAU); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    live.forEach(function (o) {
      var p = o.p, d = o.d, tau = o.tau;
      var sc = lerp(0.35, 1, easeOutCubic(o.q));
      var ang = p.start + tau * TAU / p.period;
      var x = c + Math.cos(ang) * d, y = c + Math.sin(ang) * d;
      ctx.save();
      ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.drawImage(p.sprite.c, -p.sprite.w / 2, -p.sprite.h / 2, p.sprite.w, p.sprite.h);
      ctx.rotate(LIGHT);
      ctx.drawImage(p.shade.c, -p.shade.w / 2, -p.shade.h / 2, p.shade.w, p.shade.h);
      ctx.restore();
      if (p.moon) {
        var ma = -0.6 + tau * TAU / MOON_PERIOD, mr = p.rp * MOON_ORBIT * sc;
        var mx = x + Math.cos(ma) * mr, my = y + Math.sin(ma) * mr, rr = Math.max(1.2, p.rp * MOON_SIZE) * sc;
        ctx.fillStyle = paper; ctx.strokeStyle = ink; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(mx, my, rr, 0, TAU); ctx.fill(); ctx.stroke();
      }
    });
  }

  function loop(now) { draw(now); if (running) raf = requestAnimationFrame(loop); }
  function update() {
    var should = visible && started && !document.hidden && !reduceMotion.matches;
    if (should && !running) { running = true; raf = requestAnimationFrame(loop); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    if (!should) draw(performance.now());
  }
  function start() { if (started) return; started = true; t0 = performance.now(); update(); }

  resize();
  draw(performance.now());
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(performance.now()); }, 120); });
  document.addEventListener('visibilitychange', update);
  // Repaint in the new ink when the theme changes
  new MutationObserver(function () { paintAll(); draw(performance.now()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { paintAll(); draw(performance.now()); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible = e.isIntersecting;
        if (e.isIntersecting && e.intersectionRatio >= 0.3) start();
        update();
      });
    }, { threshold: [0, 0.3] }).observe(stage);
  } else {
    start();
  }
})();
