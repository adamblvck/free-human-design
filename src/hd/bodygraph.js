// Human Design bodygraph: the canonical (Jovian Archive / Ra Uru Hu) mapping of
// the 64 gates to the 9 centers and the 36 channels, plus the derivation of a
// full bodygraph (activated gates, defined channels, defined / open centers,
// Type, Authority, Profile) from a set of planetary gate activations.
//
// This data is fixed, well-known reference data — the same bodygraph used by
// every Human Design chart calculator.

// The 9 centers.
const CENTERS = [
  'head',
  'ajna',
  'throat',
  'g',
  'heart',
  'sacral',
  'solarplexus',
  'spleen',
  'root',
];

// Human-readable center labels.
const CENTER_LABELS = {
  head: 'Head',
  ajna: 'Ajna',
  throat: 'Throat',
  g: 'G (Identity)',
  heart: 'Heart (Ego/Will)',
  sacral: 'Sacral',
  solarplexus: 'Solar Plexus',
  spleen: 'Spleen',
  root: 'Root',
};

// The "motor" centers — sources of energy/pressure that can power the Throat.
const MOTOR_CENTERS = ['sacral', 'heart', 'solarplexus', 'root'];

// Gate → center. All 64 gates appear exactly once (asserted in tests).
const GATE_CENTER = {
  // Head (Crown)
  64: 'head', 61: 'head', 63: 'head',
  // Ajna
  47: 'ajna', 24: 'ajna', 4: 'ajna', 17: 'ajna', 11: 'ajna', 43: 'ajna',
  // Throat
  62: 'throat', 23: 'throat', 56: 'throat', 35: 'throat', 12: 'throat', 45: 'throat',
  33: 'throat', 8: 'throat', 31: 'throat', 20: 'throat', 16: 'throat',
  // G (Identity / Self)
  1: 'g', 13: 'g', 25: 'g', 46: 'g', 2: 'g', 15: 'g', 10: 'g', 7: 'g',
  // Heart (Ego / Will)
  21: 'heart', 40: 'heart', 26: 'heart', 51: 'heart',
  // Spleen
  48: 'spleen', 57: 'spleen', 44: 'spleen', 50: 'spleen', 32: 'spleen', 28: 'spleen', 18: 'spleen',
  // Sacral
  34: 'sacral', 5: 'sacral', 14: 'sacral', 29: 'sacral', 59: 'sacral', 9: 'sacral',
  3: 'sacral', 42: 'sacral', 27: 'sacral',
  // Solar Plexus (Emotional)
  6: 'solarplexus', 37: 'solarplexus', 30: 'solarplexus', 55: 'solarplexus',
  49: 'solarplexus', 22: 'solarplexus', 36: 'solarplexus',
  // Root
  53: 'root', 60: 'root', 52: 'root', 19: 'root', 39: 'root', 41: 'root',
  58: 'root', 38: 'root', 54: 'root',
};

// The 36 channels as unordered gate pairs. The two centers a channel connects
// are DERIVED from GATE_CENTER (see CHANNELS below) so the data can't drift.
const CHANNEL_GATE_PAIRS = [
  [1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31], [9, 52],
  [10, 20], [10, 34], [10, 57], [11, 56], [12, 22], [13, 33], [16, 48], [17, 62],
  [18, 58], [19, 49], [20, 34], [20, 57], [21, 45], [23, 43], [24, 61], [25, 51],
  [26, 44], [27, 50], [28, 38], [29, 46], [30, 41], [32, 54], [34, 57], [35, 36],
  [37, 40], [39, 55], [42, 53], [47, 64],
];

// Optional channel names (nice-to-have for output; not required for derivation).
const CHANNEL_NAMES = {
  '1-8': 'Inspiration', '2-14': 'The Beat', '3-60': 'Mutation', '4-63': 'Logic',
  '5-15': 'Rhythm', '6-59': 'Mating', '7-31': 'The Alpha', '9-52': 'Concentration',
  '10-20': 'Awakening', '10-34': 'Exploration', '10-57': 'Perfected Form',
  '11-56': 'Curiosity', '12-22': 'Openness', '13-33': 'The Prodigal',
  '16-48': 'The Wavelength', '17-62': 'Acceptance', '18-58': 'Judgment',
  '19-49': 'Synthesis', '20-34': 'Charisma', '20-57': 'The Brainwave',
  '21-45': 'Money', '23-43': 'Structuring', '24-61': 'Awareness', '25-51': 'Initiation',
  '26-44': 'Surrender', '27-50': 'Preservation', '28-38': 'Struggle',
  '29-46': 'Discovery', '30-41': 'Recognition', '32-54': 'Transformation',
  '34-57': 'Power', '35-36': 'Transitoriness', '37-40': 'Community',
  '39-55': 'Emoting', '42-53': 'Maturation', '47-64': 'Abstraction',
};

function channelKey(a, b) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${lo}-${hi}`;
}

// Materialized channel list with derived centers.
const CHANNELS = CHANNEL_GATE_PAIRS.map(([a, b]) => {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const key = `${lo}-${hi}`;
  return {
    key,
    gates: [lo, hi],
    centers: [GATE_CENTER[lo], GATE_CENTER[hi]],
    name: CHANNEL_NAMES[key] || null,
  };
});

function uniqueSorted(nums) {
  return [...new Set(nums)].sort((x, y) => x - y);
}

// Reachability in the defined-center graph: can any motor center reach Throat?
function motorConnectsToThroat(definedCentersSet, definedChannels) {
  if (!definedCentersSet.has('throat')) return false;
  // adjacency among defined centers via defined channels
  const adj = new Map();
  for (const c of definedCentersSet) adj.set(c, new Set());
  for (const ch of definedChannels) {
    const [c1, c2] = ch.centers;
    if (adj.has(c1) && adj.has(c2)) {
      adj.get(c1).add(c2);
      adj.get(c2).add(c1);
    }
  }
  const motors = MOTOR_CENTERS.filter((m) => definedCentersSet.has(m));
  // BFS from each motor; success if Throat is reached.
  const seen = new Set();
  const queue = [...motors];
  motors.forEach((m) => seen.add(m));
  while (queue.length) {
    const cur = queue.shift();
    if (cur === 'throat') return true;
    for (const nxt of adj.get(cur) || []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return false;
}

function determineType(definedCentersSet, definedChannels) {
  if (definedCentersSet.size === 0) return 'Reflector';
  const sacral = definedCentersSet.has('sacral');
  const motorThroat = motorConnectsToThroat(definedCentersSet, definedChannels);
  if (sacral) return motorThroat ? 'Manifesting Generator' : 'Generator';
  return motorThroat ? 'Manifestor' : 'Projector';
}

function determineAuthority(definedCentersSet, definedChannels) {
  const has = (c) => definedCentersSet.has(c);
  if (definedCentersSet.size === 0) return 'Lunar (Reflector)';
  if (has('solarplexus')) return 'Emotional (Solar Plexus)';
  if (has('sacral')) return 'Sacral';
  if (has('spleen')) return 'Splenic';
  if (has('heart')) return 'Ego (Heart)';
  // G defined and connected to the throat → Self-Projected.
  if (has('g') && has('throat')) {
    const gReachesThroat = motorConnectsToThroatFrom('g', definedCentersSet, definedChannels);
    if (gReachesThroat) return 'Self-Projected (G)';
  }
  // Only awareness/throat centers → Mental (Environmental / "None").
  return 'Mental (None / Environmental)';
}

// Generic reachability from a single start center to the throat.
function motorConnectsToThroatFrom(start, definedCentersSet, definedChannels) {
  if (!definedCentersSet.has('throat') || !definedCentersSet.has(start)) return false;
  const adj = new Map();
  for (const c of definedCentersSet) adj.set(c, new Set());
  for (const ch of definedChannels) {
    const [c1, c2] = ch.centers;
    if (adj.has(c1) && adj.has(c2)) {
      adj.get(c1).add(c2);
      adj.get(c2).add(c1);
    }
  }
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === 'throat') return true;
    for (const nxt of adj.get(cur) || []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return false;
}

/**
 * Derive a full Human Design bodygraph from planetary activations.
 *
 * @param {{
 *   personality: Array<{ body: string, gate: number, line: number }>,
 *   design: Array<{ body: string, gate: number, line: number }>
 * }} activations  (as returned by computeActivations)
 * @returns {{
 *   type: string,
 *   authority: string,
 *   profile: string,
 *   definitionCount: number,
 *   activatedGates: number[],
 *   definedChannels: Array<{ key, gates, centers, name }>,
 *   definedCenters: string[],
 *   openCenters: string[],
 *   centers: Record<string, boolean>,
 *   gateActivations: Record<number, Array<{ stream, body, line }>>
 * }}
 */
function computeBodygraph(activations) {
  const personality = activations.personality || [];
  const design = activations.design || [];
  const all = [...personality, ...design];

  const activatedGates = uniqueSorted(all.map((a) => a.gate));
  const gateSet = new Set(activatedGates);

  const definedChannels = CHANNELS.filter(
    (ch) => gateSet.has(ch.gates[0]) && gateSet.has(ch.gates[1])
  );

  const definedCentersSet = new Set();
  for (const ch of definedChannels) {
    definedCentersSet.add(ch.centers[0]);
    definedCentersSet.add(ch.centers[1]);
  }
  const definedCenters = CENTERS.filter((c) => definedCentersSet.has(c));
  const openCenters = CENTERS.filter((c) => !definedCentersSet.has(c));

  const centers = {};
  for (const c of CENTERS) centers[c] = definedCentersSet.has(c);

  // Per-gate activation detail (which body/stream lit each gate).
  const gateActivations = {};
  for (const a of all) {
    if (!gateActivations[a.gate]) gateActivations[a.gate] = [];
    gateActivations[a.gate].push({ stream: a.stream, body: a.body, line: a.line });
  }

  // Profile = personality Sun line / design Sun line.
  const pSun = personality.find((a) => a.body === 'sun');
  const dSun = design.find((a) => a.body === 'sun');
  const profile = pSun && dSun ? `${pSun.line}/${dSun.line}` : null;

  return {
    type: determineType(definedCentersSet, definedChannels),
    authority: determineAuthority(definedCentersSet, definedChannels),
    profile,
    definitionCount: definedChannels.length,
    activatedGates,
    definedChannels,
    definedCenters,
    openCenters,
    centers,
    gateActivations,
  };
}

module.exports = {
  CENTERS,
  CENTER_LABELS,
  MOTOR_CENTERS,
  GATE_CENTER,
  CHANNELS,
  CHANNEL_NAMES,
  channelKey,
  computeBodygraph,
};
