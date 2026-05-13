const fs = require('fs');
const path = require('path');
const swe = require('swisseph');

let didSetPath = false;
let didPrintStatus = false;

function parseBool(v, fallback = false) {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (e) {
    return null;
  }
}

function isReadableDir(dirPath) {
  try {
    const st = fs.statSync(dirPath);
    if (!st.isDirectory()) return false;
    fs.accessSync(dirPath, fs.constants.R_OK);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * rave-engine ships its own ephemeris files in `<package>/ephe/` so it stays
 * self-contained regardless of where it's consumed from. This always resolves
 * relative to *this file*, not the caller's CWD.
 */
function localBundledEphePath() {
  // src/calc/ephemeris.js → up two → package root → /ephe
  const candidate = path.resolve(__dirname, '..', '..', 'ephe');
  if (isReadableDir(candidate)) return candidate;
  return null;
}

/**
 * Last-resort fallback: the `swisseph` npm package itself also ships .se1
 * files in its `ephe/` directory. Used only if our own bundled folder went
 * missing somehow.
 */
function swissephVendorEphePath() {
  try {
    const pkgPath = require.resolve('swisseph/package.json');
    const candidate = path.join(path.dirname(pkgPath), 'ephe');
    if (isReadableDir(candidate)) return candidate;
  } catch (_e) {
    // fall through
  }
  return null;
}

function resolveEphePath(configuredPath) {
  // 1) explicit env var wins
  if (configuredPath) {
    const resolvedConfigured = path.resolve(configuredPath);
    if (isReadableDir(resolvedConfigured)) return resolvedConfigured;
    throw new Error(`EPHE_PATH directory is not readable: ${resolvedConfigured}`);
  }

  // 2) prefer rave-engine's own bundled `ephe/` directory
  const local = localBundledEphePath();
  if (local) return local;

  // 3) fall back to the swisseph package's bundled ephe/ folder
  const vendor = swissephVendorEphePath();
  if (vendor) return vendor;

  throw new Error(
    'Could not locate Swiss Ephemeris .se1 files. Set EPHE_PATH to a folder containing seas_18.se1, semo_18.se1, sepl_18.se1.'
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
}

function printEphemerisStatusOnce({ ephPath, label }) {
  if (didPrintStatus) return;
  didPrintStatus = true;

  // eslint-disable-next-line no-console
  console.log('[rave-engine][ephe] status', {
    label,
    EPHE_PATH: ephPath,
    resolved: ephPath ? path.resolve(ephPath) : null,
    cwd: process.cwd(),
  });

  if (!ephPath) return;

  const required = ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1'];
  for (const f of required) {
    const full = path.join(ephPath, f);
    const st = safeStat(full);
    // eslint-disable-next-line no-console
    console.log('[rave-engine][ephe] file', {
      file: full,
      ok: Boolean(st && st.isFile()),
      size: st ? formatBytes(st.size) : null,
    });
  }

  try {
    const entries = fs.readdirSync(ephPath);
    const se1 = entries.filter((x) => x.toLowerCase().endsWith('.se1')).sort();
    // eslint-disable-next-line no-console
    console.log('[rave-engine][ephe] dir', {
      se1_count: se1.length,
      se1_sample: se1.slice(0, 10),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[rave-engine][ephe] dir_read_error', { message: e?.message });
  }

  // Quick sanity calc to verify the binding+files are wired.
  try {
    const t0 = process.hrtime.bigint();
    // J2000.0 is 2451545.0 (2000-01-01 12:00:00 UT)
    const jdUt = 2451545.0;
    const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
    const r = swe.swe_calc_ut(jdUt, swe.SE_SUN, flags);
    const t1 = process.hrtime.bigint();
    const ms = Number(t1 - t0) / 1e6;
    // eslint-disable-next-line no-console
    console.log('[rave-engine][ephe] swe_calc_ut', {
      ok: Boolean(r && Number.isFinite(r.longitude)),
      ms: Number.isFinite(ms) ? Number(ms.toFixed(2)) : null,
      longitude: r?.longitude,
      longitudeSpeed: r?.longitudeSpeed,
      error: r?.error,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[rave-engine][ephe] swe_calc_ut_error', { message: e?.message, stack: e?.stack });
  }
}

/**
 * Ensure Swiss Ephemeris path is configured.
 *
 * - Honors EPHE_PATH if set.
 * - Otherwise auto-resolves to the swisseph package's bundled `ephe/` directory.
 * - Idempotent and safe to call in hot paths.
 *
 * Set EPHE_STATUS=true (or EPHE_DEBUG=true) for a one-time diagnostic print.
 */
function ensureEphePath({ label } = {}) {
  const resolvedEphePath = resolveEphePath(process.env.EPHE_PATH);

  if (!didSetPath) {
    swe.swe_set_ephe_path(resolvedEphePath);
    didSetPath = true;
  }

  if (parseBool(process.env.EPHE_STATUS, false) || parseBool(process.env.EPHE_DEBUG, false)) {
    printEphemerisStatusOnce({ ephPath: resolvedEphePath, label });
  }
}

module.exports = { ensureEphePath };
