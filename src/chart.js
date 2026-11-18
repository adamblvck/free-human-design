// computeChart — the high-level "powerful primitive".
//
// From a birth date / time / timezone (and an optional location), it returns
// three coherent sections:
//   - hexagrams  : the hexagram profile, hexagram + line per placement
//   - bodygraph  : the full bodygraph — activations, gates,
//                  channels, defined / open centers, Type, Authority, Profile
//   - astrology  : extended astrology — Ascendant / Descendant / MC / IC and
//                  house cusps (needs a location; null if none resolvable)

const { parseBirthToUtc } = require('./birth/parseBirth');
const { computeEngineTest, computeActivations } = require('./calc/profile');
const { computeBodygraph } = require('./hd/bodygraph');
const { computeMidpoints } = require('./calc/midpoints');
const { computeAngles, computeHouses } = require('./hd/houses');
const { resolveLocation } = require('./timezone/location');

/**
 * Build the point set fed to the midpoint matrix: the 26 bodygraph
 * activations (13 bodies × personality + design), keyed `p_<body>` / `d_<body>`.
 * @param {{ personality: Array<object>, design: Array<object> }} activations
 */
function midpointPoints(activations) {
  const fromStream = (list, prefix) =>
    list.map((a) => ({
      key: `${prefix}_${a.body}`,
      body: a.body,
      stream: prefix === 'p' ? 'personality' : 'design',
      longitude: a.longitude,
      gate: a.gate,
      line: a.line,
    }));
  return [
    ...fromStream(activations.personality, 'p'),
    ...fromStream(activations.design, 'd'),
  ];
}

/**
 * @param {{
 *   birthdate: string,
 *   birthtime: string,
 *   timezone: string,
 *   location?: { lat:number, lng:number },
 *   houseSystem?: 'placidus'|'whole'|'equal',
 *   midpoints?: boolean
 * }} input
 */
function computeChart(input) {
  const birthUtc = parseBirthToUtc(input);

  const engine = computeEngineTest({ birthUtc });
  const activations = computeActivations({ birthUtc });
  const derived = computeBodygraph(activations);

  // Resolve a birth location: explicit lat/lng wins, else the timezone's
  // representative (most-populous-city) coordinates.
  const location = resolveLocation({
    lat: input.location && input.location.lat,
    lng: input.location && input.location.lng,
    timezone: input.timezone,
  });

  let astrology = null;
  if (location) {
    const jdUT = engine._meta.jd_personality;
    const houseSystem = input.houseSystem || 'placidus';
    astrology = {
      location,
      angles: computeAngles({ jdUT, lat: location.lat, lng: location.lng }),
      houses: computeHouses({ jdUT, lat: location.lat, lng: location.lng, system: houseSystem }),
    };
  }

  // The hexagram profile without the internal _meta key.
  const { _meta: spheresMeta, ...spheres } = engine.hexagrams;

  const bodygraph = {
    type: derived.type,
    authority: derived.authority,
    profile: derived.profile,
    definition: derived.definition,
    definitionGroups: derived.definitionGroups,
    channelCount: derived.channelCount,
    definitionCount: derived.definitionCount, // deprecated: same as channelCount
    p_: engine.p_,
    d_: engine.d_,
    activations: { personality: activations.personality, design: activations.design },
    activatedGates: derived.activatedGates,
    definedChannels: derived.definedChannels,
    definedCenters: derived.definedCenters,
    openCenters: derived.openCenters,
    centers: derived.centers,
    gateActivations: derived.gateActivations,
  };

  // Advanced, opt-in: the midpoint matrix over the 26 activations. Left off the
  // default output (it's O(n²) and most callers don't need it).
  if (input.midpoints) {
    bodygraph.midpoints = computeMidpoints(midpointPoints(activations));
  }

  return {
    input: {
      birthdate: input.birthdate,
      birthtime: input.birthtime,
      timezone: input.timezone,
      birth_utc: birthUtc.toISOString(),
      location,
    },
    hexagrams: spheres,
    bodygraph,
    astrology,
    _meta: engine._meta,
  };
}

module.exports = { computeChart, midpointPoints };
