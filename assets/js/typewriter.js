/*
 * Role line under the name.
 * Each phrase types in quickly, holds, then dissolves into ASCII characters
 * (the same character set the jellyfish is drawn with) before the next one.
 * The caret keeps blinking throughout. Edit PHRASES freely.
 */
(function () {
  const el = document.getElementById('typed');
  if (!el) return;

  const PHRASES = [
    'an immunologist',
    'a Ph.D. student at UTMB',
    'studying vaccines',
    'an NIH/NLM data science trainee',
    'building single-cell pipelines',
  ];
  const TYPE_MS = 22;          // per character, typing in
  const HOLD_MS = 2200;        // how long a phrase stays
  const DISSOLVE_MS = 420;     // total dissolve time
  const GAP_MS = 120;          // blank pause before the next phrase
  const DECAY = '#Ox*+=~-:;,.'; // dense → sparse, then gone

  el.textContent = PHRASES[0];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(r));

  async function typeIn(text) {
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    for (let n = 1; n <= text.length; n++) {
      el.textContent = text.slice(0, n);
      await wait(TYPE_MS);
    }
  }

  async function dissolve(text) {
    // wrap each character in a span locked to its original width so nothing shifts
    el.textContent = '';
    const glyphs = [...text].map((ch) => {
      const s = document.createElement('span');
      s.className = 'glyph';
      s.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(s);
      return s;
    });
    const widths = glyphs.map((s) => s.getBoundingClientRect().width);
    glyphs.forEach((s, i) => { s.style.width = widths[i] + 'px'; });

    // each glyph starts decaying at a random moment, left side slightly first
    const starts = glyphs.map((_, i) => (i / glyphs.length) * DISSOLVE_MS * 0.35 + Math.random() * DISSOLVE_MS * 0.3);
    const life = DISSOLVE_MS * 0.4;
    const t0 = performance.now();
    for (;;) {
      const t = performance.now() - t0;
      let alive = false;
      glyphs.forEach((s, i) => {
        if (text[i] === ' ') return;
        const p = (t - starts[i]) / life;
        if (p < 0) { alive = true; return; }
        if (p >= 1) { s.textContent = ' '; return; }
        alive = true;
        s.classList.add('ascii-bit');
        const idx = Math.min(DECAY.length - 1, Math.floor(p * DECAY.length + Math.random() * 1.5));
        s.textContent = DECAY[idx];
        s.style.opacity = String(1 - p * 0.7);
      });
      if (!alive) break;
      await frame();
    }
    el.textContent = '';
  }

  async function run() {
    let p = 0;
    await wait(HOLD_MS);
    for (;;) {
      await dissolve(PHRASES[p]);
      await wait(GAP_MS);
      p = (p + 1) % PHRASES.length;
      await typeIn(PHRASES[p]);
      await wait(HOLD_MS);
    }
  }
  run();
})();
