'use strict';

const { Resolver } = require('node:dns').promises;
const { BlockList, isIP } = require('node:net');
const { isPublicIp } = require('./geolocation');

const { crawlerTokens } = require('./userAgent');

const hostnames = {
  Googlebot: /^(?:crawl-[a-z0-9-]+\.googlebot\.com|geo-crawl-[a-z0-9-]+\.geo\.googlebot\.com)$/i,
  Bingbot: /^(?:[a-z0-9-]+\.)+search\.msn\.com$/i
};
const crawlers = crawlerTokens.map(crawler => ({ ...crawler, hostname: hostnames[crawler.name] }));
const interactions = new Set([
  'contact_opened', 'returning_popup_email_opened', 'returning_popup_email_submitted',
  'returning_popup_start_project', 'returning_popup_details_opened'
]);

async function verifyCrawlerOrigin(ip, crawler, resolver = new Resolver({ timeout: 1500, tries: 1 })) {
  const names = await resolver.reverse(ip);
  const addressFamily = isIP(ip) === 6 ? 'ipv6' : 'ipv4';
  const addresses = new BlockList();
  addresses.addAddress(ip, addressFamily);
  // A PTR alone can be set by the owner of an unrelated address.
  for (const hostname of names.filter(name => crawler.hostname.test(name.replace(/\.$/, ''))).slice(0, 2)) {
    const records = await (addressFamily === 'ipv6' ? resolver.resolve6(hostname) : resolver.resolve4(hostname)).catch(() => []);
    if (records.some(address => addresses.check(address, addressFamily))) return true;
  }
  return false;
}

function createTrafficClassifier({ verify = verifyCrawlerOrigin, now = Date.now } = {}) {
  const cache = new Map();
  let pending = 0;

  function verificationStatus(event, crawler) {
    // Historical forwarded addresses do not establish that ingress validated the header.
    if (event.ip_source !== 'socket' || !isPublicIp(event.ip)) return 'No trusted public socket address for origin verification.';
    const key = `${crawler.name}:${event.ip}`;
    const cached = cache.get(key);
    if (cached?.status === 'pending' || cached?.expires > now()) return cached.status;
    if (pending >= 4) return 'Origin verification is busy. Reopen the profile to retry.';
    if (cache.size >= 512 && !cached) {
      const oldest = [...cache].find(([, entry]) => entry.status !== 'pending');
      cache.delete(oldest[0]);
    }
    pending++;
    cache.set(key, { status: 'pending' });
    Promise.resolve()
      .then(() => verify(event.ip, crawler))
      .then(verified => verified === true ? 'verified' : 'Origin could not be corroborated by forward and reverse DNS.',
        () => 'Origin verification unavailable.')
      .then(status => {
        pending--;
        cache.set(key, { status, expires: now() + (status === 'verified' ? 10 * 60_000 : 60_000) });
      });
    return 'pending';
  }

  return function classifyTraffic(event) {
    const ua = typeof event.user_agent === 'string' ? event.user_agent : '';
    const crawler = crawlers.find(candidate => candidate.token.test(ua));
    if (crawler) {
      const status = verificationStatus(event, crawler);
      if (status === 'verified') {
        return { traffic: 'Known Bot', confidence: 'High', why: `${crawler.name} token and public socket IP corroborated by current reverse and forward DNS.` };
      }
      const reason = status === 'pending' ? 'Origin verification pending. Reopen the profile to refresh.' : status;
      return { traffic: 'Suspected Automation', confidence: 'Low', why: `User-Agent claims ${crawler.name}. ${reason}` };
    }
    if (/\bHeadlessChrome\/|\b(?:curl|Wget|python-requests|Scrapy)\//i.test(ua)) {
      return { traffic: 'Suspected Automation', confidence: 'Medium', why: 'User-Agent declares a headless browser or programmatic HTTP client.' };
    }
    if (interactions.has(event.event_type)) {
      return { traffic: 'Likely Human', confidence: 'Medium', why: 'An explicit site interaction was reported. Automation can also generate this event.' };
    }
    return { traffic: 'Unknown', confidence: 'Insufficient', why: 'No explicit interaction or recognized automation signal for this event.' };
  };
}

module.exports = { createTrafficClassifier, verifyCrawlerOrigin, crawlers };
