'use strict';

const UNKNOWN = 'Unknown';

function versionFrom(userAgent, pattern) {
  const match = userAgent.match(pattern);
  return match ? match[1].replace(/_/g, '.') : UNKNOWN;
}

function parseUserAgent(value) {
  const userAgent = typeof value === 'string' ? value.trim() : '';
  const result = {
    device_name: UNKNOWN,
    device_type: UNKNOWN,
    operating_system: UNKNOWN,
    operating_system_version: UNKNOWN,
    browser: UNKNOWN,
    browser_version: UNKNOWN
  };
  if (!userAgent) return result;

  if (/iPhone/i.test(userAgent)) {
    result.device_name = 'iPhone';
    result.device_type = 'mobile';
    result.operating_system = 'iOS';
    result.operating_system_version = versionFrom(userAgent, /(?:CPU )?iPhone OS ([\d_]+)/i);
  } else if (/iPad/i.test(userAgent)) {
    result.device_name = 'iPad';
    result.device_type = 'tablet';
    result.operating_system = 'iPadOS';
    result.operating_system_version = versionFrom(userAgent, /CPU OS ([\d_]+)/i);
  } else if (/Android/i.test(userAgent)) {
    result.device_name = /Mobile/i.test(userAgent) ? 'Android Phone' : 'Android Tablet';
    result.device_type = /Mobile/i.test(userAgent) ? 'mobile' : 'tablet';
    result.operating_system = 'Android';
    result.operating_system_version = versionFrom(userAgent, /Android ([\d.]+)/i);
  } else if (/Windows NT/i.test(userAgent)) {
    result.device_name = 'Windows PC';
    result.device_type = 'desktop';
    result.operating_system = 'Windows';
    result.operating_system_version = versionFrom(userAgent, /Windows NT ([\d.]+)/i);
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    result.device_name = 'Mac';
    result.device_type = 'desktop';
    result.operating_system = 'macOS';
    result.operating_system_version = versionFrom(userAgent, /Mac OS X ([\d_\.]+)/i);
  } else if (/Linux/i.test(userAgent) && !/Android/i.test(userAgent)) {
    result.device_name = 'Linux PC';
    result.device_type = 'desktop';
    result.operating_system = 'Linux';
  }

  const browsers = [
    ['Edge', /(?:EdgA|EdgiOS|Edg)\/([\d.]+)/i],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/i],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/i],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/i]
  ];
  for (const [name, pattern] of browsers) {
    const match = userAgent.match(pattern);
    if (match) {
      result.browser = name;
      result.browser_version = match[1];
      return result;
    }
  }
  const safari = userAgent.match(/Version\/([\d.]+).+Safari\//i);
  if (safari) {
    result.browser = result.device_name === 'iPhone' || result.device_name === 'iPad' ? 'Mobile Safari' : 'Safari';
    result.browser_version = safari[1];
  }
  return result;
}

module.exports = { parseUserAgent, UNKNOWN };
