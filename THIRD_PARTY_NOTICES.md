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

## Company of Heroes cover voices

240 clips extracted from the original WW2AlliesSpeechEnglish.sga and WW2AxisSpeechEnglish.sga archives distributed in the community language pack: https://steamcommunity.com/sharedfiles/filedetails/?id=647726710 . Download: https://drive.google.com/file/d/1L3oXCWtX5gP8izlKaC9-nWUVv7TMwWcF/view . Original audio belongs to its respective game rights holders; these assets are proprietary, not covered by this project’s code license. The per-clip source paths are recorded in src/audio/coh-original/manifest.json.
