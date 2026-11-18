// Filtering, sorting and URL state for the player table (no DOM, testable in Node).
import { fold } from "./format.js";

export const SORTS = {
  xpar: { key: "xpar", label: "xPAR", desc: true },
  net: { key: "net", label: "Net per 90", desc: true },
  off: { key: "off", label: "Attack per 90", desc: true },
  // lower def90 is better: "best defence first" sorts ascending
  def: { key: "def", label: "Defence per 90", desc: false },
  min: { key: "min", label: "Minutes", desc: true },
  name: { key: "name", label: "Name", desc: false },
};

export const DEFAULT_STATE = { s: null, lg: "all", pos: "all", min: 900, q: "", sort: "xpar", dir: "" };

/** Parse "lg=EPL&pos=F" into a state object (unknown keys ignored, bad values defaulted). */
export function parseState(query, defaults = DEFAULT_STATE) {
  const p = new URLSearchParams(query || "");
  const st = { ...defaults };
  if (p.has("s")) st.s = Number(p.get("s")) || defaults.s;
  if (p.has("lg")) st.lg = p.get("lg") || "all";
  if (p.has("pos") && ["all", "G", "D", "M", "F"].includes(p.get("pos"))) st.pos = p.get("pos");
  if (p.has("min")) {
    const m = Number(p.get("min"));
    st.min = Number.isFinite(m) && m >= 0 ? m : defaults.min;
  }
  if (p.has("q")) st.q = p.get("q");
  if (p.has("sort") && SORTS[p.get("sort")]) st.sort = p.get("sort");
  if (p.has("dir") && ["asc", "desc"].includes(p.get("dir"))) st.dir = p.get("dir");
  return st;
}

/** Inverse of parseState: only non-default values are written, so URLs stay short. */
export function stateToQuery(st, defaults = DEFAULT_STATE) {
  const p = new URLSearchParams();
  for (const k of Object.keys(defaults)) {
    if (st[k] !== undefined && st[k] !== null && st[k] !== defaults[k] && st[k] !== "") p.set(k, st[k]);
  }
  return p.toString();
}

export function filterPlayers(players, st) {
  const q = fold(st.q).trim();
  const terms = q ? q.split(/\s+/) : [];
  return players.filter((p) => {
    if (st.lg !== "all" && p.league !== st.lg) return false;
    if (st.pos !== "all" && p.pos !== st.pos) return false;
    if ((p.min || 0) < st.min) return false;
    if (terms.length) {
      const hay = fold(`${p.name} ${p.team}`);
      for (const t of terms) if (!hay.includes(t)) return false;
    }
    return true;
  });
}

export function sortPlayers(players, sortKey, dir = "") {
  const spec = SORTS[sortKey] || SORTS.xpar;
  const desc = dir ? dir === "desc" : spec.desc;
  const k = spec.key;
  const out = players.slice();
  out.sort((a, b) => {
    const x = a[k], y = b[k];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;      // missing values always last
    if (y === null || y === undefined) return -1;
    const c = typeof x === "string" ? x.localeCompare(y) : x - y;
    return desc ? -c : c;
  });
  return out;
}

/** Symmetric axis limit for split bars: a high quantile of |values|, so outliers don't squash everyone. */
export function barScale(players, keys = ["off", "def"], q = 0.995) {
  const v = [];
  for (const p of players) for (const k of keys) if (typeof p[k] === "number") v.push(Math.abs(p[k]));
  if (!v.length) return 0.1;
  v.sort((a, b) => a - b);
  return Math.max(v[Math.min(v.length - 1, Math.floor(q * v.length))], 1e-6);
}

/** Club squads: players grouped by club (only those with minutes for that club as their main club). */
export function clubIndex(players) {
  const clubs = new Map();
  for (const p of players) {
    if (!p.team) continue;
    if (!clubs.has(p.team)) clubs.set(p.team, { team: p.team, league: p.league, players: [] });
    clubs.get(p.team).players.push(p);
  }
  for (const c of clubs.values()) {
    const w = c.players.reduce((a, p) => a + (p.min || 0), 0);
    const avg = (k) => (w ? c.players.reduce((a, p) => a + (p[k] || 0) * (p.min || 0), 0) / w : 0);
    c.minutes = w;
    c.off = avg("off");
    c.def = avg("def");
    c.net = avg("net");
    c.xpar = c.players.reduce((a, p) => a + (p.xpar || 0), 0);
  }
  return clubs;
}

/** Club URL fragment: club names contain spaces, accents and dots, so encode them. */
export function clubHref(team, season) {
  return `#/club/${encodeURIComponent(team)}?s=${season}`;
}
