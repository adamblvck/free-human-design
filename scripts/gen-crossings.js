#!/usr/bin/env node
//
// gen-crossings — write a self-contained HTML page showing the "crossings" (the
// 26 Human Design activations) AND the midpoint matrix for a birth moment, with
// a "Show midpoints" toggle. The chart is pre-computed here and inlined as JSON,
// so the page opens straight from disk with no server and no build step.
//
// Default birth: 1992-12-09 00:35 Europe/Brussels (Hasselt) — the golden
// reference chart in test/reference-charts.test.js.
//
// Usage:
//   node scripts/gen-crossings.js
//   node scripts/gen-crossings.js --date 1990-04-16 --time 05:35 --tz Europe/Brussels --out scripts/crossings.html

const fs = require('fs');
const path = require('path');
const { computeChart } = require('../src/chart');

function parseArgs(argv) {
  const out = {};
  const a = argv.slice(2);
  for (let i = 0; i < a.length; i += 1) {
    if (!a[i].startsWith('--')) continue;
    const key = a[i].slice(2);
    const next = a[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

function renderHtml(chart, label) {
  const json = JSON.stringify(chart);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crossings & midpoints — ${label}</title>
<style>
  :root { color-scheme: light dark; --bg:#0e1016; --fg:#e8ebf3; --muted:#98a0b3;
    --card:#171a24; --line:#262b3a; --p:#7aa2ff; --d:#ffd27a; --mid:#8affc1; --hl:#232838; }
  @media (prefers-color-scheme: light) { :root {
    --bg:#f6f7fb; --fg:#1a1e2b; --muted:#5a627a; --card:#fff; --line:#e4e7f0;
    --p:#3a63d6; --d:#c8891a; --mid:#1a9a63; --hl:#eef1f8; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:1080px; margin:0 auto; padding:32px 20px 72px; }
  h1 { font-size:1.45rem; margin:0 0 2px; }
  h2 { font-size:1.05rem; margin:26px 0 12px; }
  .sub { color:var(--muted); margin:0 0 8px; font-size:0.9rem; }
  .facts { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0 8px; }
  .fact { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 14px; font-size:0.9rem; }
  .fact b { display:block; font-size:0.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.04em; }
  .toggle { display:inline-flex; align-items:center; gap:9px; cursor:pointer; user-select:none;
    background:var(--card); border:1px solid var(--line); border-radius:999px; padding:8px 16px; font-weight:600; }
  .toggle input { width:16px; height:16px; accent-color:var(--mid); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:6px; overflow-x:auto; margin:10px 0; }
  table { border-collapse:collapse; width:100%; font-size:0.86rem; }
  th, td { padding:6px 9px; border-bottom:1px solid var(--line); white-space:nowrap; text-align:right; }
  th:first-child, td:first-child { text-align:left; }
  th { color:var(--muted); font-weight:600; }
  .st-p { color:var(--p); } .st-d { color:var(--d); }
  .gl { font-variant-numeric:tabular-nums; font-weight:700; }
  /* midpoint matrix */
  #midSection { display:none; }
  #midSection.show { display:block; }
  .matrix { font-size:11px; border-collapse:collapse; }
  .matrix th, .matrix td { padding:3px 5px; border:1px solid var(--line); text-align:center; min-width:34px; }
  .matrix th { position:sticky; background:var(--card); }
  .matrix thead th { top:0; } .matrix tbody th { left:0; z-index:1; text-align:right; }
  .matrix td.diag { background:var(--hl); color:var(--muted); }
  .matrix td .g { font-weight:700; } .matrix td .l { color:var(--muted); }
  .matrix td:hover { outline:2px solid var(--mid); }
  .muted { color:var(--muted); font-size:0.85rem; }
  code { background:var(--hl); padding:1px 6px; border-radius:5px; font-size:0.85em; }
</style></head>
<body><div class="wrap">
  <h1>Crossings &amp; midpoints</h1>
  <p class="sub" id="sub"></p>

  <div class="facts" id="facts"></div>

  <label class="toggle"><input type="checkbox" id="midToggle"> ✳ Show midpoints</label>
  <span class="muted" id="midHint"> — the ${'26×26'} matrix of shorter-arc midpoints between every crossing.</span>

  <h2>Crossings — 26 activations</h2>
  <div class="card"><table id="crossings">
    <thead><tr><th>Body</th><th>Personality</th><th>P long°</th><th>Design</th><th>D long°</th></tr></thead>
    <tbody></tbody>
  </table></div>

  <div id="midSection">
    <h2>Midpoint matrix</h2>
    <p class="muted">Each cell is the Gene Key <code>gate.line</code> of the midpoint of its row &amp; column crossing (shorter arc on the ecliptic). Hover a cell to highlight it.</p>
    <div class="card"><table class="matrix" id="matrix"></table></div>
  </div>

<script id="chart" type="application/json">${json}</script>
<script>
  const chart = JSON.parse(document.getElementById('chart').textContent);
  const hd = chart.humanDesign;
  const gl = (a) => a ? a.gate + '.' + a.line : '—';
  const f2 = (x) => (x == null ? '—' : Number(x).toFixed(2));

  // Facts
  const facts = [
    ['Born (UTC)', chart.input.birth_utc],
    ['Type', hd.type], ['Authority', (hd.authority||'').replace(/ \\(.*\\)/,'')], ['Profile', hd.profile],
  ];
  document.getElementById('facts').innerHTML = facts.map(([k,v]) => '<div class="fact"><b>'+k+'</b>'+v+'</div>').join('');
  document.getElementById('sub').textContent =
    chart.input.birthdate + ' ' + chart.input.birthtime + ' · ' + chart.input.timezone;

  // Crossings table (personality vs design, aligned by body)
  const P = Object.fromEntries(hd.activations.personality.map(a => [a.body, a]));
  const D = Object.fromEntries(hd.activations.design.map(a => [a.body, a]));
  const ORDER = ['sun','earth','moon','north_node','south_node','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  document.querySelector('#crossings tbody').innerHTML = ORDER.map(body => {
    const p = P[body], d = D[body];
    return '<tr><td>'+body.replace('_',' ')+'</td>'
      + '<td class="st-p gl">'+gl(p)+'</td><td>'+f2(p&&p.longitude)+'</td>'
      + '<td class="st-d gl">'+gl(d)+'</td><td>'+f2(d&&d.longitude)+'</td></tr>';
  }).join('');

  // Midpoint matrix
  const mp = hd.midpoints;
  if (mp) {
    const pts = mp.points, n = pts.length;
    const head = '<thead><tr><th></th>' + pts.map(p => '<th title="'+p.key+'">'+p.key+'</th>').join('') + '</tr></thead>';
    let bodyRows = '';
    for (let i = 0; i < n; i++) {
      let cells = '<th title="'+pts[i].key+'">'+pts[i].key+'</th>';
      for (let j = 0; j < n; j++) {
        const cell = mp.matrix[i][j];
        if (i === j) cells += '<td class="diag">·</td>';
        else cells += '<td title="'+pts[i].key+' × '+pts[j].key+' = '+cell.longitude.toFixed(2)+'°">'
          + '<span class="g">'+cell.gate+'</span><span class="l">.'+cell.line+'</span></td>';
      }
      bodyRows += '<tr>'+cells+'</tr>';
    }
    document.getElementById('matrix').innerHTML = head + '<tbody>'+bodyRows+'</tbody>';
  } else {
    document.getElementById('midToggle').disabled = true;
    document.getElementById('midHint').textContent = ' — (this chart was generated without midpoints)';
  }

  // Toggle
  const section = document.getElementById('midSection');
  document.getElementById('midToggle').addEventListener('change', (e) => {
    section.classList.toggle('show', e.target.checked);
  });
</script>
</div></body></html>`;
}

function main() {
  const args = parseArgs(process.argv);
  const birthdate = typeof args.date === 'string' ? args.date : '1992-12-09';
  const birthtime = typeof args.time === 'string' ? args.time : '00:35';
  const timezone = typeof args.tz === 'string' ? args.tz : 'Europe/Brussels';
  const outFile = typeof args.out === 'string'
    ? args.out
    : path.join(__dirname, 'crossings-hasselt.html');

  const chart = computeChart({ birthdate, birthtime, timezone, midpoints: true });
  const label = `${birthdate} ${birthtime} ${timezone}`;
  fs.writeFileSync(outFile, renderHtml(chart, label));
  console.log(`Wrote ${outFile}`);
  console.log(`  ${label} · ${chart.humanDesign.type} · ${chart.humanDesign.profile} · ${chart.humanDesign.midpoints._meta.pairCount} midpoint pairs`);
}

main();
