(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReturningVisitorCopy = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const variants = [
    'Back again? I respect the commitment.',
    'Looks like curiosity won.',
    "Second visit? Now we're getting somewhere.",
  ];

  function variantIndex(seed) {
    return Array.from(String(seed || '')).reduce((total, char) => total + char.charCodeAt(0), 0) % variants.length;
  }

  function build(context = {}) {
    const city = typeof context.city === 'string' ? context.city.trim() : '';
    const seed = `${context.ip || ''}:${context.current_visit || ''}`;
    return {
      variant: variants[variantIndex(seed)],
      locationHeadline: city ? `${city.toUpperCase()} THIS TIME?` : 'WELCOME BACK.',
      locationLead: city ? `Looks like ${city} from here.` : "Your connection isn't giving me much of a location this time.",
      locationQualifier: city ? "At least that's what your current IP says." : 'But the important part is: you came back.',
      networkAside: city && context.network ? 'Your network tells a more interesting story.' : null,
      showEmphasis: Boolean(city),
    };
  }

  return { build, variants };
});
