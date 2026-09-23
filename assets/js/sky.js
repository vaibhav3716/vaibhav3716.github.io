/* ------------------------------------------------------------------
   Hero sky: a small planetarium for Mumbai (19.08° N).

   Light theme: sunrise on 16 December, with the Sun's path across the
   sky drawn as a dashed line.
   Dark theme: the evening of 15 December, looking east: Orion rising,
   Taurus and the Pleiades, Sirius just clearing the horizon, and the
   Andromeda Galaxy high in the north.

   Switching theme runs the Earth's rotation forward in time, so the
   whole sky turns about the celestial pole between the two scenes.
   Star positions are J2000 catalogue values; the view uses a
   stereographic projection, as planetarium software does.
------------------------------------------------------------------- */
(function () {
  'use strict';

  var canvas = document.querySelector('.sky');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var D2R = Math.PI / 180;
  var LAT = 19.08 * D2R;
  var SUN = { ra: 17.55, dec: -23.3 };      // mid-December
  var LST_DAY = 12.45;                     // 16 Dec, about 7:25 am IST: Sun ~5° up
  var LST_NIGHT = 1.8;                     // 15 Dec, about 8:50 pm IST

  // name, RA (h), Dec (deg), V mag, colour
  var STARS = {
    betelgeuse: [5.919, 7.407, 0.50, '#FFB07A'], rigel: [5.242, -8.202, 0.13, '#CFDBFF'],
    bellatrix: [5.419, 6.350, 1.64, '#D6E0FF'], saiph: [5.796, -9.670, 2.06, '#D6E0FF'],
    alnitak: [5.679, -1.943, 1.77, '#D6E0FF'], alnilam: [5.604, -1.202, 1.69, '#D6E0FF'],
    mintaka: [5.533, -0.299, 2.23, '#D6E0FF'], meissa: [5.586, 9.934, 3.39, '#DDE5FF'],
    pi3: [4.830, 6.961, 3.19, '#FFF6E8'], pi2: [4.843, 8.900, 4.35, '#FFFFFF'],
    pi4: [4.853, 5.605, 3.68, '#DDE5FF'], pi5: [4.904, 2.440, 3.70, '#DDE5FF'],
    mu_ori: [6.040, 9.648, 4.10, '#FFFFFF'], xi_ori: [6.199, 14.21, 4.45, '#DDE5FF'],
    nu_ori: [6.126, 14.77, 4.40, '#DDE5FF'], chi1: [5.906, 20.28, 4.40, '#FFF3DD'],
    aldebaran: [4.599, 16.509, 0.85, '#FFB97F'], elnath: [5.438, 28.608, 1.65, '#E3EAFF'],
    zeta_tau: [5.628, 21.143, 3.00, '#DDE5FF'], theta2_tau: [4.478, 15.87, 3.40, '#FFFFFF'],
    gamma_tau: [4.330, 15.628, 3.65, '#FFE2B8'], delta_tau: [4.382, 17.54, 3.76, '#FFE2B8'],
    eps_tau: [4.477, 19.18, 3.53, '#FFD9A6'], lambda_tau: [4.011, 12.49, 3.40, '#DDE5FF'],
    alcyone: [3.791, 24.105, 2.87, '#CFDBFF'], atlas: [3.819, 24.053, 3.60, '#CFDBFF'],
    electra: [3.747, 24.113, 3.70, '#CFDBFF'], maia: [3.764, 24.368, 3.90, '#CFDBFF'],
    merope: [3.772, 23.948, 4.10, '#CFDBFF'], taygeta: [3.753, 24.467, 4.30, '#CFDBFF'],
    sirius: [6.752, -16.716, -1.46, '#E4ECFF'], mirzam: [6.378, -17.956, 1.98, '#D6E0FF'],
    adhara: [6.977, -28.972, 1.50, '#D6E0FF'], wezen: [7.140, -26.393, 1.83, '#FFF3DD'],
    aludra: [7.402, -29.303, 2.45, '#D6E0FF'],
    procyon: [7.655, 5.225, 0.34, '#FFF6E6'], gomeisa: [7.453, 8.289, 2.90, '#D6E0FF'],
    castor: [7.577, 31.888, 1.58, '#E8EEFF'], pollux: [7.755, 28.026, 1.14, '#FFD29A'],
    alhena: [6.629, 16.399, 1.90, '#E8EEFF'],
    capella: [5.278, 45.998, 0.08, '#FFF0C8'], menkalinan: [5.992, 44.948, 1.90, '#EEF2FF'],
    theta_aur: [5.995, 37.213, 2.60, '#EEF2FF'], iota_aur: [4.950, 33.166, 2.70, '#FFC98F'],
    eps_aur: [5.033, 43.823, 3.00, '#FFF6E6'],
    mirfak: [3.405, 49.861, 1.80, '#FFF6E6'], algol: [3.136, 40.956, 2.10, '#DDE5FF'],
    gamma_per: [3.080, 53.506, 2.90, '#FFF0C8'], delta_per: [3.715, 47.788, 3.00, '#DDE5FF'],
    eps_per: [3.964, 40.011, 2.90, '#DDE5FF'], zeta_per: [3.902, 31.884, 2.85, '#DDE5FF'],
    alpheratz: [0.140, 29.090, 2.06, '#DDE5FF'], delta_and: [0.655, 30.861, 3.27, '#FFD29A'],
    mirach: [1.162, 35.621, 2.05, '#FFB97F'], almach: [2.065, 42.330, 2.10, '#FFC98F'],
    mu_and: [0.946, 38.500, 3.87, '#FFFFFF'], nu_and: [0.830, 41.079, 4.50, '#DDE5FF'],
    markab: [23.079, 15.205, 2.48, '#DDE5FF'], scheat: [23.063, 28.083, 2.42, '#FFB07A'],
    algenib: [0.221, 15.184, 2.83, '#D6E0FF'],
    schedar: [0.675, 56.537, 2.24, '#FFC98F'], caph: [0.153, 59.150, 2.27, '#FFF6E6'],
    gamma_cas: [0.945, 60.717, 2.47, '#D6E0FF'], ruchbah: [1.430, 60.235, 2.68, '#EEF2FF'],
    segin: [1.907, 63.670, 3.37, '#D6E0FF'],
    polaris: [2.530, 89.264, 1.98, '#FFF3DD'],
    keid: [4.254, -7.653, 4.43, '#FFE2B8'],
    hamal: [2.120, 23.462, 2.00, '#FFC98F'], sheratan: [1.911, 20.808, 2.64, '#EEF2FF'],
    menkar: [3.038, 4.090, 2.54, '#FFB97F']
  };

  var LINES = [
    // Orion
    ['betelgeuse', 'meissa'], ['meissa', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'],
    ['alnitak', 'alnilam'], ['alnilam', 'mintaka'], ['alnitak', 'saiph'], ['mintaka', 'rigel'],
    ['bellatrix', 'pi3'], ['pi2', 'pi3'], ['pi3', 'pi4'], ['pi4', 'pi5'],
    ['betelgeuse', 'mu_ori'], ['mu_ori', 'xi_ori'], ['xi_ori', 'nu_ori'], ['nu_ori', 'chi1'],
    // Taurus
    ['zeta_tau', 'aldebaran'], ['aldebaran', 'theta2_tau'], ['theta2_tau', 'gamma_tau'], ['gamma_tau', 'delta_tau'],
    ['delta_tau', 'eps_tau'], ['eps_tau', 'elnath'], ['gamma_tau', 'lambda_tau'],
    // Canis Major and Minor
    ['mirzam', 'sirius'], ['sirius', 'wezen'], ['wezen', 'adhara'], ['wezen', 'aludra'],
    ['procyon', 'gomeisa'],
    // Gemini (just the twins)
    ['castor', 'pollux'],
    // Auriga
    ['capella', 'menkalinan'], ['menkalinan', 'theta_aur'], ['theta_aur', 'elnath'], ['elnath', 'iota_aur'],
    ['iota_aur', 'eps_aur'], ['eps_aur', 'capella'],
    // Perseus
    ['gamma_per', 'mirfak'], ['mirfak', 'delta_per'], ['delta_per', 'eps_per'], ['eps_per', 'zeta_per'], ['mirfak', 'algol'],
    // Andromeda and the Square of Pegasus
    ['alpheratz', 'delta_and'], ['delta_and', 'mirach'], ['mirach', 'almach'], ['mirach', 'mu_and'], ['mu_and', 'nu_and'],
    ['alpheratz', 'scheat'], ['scheat', 'markab'], ['markab', 'algenib'], ['algenib', 'alpheratz'],
    // Cassiopeia
    ['caph', 'schedar'], ['schedar', 'gamma_cas'], ['gamma_cas', 'ruchbah'], ['ruchbah', 'segin'],
    // Aries
    ['hamal', 'sheratan']
  ];

  // Labels. `kind`: 'con' = constellation name, 'obj' = object note
  var LABELS = [
    { at: [5.60, 3.5], text: 'Orion', kind: 'con' },
    { at: [4.45, 22.5], text: 'Taurus', kind: 'con' },
    { at: [3.55, 53.5], text: 'Perseus', kind: 'con' },
    { at: [1.00, 64.5], text: 'Cassiopeia', kind: 'con' },
    { at: [5.60, 40.0], text: 'Auriga', kind: 'con' },
    { at: [3.791, 24.105], text: 'Pleiades', kind: 'obj', dx: 12, dy: -10 },
    { at: [5.588, -5.39], text: 'Orion Nebula', kind: 'obj', dx: 12, dy: 4 },
    { at: [0.712, 41.269], text: 'Andromeda Galaxy', sub: '2.5 million light-years away', kind: 'obj', dx: 14, dy: -6 },
    { at: [6.752, -16.716], text: 'Sirius', sub: 'its companion, Sirius B, is a white dwarf', kind: 'obj', dx: 14, dy: -4 },
    { at: [4.254, -7.653], text: '40 Eridani', sub: 'home of the first white dwarf found', kind: 'obj', dx: 12, dy: 18, side: 'left' },
    { at: [3.136, 40.956], text: 'Algol', sub: 'an eclipsing binary', kind: 'obj', dx: 10, dy: 12 }
  ];

  // Deterministic random numbers so the faint field is identical on every load
  var seed = 7;
  function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var FAINT = [];
  for (var i = 0; i < 900; i++) {
    FAINT.push({ ra: rand() * 24, dec: Math.asin(2 * rand() - 1) / D2R, mag: 4.3 + rand() * 2.2, tw: rand() * 6.28, sp: 0.4 + rand() });
  }

  // Galactic equator sampled in (RA, Dec), for a faint Milky Way band
  var MILKY = [];
  (function () {
    var raNGP = 192.859 * D2R, decNGP = 27.128 * D2R, lNCP = 122.932 * D2R;
    for (var l = 0; l < 360; l += 2.5) {
      var lr = l * D2R, b = 0;
      var sd = Math.sin(decNGP) * Math.sin(b) + Math.cos(decNGP) * Math.cos(b) * Math.cos(lNCP - lr);
      var dec = Math.asin(sd);
      var y = Math.cos(b) * Math.sin(lNCP - lr);
      var x = Math.cos(decNGP) * Math.sin(b) - Math.sin(decNGP) * Math.cos(b) * Math.cos(lNCP - lr);
      var ra = (raNGP + Math.atan2(y, x)) / D2R / 15;
      MILKY.push({ ra: (ra + 24) % 24, dec: dec / D2R, w: 0.45 + 0.35 * Math.abs(Math.cos(lr / 2)) + 0.2 * Math.sin(lr * 7) });
    }
  })();

  // ---------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------
  function horizontal(ra, dec, lst) {
    // Unit vector in (East, North, Up) for a star at hour angle H
    var H = (lst - ra) * 15 * D2R, d = dec * D2R;
    var sinAlt = Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H);
    var alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    var az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(LAT) - Math.cos(d) * Math.cos(H) * Math.sin(LAT));
    var ca = Math.cos(alt);
    return [ca * Math.sin(az), ca * Math.cos(az), Math.sin(alt)];
  }

  var view = { c: null, r: null, u: null, cx: 0, cy: 0, k: 1, az0: 0 };
  // Framing: centre of view (azimuth, altitude), its place on screen, and scale.
  // Night looks east at Orion and Andromeda; day pans south to show the Sun's whole arc.
  var FRAMES = {
    night:  { az: 60,  alt: 40, cx: 0.64, cy: 0.50, kW: 0.27, kH: 0.45 },
    day:    { az: 160, alt: 2,  cx: 0.77, cy: 0.80, kW: 0.23, kH: 0.40 },
    nightN: { az: 84,  alt: 14, cx: 0.50, cy: 0.86, kW: 0.95, kH: 0.40 },
    dayN:   { az: 140, alt: 2,  cx: 0.66, cy: 0.93, kW: 0.75, kH: 0.26 }
  };
  var dayMix = 0;   // 0 = night framing, 1 = day framing
  function lerp(a, b, t) { return a + (b - a) * t; }
  function setView() {
    var narrow = W < 720;
    var n = narrow ? FRAMES.nightN : FRAMES.night, d = narrow ? FRAMES.dayN : FRAMES.day, t = dayMix;
    var az0 = lerp(n.az, d.az, t) * D2R, alt0 = lerp(n.alt, d.alt, t) * D2R;
    view.az0 = az0;
    view.c = [Math.cos(alt0) * Math.sin(az0), Math.cos(alt0) * Math.cos(az0), Math.sin(alt0)];
    view.r = [Math.cos(az0), -Math.sin(az0), 0];
    view.u = [-Math.sin(alt0) * Math.sin(az0), -Math.sin(alt0) * Math.cos(az0), Math.cos(alt0)];
    view.cx = W * lerp(n.cx, d.cx, t);
    view.cy = H * lerp(n.cy, d.cy, t);
    view.k = Math.max(W * lerp(n.kW, d.kW, t), H * lerp(n.kH, d.kH, t));
  }
  function project(v) {
    var dc = v[0] * view.c[0] + v[1] * view.c[1] + v[2] * view.c[2];
    if (dc < -0.35) return null;
    var f = 2 / (1 + dc);
    var dr = v[0] * view.r[0] + v[1] * view.r[1] + v[2] * view.r[2];
    var du = v[0] * view.u[0] + v[1] * view.u[1] + v[2] * view.u[2];
    return [view.cx + view.k * f * dr, view.cy - view.k * f * du];
  }

  function sunAltitude(lst) { return Math.asin(horizontal(SUN.ra, SUN.dec, lst)[2]) / D2R; }

  // ---------------------------------------------------------------
  // Sky colour from the Sun's altitude (degrees)
  // ---------------------------------------------------------------
  var SKY_STOPS = [
    // alt, top, middle, horizon
    [-90, [6, 10, 22], [9, 15, 32], [16, 24, 46]],
    [-18, [6, 10, 22], [9, 15, 32], [16, 24, 46]],
    [-10, [10, 18, 40], [22, 34, 70], [58, 58, 92]],
    [-4, [18, 36, 74], [52, 66, 118], [180, 110, 96]],
    [2, [28, 58, 108], [86, 112, 164], [246, 170, 110]],
    [10, [38, 86, 150], [104, 152, 206], [236, 200, 160]],
    [30, [44, 104, 176], [110, 168, 224], [190, 220, 242]],
    [90, [44, 104, 176], [110, 168, 224], [190, 220, 242]]
  ];
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function skyColours(h) {
    for (var i = 1; i < SKY_STOPS.length; i++) {
      if (h <= SKY_STOPS[i][0]) {
        var a = SKY_STOPS[i - 1], b = SKY_STOPS[i], t = (h - a[0]) / (b[0] - a[0]);
        return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
      }
    }
    var l = SKY_STOPS[SKY_STOPS.length - 1];
    return [l[1], l[2], l[3]];
  }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')'; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  var W = 0, H = 0, dpr = 1;
  var lst = LST_NIGHT;
  var ground = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setView();
  }

  // A low, irregular skyline, as a height in pixels above the horizon at azimuth a (deg)
  function skyline(a) {
    var r = a * D2R;
    var h = 7 + Math.sin(r * 3 + 1) * 5 + Math.sin(r * 11 + 2) * 3 + Math.sin(r * 29) * 1.5;
    if (Math.sin(r * 57) > 0.9) h += 7;   // the odd tree
    return h * Math.min(1.4, view.k / 420);
  }

  // Horizon: the half of the altitude-0 circle that faces the viewer
  function horizonPoints() {
    var pts = [], a0 = view.az0 / D2R;
    for (var a = a0 - 115; a <= a0 + 115; a += 1.5) {
      var p = project([Math.sin(a * D2R), Math.cos(a * D2R), 0]);
      if (p) pts.push([p[0], p[1], a]);
    }
    return pts;
  }

  function starRadius(mag) { return Math.max(0.5, 2.9 - 0.52 * mag); }

  function draw(t) {
    var h = sunAltitude(lst);
    var night = clamp01((-h - 4) / 12);        // 0 in daylight, 1 when the Sun is 16° down
    var twilight = clamp01(1 - Math.abs(h - 1) / 14);
    var cols = skyColours(h);

    if (tweenActive()) setView();
    var hpts = horizonPoints();
    var hy = project([Math.sin(view.az0), Math.cos(view.az0), 0])[1];

    // Sky gradient
    var g = ctx.createLinearGradient(0, 0, 0, Math.max(hy, H * 0.6));
    g.addColorStop(0, rgb(cols[0])); g.addColorStop(0.62, rgb(cols[1])); g.addColorStop(1, rgb(cols[2]));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Sun glow first, so stars and lines sit on top of it
    var sunV = horizontal(SUN.ra, SUN.dec, lst);
    var sunP = project(sunV);
    if (sunP && h > -12) {
      var glowA = clamp01((h + 12) / 14);
      var rg = ctx.createRadialGradient(sunP[0], sunP[1], 0, sunP[0], sunP[1], Math.max(W, H) * 0.55);
      rg.addColorStop(0, 'rgba(255,214,150,' + 0.55 * glowA + ')');
      rg.addColorStop(0.25, 'rgba(255,170,110,' + 0.22 * glowA + ')');
      rg.addColorStop(1, 'rgba(255,150,100,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }

    // Milky Way
    if (night > 0.02) {
      for (var m = 0; m < MILKY.length; m++) {
        var mv = horizontal(MILKY[m].ra, MILKY[m].dec, lst);
        if (mv[2] < -0.05) continue;
        var mp = project(mv); if (!mp) continue;
        var rad = view.k * 0.16;
        var mg = ctx.createRadialGradient(mp[0], mp[1], 0, mp[0], mp[1], rad);
        mg.addColorStop(0, 'rgba(190,200,235,' + 0.032 * night * MILKY[m].w + ')');
        mg.addColorStop(1, 'rgba(190,200,235,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mp[0], mp[1], rad, 0, 6.2832); ctx.fill();
      }
    }

    var tw = reduceMotion.matches ? 0 : t * 0.001;

    // Faint field
    if (night > 0.02) {
      for (var f = 0; f < FAINT.length; f++) {
        var s = FAINT[f];
        var v = horizontal(s.ra, s.dec, lst);
        if (v[2] < 0) continue;
        var p = project(v); if (!p || p[0] < -4 || p[0] > W + 4 || p[1] < -4 || p[1] > H + 4) continue;
        var ext = clamp01(v[2] * 6);             // dimmer close to the horizon
        var a = (0.62 - (s.mag - 4.3) * 0.22) * night * ext * (0.82 + 0.18 * Math.sin(tw * s.sp + s.tw));
        ctx.fillStyle = 'rgba(225,232,255,' + a + ')';
        ctx.fillRect(p[0], p[1], starRadius(s.mag) * 1.1, starRadius(s.mag) * 1.1);
      }
    }

    // Project named stars once
    var pos = {};
    for (var name in STARS) {
      var st = STARS[name];
      var sv = horizontal(st[0], st[1], lst);
      pos[name] = { v: sv, p: sv[2] > -0.02 ? project(sv) : null };
    }

    // Constellation lines
    var lineA = 0.26 * night;
    if (lineA > 0.01) {
      ctx.strokeStyle = 'rgba(160,190,240,' + lineA + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      LINES.forEach(function (ln) {
        var a = pos[ln[0]], b = pos[ln[1]];
        if (!a.p || !b.p) return;
        // shorten each end so lines don't touch the stars
        var dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], len = Math.sqrt(dx * dx + dy * dy);
        if (len < 14 || len > W * 0.6) return;
        var ux = dx / len, uy = dy / len, pad = 5;
        ctx.moveTo(a.p[0] + ux * pad, a.p[1] + uy * pad);
        ctx.lineTo(b.p[0] - ux * pad, b.p[1] - uy * pad);
      });
      ctx.stroke();
    }

    // Deep-sky objects
    if (night > 0.02) {
      drawGalaxy(night);
      drawNebula(5.588, -5.39, 'rgba(255,150,190,', 0.42 * night, 0.022);
      drawNebula(3.781, 24.1, 'rgba(150,180,255,', 0.25 * night, 0.03);
    }

    // Named stars
    var starVis = Math.max(night, 0.0);
    for (var nm in STARS) {
      var ps = pos[nm]; if (!ps.p) continue;
      var sd = STARS[nm];
      var ext2 = clamp01(ps.v[2] * 8 + 0.15);
      // the brightest stars stay faintly visible into twilight
      var vis = sd[2] < 0.9 ? Math.max(starVis, clamp01((-h + 2) / 10)) : starVis;
      var a2 = clamp01(1.05 - sd[2] * 0.17) * vis * ext2 * (0.85 + 0.15 * Math.sin(tw * 1.3 + sd[0] * 7));
      if (a2 < 0.01) continue;
      var r = starRadius(sd[2]);
      if (sd[2] < 1.2) {
        var sg = ctx.createRadialGradient(ps.p[0], ps.p[1], 0, ps.p[0], ps.p[1], r * 5);
        sg.addColorStop(0, hexA(sd[3], 0.45 * a2)); sg.addColorStop(1, hexA(sd[3], 0));
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(ps.p[0], ps.p[1], r * 5, 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = hexA(sd[3], a2);
      ctx.beginPath(); ctx.arc(ps.p[0], ps.p[1], r, 0, 6.2832); ctx.fill();
    }

    // The Sun and its path
    drawSunPath(clamp01((h + 6) / 8) * (1 - night));
    if (sunP && h > -1.5) {
      var sr = Math.max(9, view.k * 0.017);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      var sgr = ctx.createRadialGradient(sunP[0], sunP[1], 0, sunP[0], sunP[1], sr * 4);
      sgr.addColorStop(0, 'rgba(255,245,225,1)');
      sgr.addColorStop(0.25, 'rgba(255,220,160,.95)');
      sgr.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = sgr; ctx.beginPath(); ctx.arc(sunP[0], sunP[1], sr * 4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#FFF6E4'; ctx.beginPath(); ctx.arc(sunP[0], sunP[1], sr, 0, 6.2832); ctx.fill();
      ctx.restore();
    }

    // Ground, drawn last so it hides anything below the horizon
    drawGround(h, twilight, night, hpts, hy);

    // Labels
    drawLabels(night, pos);
    drawSunLabel(clamp01((h + 2) / 4) * (1 - night), sunP);
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function drawGalaxy(night) {
    // M31: major axis at position angle ~35°, about 3° by 1° to the eye
    var ra = 0.712, dec = 41.269, pa = 35 * D2R, len = 1.6;
    var c = horizontal(ra, dec, lst); if (c[2] < 0) return;
    var cp = project(c); if (!cp) return;
    var ep = project(horizontal(ra + len * Math.sin(pa) / Math.cos(dec * D2R) / 15, dec + len * Math.cos(pa), lst));
    if (!ep) return;
    var dx = ep[0] - cp[0], dy = ep[1] - cp[1];
    var major = Math.max(10, Math.sqrt(dx * dx + dy * dy) * 1.4), ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(cp[0], cp[1]); ctx.rotate(ang); ctx.scale(1, 0.32);
    var gg = ctx.createRadialGradient(0, 0, 0, 0, 0, major);
    gg.addColorStop(0, 'rgba(255,236,205,' + 0.85 * night + ')');
    gg.addColorStop(0.18, 'rgba(235,220,210,' + 0.35 * night + ')');
    gg.addColorStop(1, 'rgba(200,205,235,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, major, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function drawNebula(ra, dec, colour, a, size) {
    var v = horizontal(ra, dec, lst); if (v[2] < 0.02) return;
    var p = project(v); if (!p) return;
    var r = view.k * size;
    var ng = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
    ng.addColorStop(0, colour + a + ')'); ng.addColorStop(1, colour + '0)');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
  }

  function drawSunPath(a) {
    if (a < 0.02) return;
    // The Sun's diurnal circle at its current declination
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,236,200,' + 0.75 * a + ')';
    ctx.beginPath();
    var started = false;
    for (var H = -180; H <= 180; H += 1.5) {
      var v = horizontal(SUN.ra, SUN.dec, SUN.ra + H / 15);
      var p = v[2] > -0.01 ? project(v) : null;
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGround(h, twilight, night, hpts, gy) {
    var day = clamp01((h + 8) / 14);
    var top = mix([8, 11, 20], [34, 38, 58], day);
    var bot = mix([3, 5, 10], [18, 20, 32], day);
    var gg = ctx.createLinearGradient(0, gy - 20, 0, H);
    gg.addColorStop(0, rgb(top)); gg.addColorStop(1, rgb(bot));
    ctx.fillStyle = gg;
    ctx.beginPath();
    var first = hpts[0], last = hpts[hpts.length - 1];
    // carry the ground out to both edges of the screen
    ctx.moveTo(-10, H + 10);
    ctx.lineTo(-10, Math.min(first[1], H) - skyline(first[2]));
    hpts.forEach(function (pt) { ctx.lineTo(pt[0], pt[1] - skyline(pt[2])); });
    ctx.lineTo(W + 10, Math.min(last[1], H) - skyline(last[2]));
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();
    if (twilight > 0.05) {
      ctx.strokeStyle = 'rgba(255,190,140,' + 0.35 * twilight + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      hpts.forEach(function (pt, i) { var y = pt[1] - skyline(pt[2]); if (i) ctx.lineTo(pt[0], y); else ctx.moveTo(pt[0], y); });
      ctx.stroke();
    }
  }

  var labelFont = '500 12px "IBM Plex Sans", system-ui, sans-serif';
  var labelFontCon = 'italic 400 14px "Spectral", Georgia, serif';
  function drawLabels(night, pos) {
    var a = clamp01((night - 0.35) / 0.5);
    if (a < 0.02) return;
    var narrow = W < 720;
    LABELS.forEach(function (lb) {
      if (narrow && lb.kind !== 'con') return;
      var v = horizontal(lb.at[0], lb.at[1], lst);
      if (v[2] < 0.03) return;
      var p = project(v); if (!p) return;
      var x = p[0] + (lb.dx || 0), y = p[1] + (lb.dy || 0);
      if (y < 70 || y > H - 20 || p[0] < 8 || p[0] > W - 8) return;
      if (lb.kind !== 'con') {
        // Flip to the left of the object if the text would run off the right edge
        ctx.font = labelFont;
        var wText = ctx.measureText(lb.text).width;
        if (lb.sub) { ctx.font = '400 11.5px "IBM Plex Sans", system-ui, sans-serif'; wText = Math.max(wText, ctx.measureText(lb.sub).width); }
        if (lb.side === 'left' || x + wText > W - 14) x = p[0] - (lb.dx || 0) - wText;
        if (x < 8) return;
      }
      if (lb.kind === 'con') {
        ctx.font = labelFontCon;
        ctx.fillStyle = 'rgba(170,190,230,' + 0.55 * a + ')';
        ctx.textAlign = 'center';
        ctx.fillText(lb.text, p[0], p[1]);
        ctx.textAlign = 'left';
      } else {
        ctx.font = labelFont;
        ctx.fillStyle = 'rgba(233,237,246,' + 0.9 * a + ')';
        ctx.fillText(lb.text, x, y);
        if (lb.sub) {
          ctx.font = '400 11.5px "IBM Plex Sans", system-ui, sans-serif';
          ctx.fillStyle = 'rgba(170,185,215,' + 0.85 * a + ')';
          ctx.fillText(lb.sub, x, y + 15);
        }
      }
    });
  }

  function drawSunLabel(a, sunP) {
    if (a < 0.02 || !sunP || W < 720) return;
    // Label the path where it climbs, not at the Sun itself
    var v = horizontal(SUN.ra, SUN.dec, SUN.ra + 0.6);   // just past noon, near the top of the arc
    var p = project(v); if (!p) return;
    ctx.font = labelFont;
    ctx.fillStyle = 'rgba(255,244,228,' + 0.9 * a + ')';
    var text = "The Sun's path across the sky today";
    var w = ctx.measureText(text).width;
    var x = Math.max(8, Math.min(p[0] + 10, W - w - 14)), y = Math.max(84, p[1] - 12);
    ctx.fillText(text, x, y);
  }

  // ---------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------
  var running = false, visible = true, raf = 0;
  var tween = null;
  function frame(t) {
    if (tween) {
      var k = clamp01((t - tween.t0) / tween.dur);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      lst = tween.from + (tween.to - tween.from) * e;
      dayMix = tween.mixFrom + (tween.mixTo - tween.mixFrom) * e;
      if (k >= 1) { lst = tween.to % 24; dayMix = tween.mixTo; setView(); tween = null; if (onSettle) onSettle(); }
    }
    draw(t);
    if (running) raf = requestAnimationFrame(frame);
  }
  function tweenActive() { return !!tween; }
  function wantRun() { return visible && !document.hidden && (!reduceMotion.matches || tween); }
  function update() {
    var should = wantRun();
    if (should && !running) { running = true; raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); draw(0); }
    else if (!should) draw(0);
  }

  var onSettle = null;
  function targetFor(theme) { return theme === 'light' ? LST_DAY : LST_NIGHT; }

  window.Sky = {
    set: function (theme, animate, done) {
      var target = targetFor(theme);
      onSettle = done || null;
      var mixTarget = theme === 'light' ? 1 : 0;
      if (!animate || reduceMotion.matches) {
        tween = null; lst = target; dayMix = mixTarget; setView(); draw(performance.now());
        if (onSettle) onSettle();
        return;
      }
      // Always run time forward: the sky turns westward, as it does
      var from = lst, to = target;
      while (to <= from) to += 24;
      tween = { from: from, to: to, mixFrom: dayMix, mixTo: mixTarget, t0: performance.now(), dur: 3600 };
      update();
    }
  };

  function currentTheme() {
    var d = document.documentElement.dataset.theme;
    if (d) return d;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  lst = targetFor(currentTheme());
  dayMix = currentTheme() === 'light' ? 1 : 0;
  resize();
  draw(0);
  update();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); draw(performance.now()); }, 150);
  });
  document.addEventListener('visibilitychange', update);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; update(); }).observe(canvas);
  }
  // Follow the system theme when the visitor hasn't chosen one
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', function () {
    if (!document.documentElement.dataset.theme) window.Sky.set(currentTheme(), true);
  });
  // Web fonts change label metrics; redraw once they are ready
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(performance.now()); });
})();
