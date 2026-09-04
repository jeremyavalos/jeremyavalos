const fs = require('fs');
const path = require('path');
const { build } = require('../../returning-visitor-copy');

function assert(value, message) { if (!value) throw new Error(message); }

for (const city of ['Denver', 'Miami', 'Paris']) {
  const copy = build({ city, ip:'203.0.113.8', current_visit:'2026-09-04T10:12:00Z' });
  assert(copy.locationHeadline === `${city.toUpperCase()} THIS TIME?`, `${city} headline was not dynamic`);
  assert(copy.locationLead.includes(city), `${city} location copy was not dynamic`);
  assert(copy.locationQualifier.includes('current IP'), `${city} copy overstated location certainty`);
}

const unknown = build({ ip:'203.0.113.8', current_visit:'2026-09-04T10:12:00Z' });
assert(unknown.locationHeadline === 'WELCOME BACK.' && unknown.locationLead.includes("isn't giving me much of a location"), 'Unknown-location fallback is missing');

const root = path.join(__dirname, '..', '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(script.includes('cooldownMs: 7 * 24 * 60 * 60 * 1000'), 'Seven-day dismissal cooldown changed');
assert(script.includes("params.get('challenge')") && script.includes("document.querySelector('dialog[open]')") && script.includes("document.querySelector('form:focus-within')"), 'Active interaction suppression is incomplete');
assert(script.includes('context.previous_visit') && script.includes('context.current_visit'), 'Real visit timestamps are not rendered');
assert(script.includes("trackPopup('returning_popup_details_opened')"), 'Details-open analytics are missing');
assert(styles.includes('@media (prefers-reduced-motion: reduce)') && styles.includes('@media (max-width: 480px)'), 'Motion or mobile styling regression');
assert(html.includes('CONNECTION DETAILS') && !html.includes('152.233.23.194') && !html.includes('AS60068'), 'Technical details are missing or hardcoded');
console.log('Returning popup copy, fallback, cooldown, interaction, motion, and mobile regressions passed');
