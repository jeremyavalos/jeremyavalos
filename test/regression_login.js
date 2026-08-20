(async () => {
  const { spawn } = require('child_process');
  const fetch = global.fetch || require('node-fetch');
  // bcrypt not required in test mode
  const path = require('path');

  // Start the app in test mode by requiring it directly
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // let system pick free port

  // For test mode we'll set ADMIN_PASSWORD_HASH equal to the plaintext to avoid bcrypt dependency.
  const plaintext = 'test-password-123';
  process.env.ADMIN_USERNAME = 'admin-test';
  process.env.ADMIN_PASSWORD_HASH = plaintext;

  // Resolve backend src path by walking up from this file's directory to avoid
  // issues when tests are run with different CWDs.
  function findBackendSrc() {
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
      const cand1 = path.resolve(dir, 'backend', 'src', 'index.js');
      const cand2 = path.resolve(dir, 'src', 'index.js');
      try { require('fs').accessSync(cand1); return cand1; } catch (e) {}
      try { require('fs').accessSync(cand2); return cand2; } catch (e) {}
      dir = path.resolve(dir, '..');
    }
    // last resort: project cwd
    const cand = path.resolve(process.cwd(), 'backend', 'src', 'index.js');
    return cand;
  }
  const backendSrc = findBackendSrc();
  const app = require(backendSrc);

  // listen on ephemeral port
  const server = app.listen(0);
  const addr = server.address();
  const port = addr.port;
  const base = `http://127.0.0.1:${port}`;
  console.log('Test server started on', base);

  try {
    // GET /admin
    let r = await fetch(base + '/admin');
    const html = await r.text();
    if (html.includes(process.env.ADMIN_PASSWORD_HASH)) throw new Error('Regression: admin HTML contains hash');
    console.log('GET /admin passed: no hash in HTML');

    // POST /admin/login with correct plaintext
    r = await fetch(base + '/admin/login', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ username: 'admin-test', password: plaintext }) });
    const sessionCookie = r.headers.get('set-cookie')?.split(';')[0];
    const j = await r.json().catch(()=>null);
    if (!r.ok || !j || !j.ok) throw new Error('Login with correct password failed');
    console.log('POST /admin/login correct password passed');

    // Authenticated dashboard uses CSP-safe external assets, not blocked inline loaders.
    r = await fetch(base + '/admin', { headers: { Cookie: sessionCookie } });
    const dashboard = await r.text();
    if (!dashboard.includes('/admin/assets/dashboard.js')) throw new Error('Dashboard external script missing');
    if (dashboard.includes('loadOverview()')) throw new Error('Dashboard still contains blocked inline loader');
    r = await fetch(base + '/admin/assets/dashboard.js', { headers: { Cookie: sessionCookie } });
    if (!r.ok || !(await r.text()).includes('/api/admin/overview')) throw new Error('Protected dashboard asset unavailable');
    r = await fetch(base + '/admin/assets/dashboard.js');
    if (r.status !== 403) throw new Error('Dashboard asset should require an admin session');
    console.log('Authenticated dashboard CSP regression passed');

    // POST wrong password
    r = await fetch(base + '/admin/login', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ username: 'admin-test', password: 'wrong' }) });
    if (r.ok) throw new Error('Login should have failed with wrong password');
    console.log('POST /admin/login wrong password passed');

    // POST the hash itself as password should fail
    r = await fetch(base + '/admin/login', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ username: 'admin-test', password: 'some-other-string' }) });
    if (r.ok) throw new Error('Login should have failed when submitting hash as password');
    console.log('POST /admin/login submitting hash as password passed');

    console.log('All regression tests passed');
  } catch (e) {
    console.error('Regression test failed:', e);
    process.exitCode = 2;
  } finally {
    server.close();
  }
})();
