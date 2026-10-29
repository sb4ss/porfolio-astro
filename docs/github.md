# GitHub in the portfolio

The featured project uses public repository metadata from
https://api.github.com/repos/tuki-labs/tukicode.
The contribution calendar uses the public calendar at
https://github.com/users/sb4ss/contributions.

The browser calls the same-origin GET endpoint /api/github.json. It never needs
a GitHub token. The server fetches only these two fixed URLs, limits each request
to seven seconds, coalesces concurrent requests, and caches each successful
snapshot for fifteen minutes. CDN responses use the same fifteen-minute cache.
Errors are cached for one minute; a previous snapshot is retained when available.
The original fetch timestamp stays visible so an older snapshot is not presented
as a fresh measurement.

GitHub's calendar is HTML rather than a documented REST response. The parser
extracts only validated date, level, and contribution counts. No source HTML is
rendered in the portfolio. Unexpected markup results in an unavailable state
with the profile link still accessible. The calendar represents contributions,
not a commit counter, and mirrors what the public profile exposes.

Tukicode's mascot and demo video were copied without modification from the
user-provided C:/proyectos/tukicode-website/public directory:

- tukilogo.png → public/tukicode/mascot.png
- tuki_plan_mode.mp4 → public/tukicode/plan-mode.mp4

The video uses native playback controls and does not autoplay.
The calendar scrolls horizontally within its own region on narrow screens.

Validation: node --test tests/github.test.mjs
