'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { getClientIp } = require('../src/index');

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
