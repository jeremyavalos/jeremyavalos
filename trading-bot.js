// Native details keeps the case study accessible without JavaScript.
// Project links and direct URLs also open the study before navigating to it.
(() => {
  const studies = [...document.querySelectorAll('details.trading-case[id]')];
  const openFromHash = () => {
    const study = studies.find(item => `#${item.id}` === window.location.hash);
    if (!study) return;
    study.open = true;
    requestAnimationFrame(() => study.scrollIntoView({ block: 'start' }));
  };
  studies.forEach(study => {
    document.querySelectorAll(`a[href="#${study.id}"]`).forEach(link => {
      link.addEventListener('click', () => { study.open = true; });
    });
  });
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
