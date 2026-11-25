/*
 * Light / dark theme switch.
 * The page starts in the visitor's system theme (set by the small script in <head>).
 * Clicking the button switches theme and remembers that choice; until someone clicks,
 * the page keeps following the system setting, even if it changes while the page is open.
 */
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const media = window.matchMedia('(prefers-color-scheme: light)');

  const saved = () => { try { return localStorage.getItem('theme'); } catch (e) { return null; } };
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    if (!btn) return;
    const next = theme === 'light' ? 'dark' : 'light';
    btn.setAttribute('aria-label', 'Switch to ' + next + ' mode');
    btn.setAttribute('title', 'Switch to ' + next + ' mode');
  }

  apply(root.getAttribute('data-theme') || (media.matches ? 'light' : 'dark'));

  if (btn) {
    btn.addEventListener('click', () => {
      const theme = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('theme', theme); } catch (e) {}
      apply(theme);
    });
  }

  // follow live system changes only while the visitor hasn't picked a theme themselves
  media.addEventListener('change', (e) => {
    const s = saved();
    if (s !== 'light' && s !== 'dark') apply(e.matches ? 'light' : 'dark');
  });
})();
