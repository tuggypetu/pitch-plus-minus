# Pitch Plus-Minus

Player, club and manager impact ratings for the Premier League, LaLiga,
Bundesliga, Serie A and Ligue 1, built from expected goals.

This repo is the website: plain HTML, CSS and JavaScript modules, with no build
step, no dependencies and no server. GitHub Pages serves the `site/` folder.
The ratings come from a separate model; this repo only holds its published
output (`site/data/`, derived ratings only).

```
site/                     everything that gets published
  index.html              page shell
  assets/css/main.css     all styles (colours and type scale at the top)
  assets/js/config.js     site name, donate link, credits, defaults  <- edit this first
  assets/js/app.js        router (hash URLs such as #/player/108579?s=2025)
  assets/js/data.js       loads site/data/*.json
  assets/js/filters.js    search, filters, sorting, club grouping, URL state
  assets/js/format.js     number formatting, accent-insensitive search
  assets/js/components.js split bars, percentile strips, the club scatter chart
  assets/js/views/        one file per page: players, player, clubs, club, managers, pages (method, support)
  data/                   ratings, written by scripts/export_data.py
scripts/export_data.py    model outputs (CSV) -> site/data (JSON)
scripts/update.sh         export + test + commit + push in one go
tests/                    node --test tests/*.test.mjs
.github/workflows/deploy.yml   test, then publish site/ with GitHub Pages
```

## Pages

- `#/` player table: search, season, league, position and minutes filters, sortable columns
- `#/player/<id>?s=<season>` one player: attack, defence and net with likely ranges, xPAR, percentiles, seasons
- `#/clubs` every club by league, with the squad's minutes-weighted net impact
- `#/club/<name>?s=<season>` one club: interactive attack-vs-defence chart of the squad (hover or tab to a
  dot for details, select it to open the player; highlight a position; filter by minutes), managers, squad table
- `#/managers`, `#/method`, `#/support`

Percentiles always compare with players who played 900+ minutes across all five leagues.

## Run it locally

```bash
python3 -m http.server 8000 --directory site      # open http://localhost:8000
node --test tests/*.test.mjs                       # logic and data checks (Node 18+)
```

Opening `site/index.html` straight from disk won't work: browsers block
loading the data files from `file://`, so use the local server.

## Publishing (one-time setup)

1. Create an empty **public** repo `pitch-plus-minus` on GitHub and push this folder to it.
2. In the repo: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Actions → Deploy site → Run workflow (later pushes to `site/` deploy automatically).

The site appears at `https://<username>.github.io/pitch-plus-minus/`. For a custom
domain, set it under Settings → Pages.

## Updating the ratings

The model lives next to this folder (`../football-isolated-impact`). After re-running it:

```bash
scripts/update.sh                                       # seasons 2024 2025
scripts/update.sh ../football-isolated-impact/outputs 2025 2026   # when 2026-27 arrives
```

That exports the JSON, runs the tests, commits `site/data` and pushes; the
workflow republishes the site.

## Before going public

- Set `donateUrl` (Ko-fi, Buy Me a Coffee, GitHub Sponsors, ...) in
  `site/assets/js/config.js`. While it's empty the nav says "About" and the page
  says donations aren't open yet.
- Check the credits in `config.js`. Only derived ratings are published (no
  shots, lineups or provider xG); see the notes on the data provider's terms
  before launching.
- The method page quotes the model's evaluation results; update it if the model changes.
