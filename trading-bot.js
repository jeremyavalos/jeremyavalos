// Native details keeps the case study accessible without JavaScript.
// Project links and direct URLs also open the study before navigating to it.
(() => {
  const study = document.getElementById('trading-bot');
  if (!study) return;
  const openFromHash = () => {
    if (window.location.hash !== '#trading-bot') return;
    study.open = true;
    requestAnimationFrame(() => study.scrollIntoView({ block: 'start' }));
  };
  document.querySelectorAll('a[href="#trading-bot"]').forEach(link => {
    link.addEventListener('click', () => { study.open = true; });
  });
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
