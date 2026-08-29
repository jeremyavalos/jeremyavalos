'use strict';

const assert = require('assert');
const { parseUserAgent } = require('../src/userAgent');

const cases = [
  {
    name: 'iPhone Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    expected: { device_name:'iPhone', device_type:'mobile', operating_system:'iOS', operating_system_version:'26.0', browser:'Mobile Safari', browser_version:'26.0' }
  },
  {
    name: 'Android Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    expected: { device_name:'Android Phone', device_type:'mobile', operating_system:'Android', operating_system_version:'15', browser:'Chrome', browser_version:'140.0.0.0' }
  },
  {
    name: 'Windows Chrome',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    expected: { device_name:'Windows PC', device_type:'desktop', operating_system:'Windows', operating_system_version:'10.0', browser:'Chrome', browser_version:'140.0.0.0' }
  },
  {
    name: 'macOS Safari',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    expected: { device_name:'Mac', device_type:'desktop', operating_system:'macOS', operating_system_version:'10.15.7', browser:'Safari', browser_version:'18.6' }
  },
  {
    name: 'Linux Firefox',
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0',
    expected: { device_name:'Linux PC', device_type:'desktop', operating_system:'Linux', operating_system_version:'Unknown', browser:'Firefox', browser_version:'142.0' }
  },
  {
    name: 'unknown ambiguous',
    ua: 'ExampleClient/1.0',
    expected: { device_name:'Unknown', device_type:'Unknown', operating_system:'Unknown', operating_system_version:'Unknown', browser:'Unknown', browser_version:'Unknown' }
  }
];

for (const test of cases) assert.deepStrictEqual(parseUserAgent(test.ua), test.expected, test.name);
assert.deepStrictEqual(parseUserAgent(null), cases.at(-1).expected, 'missing User-Agent');
console.log(`user-agent regression tests passed (${cases.length + 1} cases)`);
