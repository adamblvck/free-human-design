// Midpoints — the "advanced" layer of a chart.
//
// A midpoint is the point on the ecliptic that sits exactly halfway between two
// bodies, along the SHORTER of the two arcs joining them (the astrological
// convention, cf. Ebertin's cosmobiology). For two longitudes a and b:
//
//   mid = a + signedAngleDiff(b, a) / 2        // signedAngleDiff ∈ [-180, 180)
//
// which always lands on the near side. The midpoint is then mapped back onto the
// Gene Keys / I-Ching wheel (gate / line / color) with the same `mapLongitudeDegrees`
// the engine uses for every other point, so a midpoint reads like any activation.
//
// This module is intentionally free of ephemeris concerns: it takes an array of
// already-computed points `{ key, longitude, ... }` and returns the full pairwise
// structure. Callers decide which points to feed it (see src/chart.js, which uses
// the 26 Human Design activations).

const { signedAngleDiff } = require('./profile');
const { mapLongitudeDegrees, normalizeAngleDegrees } = require('./mandala');

/**
 * Shorter-arc midpoint of two ecliptic longitudes (degrees), mapped to the wheel.
 * @param {number} aLon longitude of point A, degrees
 * @param {number} bLon longitude of point B, degrees
 * @returns {{ longitude:number, gate:number, line:number, color:number }}
 */
function midpointOf(aLon, bLon) {
  const longitude = normalizeAngleDegrees(aLon + signedAngleDiff(bLon, aLon) / 2);
  const { hexagram, line, color } = mapLongitudeDegrees(longitude);
  return { longitude, gate: hexagram, line, color };
}

/**
 * Compute the full midpoint structure for a set of points.
 *
 * @param {Array<{ key:string, longitude:number, [k:string]:any }>} points
 *   Each point must have a stable `key` (e.g. "p_sun") and a `longitude` in
 *   degrees. Any other fields (body, stream, gate, line…) are echoed back on
 *   `points` untouched.
 * @returns {{
 *   points: Array<object>,
 *   pairs: Array<{ a:string, b:string, longitude:number, gate:number, line:number, color:number }>,
 *   matrix: Array<Array<{ longitude:number, gate:number, line:number, color:number }|null>>,
 *   _meta: { count:number, pairCount:number, method:'shortest-arc' }
 * }}
 */
function computeMidpoints(points) {
  const pts = Array.isArray(points) ? points.filter((p) => p && Number.isFinite(p.longitude)) : [];
  const n = pts.length;

  const pairs = [];
  // N×N grid; diagonal is null (a point has no midpoint with itself). The matrix
  // is symmetric — matrix[i][j] === matrix[j][i] — so renderers can show either
  // triangle. `pairs` is the de-duplicated upper triangle for lists/tables.
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const mid = midpointOf(pts[i].longitude, pts[j].longitude);
      matrix[i][j] = mid;
      matrix[j][i] = mid;
      pairs.push({ a: pts[i].key, b: pts[j].key, ...mid });
    }
  }

  return {
    points: pts.map((p) => ({
      key: p.key,
      body: p.body,
      stream: p.stream,
      longitude: p.longitude,
      gate: p.gate,
      line: p.line,
    })),
    pairs,
    matrix,
    _meta: { count: n, pairCount: pairs.length, method: 'shortest-arc' },
  };
}

module.exports = { computeMidpoints, midpointOf };
