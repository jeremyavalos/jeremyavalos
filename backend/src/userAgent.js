'use strict';

const UNKNOWN = 'Unknown';
const brands = new Map([
  ['Microsoft Edge', 'Edge'], ['Opera', 'Opera'], ['Samsung Internet', 'Samsung Internet'],
  ['Google Chrome', 'Chrome'], ['Chromium', 'Chromium']
]);
const platforms = new Map([
  ['Android', 'Android'], ['Chrome OS', 'ChromeOS'], ['Windows', 'Windows'],
  ['macOS', 'macOS'], ['Linux', 'Linux'], ['iOS', 'iOS']
]);
const browsers = [
  ['Samsung Internet', /\bSamsungBrowser\/([\d.]+)/i],
  ['Edge', /\b(?:EdgA|EdgiOS|Edg|Edge)\/([\d.]+)/i],
  ['Opera', /\b(?:OPR|Opera|OPiOS)\/([\d.]+)/i],
  ['Firefox', /\b(?:Firefox|FxiOS)\/([\d.]+)/i],
  ['Chrome', /\b(?:Chrome|CriOS)\/([\d.]+)/i],
  ['Headless Chrome', /\bHeadlessChrome\/([\d.]+)/i],
  ['Chromium', /\bChromium\/([\d.]+)/i]
];
const crawlerTokens = [
  { name: 'Googlebot', token: /\bGooglebot(?:-(?:Image|News|Video))?\//i },
  { name: 'Bingbot', token: /\bbingbot\//i }
];
const androidTv = /\b(?:Android TV|Google TV|Smart-TV|AFT[A-Z0-9]+)\b|[;(]\s*TV\s*[;)]/i;
const reducedChrome = /\bChrome\/(\d+)\.0\.0\.0\b/i;

function versionFrom(ua, pattern) {
  return ua.match(pattern)?.[1]?.replace(/_/g, '.') || UNKNOWN;
}

function readClientHints(headers = {}) {
  const brandHeader = headers['sec-ch-ua'];
  const platformHeader = headers['sec-ch-ua-platform'];
  const advertised = new Map();
  if (typeof brandHeader === 'string' && brandHeader.length <= 512) {
    for (const match of brandHeader.matchAll(/(?:^|,)\s*"([^"\\]+)"\s*;\s*v="(\d{1,4})"\s*(?=,|$)/g)) {
      if (brands.has(match[1])) advertised.set(match[1], match[2]);
    }
  }
  const specific = [...advertised.keys()].filter(brand => brand !== 'Chromium');
  const brand = specific.length === 1 ? specific[0] : specific.length === 0 ? 'Chromium' : null;
  const platform = typeof platformHeader === 'string' && platformHeader.match(/^"([^"]+)"$/)?.[1];
  return {
    browser: advertised.has(brand) ? brands.get(brand) : UNKNOWN,
    version: advertised.get(brand) || UNKNOWN,
    platform: platforms.get(platform) || UNKNOWN,
    mobile: headers['sec-ch-ua-mobile'] === '?1'
  };
}

function parseUserAgent(value, headers) {
  const ua = typeof value === 'string' ? value.trim() : '';
  const hints = readClientHints(headers);
  const reduced = ua.match(reducedChrome);
  let device = UNKNOWN, type = UNKNOWN, os = UNKNOWN, osVersion = UNKNOWN;
  let browser = UNKNOWN, browserVersion = UNKNOWN;

  if (crawlerTokens.some(crawler => crawler.token.test(ua))) {
    return {
      device_name: device, device_type: type, operating_system: os,
      operating_system_version: osVersion, browser, browser_version: browserVersion
    };
  }

  if (/\biPad\b/i.test(ua)) {
    [device, type, os] = ['iPad', 'tablet', 'iPadOS'];
    osVersion = versionFrom(ua, /CPU OS ([\d_]+)/i);
  } else if (/\biPhone\b/i.test(ua)) {
    [device, type, os] = ['iPhone', 'mobile', 'iOS'];
    osVersion = versionFrom(ua, /iPhone OS ([\d_]+)/i);
  } else if (/\bAndroid\b/i.test(ua)) {
    os = 'Android';
    if (androidTv.test(ua)) [device, type] = ['Android TV', 'tv'];
    else if (/\bMobile\b/i.test(ua) || (hints.platform === os && hints.mobile)) [device, type] = ['Android Phone', 'mobile'];
    else if (/\bTablet\b/i.test(ua)) [device, type] = ['Android Tablet', 'tablet'];
    if (!(reduced && /\bAndroid 10; K\b/i.test(ua))) osVersion = versionFrom(ua, /Android ([\d.]+)/i);
  } else if (/\bCrOS\b/i.test(ua)) {
    [device, type, os] = ['ChromeOS device', 'desktop', 'ChromeOS'];
    if (!reduced) osVersion = versionFrom(ua, /CrOS \S+ ([\d.]+)/i);
  } else if (/Windows NT/i.test(ua)) {
    [device, type, os] = ['Windows PC', 'desktop', 'Windows'];
    if (!(reduced && /Windows NT 10\.0/i.test(ua))) osVersion = versionFrom(ua, /Windows NT ([\d.]+)/i);
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    [device, type, os] = ['Mac', UNKNOWN, 'macOS'];
    if (!(reduced && /Mac OS X 10_15_7/i.test(ua))) osVersion = versionFrom(ua, /Mac OS X ([\d_.]+)/i);
    if (!/\bMobile\//i.test(ua)) type = 'desktop';
    else [device, os, osVersion] = [UNKNOWN, UNKNOWN, UNKNOWN];
  } else if (/\bLinux\b/i.test(ua) && hints.platform !== 'Android') {
    [device, type, os] = ['Linux PC', 'desktop', 'Linux'];
  }
  if (os === UNKNOWN) {
    os = hints.platform;
    if (os === 'Android' && hints.mobile) [device, type] = ['Android Phone', 'mobile'];
    if (os === 'ChromeOS') [device, type] = ['ChromeOS device', 'desktop'];
  }

  for (const [name, pattern] of browsers) {
    const version = versionFrom(ua, pattern);
    if (version === UNKNOWN) continue;
    [browser, browserVersion] = [name, name === 'Chrome' && reduced ? reduced[1] : version];
    break;
  }
  if (os === 'Android' && /[;\s]wv[;\s)]/i.test(ua)) {
    browser = 'Android WebView';
    browserVersion = reduced?.[1] || versionFrom(ua, /\bChrome\/([\d.]+)/i);
  } else if (browser === UNKNOWN && /\bVersion\/[\d.]+.*\bSafari\//i.test(ua)) {
    browser = ['iOS', 'iPadOS'].includes(os) ? 'Mobile Safari' : 'Safari';
    browserVersion = versionFrom(ua, /\bVersion\/([\d.]+)/i);
  } else if (browser === UNKNOWN && ['iOS', 'iPadOS'].includes(os) && /AppleWebKit\//i.test(ua) && /\bMobile\//i.test(ua) && !/\bSafari\//i.test(ua)) {
    browser = 'iOS WebView';
  } else if (browser === UNKNOWN || (['Chromium', 'Chrome'].includes(browser) && ![UNKNOWN, 'Chromium', browser].includes(hints.browser))) {
    if (hints.browser !== UNKNOWN) [browser, browserVersion] = [hints.browser, hints.version];
  }

  return { device_name: device, device_type: type, operating_system: os, operating_system_version: osVersion, browser, browser_version: browserVersion };
}

module.exports = { parseUserAgent, UNKNOWN, reducedChrome, crawlerTokens };
