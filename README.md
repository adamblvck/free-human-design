# rave-engine

Standalone profile (`p_` / `d_`) calculation engine extracted from
`event-horizon-api`. Given a birth date, time and IANA timezone, it computes
the Personality (`p_`) and Design (`d_`) gates/lines for the Sun, Earth, Moon,
Mercury, Venus, Mars, Jupiter, Saturn and Uranus, plus the sphere-keyed map
(`lifeswork`, `purpose`, `pearl`, `iq`, `eq`, …) used elsewhere in the
codebase.

The math is identical to `event-horizon-api/src/calc/profile.js` — the
intent is to give us a small, isolated package we can test, iterate on and
later swap back into the API.

## Install

```bash
cd rave-engine
npm install
```

## Ephemeris files

Swiss Ephemeris needs binary `.se1` data files to compute planet positions.
rave-engine vendors them locally inside the package so it's self-contained:

```
rave-engine/
  ephe/
    sepl_18.se1     // planets 1800–2399 (required)
    semo_18.se1     // moon    1800–2399 (required)
    seas_18.se1     // asteroids 1800–2399
    sefstars.txt    // fixed stars
    seleapsec.txt   // leap seconds
    seorbel.txt     // fictitious orbital elements
    README.md       // origin + license notes
```

See [`ephe/README.md`](ephe/README.md) for what each file is and where to
grab a wider date range from Astrodienst if you ever need one.

The runtime resolution order in [`src/calc/ephemeris.js`](src/calc/ephemeris.js) is:

1. `EPHE_PATH` env var (explicit override).
2. `<package>/ephe/` (the bundled folder above — default).
3. `node_modules/swisseph/ephe/` (last-resort fallback).

So `npm install && npm test` works out of the box with zero env vars.

## Library use

```js
const { computeProfile, searchTimezones } = require('rave-engine');

const out = computeProfile({
  birthdate: '1972-08-02',
  birthtime: '14:30',
  timezone: 'Asia/Bangkok',
});

console.log(out.engine.p_.sun);     // { gate, line, color, longitude, ... }
console.log(out.engine.spheres);    // { lifeswork: { gk, line }, ... }
```

Other exports:

| Export                    | Returns                                                   |
| ------------------------- | --------------------------------------------------------- |
| `computeProfile(input)`   | `{ input, engine: { p_, d_, spheres, _meta } }`           |
| `computeEngineTest({ birthUtc })` | Same engine payload but with a pre-parsed `Date` |
| `computeProfileSpheres({ birthUtc })` | Just the sphere-keyed `{ lifeswork, … }` map  |
| `parseBirthToUtc({ birthdate, birthtime, timezone })` | UTC `Date`            |
| `searchTimezones(query, { limit })` | Ranked list of IANA zones with current offsets and city hints |

## Timezone autocomplete

`searchTimezones` combines [`@vvo/tzdb`](https://github.com/vvo/tzdb) (rich
IANA timezone metadata with current offsets and grouped cities) and
[`city-timezones`](https://www.npmjs.com/package/city-timezones) (city-name →
IANA lookup). One call, deduplicated and ranked:

```js
searchTimezones('bali');     // -> [{ ianaName: 'Asia/Makassar', mainCity: 'Makassar', ...}]
searchTimezones('tokyo');    // -> [{ ianaName: 'Asia/Tokyo', currentOffsetMinutes: 540, ...}]
searchTimezones('los ang');  // -> [{ ianaName: 'America/Los_Angeles', ... }]
```

## CLI

```bash
node bin/rave.js --date 1972-08-02 --time 14:30 --tz Asia/Bangkok
node bin/rave.js --tz-search bali
```

## Tests

```bash
npm test
```

Tests cover:
- The mandala mapping against known longitudes.
- A regression-locked `computeProfile` for a fixed birth.
- Birth-string parsing (loose `YYYY-M-D` / `H:mm`, invalid TZ).
- Timezone autocomplete (city + IANA name).
