/* Free Human Design API — midpoint overlay for the astrology wheel.
 *
 * window.FhdMidpoints.sync(chart, show) draws (or clears) a ring of the 325
 * shorter-arc midpoints between the 26 Human Design activations on #wheelSvg, and
 * fills a table under it. It prefers the server-computed chart.humanDesign.midpoints
 * (from /api/chart?midpoints=1); if that's absent (e.g. the static-preview sample)
 * it computes them in-browser — the mandala math below mirrors src/calc/mandala.js.
 *
 * Wheel geometry matches charts.min.js exactly: center (320,320),
 * screen angle d(lon) = 180 - (lon - ascendantLongitude).
 */
(function () {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const CX = 320, CY = 320, RING_R = 130;

  // --- mandala mapping (mirror of src/calc/mandala.js) ---
  const ICHING = [
    55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8,
    20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29,
    59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14,
    34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60, 41, 19, 13, 49, 30,
  ];
  const PI2 = Math.PI * 2;
  const hexW = PI2 / 64, lineW = hexW / 6, colorW = lineW / 6, toneW = colorW / 6, baseW = toneW / 5;
  const D2R = Math.PI / 180, LINE_SEG = 1 / 6;
  function neutronPos(rad) {
    const off = 2 * lineW - 1 * colorW - 1 * toneW + 3 * baseW;
    const offCalc = (360 * D2R) / 64 * 5 + off;
    return (((rad + offCalc) / PI2) * 64) % 64;
  }
  function norm360(a) { const o = a % 360; return o < 0 ? o + 360 : o; }
  function mapLon(lonDeg) {
    const b = neutronPos(norm360(lonDeg) * D2R);
    const bin = Math.floor(b);
    const gate = ICHING[bin];
    const rem = b - bin;
    const line = Math.floor(rem / LINE_SEG) + 1;
    return { gate, line };
  }
  function signedDiff(a, b) { return ((a - b + 540) % 360) - 180; }
  function midpoint(a, b) { return norm360(a + signedDiff(b, a) / 2); }

  // --- build midpoint pairs from a chart (server block preferred) ---
  function pairsFromChart(chart) {
    const hd = (chart && chart.humanDesign) || {};
    if (hd.midpoints && hd.midpoints.pairs && hd.midpoints.pairs.length) {
      return hd.midpoints.pairs.map((p) => ({ a: p.a, b: p.b, lon: p.longitude, gate: p.gate, line: p.line }));
    }
    const act = hd.activations;
    if (!act) return [];
    const pts = [];
    (act.personality || []).forEach((x) => pts.push({ key: `p_${x.body}`, lon: x.longitude }));
    (act.design || []).forEach((x) => pts.push({ key: `d_${x.body}`, lon: x.longitude }));
    const out = [];
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const lon = midpoint(pts[i].lon, pts[j].lon);
        const gl = mapLon(lon);
        out.push({ a: pts[i].key, b: pts[j].key, lon, gate: gl.gate, line: gl.line });
      }
    }
    return out;
  }

  function ascLongitude(chart) {
    const a = chart && chart.astrology && chart.astrology.angles;
    return a && a.ascendant ? a.ascendant.longitude : 0;
  }

  function polar(r, deg) {
    const rad = deg * D2R;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  }

  function drawOverlay(chart, pairs) {
    const svg = document.querySelector('#wheelSvg');
    if (!svg) return;
    clearOverlay();
    const asc = ascLongitude(chart);
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('id', 'wheelMidpoints');
    // faint guide ring
    const ring = document.createElementNS(SVGNS, 'circle');
    ring.setAttribute('cx', CX); ring.setAttribute('cy', CY); ring.setAttribute('r', RING_R);
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#57e39b');
    ring.setAttribute('stroke-opacity', '0.18');
    ring.setAttribute('stroke-width', '1');
    g.appendChild(ring);
    for (const p of pairs) {
      const ang = 180 - (p.lon - asc);
      const [x, y] = polar(RING_R, ang);
      const dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      dot.setAttribute('r', '1.7');
      dot.setAttribute('fill', '#57e39b');
      dot.setAttribute('fill-opacity', '0.7');
      const t = document.createElementNS(SVGNS, 'title');
      t.textContent = `${p.a} × ${p.b} → ${p.gate}.${p.line} (${p.lon.toFixed(1)}°)`;
      dot.appendChild(t);
      g.appendChild(dot);
    }
    svg.appendChild(g);
  }

  function clearOverlay() {
    const g = document.querySelector('#wheelMidpoints');
    if (g) g.remove();
  }

  function fillTable(pairs) {
    const panel = document.querySelector('#midpointsPanel');
    if (!panel) return;
    const rows = pairs
      .map((p) => `<tr><td>${p.a}</td><td>${p.b}</td><td class="mp-gl">${p.gate}.${p.line}</td><td>${p.lon.toFixed(2)}°</td></tr>`)
      .join('');
    panel.innerHTML = `<div class="mp-count">${pairs.length} midpoints · shorter-arc, over the 26 activations</div>
      <div class="mp-scroll"><table class="mp-table">
        <thead><tr><th>A</th><th>B</th><th>Gate·Line</th><th>Longitude</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  }

  function sync(chart, show) {
    const panel = document.querySelector('#midpointsPanel');
    if (!show) {
      clearOverlay();
      if (panel) { panel.hidden = true; panel.innerHTML = ''; }
      return;
    }
    const pairs = pairsFromChart(chart);
    drawOverlay(chart, pairs);
    fillTable(pairs);
    if (panel) panel.hidden = false;
  }

  window.FhdMidpoints = { sync, pairsFromChart };
})();
