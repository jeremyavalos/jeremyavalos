// Simple local check of CORS origin callback logic copied from src/index.js
const allowedOrigins = [
  process.env.CORS_ORIGIN || 'https://www.jeremyavalos.xyz',
  'https://jeremyavalos.xyz',
  process.env.BACKEND_PUBLIC_URL || 'https://jeremyavalos-production.up.railway.app',
  'http://localhost:3000',
  'http://localhost:8000'
].filter(Boolean);

function originAllowed(origin) {
  return new Promise((resolve) => {
    // Mimic the apiCors origin callback
    if (!origin) return resolve({ allowed: true, reason: 'no-origin' });
    if (origin === 'null') return resolve({ allowed: false, reason: "literal 'null'" });
    if (allowedOrigins.includes(origin)) return resolve({ allowed: true, reason: 'allowlist' });
    return resolve({ allowed: false, reason: 'not in allowlist' });
  });
}

(async () => {
  const tests = [undefined, 'null', 'https://www.jeremyavalos.xyz', 'https://evil.example'];
  for (const t of tests) {
    const r = await originAllowed(t);
    console.log('Origin:', String(t), '=>', r);
  }
})();
