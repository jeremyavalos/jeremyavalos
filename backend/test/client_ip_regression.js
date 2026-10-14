'use strict';

const assert = require('assert');
process.env.NODE_ENV = 'test';
const { getClientIp, getClientIpDetails } = require('../src/index');
const request = (headers = {}, remoteAddress = '::ffff:100.64.0.2') => ({ headers, socket: { remoteAddress } });
const expect = (req, ip, source) => {
  assert.strictEqual(getClientIp(req), ip);
  assert.deepStrictEqual(getClientIpDetails(req), { ip, source });
};

delete process.env.TRUSTED_PROXY_CIDRS;
expect(request({ 'x-forwarded-for': 'bad, ::ffff:198.51.100.1, 100.64.0.1', 'x-real-ip': '192.0.2.1' }), '198.51.100.1', 'x-forwarded-for');
expect(request({ 'cf-connecting-ip': 'invalid', 'x-forwarded-for': 'invalid', 'x-real-ip': ' ::ffff:192.0.2.2 ' }), '192.0.2.2', 'x-real-ip');
expect(request({ 'cf-connecting-ip': ['bad', ' 2001:db8::1 '] }), '2001:db8::1', 'cf-connecting-ip');
expect(request({}, 'not-an-ip'), 'not-an-ip', 'socket');
expect(request({}), '100.64.0.2', 'socket');
expect({}, null, 'socket');

process.env.TRUSTED_PROXY_CIDRS = '100.64.0.0/10, 2001:db8:abcd::/48';
expect(request({ 'x-forwarded-for': '203.0.113.99, 198.51.100.1, 100.64.0.1' }), '198.51.100.1', 'x-forwarded-for');
expect(request({ 'x-forwarded-for': '203.0.113.99, bad, ::ffff:198.51.100.1, 100.127.255.255' }), '198.51.100.1', 'x-forwarded-for');
expect(request({ 'cf-connecting-ip': '192.0.2.8', 'x-forwarded-for': '198.51.100.1' }), '192.0.2.8', 'cf-connecting-ip');
expect(request({ 'cf-connecting-ip': 'bad', 'x-forwarded-for': '198.51.100.1' }), '198.51.100.1', 'x-forwarded-for');
expect(request({ 'x-forwarded-for': '100.64.0.1, 100.127.255.255', 'x-real-ip': '192.0.2.8' }), '192.0.2.8', 'x-real-ip');
expect(request({ 'x-forwarded-for': '100.64.0.1, 100.127.255.255' }), '100.64.0.2', 'socket');
for (const remote of ['100.63.255.255', '100.128.0.0', '198.51.100.99']) {
  expect(request({ 'cf-connecting-ip': '192.0.2.8', 'x-forwarded-for': '192.0.2.9', 'x-real-ip': '192.0.2.10' }, remote), remote, 'socket');
}
expect(request({ 'x-forwarded-for': '203.0.113.99, 2001:db8:1::1, 2001:db8:abcd::2' }, '2001:db8:abcd::3'), '2001:db8:1::1', 'x-forwarded-for');
const originalWarn = console.warn;
const warnings = [];
console.warn = message => warnings.push(message);
try {
  for (const value of ['', 'invalid', '100.64.0.0/33', '100.64.0.0/10,invalid', '2001:db8::/129']) {
    process.env.TRUSTED_PROXY_CIDRS = value;
    expect(request({ 'cf-connecting-ip': '192.0.2.8', 'x-forwarded-for': '192.0.2.9' }), '100.64.0.2', 'socket');
  }
  assert.strictEqual(warnings.length, 5);
} finally {
  console.warn = originalWarn;
  delete process.env.TRUSTED_PROXY_CIDRS;
}
console.log('Client IP regression passed: spoofed XFF, untrusted socket/CF, trusted CF, IPv4/IPv6 CIDRs, invalid headers/configuration and source attribution');
