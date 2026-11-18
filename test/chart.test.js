const { computeChart } = require('../src');
const { CENTERS } = require('../src/hd/bodygraph');

describe('computeChart shape & cross-section consistency', () => {
  let chart;
  beforeAll(() => {
    chart = computeChart({
      birthdate: '1972-08-02',
      birthtime: '14:30',
      timezone: 'Asia/Bangkok',
    });
  });

  it('echoes the parsed input with birth_utc and resolved location', () => {
    expect(chart.input.birth_utc).toBe('1972-08-02T07:30:00.000Z');
    expect(chart.input.location.city).toBe('Bangkok');
  });

  it('exposes the three top-level sections', () => {
    expect(chart.hexagrams).toBeDefined();
    expect(chart.bodygraph).toBeDefined();
    expect(chart.astrology).toBeDefined();
  });

  it('hexagrams carry no internal _meta key', () => {
    expect(chart.hexagrams._meta).toBeUndefined();
    expect(chart.hexagrams.p_sun).toEqual({ hexagram: 33, line: 3 });
  });

  it('bodygraph p_.sun gate matches the p_sun placement and Profile', () => {
    expect(chart.bodygraph.p_.sun.gate).toBe(chart.hexagrams.p_sun.hexagram);
    expect(chart.bodygraph.profile).toBe(
      `${chart.bodygraph.p_.sun.line}/${chart.bodygraph.d_.sun.line}`
    );
  });

  it('every activated gate corresponds to a real activation', () => {
    const { activations, activatedGates } = chart.bodygraph;
    const gatesFromActivations = new Set(
      [...activations.personality, ...activations.design].map((a) => a.gate)
    );
    expect(new Set(activatedGates)).toEqual(gatesFromActivations);
    expect(activations.personality).toHaveLength(13);
    expect(activations.design).toHaveLength(13);
  });

  it('defined and open centers partition the 9 centers', () => {
    const hd = chart.bodygraph;
    expect([...hd.definedCenters, ...hd.openCenters].sort()).toEqual([...CENTERS].sort());
    for (const c of CENTERS) {
      expect(hd.centers[c]).toBe(hd.definedCenters.includes(c));
    }
  });

  it('astrology section is null when no location can be resolved', () => {
    const noLoc = computeChart({
      birthdate: '1972-08-02',
      birthtime: '14:30',
      timezone: 'Etc/GMT-7', // valid zone, no representative city
    });
    expect(noLoc.astrology).toBeNull();
  });
});

// The /api/chart and /api/bodygraph payloads come straight from computeChart.
describe('computeChart definition — 1992-12-09 00:35 Europe/Brussels', () => {
  it('reports single definition, 1 group, 3 channels', () => {
    const hd = computeChart({
      birthdate: '1992-12-09',
      birthtime: '00:35',
      timezone: 'Europe/Brussels',
    }).bodygraph;
    expect(hd.definition).toBe('single');
    expect(hd.definitionGroups).toBe(1);
    expect(hd.channelCount).toBe(3);
    expect(hd.definitionCount).toBe(3);
  });
});

// A second, independent regression chart to catch cross-cutting drift.
describe('computeChart regression — 1991-12-25 09:15 Europe/London', () => {
  let chart;
  beforeAll(() => {
    chart = computeChart({
      birthdate: '1991-12-25',
      birthtime: '09:15',
      timezone: 'Europe/London',
    });
  });

  it('derives the expected bodygraph summary', () => {
    const hd = chart.bodygraph;
    expect(hd.type).toBe('Manifesting Generator');
    expect(hd.authority).toBe('Sacral');
    expect(hd.profile).toBe('6/2');
    expect(hd.definition).toBe('single');
    expect(hd.definitionGroups).toBe(1);
    expect(hd.channelCount).toBe(4);
    expect(hd.definitionCount).toBe(4); // deprecated alias of channelCount
    expect(hd.definedChannels.map((c) => c.key).sort()).toEqual(
      ['10-20', '10-57', '20-57', '29-46']
    );
    expect(hd.definedCenters.sort()).toEqual(['g', 'sacral', 'spleen', 'throat']);
  });

  it('derives the expected hexagram profile p_sun/d_earth', () => {
    expect(chart.hexagrams.p_sun).toEqual({ hexagram: 10, line: 6 });
    expect(chart.hexagrams.d_earth).toEqual({ hexagram: 17, line: 2 });
  });

  it('derives the expected Ascendant/MC signs at London', () => {
    expect(chart.astrology.angles.ascendant.sign).toBe('Capricorn');
    expect(chart.astrology.angles.mc.sign).toBe('Scorpio');
  });
});
