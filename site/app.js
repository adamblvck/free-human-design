/* Free Human Design API landing page — vanilla JS, no build step. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>';
  const MOON = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    $('#themeIcon').innerHTML = t === 'dark' ? MOON : SUN;
    try { localStorage.setItem('fhd-theme', t); } catch (e) {}
  }
  const saved = (() => { try { return localStorage.getItem('fhd-theme'); } catch (e) { return null; } })();
  applyTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  $('#themeToggle').addEventListener('click', () =>
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  /* ---------- Hero rings: ticks + rotating zodiac ---------- */
  const cx = 300, cy = 300;
  const tick = (r1, r2, a) =>
    `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy + r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy + r2 * Math.sin(a)).toFixed(1)}"/>`;
  const outerTicks = $('#heroOuterTicks');
  if (outerTicks) {
    let g = '';
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      g += tick(298, i % 8 === 0 ? 286 : 292, a);
    }
    outerTicks.innerHTML = g;
  }
  const innerTicks = $('#heroInnerTicks');
  if (innerTicks) {
    let g = '';
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      g += tick(210, i % 8 === 0 ? 224 : 217, a);
    }
    innerTicks.innerHTML = g;
  }
  const heroZodiac = $('#heroZodiac');
  if (heroZodiac) {
    // Astrodot zodiac glyphs (a..l) riding the slow outer ring.
    let g = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const x = cx + 268 * Math.cos(a), y = cy + 268 * Math.sin(a);
      g += `<text class="hz-glyph" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${'abcdefghijkl'[i]}</text>`;
    }
    heroZodiac.innerHTML = g;
  }

  /* ---------- Ambient glyph field ---------- */
  const field = $('#glyphField');
  if (field && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const GLYPHS = 'ABCDEFGHIJLMabcdefghijkl'; // planets + zodiac (Astrodot)
    let html = '';
    for (let i = 0; i < 18; i++) {
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      const left = (Math.random() * 100).toFixed(1);
      const top = (55 + Math.random() * 55).toFixed(1); // start in the lower half+
      const size = (18 + Math.random() * 42).toFixed(0);
      const dur = (55 + Math.random() * 70).toFixed(0);
      const delay = (-Math.random() * 120).toFixed(0);
      const op = (0.035 + Math.random() * 0.05).toFixed(3);
      const rot = ((Math.random() - 0.5) * 120).toFixed(0);
      html += `<span style="left:${left}vw; top:${top}vh; font-size:${size}px; --dur:${dur}s; --delay:${delay}s; --op:${op}; --rot:${rot}deg">${ch}</span>`;
    }
    field.innerHTML = html;
  }

  /* ---------- Toast ---------- */
  const toast = $('#toast');
  let toastT;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 1900);
  }
  function copy(text, msg) {
    navigator.clipboard.writeText(text).then(() => showToast(msg || 'Copied')).catch(() => showToast('Copy failed'));
  }
  $('#installBtn').addEventListener('click', () => copy('npm install free-human-design', 'Copied: npm install free-human-design'));

  /* ---------- Timezone hints ---------- */
  const COMMON_TZ = ['Asia/Bangkok', 'Europe/Brussels', 'Europe/London', 'America/New_York', 'America/Los_Angeles',
    'America/Chicago', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney', 'Europe/Warsaw', 'Europe/Paris', 'UTC'];
  $('#tzlist').innerHTML = COMMON_TZ.map((z) => `<option value="${z}">`).join('');

  /* ---------- JSON highlight ---------- */
  function highlight(obj) {
    const json = JSON.stringify(obj, null, 2)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json
      .replace(/"([^"]+)":/g, '<span class="tok-key">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="tok-str">"$1"</span>')
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="tok-num">$1</span>');
  }

  /* ---------- Tabs ---------- */
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.remove('active'));
    $$('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $('#panel-' + tab.dataset.tab).classList.add('active');
  }));

  /* ---------- Docs tabs (REST / JavaScript) ---------- */
  $$('.docs-tab').forEach((tab) => tab.addEventListener('click', () => {
    $$('.docs-tab').forEach((t) => t.classList.remove('active'));
    $$('.docs-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $('#docs-' + tab.dataset.docs).classList.add('active');
  }));

  /* ---------- Copy-minis (literal data-copy) ---------- */
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', () =>
    copy(btn.dataset.copy, 'Copied')));

  /* ---------- JavaScript usage snippet ---------- */
  const JS_USAGE = `const { computeChart } = require('free-human-design');

const chart = computeChart({
  birthdate: '1990-04-16',
  birthtime: '05:35',
  timezone: 'Europe/Brussels',
});

console.log(chart.humanDesign.type);             // "Manifesting Generator"
console.log(chart.humanDesign.profile);          // "6/2"
console.log(chart.geneKeys.spheres.lifeswork.gk); // 13
console.log(chart.astrology.angles.ascendant.sign); // "Aries"`;
  const copyUsage = $('#copyUsageBtn');
  if (copyUsage) copyUsage.addEventListener('click', () => copy(JS_USAGE, 'Usage snippet copied'));

  /* ---------- Markdown doc for LLM use ---------- */
  const LLM_MARKDOWN = `# Free Human Design API — Human Design, Gene Keys & Astrology API

Free Human Design API is a free, open-source, local-first engine for computing Human Design bodygraphs, Gene Keys hologenetic profiles, and astrology charts (Ascendant, MC, houses). It is the most tested engine of its kind — 247 passing tests across 13 suites (~90% coverage), five real third-party reference charts (125/130 activations exact), and a 2,000-birth study vs the official Gene Keys engine (99.4% gate / 95.6% line agreement on hologenetic spheres). Pure JavaScript — no native build, no ephemeris files. MIT licensed.

## Two ways to use it

### 1. Offline (npm) — your birth data never leaves your machine

\`\`\`bash
npm install free-human-design
\`\`\`

\`\`\`js
const { computeChart } = require('free-human-design');

const chart = computeChart({
  birthdate: '1990-04-16',
  birthtime: '05:35',
  timezone: 'Europe/Brussels',
});

chart.humanDesign.type;                       // "Manifesting Generator"
chart.humanDesign.authority;                  // "Sacral"
chart.humanDesign.profile;                    // "6/2"
chart.humanDesign.definedCenters;             // ["throat","g","sacral", ...]
chart.geneKeys.spheres.lifeswork;             // { gk: 13, line: 4, ... }
chart.astrology.angles.ascendant.sign;        // "Aries"
chart.astrology.angles.ascendant.degInSign;   // 25.3
\`\`\`

CLI:

\`\`\`bash
npx free-human-design --chart --date 1990-04-16 --time 05:35 --tz Europe/Brussels
\`\`\`

### 2. Online (REST API) — no API key, open CORS

\`\`\`bash
curl "https://freehumandesign.netlify.app/api/chart?date=1990-04-16&time=05:35&tz=Europe/Brussels"
\`\`\`

| Endpoint          | Returns                                                     |
| ----------------- | ----------------------------------------------------------- |
| \`/api/chart\`      | Full chart — Gene Keys + Human Design + Astrology          |
| \`/api/genekeys\`   | Gene Keys spheres only                                     |
| \`/api/humandesign\` | Human Design bodygraph only                                |
| \`/api/astrology\`  | Ascendant / MC / houses (needs lat/lng)                    |
| \`/api/midpoints\`  | Advanced — midpoint matrix over the 26 activations         |
| \`/api/prompt\`     | A ready-to-paste AI interpretation prompt                  |
| \`/api/timezones\`  | IANA timezone search (\`?q=bali\`)                            |

Params: \`date=YYYY-MM-DD\`, \`time=HH:mm\`, \`tz=IANA\`, optional \`lat\`, \`lng\`, \`house=placidus|whole|equal\`, \`midpoints=1\`.

Add \`?midpoints=1\` (alias \`?advanced=1\`) to any chart route to include \`humanDesign.midpoints\` — the shorter-arc midpoint matrix (points, pairs, and an N×N grid) over all 26 Human Design activations.

## Output shape (abridged)

\`\`\`json
{
  "input": { "birthdate": "1990-04-16", "birthtime": "05:35", "timezone": "Europe/Brussels" },
  "humanDesign": {
    "type": "Manifesting Generator",
    "authority": "Sacral",
    "profile": "6/2",
    "definedCenters": ["throat", "g", "sacral", "solarplexus", "root"],
    "gateActivations": { "1": [{ "stream": "personality", "gate": 1, "line": 4 }], "...": "..." },
    "centers": { "head": false, "ajna": false, "throat": true, "...": "..." }
  },
  "geneKeys": {
    "spheres": {
      "lifeswork": { "gk": 13, "line": 4 },
      "evolution": { "gk": 7, "line": 3 },
      "radiance":  { "gk": 2, "line": 5 },
      "purpose":   { "gk": 32, "line": 1 },
      "attraction":{ "gk": 9, "line": 6 },
      "iq":        { "gk": 47, "line": 2 },
      "eq":        { "gk": 6, "line": 5 },
      "sq":        { "gk": 36, "line": 1 },
      "core":      { "gk": 31, "line": 5 },
      "culture":   { "gk": 8, "line": 1 },
      "pearl":     { "gk": 4, "line": 6 }
    }
  },
  "astrology": {
    "angles": {
      "ascendant": { "sign": "Aries", "degInSign": 25.3, "longitude": 25.3 },
      "mc":        { "sign": "Capricorn", "degInSign": 12.7, "longitude": 282.7 }
    },
    "houses": { "cusps": [ { "house": 1, "longitude": 25.3 }, "..." ] }
  }
}
\`\`\`

## Links

- npm: https://www.npmjs.com/package/free-human-design
- GitHub: https://github.com/adamblvck/free-human-design
- Live API + chart demo: https://freehumandesign.netlify.app

## Notes for LLMs

- The engine is deterministic and local-first; given the same birth moment it always returns the same chart.
- All calculations run in pure JavaScript — no external ephemeris files, no native dependencies.
- Use the JSON shape above to read a chart: \`humanDesign\` for bodygraph facts (Type, Authority, Profile, defined centers, gate activations), \`geneKeys.spheres\` for the Hologenetic Profile, \`astrology\` for angles and houses.
- For interpretation, call \`/api/prompt?date=...&time=...&tz=...\` to get a ready-to-paste prompt that includes the full chart.`;
  const copyMd = $('#copyMarkdownBtn');
  if (copyMd) copyMd.addEventListener('click', () => copy(LLM_MARKDOWN, 'Markdown doc copied — paste it into any LLM'));

  /* ---------- Sample fallback (when the API isn't reachable, e.g. static preview) ---------- */
  const SAMPLE = window.SAMPLE_CHART || {};
  const ALL_CENTERS = ['head', 'ajna', 'throat', 'g', 'heart', 'sacral', 'solarplexus', 'spleen', 'root'];

  /* ---------- Shareable URL state ---------- */
  function buildQuery() {
    const p = new URLSearchParams();
    p.set('date', $('#date').value);
    p.set('time', $('#time').value);
    p.set('tz', $('#tz').value);
    if ($('#lat').value && $('#lng').value) { p.set('lat', $('#lat').value); p.set('lng', $('#lng').value); }
    return p.toString();
  }

  // Prefill the form from the URL (?date=&time=&tz=&lat=&lng=) so links are shareable.
  (function readParams() {
    const q = new URLSearchParams(location.search);
    if (q.get('date')) $('#date').value = q.get('date');
    if (q.get('time')) $('#time').value = q.get('time');
    if (q.get('tz')) $('#tz').value = q.get('tz');
    if (q.get('lat')) $('#lat').value = q.get('lat');
    if (q.get('lng')) $('#lng').value = q.get('lng');
  })();

  function shareUrl(qs) {
    return location.origin + location.pathname + '?' + qs;
  }
  function copyShareLink() {
    const qs = buildQuery();
    try { history.replaceState(null, '', '?' + qs); } catch (e) {}
    copy(shareUrl(qs), 'Chart link copied — share it anywhere');
  }
  $('#copyLinkBtn').addEventListener('click', copyShareLink);
  $('#copyLinkBtn2').addEventListener('click', copyShareLink);

  function render(chart, qs) {
    const hd = chart.humanDesign || {};
    $('#s-type').textContent = hd.type || '—';
    $('#s-auth').textContent = (hd.authority || '—').replace(/ \(.*\)/, '');
    $('#s-profile').textContent = hd.profile || '—';

    const defined = new Set(hd.definedCenters || []);
    $('#s-centers').innerHTML = ALL_CENTERS.map((c) =>
      `<span class="chip ${defined.has(c) ? 'on' : ''}">${c}</span>`).join('');

    const spheres = (chart.geneKeys && chart.geneKeys.spheres) || {};
    $('#s-spheres').innerHTML = Object.entries(spheres).map(([k, v]) =>
      `<div class="sphere"><span class="name">${k}</span><span class="gk">${v.gk}.${v.line}</span></div>`).join('');

    const a = chart.astrology;
    $('#s-astro').innerHTML = a
      ? `<span class="chip on">ASC ${a.angles.ascendant.sign} ${a.angles.ascendant.degInSign.toFixed(1)}°</span>
         <span class="chip on">MC ${a.angles.mc.sign} ${a.angles.mc.degInSign.toFixed(1)}°</span>`
      : '<span class="chip">no location — add lat/lng or a city timezone</span>';

    $('#jsonOut').innerHTML = highlight(chart);
    const base = location.origin && location.protocol.startsWith('http') ? location.origin : 'https://freehumandesign.netlify.app';
    $('#endpointUrl').textContent = `/api/chart?${qs}`;
    $('#curlOut').textContent = `curl "${base}/api/chart?${qs}"`;
    $('#copyJsonBtn').onclick = () => copy(JSON.stringify(chart, null, 2), 'Chart JSON copied');
    $('#copyCurlBtn').onclick = () => copy(`curl "${base}/api/chart?${qs}"`, 'cURL command copied');

    // Drawn charts (wheel, bodygraph, hologenetic profile)
    if (window.FhdCharts) window.FhdCharts.renderAll(chart);
    // Midpoint overlay follows the current toggle state (re-drawn each render).
    lastChart = chart;
    if (window.FhdMidpoints) window.FhdMidpoints.sync(chart, $('#midToggle') && $('#midToggle').checked);
    const note = $('#wheelNote');
    if (note) note.textContent = chart.astrology ? '' : 'Add a location (or a city timezone) for houses & angles.';
  }

  // Remember the last rendered chart so the midpoint toggle can redraw without recomputing.
  let lastChart = null;
  const midToggle = $('#midToggle');
  if (midToggle) midToggle.addEventListener('change', () => {
    if (window.FhdMidpoints) window.FhdMidpoints.sync(lastChart, midToggle.checked);
  });

  async function compute(updateUrl) {
    const qs = buildQuery();
    // Keep the address bar shareable, but don't stamp params on a clean first load.
    if (updateUrl || location.search) { try { history.replaceState(null, '', '?' + qs); } catch (e) {} }
    const btn = $('#computeBtn');
    btn.textContent = '✦ Computing…';
    btn.disabled = true;
    try {
      const res = await fetch(`/api/chart?${qs}&pretty=1&midpoints=1`);
      if (!res.ok) throw new Error('api ' + res.status);
      const chart = await res.json();
      render(chart, qs);
      // Prompt tab
      try {
        const pr = await fetch(`/api/prompt?${qs}`);
        const promptText = await pr.text();
        $('#promptOut').textContent = promptText;
        $('#openChatGpt').href = 'https://chatgpt.com/?q=' + encodeURIComponent(promptText);
        $('#copyPromptBtn').onclick = () => copy(promptText, 'AI prompt copied');
      } catch (e) {}
    } catch (e) {
      // Static-preview fallback.
      render(SAMPLE, qs);
      $('#promptOut').textContent = 'The live API (and AI prompt) run on the deployed site. This is a sample result.';
      showToast('Live API runs on the deployed site — showing a sample');
    } finally {
      btn.textContent = '✦ Compute chart';
      btn.disabled = false;
    }
  }

  $('#computeBtn').addEventListener('click', () => compute(true));
  // Compute once on load so the panel (and the drawn charts) are alive.
  compute(false);
})();
