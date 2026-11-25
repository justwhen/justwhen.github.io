/*
 * Floating "back to top" bubble.
 * Appears once you've scrolled well down the page; a few small bubbles drift up
 * out of it, more while you hover, and a burst when you press it.
 */
(function () {
  const btn = document.getElementById('to-top');
  if (!btn) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer = btn.querySelector('.bubbles');

  // show after scrolling past ~1.2 screens, so it's there for the bottom of the page
  const onScroll = () => btn.classList.toggle('show', window.scrollY > window.innerHeight * 1.2);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function bubble(big) {
    if (reduce) return;
    const b = document.createElement('span');
    b.className = 'bubble';
    const size = (big ? 6 : 3) + Math.random() * (big ? 8 : 5);
    b.style.width = b.style.height = size.toFixed(1) + 'px';
    b.style.setProperty('--dx', ((Math.random() - 0.5) * (big ? 46 : 22)).toFixed(0) + 'px');
    b.style.setProperty('--dy', (-(big ? 60 : 38) - Math.random() * (big ? 50 : 30)).toFixed(0) + 'px');
    b.style.setProperty('--d', ((big ? 0.9 : 1.6) + Math.random() * 0.9).toFixed(2) + 's');
    b.style.left = (40 + Math.random() * 20).toFixed(0) + '%';
    layer.appendChild(b);
    b.addEventListener('animationend', () => b.remove());
  }

  // a slow trickle while visible, faster while hovered
  let hovering = false;
  btn.addEventListener('mouseenter', () => { hovering = true; });
  btn.addEventListener('mouseleave', () => { hovering = false; });
  let last = 0;
  (function tick(now) {
    requestAnimationFrame(tick);
    if (!btn.classList.contains('show') || document.hidden) return;
    const gap = hovering ? 160 : 900;
    if (now - last > gap) { last = now; bubble(false); }
  })(0);

  btn.addEventListener('click', () => {
    for (let k = 0; k < 12; k++) setTimeout(() => bubble(true), k * 35);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
})();
