'use strict';

const { parseUserAgent, UNKNOWN, reducedChrome, crawlerTokens } = require('./userAgent');

const recognized = value => typeof value === 'string' && value.trim() !== '' && value.trim().toLowerCase() !== 'unknown';

function identifyStoredEvent(event, parse = parseUserAgent) {
  const ua = event.user_agent?.trim() || '';
  const parsed = parse(ua);
  if (crawlerTokens.some(crawler => crawler.token.test(ua))) {
    const reason = 'The User-Agent declares a crawler. Compatibility tokens do not identify a visitor device or browser.';
    return { ...parsed, reasons: { device: reason, browser: reason } };
  }
  const storedBrowser = [event.browser, event.browser_family].find(recognized);
  const storedDevice = [event.device_name, event.device_category].find(recognized);
  // A specific stored value can come from Client Hints that are deliberately not retained.
  const correctedBrowser = !storedBrowser || (storedBrowser === 'Chrome' && !['Chromium', UNKNOWN].includes(parsed.browser));
  const browser = correctedBrowser ? parsed.browser : storedBrowser;
  const staleTablet = storedDevice === 'Android Tablet' && parsed.operating_system === 'Android';
  const preferParsedDevice = !storedDevice || staleTablet || parsed.device_type === 'tv' || (!recognized(event.device_name) && recognized(parsed.device_name));
  const deviceName = preferParsedDevice ? parsed.device_name : storedDevice;
  const deviceType = preferParsedDevice ? parsed.device_type : [event.device_type, event.device_category, parsed.device_type].find(recognized) || UNKNOWN;
  const os = recognized(event.operating_system) ? event.operating_system : parsed.operating_system;
  const reduced = reducedChrome.test(ua);
  const browserVersion = browser === parsed.browser && recognized(parsed.browser_version)
    ? parsed.browser_version
    : browser === storedBrowser && recognized(event.browser_version) ? event.browser_version : UNKNOWN;
  const osVersion = reduced && os === parsed.operating_system
    ? parsed.operating_system_version
    : os === parsed.operating_system && recognized(parsed.operating_system_version)
      ? parsed.operating_system_version : event.operating_system_version || UNKNOWN;
  const missing = ua ? 'No supported marker in the recorded User-Agent.' : 'No User-Agent recorded and no stored identification.';
  const deviceReason = os === 'Android'
    ? 'Android was identified. The available signals do not distinguish the device type.'
    : missing;
  return {
    device_name: deviceName, device_type: deviceType,
    operating_system: os, operating_system_version: osVersion,
    browser, browser_version: browserVersion,
    reasons: {
      ...(recognized(deviceName) ? {} : { device: deviceReason }),
      ...(recognized(deviceType) ? {} : { device_type: deviceReason }),
      ...(recognized(browser) ? {} : { browser: missing }),
      ...(recognized(osVersion) ? {} : { operating_system_version: reduced ? 'Detailed OS version unavailable in the reduced User-Agent.' : 'No OS version available.' }),
      ...(reduced && browser === 'Chrome' ? { browser_version: 'Only the major browser version is shown for the reduced User-Agent.' } : {}),
      ...(browser === 'iOS WebView' ? { browser: 'AppleWebKit and Mobile tokens suggest an embedded iOS browser.' } : {}),
      ...(recognized(browser) && !recognized(browserVersion) ? { browser_version: 'No browser version available.' } : {})
    }
  };
}

function lastRecognized(events, field) {
  const event = events.find(item => recognized(item.identification[field]));
  if (!event) return null;
  return {
    value: event.identification[field],
    created_at: event.created_at,
    version: field === 'browser' ? event.identification.browser_version : undefined
  };
}

module.exports = { identifyStoredEvent, lastRecognized, recognized };
