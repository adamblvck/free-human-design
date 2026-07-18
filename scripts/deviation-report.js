// deviation-report — render an aggregate (from deviation-lib.aggregate) into a
// Markdown report and a self-contained HTML report (inline SVG bar chart, no deps).

function fmt(x, digits = 2) {
  return x == null ? '—' : Number(x).toFixed(digits);
}
function pct(x) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

function buildMarkdown(agg, sphereAgg, meta = {}) {
  const L = [];
  L.push('# free-human-design vs official Gene Keys engine — deviation study');
  L.push('');
  if (meta.window) L.push(`- **Window:** ${meta.window} AD, binned by ${agg.width} years`);
  if (meta.samples != null) L.push(`- **Samples:** ${meta.samples} births (${agg.overall.rows} body activations compared)`);
  if (meta.generatedAt) L.push(`- **Generated:** ${meta.generatedAt}`);
  L.push(`- **Heuristic:** astronomia (VSOP87 + abridged lunar theory) · **Reference:** genekeysExperimentalV2 (Swiss Ephemeris)`);
  L.push(`- **Metric:** Δ = shortest angular distance between the two ecliptic longitudes (arcminutes; 1° = 60′).`);
  L.push('');
  if (sphereAgg) {
    L.push('## Gene Keys profile spheres (headline)');
    L.push('');
    L.push(`The ${sphereAgg.sphereCount} spheres a Hologenetic Profile actually reads never include Pluto,`);
    L.push('Neptune or the lunar nodes — the bodies that dominate the deviation — so profile');
    L.push(`accuracy is far tighter than the all-26-body figure (${sphereAgg.overall.rows} sphere activations compared):`);
    L.push('');
    L.push('| | Gene Keys spheres | All 26 bodies |');
    L.push('| --- | --- | --- |');
    L.push(`| Median Δ | **${fmt(sphereAgg.overall.deltaArcmin.median)}′** | ${fmt(agg.overall.deltaArcmin.median)}′ |`);
    L.push(`| p95 Δ | **${fmt(sphereAgg.overall.deltaArcmin.p95)}′** | ${fmt(agg.overall.deltaArcmin.p95)}′ |`);
    L.push(`| max Δ | ${fmt(sphereAgg.overall.deltaArcmin.max)}′ | ${fmt(agg.overall.deltaArcmin.max)}′ |`);
    L.push(`| Gate match | **${pct(sphereAgg.overall.gateMatch)}** | ${pct(agg.overall.gateMatch)} |`);
    L.push(`| Line match | **${pct(sphereAgg.overall.lineMatch)}** | ${pct(agg.overall.lineMatch)} |`);
    L.push('');
    L.push('### Per sphere (all eras)');
    L.push('');
    L.push('| Sphere | Body | Median Δ′ | p95 Δ′ | Max Δ′ | Gate% | Line% |');
    L.push('| ------ | ---- | --------- | ------ | ------ | ----- | ----- |');
    for (const [name, s] of Object.entries(sphereAgg.bySphere)) {
      L.push(`| ${name} | ${s.stream === 'personality' ? 'p' : 'd'}_${s.body} | ${fmt(s.deltaArcmin.median)} | ${fmt(s.deltaArcmin.p95)} | ${fmt(s.deltaArcmin.max)} | ${pct(s.gateMatch)} | ${pct(s.lineMatch)} |`);
    }
    L.push('');
    L.push('### Sphere deviation by 20-year bucket');
    L.push('');
    L.push('| Bucket | Median Δ′ | p95 Δ′ | Max Δ′ | Gate% | Line% |');
    L.push('| ------ | --------- | ------ | ------ | ----- | ----- |');
    for (const b of sphereAgg.buckets) {
      L.push(`| ${b.bucketStart}–${b.bucketEnd} | ${fmt(b.deltaArcmin.median)} | ${fmt(b.deltaArcmin.p95)} | ${fmt(b.deltaArcmin.max)} | ${pct(b.gateMatch)} | ${pct(b.lineMatch)} |`);
    }
    L.push('');
  }
  L.push('## All 26 activations');
  L.push('');
  L.push(`- Median Δ: **${fmt(agg.overall.deltaArcmin.median)}′**, p95: ${fmt(agg.overall.deltaArcmin.p95)}′, max: ${fmt(agg.overall.deltaArcmin.max)}′`);
  L.push(`- Gate match: **${pct(agg.overall.gateMatch)}**, line match: **${pct(agg.overall.lineMatch)}**`);
  L.push('');
  L.push('## Deviation by 20-year bucket');
  L.push('');
  L.push('| Bucket | Samples | Median Δ′ | p95 Δ′ | Max Δ′ | Pluto med Δ′ | Gate% | Line% |');
  L.push('| ------ | ------- | --------- | ------ | ------ | ------------ | ----- | ----- |');
  for (const b of agg.buckets) {
    L.push(`| ${b.bucketStart}–${b.bucketEnd} | ${b.samples} | ${fmt(b.deltaArcmin.median)} | ${fmt(b.deltaArcmin.p95)} | ${fmt(b.deltaArcmin.max)} | ${fmt(b.plutoArcmin.median)} | ${pct(b.gateMatch)} | ${pct(b.lineMatch)} |`);
  }
  L.push('');
  L.push('## By body (all eras)');
  L.push('');
  L.push('| Body | Median Δ′ | p95 Δ′ | Max Δ′ | Gate% | Line% |');
  L.push('| ---- | --------- | ------ | ------ | ----- | ----- |');
  const bodies = Object.keys(agg.byBody).sort(
    (a, b) => (agg.byBody[b].deltaArcmin.median || 0) - (agg.byBody[a].deltaArcmin.median || 0)
  );
  for (const body of bodies) {
    const s = agg.byBody[body];
    L.push(`| ${body} | ${fmt(s.deltaArcmin.median)} | ${fmt(s.deltaArcmin.p95)} | ${fmt(s.deltaArcmin.max)} | ${pct(s.gateMatch)} | ${pct(s.lineMatch)} |`);
  }
  L.push('');
  L.push('## Notes & caveats');
  L.push('');
  L.push('- **Pluto drives the era-dependent divergence** (see the by-body table): its long-term');
  L.push('  orbit is the hardest to approximate, so free-human-design\'s precession-based Pluto drifts');
  L.push('  from Swiss Ephemeris by tens of arcminutes at the window extremes. The lunar nodes are');
  L.push('  a distant second. The Sun, Moon and the other planets stay well inside a gate line.');
  L.push('- Both engines convert the *same local time + IANA timezone* to UTC independently. Before');
  L.push('  ~1900 the IANA database uses Local Mean Time and ΔT is less certain; part of the early');
  L.push('  and far-future p95/max Δ is timezone/ΔT policy, not ephemeris. Median (robust to those');
  L.push('  outliers) is the headline stat for that reason.');
  L.push('- Longitudes are geocentric tropical; the study assumes the official engine is geocentric too.');
  return L.join('\n');
}

function buildHtml(agg, sphereAgg, meta = {}) {
  const buckets = agg.buckets;
  // Bar chart of median + p95 Δ per bucket.
  const W = 960, H = 420, padL = 56, padR = 20, padT = 30, padB = 70;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxY = Math.max(1, ...buckets.map((b) => b.deltaArcmin.p95 || 0)) * 1.1;
  const n = buckets.length || 1;
  const bw = plotW / n;
  const x = (i) => padL + i * bw;
  const y = (v) => padT + plotH - (Math.min(v, maxY) / maxY) * plotH;

  const bars = buckets.map((b, i) => {
    const cx = x(i) + bw * 0.5;
    const wMed = bw * 0.5;
    const med = b.deltaArcmin.median || 0;
    const p95 = b.deltaArcmin.p95 || 0;
    const pluto = b.plutoArcmin.median || 0;
    const label = i % Math.ceil(n / 16) === 0 ? `${b.bucketStart}` : '';
    return `
      <rect x="${(cx - wMed / 2).toFixed(1)}" y="${y(p95).toFixed(1)}" width="${wMed.toFixed(1)}" height="${(y(0) - y(p95)).toFixed(1)}" fill="var(--p95)" opacity="0.35"><title>${b.bucketStart}–${b.bucketEnd}: p95 ${p95.toFixed(1)}′</title></rect>
      <rect x="${(cx - wMed / 2).toFixed(1)}" y="${y(med).toFixed(1)}" width="${wMed.toFixed(1)}" height="${(y(0) - y(med)).toFixed(1)}" fill="var(--med)"><title>${b.bucketStart}–${b.bucketEnd}: median ${med.toFixed(1)}′ · pluto ${pluto.toFixed(1)}′ · gate ${(b.gateMatch * 100).toFixed(0)}%</title></rect>
      <circle cx="${cx.toFixed(1)}" cy="${y(pluto).toFixed(1)}" r="2.5" fill="var(--moon)"><title>Pluto median ${pluto.toFixed(1)}′</title></circle>
      ${label ? `<text x="${cx.toFixed(1)}" y="${(H - padB + 18).toFixed(1)}" class="xlab" transform="rotate(45 ${cx.toFixed(1)} ${(H - padB + 18).toFixed(1)})">${label}</text>` : ''}`;
  }).join('');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = maxY * f;
    return `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" class="grid"/>
      <text x="${padL - 8}" y="${(y(v) + 3).toFixed(1)}" class="ylab">${v.toFixed(0)}′</text>`;
  }).join('');

  const rows = buckets.map((b) => `
    <tr><td>${b.bucketStart}–${b.bucketEnd}</td><td>${b.samples}</td>
    <td>${fmt(b.deltaArcmin.median)}</td><td>${fmt(b.deltaArcmin.p95)}</td>
    <td>${fmt(b.deltaArcmin.max)}</td><td>${fmt(b.plutoArcmin.median)}</td>
    <td>${pct(b.gateMatch)}</td><td>${pct(b.lineMatch)}</td></tr>`).join('');

  // Gene Keys sphere section (headline): sphere-only KPIs + per-sphere table.
  let sphereSection = '';
  if (sphereAgg) {
    const sphereRows = Object.entries(sphereAgg.bySphere).map(([name, s]) => `
      <tr><td>${name}</td><td>${s.stream === 'personality' ? 'p' : 'd'}_${s.body}</td>
      <td>${fmt(s.deltaArcmin.median)}</td><td>${fmt(s.deltaArcmin.p95)}</td>
      <td>${fmt(s.deltaArcmin.max)}</td><td>${pct(s.gateMatch)}</td><td>${pct(s.lineMatch)}</td></tr>`).join('');
    sphereSection = `
  <h2 class="sec">Gene Keys profile spheres <span class="badge">headline</span></h2>
  <p class="sub">The ${sphereAgg.sphereCount} spheres a Hologenetic Profile actually reads never include Pluto,
    Neptune or the lunar nodes — the bodies that dominate the deviation — so profile accuracy is far tighter
    (${sphereAgg.overall.rows.toLocaleString()} sphere activations).</p>
  <div class="kpis">
    <div class="kpi hl"><div class="v">${fmt(sphereAgg.overall.deltaArcmin.median)}′</div><div class="k">Sphere median Δ</div></div>
    <div class="kpi hl"><div class="v">${fmt(sphereAgg.overall.deltaArcmin.p95)}′</div><div class="k">Sphere p95 Δ</div></div>
    <div class="kpi hl"><div class="v">${pct(sphereAgg.overall.gateMatch)}</div><div class="k">Sphere gate match</div></div>
    <div class="kpi hl"><div class="v">${pct(sphereAgg.overall.lineMatch)}</div><div class="k">Sphere line match</div></div>
  </div>
  <div class="card">
    <table>
      <thead><tr><th>Sphere</th><th>Body</th><th>Median Δ′</th><th>p95 Δ′</th><th>Max Δ′</th><th>Gate%</th><th>Line%</th></tr></thead>
      <tbody>${sphereRows}</tbody>
    </table>
  </div>
  <h2 class="sec">All 26 activations</h2>
  <p class="sub">The full body set, including Pluto and the nodes — the diagnostic view.</p>`;
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>free-human-design deviation study${meta.window ? ` — ${meta.window}` : ''}</title>
<style>
  :root { color-scheme: light dark; --bg:#0e1016; --fg:#e8ebf3; --muted:#98a0b3;
    --card:#171a24; --line:#262b3a; --med:#7aa2ff; --p95:#7aa2ff; --moon:#ffd27a; --grid:#222736; }
  @media (prefers-color-scheme: light) { :root {
    --bg:#f6f7fb; --fg:#1a1e2b; --muted:#5a627a; --card:#fff; --line:#e4e7f0;
    --med:#3a63d6; --p95:#3a63d6; --moon:#c8891a; --grid:#eceff6; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:1000px; margin:0 auto; padding:32px 20px 64px; }
  h1 { font-size:1.5rem; margin:0 0 4px; }
  .sub { color:var(--muted); margin:0 0 20px; font-size:0.9rem; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; margin:18px 0; overflow-x:auto; }
  .kpis { display:flex; flex-wrap:wrap; gap:14px; }
  .kpi { flex:1 1 150px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .kpi .v { font-size:1.5rem; font-weight:700; } .kpi .k { color:var(--muted); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.04em; }
  svg { width:100%; height:auto; display:block; }
  .grid { stroke:var(--grid); stroke-width:1; } .ylab, .xlab { fill:var(--muted); font-size:11px; }
  .ylab { text-anchor:end; } .xlab { text-anchor:start; }
  .legend { display:flex; gap:18px; color:var(--muted); font-size:0.82rem; margin-top:10px; flex-wrap:wrap; }
  .legend i { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
  table { border-collapse:collapse; width:100%; font-size:0.86rem; }
  th, td { text-align:right; padding:6px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }
  th:first-child, td:first-child { text-align:left; }
  th { color:var(--muted); font-weight:600; position:sticky; top:0; background:var(--card); }
  .note { color:var(--muted); font-size:0.85rem; } .note li { margin:4px 0; }
  h2.sec { font-size:1.05rem; margin:30px 0 4px; }
  .badge { font-size:0.62rem; text-transform:uppercase; letter-spacing:0.06em; color:#0e1016;
    background:#57e39b; border-radius:6px; padding:2px 7px; vertical-align:middle; margin-left:6px; }
  .kpi.hl { border-color:#57e39b55; background:linear-gradient(180deg, #57e39b14, transparent); }
  .kpi.hl .v { color:#2ea87a; } @media (prefers-color-scheme: dark) { .kpi.hl .v { color:#57e39b; } }
</style></head>
<body><div class="wrap">
  <h1>free-human-design vs official Gene Keys engine</h1>
  <p class="sub">Ecliptic-longitude deviation of the pure-JS heuristic (astronomia) against the
    Swiss-Ephemeris genekeysExperimentalV2 engine${meta.window ? ` · ${meta.window} AD` : ''}${meta.samples != null ? ` · ${meta.samples} births` : ''}.</p>

${sphereSection}

  <div class="kpis">
    <div class="kpi"><div class="v">${fmt(agg.overall.deltaArcmin.median)}′</div><div class="k">Median Δ</div></div>
    <div class="kpi"><div class="v">${fmt(agg.overall.deltaArcmin.p95)}′</div><div class="k">p95 Δ</div></div>
    <div class="kpi"><div class="v">${pct(agg.overall.gateMatch)}</div><div class="k">Gate match</div></div>
    <div class="kpi"><div class="v">${pct(agg.overall.lineMatch)}</div><div class="k">Line match</div></div>
  </div>

  <div class="card">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deviation by 20-year bucket">
      ${yTicks}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" class="grid"/>
      <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" class="grid"/>
      ${bars}
    </svg>
    <div class="legend">
      <span><i style="background:var(--med)"></i>Median Δ (arcmin)</span>
      <span><i style="background:var(--med);opacity:0.35"></i>p95 Δ</span>
      <span><i style="background:var(--moon)"></i>Pluto median Δ</span>
    </div>
  </div>

  <div class="card">
    <table>
      <thead><tr><th>Bucket</th><th>Samples</th><th>Median Δ′</th><th>p95 Δ′</th><th>Max Δ′</th><th>Pluto med Δ′</th><th>Gate%</th><th>Line%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="card note">
    <strong>Notes</strong>
    <ul>
      <li>Δ = shortest angular distance between the two ecliptic longitudes (1° = 60′). Median is the headline stat (robust to timezone/ΔT outliers).</li>
      <li>Both engines convert the same local time + IANA timezone to UTC independently; pre-1900 Local Mean Time and less-certain ΔT can add non-ephemeris Δ.</li>
      <li><strong>Pluto (dotted) drives the growth toward the extremes</strong> — its long-term orbit is the hardest to approximate. Sun/Moon/planets stay well inside a gate line across all eras.</li>
    </ul>
  </div>
</div></body></html>`;
}

module.exports = { buildMarkdown, buildHtml };
