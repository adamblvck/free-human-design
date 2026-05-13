# ephe/

Swiss Ephemeris data files used by the [`swisseph`](https://www.npmjs.com/package/swisseph)
native binding to compute planet positions.

These files are **bundled with rave-engine** so the package is self-contained.
The runtime resolution order in [`../src/calc/ephemeris.js`](../src/calc/ephemeris.js) is:

1. The `EPHE_PATH` env var, if set (highest priority — explicit override).
2. **This folder** (`<rave-engine>/ephe/`) — the default for local + bundled use.
3. `node_modules/swisseph/ephe` — fallback if this folder is missing.

## What each file is

| File              | Purpose                                                                                | Source           |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------- |
| `sepl_18.se1`     | Planet ephemeris (1800–2399). Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto. **Required.** | Astrodienst      |
| `semo_18.se1`     | Moon ephemeris (1800–2399). **Required for `d_moon`.**                                  | Astrodienst      |
| `seas_18.se1`     | Asteroid ephemeris (1800–2399). Not actively used by rave-engine but kept for parity.   | Astrodienst      |
| `sefstars.txt`    | Fixed star catalog (≈ 6 000 stars). Used by `swe_fixstar*` if ever called.              | Astrodienst      |
| `seleapsec.txt`   | Leap-second table.                                                                      | Astrodienst      |
| `seorbel.txt`     | Orbital elements for fictitious bodies (Trans-Neptunian, Uranian).                      | Astrodienst      |

## Where they originally come from

These files are mirrored from the `swisseph` npm package's bundled `ephe/`
directory (`node_modules/swisseph/ephe/`), which in turn pulls them from
[Astrodienst's Swiss Ephemeris distribution](https://www.astro.com/ftp/swisseph/ephe/).

If you ever need a wider date range than 1800–2399, grab the corresponding
`*_NN.se1` files from Astrodienst's FTP (e.g. `sepl_24.se1` extends to
2400–2999) and drop them in this folder.

## License

The Swiss Ephemeris data files are © Astrodienst AG and are distributed under
the [Swiss Ephemeris Public License](https://www.astro.com/swisseph/swephinfo_e.htm)
(GPL or commercial). Using them in a redistributed binary requires accepting
those terms.
