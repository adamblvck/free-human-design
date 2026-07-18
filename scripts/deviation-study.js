#!/usr/bin/env node
//
// deviation-study — measure how far free-human-design's pure-JS ephemeris (astronomia)
// drifts from the official Swiss-Ephemeris Gene Keys engine across ~1500 years.
//
// It samples birth moments, asks BOTH engines to place the 13 Human Design bodies
// on the ecliptic, and bins the disagreement by 20-year era. Every raw official
// response is cached to scripts/data/ so a re-run is instant and offline, and an
// interrupted run resumes exactly where it stopped.
//
// Usage:
//   node scripts/deviation-study.js                 # full run: 2000 births, 1600–2200
//   node scripts/deviation-study.js --count 300     # smaller batch
//   node scripts/deviation-study.js --limit 3       # smoke test (first 3 only)
//   node scripts/deviation-study.js --report-only   # re-render reports from cache
//
// Flags: --count --start --end --seed --concurrency --delay --limit --report-only --endpoint
//
// The official engine is a THIRD-PARTY service. Defaults are deliberately polite
// (small concurrency + delay + backoff). Be considerate re-running at scale.

const fs = require('fs');
const path = require('path');
const {
  generateSamples, officialRequestBody, parseOfficialResponse, compareSample, aggregate, aggregateSpheres,
} = require('./deviation-lib');
const { buildMarkdown, buildHtml } = require('./deviation-report');

const DEFAULT_ENDPOINT = 'https://seismic.myhumancode.com/genekeysExperimentalV2';
const DATA_DIR = path.join(__dirname, 'data');

function parseArgs(argv) {
  const out = {};
  const a = argv.slice(2);
  for (let i = 0; i < a.length; i += 1) {
    if (!a[i].startsWith('--')) continue;
    const key = a[i].slice(2);
    const next = a[i + 1];
    if (next === undefined || next.startsWith('--')) { out[key] = true; }
    else { out[key] = next; i += 1; }
  }
  return out;
}

function loadCache(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { meta: {}, results: {} }; }
}
function saveCache(file, cache) {
  fs.writeFileSync(file, JSON.stringify(cache));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOfficial(endpoint, body, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(400 * 2 ** attempt); // 400ms, 800ms, 1600ms backoff
    }
  }
  return null;
}

// Small worker-pool runner: keeps `concurrency` requests in flight, calls onDone
// after each so the caller can checkpoint. Adds a per-request delay (politeness).
async function runPool(items, worker, { concurrency, delay, onProgress }) {
  let idx = 0; let done = 0;
  async function loop() {
    while (idx < items.length) {
      const my = idx; idx += 1;
      await worker(items[my], my);
      done += 1;
      if (onProgress) onProgress(done, items.length);
      if (delay) await sleep(delay);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, loop));
}

function renderReports(cache, file) {
  const rows = [];
  for (const entry of Object.values(cache.results)) {
    if (entry && Array.isArray(entry.rows)) rows.push(...entry.rows);
  }
  const agg = aggregate(rows, { width: 20 });
  const sphereAgg = aggregateSpheres(rows, { width: 20 });
  const meta = {
    window: cache.meta.window,
    samples: Object.keys(cache.results).length,
    generatedAt: new Date().toISOString(),
  };
  const mdPath = path.join(DATA_DIR, 'deviation-report.md');
  const htmlPath = path.join(DATA_DIR, 'deviation-report.html');
  fs.writeFileSync(mdPath, buildMarkdown(agg, sphereAgg, meta));
  fs.writeFileSync(htmlPath, buildHtml(agg, sphereAgg, meta));
  return { agg, sphereAgg, mdPath, htmlPath, rows: rows.length };
}

async function main() {
  const args = parseArgs(process.argv);
  const count = Number(args.count) || 2000;
  const yearStart = Number(args.start) || 1600;
  const yearEnd = Number(args.end) || 2200;
  const seed = Number(args.seed) || 20260715;
  const endpoint = typeof args.endpoint === 'string' ? args.endpoint : DEFAULT_ENDPOINT;
  const concurrency = Number(args.concurrency) || 4;
  const delay = args.delay !== undefined ? Number(args.delay) : 120;
  const limit = args.limit !== undefined ? Number(args.limit) : Infinity;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const window = `${yearStart}-${yearEnd}`;
  const cacheFile = path.join(DATA_DIR, `deviation-${window}.json`);
  const cache = loadCache(cacheFile);
  cache.meta = { ...cache.meta, window, yearStart, yearEnd, seed, count, endpoint };

  if (args['report-only']) {
    const { mdPath, htmlPath, rows } = renderReports(cache, cacheFile);
    console.log(`Report rendered from ${Object.keys(cache.results).length} cached samples (${rows} rows).`);
    console.log(`  ${mdPath}\n  ${htmlPath}`);
    return 0;
  }

  const all = generateSamples({ count, yearStart, yearEnd, seed });
  const todo = all
    .filter((s) => !cache.results[s.id])   // resume: skip cached
    .slice(0, limit === Infinity ? undefined : limit);

  console.log(`Deviation study — ${window} AD, ${count} target samples, seed ${seed}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Cached: ${Object.keys(cache.results).length} · to fetch now: ${todo.length} (concurrency ${concurrency}, delay ${delay}ms)\n`);

  let ok = 0; let fail = 0;
  let sinceSave = 0;
  const t0 = Date.now();

  await runPool(todo, async (sample) => {
    try {
      const raw = await fetchOfficial(endpoint, officialRequestBody(sample), { retries: 3 });
      const parsed = parseOfficialResponse(raw);
      const rows = compareSample(sample, parsed);
      if (!rows.length) throw new Error('no comparable bodies in response');
      cache.results[sample.id] = { sample, rows };
      ok += 1;
    } catch (err) {
      cache.results[sample.id] = { sample, error: String(err && err.message || err) };
      fail += 1;
    }
    sinceSave += 1;
    if (sinceSave >= 10) { saveCache(cacheFile, cache); sinceSave = 0; }
  }, {
    concurrency,
    delay,
    onProgress: (d, total) => {
      if (d % 25 === 0 || d === total) {
        const rate = d / ((Date.now() - t0) / 1000);
        process.stdout.write(`\r  ${d}/${total}  ok:${ok} fail:${fail}  ${rate.toFixed(1)}/s   `);
      }
    },
  });

  saveCache(cacheFile, cache);
  process.stdout.write('\n\n');

  const { mdPath, htmlPath, agg, sphereAgg, rows } = renderReports(cache, cacheFile);
  console.log(`Done. ${ok} ok, ${fail} failed. ${rows} body comparisons across ${agg.buckets.length} buckets.`);
  console.log(`All 26 bodies:    median Δ ${agg.overall.deltaArcmin.median?.toFixed(2)}′ · gate ${(agg.overall.gateMatch * 100).toFixed(1)}%`);
  console.log(`Gene Keys spheres: median Δ ${sphereAgg.overall.deltaArcmin.median?.toFixed(2)}′ · p95 ${sphereAgg.overall.deltaArcmin.p95?.toFixed(2)}′ · gate ${(sphereAgg.overall.gateMatch * 100).toFixed(1)}%`);
  console.log(`Reports:\n  ${mdPath}\n  ${htmlPath}`);
  console.log(`Cache:\n  ${cacheFile}`);
  return 0;
}

// Flush the cache on Ctrl-C so a long run is never lost.
process.on('SIGINT', () => { console.log('\nInterrupted — cache already checkpointed.'); process.exit(130); });

main().then((code) => process.exit(code || 0)).catch((err) => {
  console.error('\nFatal:', err);
  process.exit(1);
});
