// The home view: search, filters and the player table.
import { CONFIG } from "../config.js";
import { loadPlayers } from "../data.js";
import { escapeHTML, fixed, int, signed } from "../format.js";
import { filterPlayers, sortPlayers, barScale, clubHref, SORTS, stateToQuery } from "../filters.js";
import { segmented, splitBars } from "../components.js";

const COLUMNS = [
  { sort: "name", text: "Player", cls: "c-player" },
  { sort: null, text: "Pos", cls: "c-pos" },
  { sort: "min", text: "Minutes", cls: "c-num c-min" },
  { sort: "off", text: "Attack", cls: "c-num c-att", tip: "xG per 90 the player adds to his team's chances" },
  { sort: "def", text: "Defence", cls: "c-num c-def", tip: "xG per 90 he keeps off the opponent's chances" },
  { sort: null, text: "Split", cls: "c-split", tip: "Attack (top) and defence (bottom); right of the line is better than average" },
  { sort: "net", text: "Net", cls: "c-num c-net", tip: "Attack plus defence, xG per 90" },
  { sort: "xpar", text: "xPAR", cls: "c-num c-xpar", tip: "Expected points above a replacement-level player over the season" },
  { sort: null, text: "Pct", cls: "c-num c-pct", tip: "xPAR percentile among players with 900+ minutes in the top five leagues" },
];

export async function renderPlayers(root, { index, state, go }) {
  const season = state.s;
  const players = await loadPlayers(season);
  const seasonMeta = index.seasons.find((x) => x.season === season);
  const scale = barScale(players.filter((p) => p.q));
  let shown = CONFIG.pageSize;

  root.innerHTML = `
    <section class="hero">
      <h1 class="hero-title">${escapeHTML(CONFIG.tagline)}</h1>
      <p class="hero-sub">How much each player changes his team's chances, and his opponents',
        while he is on the pitch. ${escapeHTML(seasonMeta?.label || "")}, ${int(seasonMeta?.matches)} matches.</p>
      <label class="search">
        <span class="visually-hidden">Search players or clubs</span>
        <input id="q" type="search" placeholder="Search a player or club" value="${escapeHTML(state.q)}" autocomplete="off" spellcheck="false">
      </label>
    </section>

    <section class="controls" aria-label="Filters">
      <div class="control">
        <span class="control-label" id="lbl-season">Season</span>
        ${segmented("s", index.seasons.map((x) => [x.season, x.label]), season, "Season")}
      </div>
      <div class="control">
        <span class="control-label">League</span>
        ${segmented("lg", [["all", "All five"], ...Object.entries(index.leagues).filter(([k]) => seasonMeta?.leagues.includes(k))], state.lg, "League")}
      </div>
      <div class="control">
        <span class="control-label">Position</span>
        ${segmented("pos", [["all", "All"], ["F", "Forwards"], ["M", "Midfielders"], ["D", "Defenders"], ["G", "Keepers"]], state.pos, "Position")}
      </div>
      <div class="control">
        <label class="control-label" for="min">Minimum minutes</label>
        <select id="min">
          ${[0, 450, 900, 1350, 1800, 2700].map((m) => `<option value="${m}" ${m === state.min ? "selected" : ""}>${m === 0 ? "Any" : int(m)}</option>`).join("")}
        </select>
      </div>
    </section>

    <p class="result-count" id="count" aria-live="polite"></p>
    <div class="table-wrap">
      <table class="ptable">
        <caption class="visually-hidden">Player ratings, ${escapeHTML(seasonMeta?.label || "")}</caption>
        <thead><tr>
          <th class="c-rank" scope="col">#</th>
          ${COLUMNS.map((c) => `<th class="${c.cls}" scope="col" ${c.tip ? `title="${escapeHTML(c.tip)}"` : ""}>${c.sort
            ? `<button type="button" class="sort" data-sort="${c.sort}">${c.text}</button>` : c.text}</th>`).join("")}
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="more"><button type="button" id="more" class="btn-quiet">Show more players</button></div>
    <p class="note">Ratings are relative to the average player in his own league; the
      <a href="#/method">method page</a> explains what the numbers mean and how sure they are.</p>
  `;

  const $ = (sel) => root.querySelector(sel);
  const rowsEl = $("#rows"), countEl = $("#count"), moreBtn = $("#more");

  function update(push = true) {
    const list = sortPlayers(filterPlayers(players, state), state.sort, state.dir);
    rowsEl.innerHTML = list.slice(0, shown).map((p, i) => `
      <tr>
        <td class="c-rank">${i + 1}</td>
        <td class="c-player"><a href="#/player/${encodeURIComponent(p.id)}?s=${season}" class="pname">${escapeHTML(p.name)}</a>
          <span class="pteam"><a class="club-link" href="${clubHref(p.team, season)}">${escapeHTML(p.team || "")}</a>${state.lg === "all" ? `<span class="pleague">${escapeHTML(index.leagues[p.league] || p.league)}</span>` : ""}</span></td>
        <td class="c-pos">${escapeHTML(p.pos || "")}</td>
        <td class="c-num c-min">${int(p.min)}</td>
        <td class="c-num c-att">${signed(p.off)}</td>
        <td class="c-num c-def">${signed(-p.def)}</td>
        <td class="c-split">${splitBars(p, scale)}</td>
        <td class="c-num c-net">${signed(p.net)}</td>
        <td class="c-num c-xpar"><strong>${fixed(p.xpar, 1)}</strong></td>
        <td class="c-num c-pct">${p.p_xpar ?? "–"}</td>
      </tr>`).join("") || `<tr><td colspan="${COLUMNS.length + 1}" class="empty">No players match these filters. Lower the minimum minutes or clear the search.</td></tr>`;
    countEl.textContent = `${int(list.length)} player${list.length === 1 ? "" : "s"}` +
      (list.length > shown ? `, showing the first ${int(shown)}` : "");
    moreBtn.hidden = list.length <= shown;
    root.querySelectorAll("button.sort").forEach((b) => {
      const active = b.dataset.sort === state.sort;
      const desc = state.dir ? state.dir === "desc" : SORTS[state.sort].desc;
      b.closest("th").setAttribute("aria-sort", active ? (desc ? "descending" : "ascending") : "none");
    });
    if (push) go(`#/?${stateToQuery(state)}`, { replace: true, silent: true });
  }

  let t;
  $("#q").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value; shown = CONFIG.pageSize; update(); }, 120);
  });
  $("#min").addEventListener("change", (e) => { state.min = Number(e.target.value); shown = CONFIG.pageSize; update(); });
  root.querySelectorAll(".seg input").forEach((inp) => inp.addEventListener("change", (e) => {
    const { name, value } = e.target;
    if (name === "s") { state.s = Number(value); go(`#/?${stateToQuery(state)}`); return; }
    state[name] = value;
    shown = CONFIG.pageSize;
    update();
  }));
  root.querySelectorAll("button.sort").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.sort;
    if (state.sort === k) {
      const desc = state.dir ? state.dir === "desc" : SORTS[k].desc;
      state.dir = desc ? "asc" : "desc";
    } else {
      state.sort = k;
      state.dir = "";
    }
    update();
  }));
  moreBtn.addEventListener("click", () => { shown += CONFIG.pageSize; update(false); });
  update(false);
}
