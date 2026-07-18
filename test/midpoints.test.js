const { computeMidpoints, midpointOf } = require('../src/calc/midpoints');
const { mapLongitudeDegrees } = require('../src/calc/mandala');
const { computeChart } = require('../src/chart');

describe('midpointOf — shorter-arc midpoint', () => {
  test('simple midpoint on the near arc', () => {
    expect(midpointOf(10, 50).longitude).toBeCloseTo(30, 6);
  });

  test('takes the SHORT arc across 0°, not the long one', () => {
    // 350° and 10° are 20° apart across 0 → midpoint 0°, not 180°.
    expect(midpointOf(350, 10).longitude).toBeCloseTo(0, 6);
    expect(midpointOf(10, 350).longitude).toBeCloseTo(0, 6);
  });

  test('is symmetric in its arguments', () => {
    expect(midpointOf(123, 45).longitude).toBeCloseTo(midpointOf(45, 123).longitude, 9);
  });

  test('maps the midpoint onto the wheel like any other point', () => {
    const m = midpointOf(10, 50);
    const w = mapLongitudeDegrees(30);
    expect(m.gate).toBe(w.hexagram);
    expect(m.line).toBe(w.line);
  });
});

describe('computeMidpoints — matrix over points', () => {
  const points = [
    { key: 'a', body: 'sun', stream: 'personality', longitude: 0, gate: 1, line: 1 },
    { key: 'b', body: 'moon', stream: 'personality', longitude: 60, gate: 2, line: 2 },
    { key: 'c', body: 'mars', stream: 'design', longitude: 120, gate: 3, line: 3 },
  ];
  const mp = computeMidpoints(points);

  test('N points → N·(N−1)/2 unique pairs', () => {
    expect(mp.points).toHaveLength(3);
    expect(mp.pairs).toHaveLength(3); // 3·2/2
    expect(mp._meta.count).toBe(3);
    expect(mp._meta.pairCount).toBe(3);
    expect(mp._meta.method).toBe('shortest-arc');
  });

  test('matrix is N×N, symmetric, null diagonal', () => {
    expect(mp.matrix).toHaveLength(3);
    for (let i = 0; i < 3; i += 1) {
      expect(mp.matrix[i][i]).toBeNull();
      for (let j = 0; j < 3; j += 1) {
        if (i !== j) expect(mp.matrix[i][j].longitude).toBeCloseTo(mp.matrix[j][i].longitude, 9);
      }
    }
  });

  test('pair longitudes match the direct midpoint', () => {
    const ab = mp.pairs.find((p) => p.a === 'a' && p.b === 'b');
    expect(ab.longitude).toBeCloseTo(30, 6);
  });

  test('ignores points without a finite longitude', () => {
    const out = computeMidpoints([{ key: 'x', longitude: 10 }, { key: 'y' }, { key: 'z', longitude: 'nope' }]);
    expect(out._meta.count).toBe(1);
    expect(out.pairs).toHaveLength(0);
  });

  test('empty input is safe', () => {
    const out = computeMidpoints([]);
    expect(out.points).toHaveLength(0);
    expect(out.pairs).toHaveLength(0);
    expect(out.matrix).toHaveLength(0);
  });
});

describe('computeChart — midpoints are opt-in', () => {
  const birth = { birthdate: '1992-12-09', birthtime: '00:35', timezone: 'Europe/Brussels' };

  test('absent by default (default output unchanged)', () => {
    const chart = computeChart(birth);
    expect(chart.humanDesign.midpoints).toBeUndefined();
  });

  test('present with { midpoints: true } — 26 activations, 325 pairs', () => {
    const chart = computeChart({ ...birth, midpoints: true });
    const mp = chart.humanDesign.midpoints;
    expect(mp).toBeDefined();
    expect(mp._meta.count).toBe(26);
    expect(mp.pairs).toHaveLength(325); // 26·25/2
    // Points are keyed p_/d_ and carry gate/line from the activations.
    expect(mp.points.find((p) => p.key === 'p_sun')).toMatchObject({ body: 'sun', stream: 'personality' });
    expect(mp.points.find((p) => p.key === 'd_moon')).toMatchObject({ body: 'moon', stream: 'design' });
  });
});
