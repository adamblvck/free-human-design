const { computeAngles, computeHouses } = require('../src/hd/houses');
const { normalizeAngleDegrees } = require('../src/calc/mandala');

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// Fixture: 1972-08-02 07:30 UT at Bangkok.
const JD_UT = 2441531.8125;
const LAT = 13.75;
const LNG = 100.5;

describe('computeAngles', () => {
  let angles;
  beforeAll(() => {
    angles = computeAngles({ jdUT: JD_UT, lat: LAT, lng: LNG });
  });

  it('places the Ascendant on the eastern horizon (altitude ≈ 0)', () => {
    const eps = angles._meta.obliquity;
    const ramc = angles._meta.ramc;
    const lon = angles.ascendant.longitude * D2R;
    const e = eps * D2R;
    const ra = Math.atan2(Math.sin(lon) * Math.cos(e), Math.cos(lon)) * R2D;
    const dec = Math.asin(Math.sin(e) * Math.sin(lon)) * R2D;
    const H = (ramc - ra) * D2R;
    const alt =
      Math.asin(
        Math.sin(LAT * D2R) * Math.sin(dec * D2R) +
          Math.cos(LAT * D2R) * Math.cos(dec * D2R) * Math.cos(H)
      ) * R2D;
    expect(alt).toBeCloseTo(0, 4);
  });

  it('places the MC on the meridian (RA(MC) ≈ RAMC)', () => {
    const eps = angles._meta.obliquity * D2R;
    const lon = angles.mc.longitude * D2R;
    const ra = normalizeAngleDegrees(
      Math.atan2(Math.sin(lon) * Math.cos(eps), Math.cos(lon)) * R2D
    );
    expect(ra).toBeCloseTo(angles._meta.ramc, 4);
  });

  it('keeps DC opposite Asc and IC opposite MC', () => {
    expect(normalizeAngleDegrees(angles.descendant.longitude - angles.ascendant.longitude)).toBeCloseTo(180, 6);
    expect(normalizeAngleDegrees(angles.ic.longitude - angles.mc.longitude)).toBeCloseTo(180, 6);
  });

  it('reproduces the fixture Ascendant/MC signs (regression)', () => {
    expect(angles.ascendant.sign).toBe('Sagittarius');
    expect(angles.mc.sign).toBe('Virgo');
    expect(angles.ascendant.degInSign).toBeCloseTo(9.99, 1);
    expect(angles.mc.degInSign).toBeCloseTo(12.65, 1);
  });
});

describe('computeHouses', () => {
  it('Whole Sign cusps are all on 0° sign boundaries and aligned to the Asc sign', () => {
    const { cusps, angles } = computeHouses({ jdUT: JD_UT, lat: LAT, lng: LNG, system: 'whole' });
    expect(cusps).toHaveLength(12);
    for (const c of cusps) expect(c.degInSign).toBeCloseTo(0, 9);
    expect(cusps[0].sign).toBe(angles.ascendant.sign);
  });

  it('Equal cusps step 30° from the Ascendant', () => {
    const { cusps, angles } = computeHouses({ jdUT: JD_UT, lat: LAT, lng: LNG, system: 'equal' });
    expect(cusps[0].longitude).toBeCloseTo(angles.ascendant.longitude, 6);
    for (let i = 0; i < 12; i += 1) {
      expect(cusps[i].longitude).toBeCloseTo(
        normalizeAngleDegrees(angles.ascendant.longitude + i * 30),
        6
      );
    }
  });

  it('Placidus cusps are monotonic, <180° apart, with 1↔7 / 4↔10 oppositions', () => {
    const { cusps, system } = computeHouses({ jdUT: JD_UT, lat: LAT, lng: LNG, system: 'placidus' });
    expect(system).toBe('placidus');
    for (let i = 0; i < 12; i += 1) {
      const a = cusps[i].longitude;
      const b = cusps[(i + 1) % 12].longitude;
      const d = normalizeAngleDegrees(b - a);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(180);
    }
    expect(normalizeAngleDegrees(cusps[6].longitude - cusps[0].longitude)).toBeCloseTo(180, 6);
    expect(normalizeAngleDegrees(cusps[9].longitude - cusps[3].longitude)).toBeCloseTo(180, 6);
  });

  it('Placidus falls back to whole sign at polar latitude', () => {
    const res = computeHouses({ jdUT: JD_UT, lat: 78, lng: 15, system: 'placidus' });
    expect(res.system).toBe('whole');
    expect(res.requestedSystem).toBe('placidus');
    expect(res.fallback).toMatch(/whole sign/i);
  });
});
