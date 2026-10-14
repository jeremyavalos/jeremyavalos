(function (root, factory) {
  const getFingerprint = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = { getFingerprint };
  if (root) root.getFingerprint = getFingerprint;
})(typeof window !== 'undefined' ? window : null, function (root) {
  return function getFingerprint(context = root) {
    try {
      const input = JSON.stringify([
        context.navigator.userAgent,
        context.navigator.language,
        `${context.screen.width}x${context.screen.height}`,
        context.screen.colorDepth,
        context.devicePixelRatio,
        context.Intl.DateTimeFormat().resolvedOptions().timeZone,
        context.navigator.hardwareConcurrency
      ]);
      let hash = 5381;
      for (let index = 0; index < input.length; index++) hash = (Math.imul(hash, 33) ^ input.charCodeAt(index)) >>> 0;
      return hash.toString(16).padStart(8, '0');
    } catch (error) {
      return null;
    }
  };
});
