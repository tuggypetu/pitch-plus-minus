"""Export the model's rating tables into the compact JSON the website reads.

Only derived ratings are published: no shots, lineups or provider xG values.

    python scripts/export_data.py --outputs ../football-isolated-impact/outputs --seasons 2024 2025

Writes site/data/index.json (seasons, leagues, generated date) and, per season,
site/data/<season>/players.json and managers.json. Each table is stored as
{"columns": [...], "rows": [[...], ...]} to keep the files small.
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import date
from pathlib import Path

import pandas as pd

LEAGUE_NAMES = {"EPL": "Premier League", "LaLiga": "LaLiga", "Bundesliga": "Bundesliga",
                "SerieA": "Serie A", "Ligue1": "Ligue 1"}

# column in the model output -> (column on the site, decimals)
PLAYER_COLS = {
    "player_id": ("id", None), "player": ("name", None), "team": ("team", None),
    "league": ("league", None), "position": ("pos", None), "minutes": ("min", 0),
    "off90": ("off", 4), "off90_lo": ("off_lo", 4), "off90_hi": ("off_hi", 4),
    "def90": ("def", 4), "def90_lo": ("def_lo", 4), "def90_hi": ("def_hi", 4),
    "net90": ("net", 4), "xPAR": ("xpar", 2), "xWAR": ("xwar", 2),
    "finishing_goals": ("fin_g", 2), "saves_goals": ("save_g", 2),
    "npxg": ("npxg", 2), "shots": ("shots", 0), "xg_share": ("xg_share", 3),
    "shot_share": ("shot_share", 3), "qualified": ("q", None),
    "off90_pct": ("p_off", 0), "def90_pct": ("p_def", 0), "net90_pct": ("p_net", 0),
    "finishing_pct": ("p_fin", 0), "xPAR_pct": ("p_xpar", 0),
    "off90_pct_league": ("pl_off", 0), "def90_pct_league": ("pl_def", 0),
    "net90_pct_league": ("pl_net", 0), "finishing_pct_league": ("pl_fin", 0),
    "xPAR_pct_league": ("pl_xpar", 0),
}
MANAGER_COLS = {
    "manager": ("name", None), "league": ("league", None), "teams": ("teams", None),
    "team_matches": ("matches", 0), "off90": ("off", 4), "def90": ("def", 4), "net90": ("net", 4),
    "net90_lo": ("net_lo", 4), "net90_hi": ("net_hi", 4),
}


def _clean(v, decimals):
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return None                       # NaN / inf are not valid JSON
    if isinstance(v, (bool,)) or str(v) in ("True", "False"):
        return 1 if str(v) == "True" else 0
    if decimals is None:
        return str(v)
    v = float(v)
    if not math.isfinite(v):
        return None
    v = round(v, decimals)
    return int(v) if decimals == 0 else v


def table(df: pd.DataFrame, spec: dict) -> dict:
    have = [c for c in spec if c in df.columns]
    cols = [spec[c][0] for c in have]
    rows = [[_clean(r[c], spec[c][1]) for c in have] for _, r in df[have].iterrows()]
    return {"columns": cols, "rows": rows}


def manager_name(raw: str) -> tuple[str, str | None]:
    """'Mikel Arteta [794075]' -> ('Mikel Arteta', '794075')."""
    if raw.endswith("]") and " [" in raw:
        name, mid = raw[:-1].rsplit(" [", 1)
        return name, mid
    return raw, None


def export(outputs: Path, seasons: list[int], dest: Path) -> None:
    index = {"generated": date.today().isoformat(), "seasons": [], "leagues": LEAGUE_NAMES}
    for season in sorted(seasons):
        players_csv = next(iter(sorted(outputs.glob(f"*_{season}_players.csv"))), None)
        for name in ("Big5", "combined"):
            if (outputs / f"{name}_{season}_players.csv").exists():
                players_csv = outputs / f"{name}_{season}_players.csv"
        if players_csv is None:
            print(f"skip {season}: no players file in {outputs}")
            continue
        stem = players_csv.name.replace("_players.csv", "")
        P = pd.read_csv(players_csv, dtype={"player_id": str})
        P = P.sort_values("xPAR", ascending=False)
        out = dest / str(season)
        out.mkdir(parents=True, exist_ok=True)
        (out / "players.json").write_text(json.dumps(table(P, PLAYER_COLS), separators=(",", ":")))

        mfile = outputs / f"{stem}_managers.csv"
        if mfile.exists():
            M = pd.read_csv(mfile)
            names = M.manager.map(manager_name)
            M["manager"], M["manager_id"] = names.str[0], names.str[1]
            spec = {**MANAGER_COLS, "manager_id": ("id", None)}
            (out / "managers.json").write_text(json.dumps(table(M, spec), separators=(",", ":")))

        meta = {"season": season, "label": f"{season}-{(season + 1) % 100:02d}",
                "players": len(P), "qualified": int(P.qualified.sum()),
                "leagues": sorted(P.league.dropna().unique().tolist())}
        sfile = outputs / f"{stem}_summary.json"
        if sfile.exists():
            s = json.loads(sfile.read_text())
            meta["matches"] = s.get("matches")
            meta["mode"] = s.get("mode")
            meta["context"] = {k: round(v, 3) for k, v in (s.get("context_effects_xg90") or {}).items()}
        index["seasons"].append(meta)
        print(f"{meta['label']}: {meta['players']} players ({meta['qualified']} with 900+ min) -> {out}")
    (dest / "index.json").write_text(json.dumps(index, indent=1))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--outputs", type=Path, required=True, help="the model's outputs/ folder")
    ap.add_argument("--seasons", type=int, nargs="+", default=[2024, 2025])
    ap.add_argument("--dest", type=Path, default=Path(__file__).resolve().parent.parent / "site" / "data")
    a = ap.parse_args()
    export(a.outputs, a.seasons, a.dest)


if __name__ == "__main__":
    main()
