'use strict';

const assert = require('node:assert/strict');
const { createTrafficClassifier, verifyCrawlerOrigin, crawlers } = require('../src/traffic');

(async () => {
  const ip = '66.249.66.1';
  const googlebot = crawlers.find(crawler => crawler.name === 'Googlebot');
  assert.equal(await verifyCrawlerOrigin(ip, googlebot, {
    reverse: async () => ['crawl-66-249-66-1.googlebot.com.'],
    resolve4: async () => [ip]
  }), true);
  assert.equal(await verifyCrawlerOrigin(ip, googlebot, {
    reverse: async () => ['crawl-66-249-66-1.googlebot.com'],
    resolve4: async () => ['66.249.66.2']
  }), false);
  assert.equal(await verifyCrawlerOrigin(ip, googlebot, {
    reverse: async () => ['crawl-66-249-66-1.googlebot.com.example', 'fakegooglebot.com'],
    resolve4: async () => { throw Error('unexpected lookup'); }
  }), false);
  const bingbot = crawlers.find(crawler => crawler.name === 'Bingbot');
  assert.equal(await verifyCrawlerOrigin('2620:1ec:c11::200', bingbot, {
    reverse: async () => ['msnbot.search.msn.com'],
    resolve6: async () => ['2620:1ec:c11:0:0:0:0:200']
  }), true);

  let requests = 0;
  let time = 0;
  let finish;
  const classify = createTrafficClassifier({
    now: () => time,
    verify: () => { requests++; return new Promise(resolve => { finish = resolve; }); }
  });
  const crawlerEvent = { ip, user_agent: 'Googlebot/2.1', event_type: 'contact_opened' };
  for (const source of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', null]) {
    const result = classify({ ...crawlerEvent, ip_source: source });
    assert.equal(result.traffic, 'Suspected Automation');
    assert.match(result.why, /No trusted/);
  }
  assert.equal(requests, 0);
  const socket = { ...crawlerEvent, ip_source: 'socket' };
  assert.match(classify(socket).why, /pending/);
  assert.match(classify(socket).why, /pending/);
  await new Promise(setImmediate);
  assert.equal(requests, 1);
  finish(true);
  await new Promise(setImmediate);
  assert.deepEqual([classify(socket).traffic, classify(socket).confidence], ['Known Bot', 'High']);
  time += 600_001;
  assert.equal(classify(socket).traffic, 'Suspected Automation');
  assert.equal(classify({ user_agent: 'Mozilla/5.0 HeadlessChrome/140.0.0.0' }).traffic, 'Suspected Automation');
  assert.equal(classify({ event_type: 'page_view', user_agent: 'Chrome/140.0.0.0' }).traffic, 'Unknown');
  assert.equal(classify({ event_type: 'section_view' }).confidence, 'Insufficient');
  assert.equal(classify({ event_type: 'contact_opened' }).traffic, 'Likely Human');
  console.log('Traffic classification, DNS origin verification, cache expiry and untrusted IP handling passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
