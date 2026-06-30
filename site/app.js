/* rave-engine landing page — vanilla JS, no build step. */
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
    try { localStorage.setItem('rave-theme', t); } catch (e) {}
  }
  const saved = (() => { try { return localStorage.getItem('rave-theme'); } catch (e) { return null; } })();
  applyTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  $('#themeToggle').addEventListener('click', () =>
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  /* ---------- Hero mandala spokes ---------- */
  const spokes = $('#spokes');
  if (spokes) {
    const cx = 300, cy = 300;
    let g = '';
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 - Math.PI / 2;
      const r1 = 250, r2 = i % 8 === 0 ? 290 : 270;
      g += `<line x1="${cx + r1 * Math.cos(a)}" y1="${cy + r1 * Math.sin(a)}" x2="${cx + r2 * Math.cos(a)}" y2="${cy + r2 * Math.sin(a)}"/>`;
    }
    spokes.innerHTML = g;
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
  $('#installBtn').addEventListener('click', () => copy('npm install rave-engine', 'Copied: npm install rave-engine'));

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

  /* ---------- Sample fallback (when the API isn't reachable, e.g. static preview) ---------- */
  const SAMPLE = {
    input: { birthdate: '1972-08-02', birthtime: '14:30', timezone: 'Asia/Bangkok', birth_utc: '1972-08-02T07:30:00.000Z', location: { city: 'Bangkok', lat: 13.75, lng: 100.51 } },
    geneKeys: { spheres: { lifeswork: { gk: 33, line: 3 }, evolution: { gk: 19, line: 3 }, radiance: { gk: 24, line: 5 }, purpose: { gk: 44, line: 5 }, iq: { gk: 12, line: 6 }, eq: { gk: 4, line: 4 }, pearl: { gk: 10, line: 2 }, relating: { gk: 4, line: 1 }, attraction: { gk: 11, line: 3 }, sq: { gk: 12, line: 3 }, core: { gk: 12, line: 1 }, culture: { gk: 58, line: 5 }, stability: { gk: 16, line: 1 }, creativity: { gk: 57, line: 1 } } },
    humanDesign: { type: 'Manifesting Generator', authority: 'Sacral', profile: '3/5', definedCenters: ['head', 'ajna', 'throat', 'g', 'sacral', 'spleen'], openCenters: ['heart', 'solarplexus', 'root'] },
    astrology: { angles: { ascendant: { sign: 'Sagittarius', degInSign: 9.99 }, mc: { sign: 'Virgo', degInSign: 12.65 } }, houses: { system: 'placidus' } },
  };
  const ALL_CENTERS = ['head', 'ajna', 'throat', 'g', 'heart', 'sacral', 'solarplexus', 'spleen', 'root'];

  /* ---------- Compute ---------- */
  function buildQuery() {
    const p = new URLSearchParams();
    p.set('date', $('#date').value);
    p.set('time', $('#time').value);
    p.set('tz', $('#tz').value);
    if ($('#lat').value && $('#lng').value) { p.set('lat', $('#lat').value); p.set('lng', $('#lng').value); }
    return p.toString();
  }

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
    const base = location.origin && location.protocol.startsWith('http') ? location.origin : 'https://rave-engine.netlify.app';
    $('#endpointUrl').textContent = `/api/chart?${qs}`;
    $('#curlOut').textContent = `curl "${base}/api/chart?${qs}"`;
  }

  async function compute() {
    const qs = buildQuery();
    const btn = $('#computeBtn');
    btn.textContent = '✦ Computing…';
    btn.disabled = true;
    try {
      const res = await fetch(`/api/chart?${qs}&pretty=1`);
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

  $('#computeBtn').addEventListener('click', compute);
  // Compute once on load so the panel is alive.
  compute();
})();
