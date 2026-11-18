// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { decodeTable } from "../site/assets/js/data.js";
import { signed, fixed, fold, ordinal, escapeHTML } from "../site/assets/js/format.js";
import { parseState, stateToQuery, filterPlayers, sortPlayers, barScale, clubIndex, clubHref, DEFAULT_STATE } from "../site/assets/js/filters.js";
import { divergingBar, percentileStrip, impactScatter, niceStep, shortName } from "../site/assets/js/components.js";

const sample = [
  { id: "1", name: "Martin Ødegaard", team: "Arsenal", league: "EPL", pos: "M", min: 2500, off: 0.05, def: -0.02, net: 0.07, xpar: 3.1 },
  { id: "2", name: "Kylian Mbappé", team: "Real Madrid", league: "LaLiga", pos: "F", min: 2800, off: 0.1, def: 0.01, net: 0.09, xpar: 7.0 },
  { id: "3", name: "Young Sub", team: "Arsenal", league: "EPL", pos: "F", min: 300, off: null, def: null, net: null, xpar: null },
  { id: "4", name: "Wall", team: "Inter", league: "SerieA", pos: "D", min: 3000, off: -0.01, def: -0.09, net: 0.08, xpar: 4.0 },
];

test("decodeTable turns columns/rows into objects", () => {
  assert.deepEqual(decodeTable({ columns: ["a", "b"], rows: [[1, 2], [3, null]] }), [{ a: 1, b: 2 }, { a: 3, b: null }]);
  assert.deepEqual(decodeTable(null), []);
});

test("number formatting uses real minus signs and handles missing values", () => {
  assert.equal(signed(0.1432), "+0.143");
  assert.equal(signed(-0.0549), "−0.055");
  assert.equal(signed(0.0001), "0.000");
  assert.equal(signed(null), "–");
  assert.equal(fixed(-1.234, 1), "−1.2");
  assert.equal(ordinal(1), "1st"); assert.equal(ordinal(12), "12th"); assert.equal(ordinal(23), "23rd"); assert.equal(ordinal(111), "111th");
  assert.equal(escapeHTML('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
});

test("search ignores accents and special letters", () => {
  assert.equal(fold("Ødegaard Đorđe Müller"), "odegaard dorde muller");
  const st = { ...DEFAULT_STATE, min: 0, q: "odegaard" };
  assert.deepEqual(filterPlayers(sample, st).map((p) => p.id), ["1"]);
  assert.deepEqual(filterPlayers(sample, { ...st, q: "arsenal young" }).map((p) => p.id), ["3"]);
});

test("filters by league, position and minutes", () => {
  const base = { ...DEFAULT_STATE, min: 0 };
  assert.equal(filterPlayers(sample, { ...base, lg: "EPL" }).length, 2);
  assert.equal(filterPlayers(sample, { ...base, pos: "F" }).length, 2);
  assert.equal(filterPlayers(sample, { ...base, min: 900 }).length, 3);
});

test("sorting: defaults, reversing, defence best-first, missing values last", () => {
  assert.deepEqual(sortPlayers(sample, "xpar").map((p) => p.id), ["2", "4", "1", "3"]);
  assert.deepEqual(sortPlayers(sample, "xpar", "asc").map((p) => p.id), ["1", "4", "2", "3"]);
  assert.deepEqual(sortPlayers(sample, "def").map((p) => p.id), ["4", "1", "2", "3"]);
  assert.deepEqual(sortPlayers(sample, "name").map((p) => p.name), ["Kylian Mbappé", "Martin Ødegaard", "Wall", "Young Sub"]);
  assert.deepEqual(sortPlayers(sample, "bogus").map((p) => p.id), ["2", "4", "1", "3"]);
});

test("URL state round-trips and rejects bad values", () => {
  const st = { ...DEFAULT_STATE, s: 2025, lg: "EPL", pos: "F", min: 450, q: "saka", sort: "off" };
  const q = stateToQuery(st);
  assert.deepEqual(parseState(q, { ...DEFAULT_STATE, s: 2025 }), st);
  assert.equal(stateToQuery({ ...DEFAULT_STATE }), "");
  const bad = parseState("pos=X&min=-5&sort=evil&dir=up", DEFAULT_STATE);
  assert.equal(bad.pos, "all"); assert.equal(bad.min, 900); assert.equal(bad.sort, "xpar"); assert.equal(bad.dir, "");
});

test("clubs: squads grouped, minutes-weighted averages, safe links", () => {
  const clubs = clubIndex(sample);
  assert.equal(clubs.get("Arsenal").players.length, 2);
  const ars = clubs.get("Arsenal");
  // Young Sub has null ratings: treated as 0 in the weighted average, weight 300 of 2800 minutes
  assert.ok(Math.abs(ars.off - (0.05 * 2500) / 2800) < 1e-12);
  assert.equal(clubHref("Paris Saint-Germain", 2025), "#/club/Paris%20Saint-Germain?s=2025");
  assert.equal(decodeURIComponent(clubHref("1. FC Köln", 2025).slice(7).split("?")[0]), "1. FC Köln");
});

test("scatter: one link per player, shared symmetric axes, labels only where asked", () => {
  const pts = sample.filter((p) => p.off !== null).map((p) => ({ ...p, href: `#/player/${p.id}` }));
  const svg = impactScatter(pts, { labelIds: new Set(["2"]), limit: 0.12 });
  assert.equal((svg.match(/class="sc-pt /g) || []).length, pts.length);
  assert.equal((svg.match(/class="sc-label"/g) || []).length, 1);
  assert.ok(svg.includes('aria-label="Kylian Mbappé, forward'));
  // a player with zero attack and zero defence sits exactly on the crossing of the zero lines
  const z = impactScatter([{ id: "z", name: "Z", pos: "M", min: 900, off: 0, def: 0, xpar: 0, href: "#" }], { limit: 0.1 });
  const zx = Number(z.match(/<line class="sc-zero" x1="([\d.]+)"/)[1]);
  const cx = Number(z.match(/<circle cx="([\d.]+)"/)[1]);
  assert.ok(Math.abs(zx - cx) < 0.1);
  assert.equal(niceStep(0.12), 0.05);
  assert.equal(shortName("Riccardo Calafiori"), "R. Calafiori");
  assert.equal(shortName("Kim Min-jae"), "Kim Min-jae");
  assert.equal(shortName("Kevin"), "Kevin");
});

test("bar scale is symmetric and robust; bars put good values right of centre", () => {
  const s = barScale(sample);
  assert.ok(s > 0 && s <= 0.1);
  const pos = divergingBar(0.05, 0.1, "attack");
  const neg = divergingBar(-0.05, 0.1, "attack");
  const xPos = Number(pos.match(/rect class="bar-fill" x="([\d.]+)"/)[1]);
  const xNeg = Number(neg.match(/rect class="bar-fill" x="([\d.]+)"/)[1]);
  assert.equal(xPos, 100);                 // starts at the centre line, extends right
  assert.ok(xNeg < 100);                   // extends left of centre
  assert.ok(neg.includes("is-neg"));
  const clipped = divergingBar(5, 0.1, "net");
  assert.ok(Number(clipped.match(/width="([\d.]+)"/)[1]) <= 100);  // never past the edge
  assert.ok(divergingBar(0.05, 0.1, "attack", { lo: 0.01, hi: 0.08 }).includes("whisker"));
  assert.ok(percentileStrip("x", null).includes("not rated"));
});

test("exported real data has the fields the site needs", { skip: !existsSync("site/data/index.json") }, () => {
  const index = JSON.parse(readFileSync("site/data/index.json", "utf8"));
  assert.ok(index.seasons.length >= 1);
  for (const s of index.seasons) {
    const players = decodeTable(JSON.parse(readFileSync(`site/data/${s.season}/players.json`, "utf8")));
    assert.equal(players.length, s.players);
    for (const k of ["id", "name", "team", "league", "pos", "min", "off", "def", "net", "xpar", "q", "p_xpar", "pl_xpar"]) {
      assert.ok(k in players[0], `${s.label}: missing ${k}`);
    }
    assert.equal(new Set(players.map((p) => p.id)).size, players.length, "player ids unique");
    const q = players.filter((p) => p.q);
    assert.equal(q.length, s.qualified);
    assert.ok(q.every((p) => p.min >= 900));
    // defence CI ordering: lo <= estimate <= hi
    const ci = q.filter((p) => typeof p.def_lo === "number");
    assert.ok(ci.every((p) => p.def_lo <= p.def + 1e-9 && p.def <= p.def_hi + 1e-9), "def interval contains estimate");
    // no raw provider data leaks into the public files
    for (const leak of ["xg_provider", "shotmap", "lineups", "X", "Y"]) assert.ok(!(leak in players[0]));
    const leagues = new Set(players.map((p) => p.league));
    for (const lg of leagues) assert.ok(index.leagues[lg], `league name for ${lg}`);
  }
});
