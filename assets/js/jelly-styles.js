/*
 * Jellyfish styles: Mosaic, Dither, Disco and plain Characters.
 * The canvas styles draw the same simulation as the ASCII layers (via window.JELLY_TAP) onto a
 * canvas in the same box, so size and motion are identical; only the look changes.
 * The style steps on each time the role line under the name scrambles (typewriter.js).
 */
(function () {
  const stack = document.querySelector('.ascii-stack');
  const pre = document.getElementById('jelly-body');
  if (!stack || !pre) return;

  const cv = document.createElement('canvas');
  cv.className = 'jelly-canvas';
  cv.setAttribute('aria-hidden', 'true');
  stack.appendChild(cv);
  const ctx = cv.getContext('2d');

  // The style steps to the next one each time the role line under the name scrambles
  // (typewriter.js fires 'role-scramble'). Mosaic comes first. ?style= picks the starting one.
  const ORDER = ['mosaic', 'dither', 'disco', 'chars'];
  let mode = 'mosaic';
  try { const q = new URLSearchParams(location.search).get('style'); if (ORDER.includes(q)) mode = q; } catch (e) {}
  const pres = Array.from(stack.querySelectorAll('pre'));
  function setMode(m) { mode = m; stack.dataset.style = m; }
  setMode(mode);
  window.JELLY_TEXT = mode === 'chars';                 // hidden text layers skip their per-frame rebuild

  // Switching is a soft crossfade: the outgoing style dissolves out while the incoming one dissolves in,
  // both redrawn every frame from the same simulation (so neither shows a stale, out-of-place frame).
  const FADE_MS = 1100;
  let from = null, f0 = 0;
  const ease = (x) => x * x * (3 - 2 * x);
  document.addEventListener('role-scramble', () => {
    if (from !== null) return;                          // let a running fade finish first
    from = mode;
    setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]);
    f0 = performance.now();
    window.JELLY_TEXT = from === 'chars' || mode === 'chars';
    stack.dataset.fading = '1';
    pres.forEach((el) => { el.style.opacity = from === 'chars' ? '1' : '0'; });
  });
  function endFade() {
    from = null;
    delete stack.dataset.fading;
    pres.forEach((el) => { el.style.opacity = ''; });
    window.JELLY_TEXT = mode === 'chars';
  }

  // palettes follow the site theme (dark: moonlit lavender; light: deep sea blues)
  const PAL = {
    dark:  { ramp: [[42, 63, 102], [79, 111, 174], [134, 168, 230], [201, 220, 255], [244, 251, 255]], glow: [138, 242, 255], gold: [244, 201, 119], core: [255, 176, 110], gap: 'rgba(10,19,28,0.9)' },
    light: { ramp: [[195, 211, 230], [125, 156, 192], [47, 111, 142], [42, 85, 124], [31, 59, 92]], glow: [11, 138, 160], gold: [180, 83, 9], core: [214, 96, 40], gap: 'rgba(243,246,249,0.9)' },
  };
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? PAL.light : PAL.dark);
  const lerp = (a, b, k) => a + (b - a) * k;
  function rampColor(p, v) {
    const r = p.ramp, x = Math.max(0, Math.min(0.999, v)) * (r.length - 1), i = Math.floor(x), k = x - i;
    return [lerp(r[i][0], r[i + 1][0], k), lerp(r[i][1], r[i + 1][1], k), lerp(r[i][2], r[i + 1][2], k)];
  }
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // fixed per-cell noise (so tiles keep their character from frame to frame)
  const noise = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

  let Wpx = 0, Hpx = 0;
  function fit() {
    const r = pre.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (Math.abs(r.width - Wpx) > 0.5 || Math.abs(r.height - Hpx) > 0.5) {
      Wpx = r.width; Hpx = r.height;
      cv.width = Math.round(Wpx * dpr); cv.height = Math.round(Hpx * dpr);
      cv.style.width = Wpx + 'px'; cv.style.height = Hpx + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  // ── Dither: ordered (Bayer 4×4) dithering into a 3-tone palette on a fine pixel grid ──
  function dither(sample, g, p) {
    const q = 0.42, nc = Math.floor(g.PW / q), nr = Math.floor(g.H / q), cw = Wpx / nc, ch = Hpx / nr;
    const tones = [rampColor(p, 0.35), rampColor(p, 0.7), rampColor(p, 1)];
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const [b, gl, sc] = sample((c + 0.5) * q, (r + 0.5) * q);
        const thr = BAYER[(r & 3) * 4 + (c & 3)];
        const x = c * cw, y = r * ch;
        if (gl > 0.12 && gl * 1.2 > thr) { paths[3].rect(x, y, cw, ch); continue; }
        const v = b * 3;                                   // three tones, dithered between
        const lvl = Math.floor(v + thr - 0.5 + 0.5);
        if (lvl >= 1) paths[Math.min(3, lvl) - 1].rect(x, y, cw, ch);
        else if (sc > 0.05 && sc * 2.5 > thr) paths[4].rect(x, y, cw, ch);
      }
    }
    ctx.fillStyle = css(tones[0]); ctx.fill(paths[0]);
    ctx.fillStyle = css(tones[1]); ctx.fill(paths[1]);
    ctx.fillStyle = css(tones[2]); ctx.fill(paths[2]);
    ctx.fillStyle = css(p.glow); ctx.fill(paths[3]);
    ctx.fillStyle = css(p.gold, 0.8); ctx.fill(paths[4]);
  }

  // ── Mosaic: square colour tiles with grout gaps, each tile a touch different ──
  function mosaic(sample, g, p) {
    const q = 0.95, nc = Math.floor(g.PW / q), nr = Math.floor(g.H / q), cw = Wpx / nc, ch = Hpx / nr, gap = Math.max(1, cw * 0.14);
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const [b, gl, sc, au] = sample((c + 0.5) * q, (r + 0.5) * q);
        const v = Math.min(1, b * 1.15);
        const x = c * cw + gap / 2, y = r * ch + gap / 2, w = cw - gap, h = ch - gap;
        if (v < 0.05 && gl < 0.08) {
          if (au > 0.04) {                                   // soft aura around the bell: faint glowing tiles in the water
            ctx.fillStyle = css(p.glow, Math.min(0.28, au * 0.55));
            ctx.fillRect(x, y, w, h);
          } else if (sc > 0.06) {                            // drifting particles
            ctx.fillStyle = css(p.gold, 0.55);
            ctx.fillRect(x, y, w, h);
          }
          continue;
        }
        const n = noise(c, r);
        let col = rampColor(p, v * (0.88 + 0.24 * n));
        if (gl > 0.08) col = mix(col, p.glow, Math.min(1, gl * 1.1));
        const core = Math.max(0, Math.min(1, (au - 0.4) * 1.9));   // warm light at the heart of the bell
        if (core > 0) col = mix(col, p.core, core);
        else if (au > 0.04) col = mix(col, p.glow, Math.min(0.5, au * 0.8));   // the whole bell glows a little
        ctx.fillStyle = css(col, Math.min(1, 0.35 + v + gl + au * 0.6));
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  // ── Disco: tiles coloured on a heat-map scale (viridis, as in Scanpy): dim edges are deep purple,
  //    the body runs through blue and teal, and the glowing core and rib lines run hot to yellow ──
  const VIRIDIS = [[68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
                   [31, 158, 137], [53, 183, 121], [110, 206, 88], [181, 222, 43], [253, 231, 37]];
  function heat(v) {
    const x = Math.max(0, Math.min(0.999, v)) * (VIRIDIS.length - 1), i = Math.floor(x), k = x - i;
    return mix(VIRIDIS[i], VIRIDIS[i + 1], k);
  }
  function disco(sample, g, p) {
    const q = 0.85, nc = Math.floor(g.PW / q), nr = Math.floor(g.H / q), cw = Wpx / nc, ch = Hpx / nr, gap = Math.max(1, cw * 0.16);
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const [b, gl, sc, au] = sample((c + 0.5) * q, (r + 0.5) * q);
        const core = Math.max(0, (au - 0.4) * 1.6);
        const v = Math.min(1, b * 0.95 + gl * 0.6 + core * 1.1);
        if (v < 0.06) {
          if (sc > 0.06) { ctx.fillStyle = css(heat(0.15), 0.7); ctx.fillRect(c * cw + gap / 2, r * ch + gap / 2, cw - gap, ch - gap); }
          continue;
        }
        const jitter = (noise(c, r) - 0.5) * 0.08;               // neighbouring tiles differ a little, like real data
        ctx.fillStyle = css(heat(0.12 + 0.88 * v + jitter));
        ctx.fillRect(c * cw + gap / 2, r * ch + gap / 2, cw - gap, ch - gap);
      }
    }
  }

  const RENDER = { dither, mosaic, disco };
  window.JELLY_TAP = function (sample, g) {
    const k = from === null ? 1 : Math.min(1, (performance.now() - f0) / FADE_MS);
    if (from === null && !RENDER[mode]) return;      // plain characters: the text layers draw it
    fit();
    ctx.clearRect(0, 0, Wpx, Hpx);
    const p = theme(), e = ease(k);
    if (from !== null && RENDER[from]) { ctx.globalAlpha = 1 - e; RENDER[from](sample, g, p); }
    if (RENDER[mode]) { ctx.globalAlpha = from === null ? 1 : e; RENDER[mode](sample, g, p); }
    ctx.globalAlpha = 1;
    if (from !== null) {
      const op = (from === 'chars' ? 1 - e : 0) + (mode === 'chars' ? e : 0);
      pres.forEach((el) => { el.style.opacity = op.toFixed(3); });
      if (k >= 1) endFade();
    }
  };
})();
