const {
  CENTERS,
  GATE_CENTER,
  CHANNELS,
  computeBodygraph,
  computeDefinition,
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
      expect(bg.definition).toBe('single');
      expect(bg.definitionGroups).toBe(1);
      expect(bg.channelCount).toBe(6);
      expect(bg.definitionCount).toBe(6); // deprecated alias of channelCount
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

// Definition counts the separate groups of defined centers, not channels.
describe('definition (connected groups of defined centers)', () => {
  const byKey = (...keys) => keys.map((k) => CHANNELS.find((ch) => ch.key === k));
  // Light both gates of each channel, everything on the personality side.
  const activationsFor = (...keys) => ({
    personality: byKey(...keys).flatMap((ch) =>
      ch.gates.map((gate) => ({ body: 'sun', gate, line: 1 }))),
    design: [],
  });

  it('no defined channels → none (Reflector)', () => {
    expect(computeDefinition([])).toEqual({ definition: 'none', groups: [] });
    const bg = computeBodygraph({ personality: [], design: [] });
    expect(bg.definition).toBe('none');
    expect(bg.definitionGroups).toBe(0);
    expect(bg.channelCount).toBe(0);
  });

  it('one channel → single', () => {
    expect(computeDefinition(byKey('34-57'))).toEqual({
      definition: 'single', groups: [['sacral', 'spleen']],
    });
  });

  it('a chain of channels through shared centers is still single', () => {
    // Head–Ajna, Ajna–Throat, Throat–Solar Plexus: three channels, one group.
    const bg = computeBodygraph(activationsFor('47-64', '11-56', '12-22'));
    expect(bg.channelCount).toBe(3);
    expect(bg.definition).toBe('single');
    expect(bg.definitionGroups).toBe(1);
  });

  it('two channels that share no center → split', () => {
    expect(computeDefinition(byKey('25-51', '30-41'))).toEqual({
      definition: 'split', groups: [['g', 'heart'], ['solarplexus', 'root']],
    });
  });

  it('three islands → triple split', () => {
    const { definition, groups } = computeDefinition(byKey('47-64', '12-22', '42-53'));
    expect(definition).toBe('triple split');
    expect(groups).toEqual([['head', 'ajna'], ['throat', 'solarplexus'], ['sacral', 'root']]);
  });

  it('four islands → quadruple split (the most nine centers allow)', () => {
    const bg = computeBodygraph(activationsFor('47-64', '1-8', '26-44', '42-53'));
    expect(bg.definition).toBe('quadruple split');
    expect(bg.definitionGroups).toBe(4);
    expect(bg.openCenters).toEqual(['solarplexus']);
  });

  it('a bridging channel joins two islands back into one', () => {
    // 25-51 (G–Heart) and 30-41 (Solar Plexus–Root) are split; 37-40 joins
    // Heart to the Solar Plexus.
    expect(computeDefinition(byKey('25-51', '30-41', '37-40')).definition).toBe('single');
  });

  it('every group is made of defined centers, and together they cover them all', () => {
    const bg = computeBodygraph(activationsFor('47-64', '12-22', '42-53', '28-38'));
    const { groups } = computeDefinition(bg.definedChannels);
    expect(groups.flat().sort()).toEqual([...bg.definedCenters].sort());
    expect(groups).toHaveLength(bg.definitionGroups);
  });

  describe('1992-12-09 00:35 Europe/Brussels (3 channels, one group)', () => {
    let bg;
    beforeAll(() => {
      const birthUtc = parseBirthToUtc({
        birthdate: '1992-12-09',
        birthtime: '00:35',
        timezone: 'Europe/Brussels',
      });
      bg = computeBodygraph(computeActivations({ birthUtc }));
    });

    it('has the three channels 11-56, 12-22, 47-64', () => {
      expect(bg.definedChannels.map((c) => c.key).sort()).toEqual(['11-56', '12-22', '47-64']);
    });

    it('is single definition: Head–Ajna–Throat–Solar Plexus in one group', () => {
      expect(bg.definition).toBe('single');
      expect(bg.definitionGroups).toBe(1);
      expect(computeDefinition(bg.definedChannels).groups).toEqual(
        [['head', 'ajna', 'throat', 'solarplexus']]
      );
    });

    it('keeps the deprecated definitionCount as the channel count', () => {
      expect(bg.channelCount).toBe(3);
      expect(bg.definitionCount).toBe(3);
    });
  });
});
