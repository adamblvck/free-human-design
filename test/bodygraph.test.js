const {
  CENTERS,
  GATE_CENTER,
  CHANNELS,
  computeBodygraph,
} = require('../src/hd/bodygraph');
const { computeActivations } = require('../src/calc/profile');
const { parseBirthToUtc } = require('../src/birth/parseBirth');

describe('bodygraph reference data integrity', () => {
  it('maps all 64 gates exactly once to a known center', () => {
    const gates = Object.keys(GATE_CENTER).map(Number).sort((a, b) => a - b);
    expect(gates).toHaveLength(64);
    for (let g = 1; g <= 64; g += 1) {
      expect(GATE_CENTER[g]).toBeDefined();
      expect(CENTERS).toContain(GATE_CENTER[g]);
    }
  });

  it('has 36 channels, each connecting two distinct, valid centers', () => {
    expect(CHANNELS).toHaveLength(36);
    const keys = new Set();
    for (const ch of CHANNELS) {
      expect(ch.gates).toHaveLength(2);
      // gate→center derivation matches the gate map
      expect(ch.centers[0]).toBe(GATE_CENTER[ch.gates[0]]);
      expect(ch.centers[1]).toBe(GATE_CENTER[ch.gates[1]]);
      expect(ch.centers[0]).not.toBe(ch.centers[1]);
      expect(CENTERS).toContain(ch.centers[0]);
      expect(CENTERS).toContain(ch.centers[1]);
      keys.add(ch.key);
    }
    expect(keys.size).toBe(36);
  });
});

describe('computeBodygraph derivation', () => {
  it('an empty activation set defines nothing → Reflector', () => {
    const bg = computeBodygraph({ personality: [], design: [] });
    expect(bg.type).toBe('Reflector');
    expect(bg.authority).toBe('Lunar (Reflector)');
    expect(bg.definedCenters).toEqual([]);
    expect(bg.openCenters).toEqual(CENTERS);
  });

  it('detects a defined channel and its two centers', () => {
    // Channel 34-57 connects Sacral and Spleen.
    const bg = computeBodygraph({
      personality: [{ body: 'sun', gate: 34, line: 1 }],
      design: [{ body: 'sun', gate: 57, line: 1 }],
    });
    expect(bg.activatedGates).toEqual([34, 57]);
    expect(bg.definedChannels.map((c) => c.key)).toContain('34-57');
    expect(bg.definedCenters.sort()).toEqual(['sacral', 'spleen']);
    expect(bg.openCenters).not.toContain('sacral');
  });

  describe('1972-08-02 14:30 Asia/Bangkok fixture', () => {
    let bg;
    beforeAll(() => {
      const birthUtc = parseBirthToUtc({
        birthdate: '1972-08-02',
        birthtime: '14:30',
        timezone: 'Asia/Bangkok',
      });
      bg = computeBodygraph(computeActivations({ birthUtc }));
    });

    it('derives the expected Type / Authority / Profile', () => {
      expect(bg.type).toBe('Manifesting Generator');
      expect(bg.authority).toBe('Sacral');
      expect(bg.profile).toBe('3/5');
      expect(bg.definitionCount).toBe(6);
    });

    it('derives the expected defined channels', () => {
      expect(bg.definedChannels.map((c) => c.key).sort()).toEqual(
        ['10-34', '10-57', '11-56', '16-48', '24-61', '34-57']
      );
    });

    it('derives the expected defined and open centers', () => {
      expect(bg.definedCenters.sort()).toEqual(
        ['ajna', 'g', 'head', 'sacral', 'spleen', 'throat']
      );
      expect(bg.openCenters.sort()).toEqual(['heart', 'root', 'solarplexus']);
    });

    it('defined + open centers partition all 9 centers', () => {
      expect([...bg.definedCenters, ...bg.openCenters].sort()).toEqual([...CENTERS].sort());
    });
  });
});
