# Third-party notices

## Three.js

Three.js 0.180.0, Copyright 2010–2025 Three.js Authors, MIT license.
Local ES modules are bundled in `src/vendor/`; the full license is in `src/vendor/THREE-LICENSE.txt`.
Project: https://threejs.org/ . No CDN or runtime network access is required.

## Map data

Made with Natural Earth. The bundled `src/world-land.js` contains detailed land polygons derived from `ne_50m_land.geojson` (1:50m scale).

- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson
- Terms: https://www.naturalearthdata.com/about/terms-of-use/
- License: Public domain. Natural Earth explicitly permits modification and redistribution for any purpose.

Only physical land outlines are used. The game uses fictional factions and does not represent historical or present-day political boundaries.


## Intro recorded voices

Sounds by qubodup and craigsmith, from Freesound. Detailed titles, source URLs, license links and modifications are provided in [src/audio/credits.html](src/audio/credits.html), linked in the opening menu and included in the build. The Russian sample is CC BY 4.0; the Chinese and English samples are labeled CC0 1.0 by their source pages. Downloaded public MP3 previews are bundled locally. These are mixed sources (military training, voice acting and historical film effects), not all live-combat recordings.


## Battle audio library (2026-11-06)

241 independent source recordings were imported from OpenGameArt and Freesound. Per-file authors, titles, source URLs, license URLs and SHA256 hashes are recorded in src/audio/battle-catalog.js and src/audio/library/SOURCES.json. A human-readable credits and audition view is linked from src/audio/library.html. Authors: qubodup, TyrantTim, HaelDB, VoiceBosch, Kenney (voice performers Jeffrey M. Smith and Giselle), Charlotte Duckett (editing by Iwan Gabovitch). Individual recordings retain CC0, CC BY 3.0/4.0, or CC BY-SA 4.0 as listed per file. VoiceBosch audio adaptations remain CC BY-SA 4.0. Original files are unchanged; runtime processing adds gain normalization, fades and light band filtering. These licenses apply to recordings and audio adaptations, not the surrounding game source code.
