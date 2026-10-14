'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getClientIp, normalizeAnalyticsPath, parseFingerprint } = require('../src/index');
const { getFingerprint } = require('../../fingerprint');

const request = headers => ({ headers, socket: { remoteAddress: '::ffff:192.0.2.9' } });
assert.strictEqual(getClientIp(request({})), '192.0.2.9');
assert.strictEqual(getClientIp(request({ 'x-forwarded-for': ' 198.51.100.1, 203.0.113.2' })), '198.51.100.1');
assert.strictEqual(getClientIp(request({ 'x-real-ip': '::ffff:198.51.100.2', 'x-forwarded-for': '203.0.113.2' })), '198.51.100.2');
assert.strictEqual(getClientIp(request({ 'cf-connecting-ip': ' 2001:db8::1 , 203.0.113.2', 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '203.0.113.2' })), '2001:db8::1');
for (const value of ['', ' ', 'invalid', '999.1.1.1', '198.51.100.1:443']) {
  assert.strictEqual(getClientIp(request({ 'cf-connecting-ip': value })), null);
}
assert.strictEqual(getClientIp({}), null);
console.log('Analytics IP regression checks passed');

assert.strictEqual(normalizeAnalyticsPath('/?token=secret&utm_source=test'), '/');
assert.strictEqual(normalizeAnalyticsPath('/portfolio?token=secret#contact'), '/portfolio');
assert.strictEqual(normalizeAnalyticsPath('/#contact'), '/#contact');
for (const value of ['', null, undefined, {}, 42]) assert.strictEqual(normalizeAnalyticsPath(value), '/');
console.log('Analytics path regression checks passed');

const environment = {
  navigator: { userAgent: 'Example Browser', language: 'es-MX', hardwareConcurrency: 8 },
  screen: { width: 1920, height: 1080, colorDepth: 24 },
  devicePixelRatio: 1,
  Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'America/Cancun' }) }) }
};
const fingerprint = getFingerprint(environment);
assert.match(fingerprint, /^[0-9a-f]{8}$/);
assert.strictEqual(getFingerprint(environment), fingerprint);
for (const property of ['userAgent', 'language', 'hardwareConcurrency']) {
  assert.notStrictEqual(getFingerprint({ ...environment, navigator: { ...environment.navigator, [property]: 'changed' } }), fingerprint);
}
for (const property of ['width', 'height', 'colorDepth']) {
  assert.notStrictEqual(getFingerprint({ ...environment, screen: { ...environment.screen, [property]: 42 } }), fingerprint);
}
assert.notStrictEqual(getFingerprint({ ...environment, devicePixelRatio: 2 }), fingerprint);
assert.notStrictEqual(getFingerprint({ ...environment, Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'UTC' }) }) } }), fingerprint);
assert.strictEqual(getFingerprint(null), null);
assert.strictEqual(parseFingerprint(fingerprint.toUpperCase()), fingerprint);
assert.strictEqual(parseFingerprint(null), null);
for (const value of ['invalid', 'a'.repeat(100), {}, 123]) assert.strictEqual(parseFingerprint(value), false);

const source = fs.readFileSync(path.join(__dirname, '../../script.js'), 'utf8');
const tracking = source.slice(source.indexOf('// Privacy-friendly analytics ping'), source.indexOf('// Returning visitor prompt.'));
let captured;
vm.runInNewContext(tracking, {
  window: { API_BASE: 'https://api.example.test', getFingerprint: () => fingerprint },
  getOrCreateVisitorId: () => '11111111-1111-4111-8111-111111111111',
  location: { pathname: '/', search: '?token=secret&utm_source=example' },
  document: { referrer: '', getElementById: () => null, querySelector: () => null },
  URLSearchParams,
  fetch: async (url, options) => { captured = JSON.parse(options.body); return { ok: false }; }
});
assert.strictEqual(captured.path, '/');
assert.strictEqual(captured.utm_source, 'example');
assert.strictEqual(captured.fingerprint, fingerprint);
assert(!JSON.stringify(captured).includes('secret'));
console.log('Fingerprint stability, input variation, validation and frontend payload checks passed');

const backendSource = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const startup = backendSource.slice(0, backendSource.indexOf("const express = require('express');"));
const warningsFor = env => {
  const warnings = [];
  vm.runInNewContext(startup, { process: { env }, require: () => ({ config() {} }), console: { warn: message => warnings.push(message) } });
  return warnings;
};
assert.strictEqual(warningsFor({ NODE_ENV: 'production' }).length, 2);
assert.strictEqual(warningsFor({ NODE_ENV: 'production', SESSION_SECRET: 'dev_session_secret', PLAYER_TOKEN_SECRET: 'dev_secret' }).length, 2);
assert.strictEqual(warningsFor({ NODE_ENV: 'production', SESSION_SECRET: 'a-production-secret', PLAYER_TOKEN_SECRET: 'another-production-secret' }).length, 0);
assert.strictEqual(warningsFor({ NODE_ENV: 'test' }).length, 0);
console.log('Production secret warning checks passed');
