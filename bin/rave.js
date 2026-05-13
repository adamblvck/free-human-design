#!/usr/bin/env node

const { computeProfile, searchTimezones } = require('../src');

function parseArgs(argv) {
  // Tiny argv parser. Supports `--key value` and `--key=value`. No deps.
  const out = {};
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    let key;
    let val;
    if (eq >= 0) {
      key = a.slice(2, eq);
      val = a.slice(eq + 1);
    } else {
      key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        val = next;
        i += 1;
      } else {
        val = true;
      }
    }
    out[key] = val;
  }
  return out;
}

function printUsage() {
  const lines = [
    'rave-engine CLI',
    '',
    'Compute a profile:',
    '  rave --date 1972-08-02 --time 14:30 --tz Asia/Bangkok',
    '',
    'Aliases: --date|--birthdate, --time|--birthtime, --tz|--timezone',
    '',
    'Search timezones:',
    '  rave --tz-search bali',
    '  rave --tz-search "los ang" --limit 5',
    '',
    'Flags:',
    '  --json     Print full JSON (default for profile mode).',
    '  --pretty   Indent output (default: 2 spaces).',
    '  --help     Show this help.',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

function formatOffsetMinutes(min) {
  const sign = min >= 0 ? '+' : '-';
  const abs = Math.abs(min);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function runTzSearch(query, limit) {
  const results = searchTimezones(query, { limit });
  if (results.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`(no matches for "${query}")`);
    return 0;
  }

  const widthIana = Math.max(...results.map((r) => r.ianaName.length));
  for (const r of results) {
    const offset = formatOffsetMinutes(r.currentOffsetMinutes);
    const city = r.mainCity || '';
    const country = r.countryName || '';
    // eslint-disable-next-line no-console
    console.log(
      `${r.ianaName.padEnd(widthIana)}  ${offset}  ${city}${country ? `, ${country}` : ''}`
    );
  }
  return 0;
}

function runProfile(args) {
  const birthdate = args.date || args.birthdate;
  const birthtime = args.time || args.birthtime;
  const timezone = args.tz || args.timezone;

  if (!birthdate || !birthtime || !timezone) {
    // eslint-disable-next-line no-console
    console.error('error: --date, --time and --tz are all required\n');
    printUsage();
    return 2;
  }

  const out = computeProfile({ birthdate, birthtime, timezone });
  const indent = args.pretty === false ? 0 : 2;
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, indent));
  return 0;
}

function main(argv) {
  const args = parseArgs(argv);

  if (args.help || args.h) {
    printUsage();
    return 0;
  }

  if (args['tz-search'] !== undefined && args['tz-search'] !== true) {
    const limit = Number.isFinite(Number(args.limit)) ? Number(args.limit) : 10;
    return runTzSearch(String(args['tz-search']), limit);
  }

  return runProfile(args);
}

try {
  process.exitCode = main(process.argv) || 0;
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(`error: ${e?.message || e}`);
  process.exitCode = 1;
}
