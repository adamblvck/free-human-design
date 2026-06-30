// rave-engine free API — a single routing function.
//
// Everything is computed locally (pure-JS ephemeris); no third-party astrology
// service is ever called. CORS is open so the API is usable from any browser,
// notebook, or AI tool.
//
//   GET /api                      → usage / endpoint index
//   GET /api/chart?...            → full chart (geneKeys + humanDesign + astrology)
//   GET /api/genekeys?...         → Gene Keys spheres only
//   GET /api/humandesign?...      → Human Design bodygraph only
//   GET /api/astrology?...        → Ascendant / MC / houses only (needs location)
//   GET /api/prompt?...           → a ready-to-paste AI interpretation prompt
//   GET /api/timezones?q=bali     → IANA timezone search
//
// Birth params: date=YYYY-MM-DD  time=HH:mm  tz=IANA  [lat= lng= house=placidus|whole|equal]
// Extra:        pretty=1 (indented JSON)

const {
  computeChart,
  searchTimezones,
  BirthParseError,
} = require('../../src/index');

const pkg = require('../../package.json');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, body, pretty) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
    body: JSON.stringify(body, null, pretty ? 2 : 0),
  };
}

function text(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
    body,
  };
}

function routeFromPath(event) {
  const p = event.path || '';
  const stripped = p.replace(/^\/(?:\.netlify\/functions\/api|api)\/?/, '');
  const seg = stripped.split('/')[0] || '';
  const q = event.queryStringParameters || {};
  return (seg || q.endpoint || '').toLowerCase();
}

function getBirthInput(q) {
  const input = {
    birthdate: q.date || q.birthdate,
    birthtime: q.time || q.birthtime,
    timezone: q.tz || q.timezone,
  };
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) input.location = { lat, lng };
  if (q.house) input.houseSystem = q.house;
  return input;
}

const USAGE = {
  name: 'rave-engine',
  version: pkg.version,
  description: 'Free, local-only Gene Keys + Human Design + Astrology API.',
  docs: 'https://github.com/adamblvck/eventhorizon/tree/main/rave-engine',
  endpoints: {
    'GET /api/chart': 'Full chart. Params: date, time, tz, [lat, lng, house]',
    'GET /api/genekeys': 'Gene Keys spheres only.',
    'GET /api/humandesign': 'Human Design bodygraph only.',
    'GET /api/astrology': 'Ascendant / MC / houses (needs a location or a city timezone).',
    'GET /api/prompt': 'A ready-to-paste AI interpretation prompt.',
    'GET /api/timezones': 'IANA timezone search. Param: q',
  },
  example: '/api/chart?date=1972-08-02&time=14:30&tz=Asia/Bangkok',
};

function buildPrompt(chart) {
  const gk = chart.geneKeys.spheres;
  const hd = chart.humanDesign;
  const a = chart.astrology;
  const lines = [];
  lines.push('You are a wise, grounded Gene Keys and Human Design guide. Using the');
  lines.push('hologenetic profile below, help me contemplate my design and gently guide');
  lines.push('me into the teaching. Be encouraging, specific, and non-deterministic.');
  lines.push('');
  lines.push(`Born (UTC): ${chart.input.birth_utc}`);
  lines.push('');
  lines.push('## Human Design');
  lines.push(`- Type: ${hd.type}`);
  lines.push(`- Strategy/Authority: ${hd.authority}`);
  lines.push(`- Profile: ${hd.profile}`);
  lines.push(`- Defined centers: ${hd.definedCenters.join(', ') || 'none'}`);
  lines.push(`- Open centers: ${hd.openCenters.join(', ') || 'none'}`);
  lines.push(`- Defined channels: ${hd.definedChannels.map((c) => c.key + (c.name ? ` (${c.name})` : '')).join(', ') || 'none'}`);
  lines.push('');
  lines.push('## Gene Keys (Hologenetic Profile)');
  for (const [sphere, v] of Object.entries(gk)) {
    lines.push(`- ${sphere}: Gene Key ${v.gk}, Line ${v.line}`);
  }
  if (a) {
    lines.push('');
    lines.push('## Astrology');
    lines.push(`- Ascendant: ${a.angles.ascendant.sign} ${a.angles.ascendant.degInSign.toFixed(1)}°`);
    lines.push(`- Midheaven: ${a.angles.mc.sign} ${a.angles.mc.degInSign.toFixed(1)}°`);
  }
  lines.push('');
  lines.push('Please: 1) summarise the core theme of my design, 2) explain my Type &');
  lines.push("Authority in plain language, 3) reflect on my Life's Work and Purpose Gene");
  lines.push('Keys, and 4) suggest one contemplation to begin with.');
  return lines.join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const q = event.queryStringParameters || {};
  const pretty = q.pretty === '1' || q.pretty === 'true';
  const route = routeFromPath(event);

  try {
    if (!route || route === 'index' || route === 'help') {
      return json(200, USAGE, true);
    }

    if (route === 'timezones' || route === 'tz') {
      const results = searchTimezones(q.q || q.query || '', { limit: Number(q.limit) || 10 });
      return json(200, { query: q.q || q.query || '', results }, pretty);
    }

    // All remaining routes need birth input.
    const input = getBirthInput(q);
    if (!input.birthdate || !input.birthtime || !input.timezone) {
      return json(400, {
        error: 'Missing required params: date, time, tz.',
        example: USAGE.example,
        endpoints: USAGE.endpoints,
      }, true);
    }

    const chart = computeChart(input);

    switch (route) {
      case 'chart':
        return json(200, chart, pretty);
      case 'genekeys':
      case 'gene-keys':
      case 'jinki':
        return json(200, { input: chart.input, geneKeys: chart.geneKeys }, pretty);
      case 'humandesign':
      case 'human-design':
      case 'hd':
        return json(200, { input: chart.input, humanDesign: chart.humanDesign }, pretty);
      case 'astrology':
      case 'astro':
        if (!chart.astrology) {
          return json(422, {
            error: 'No location could be resolved. Pass lat & lng, or a timezone with a known city.',
            input: chart.input,
          }, true);
        }
        return json(200, { input: chart.input, astrology: chart.astrology }, pretty);
      case 'prompt':
      case 'ai':
        if (q.format === 'json') return json(200, { prompt: buildPrompt(chart) }, pretty);
        return text(200, buildPrompt(chart));
      default:
        return json(404, { error: `Unknown endpoint "${route}".`, endpoints: USAGE.endpoints }, true);
    }
  } catch (err) {
    if (err instanceof BirthParseError) {
      return json(400, { error: err.message }, true);
    }
    return json(500, { error: 'Internal error', detail: String(err && err.message) }, true);
  }
};
