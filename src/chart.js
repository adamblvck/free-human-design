// computeChart — the high-level "powerful primitive".
//
// From a birth date / time / timezone (and an optional location), it returns
// three coherent sections:
//   - geneKeys   : the Gene Keys ("Jinki") sphere map — gk + line per sphere
//   - humanDesign: the full Human Design bodygraph — activations, gates,
//                  channels, defined / open centers, Type, Authority, Profile
//   - astrology  : extended astrology — Ascendant / Descendant / MC / IC and
//                  house cusps (needs a location; null if none resolvable)

const { parseBirthToUtc } = require('./birth/parseBirth');
const { computeEngineTest, computeActivations } = require('./calc/profile');
const { computeBodygraph } = require('./hd/bodygraph');
const { computeAngles, computeHouses } = require('./hd/houses');
const { resolveLocation } = require('./timezone/location');

/**
 * @param {{
 *   birthdate: string,
 *   birthtime: string,
 *   timezone: string,
 *   location?: { lat:number, lng:number },
 *   houseSystem?: 'placidus'|'whole'|'equal'
 * }} input
 */
function computeChart(input) {
  const birthUtc = parseBirthToUtc(input);

  const engine = computeEngineTest({ birthUtc });
  const activations = computeActivations({ birthUtc });
  const bodygraph = computeBodygraph(activations);

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

  // geneKeys spheres without the internal _meta key.
  const { _meta: spheresMeta, ...spheres } = engine.spheres;

  return {
    input: {
      birthdate: input.birthdate,
      birthtime: input.birthtime,
      timezone: input.timezone,
      birth_utc: birthUtc.toISOString(),
      location,
    },
    geneKeys: { spheres },
    humanDesign: {
      type: bodygraph.type,
      authority: bodygraph.authority,
      profile: bodygraph.profile,
      definitionCount: bodygraph.definitionCount,
      p_: engine.p_,
      d_: engine.d_,
      activations: { personality: activations.personality, design: activations.design },
      activatedGates: bodygraph.activatedGates,
      definedChannels: bodygraph.definedChannels,
      definedCenters: bodygraph.definedCenters,
      openCenters: bodygraph.openCenters,
      centers: bodygraph.centers,
      gateActivations: bodygraph.gateActivations,
    },
    astrology,
    _meta: engine._meta,
  };
}

module.exports = { computeChart };
