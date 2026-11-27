/* Applies the saved custom accent colour before the first paint, so the app
   never flashes the default colour. Kept as a separate classic script because
   the site's Content-Security-Policy allows scripts from 'self' only (no inline
   scripts). The CSS text is produced and cached by src/lib/accent.ts. */
(function () {
  try {
    var css = localStorage.getItem('tally-accent-css-v1');
    if (!css) return;
    var el = document.createElement('style');
    el.id = 'tally-accent-style';
    el.textContent = css;
    document.head.appendChild(el);
  } catch (e) {
    /* storage blocked: the default colour is used */
  }
})();
