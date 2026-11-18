// One player's page.
import { loadPlayers } from "../data.js";
import { escapeHTML, fixed, int, signed, POSITION_NAMES } from "../format.js";
import { barScale, clubHref } from "../filters.js";
import { divergingBar, percentileStrip } from "../components.js";

function rangeText(lo, hi) {
  return typeof lo === "number" && typeof hi === "number" ? `likely between ${signed(lo)} and ${signed(hi)}` : "";
}

export async function renderPlayer(root, { index, id, state, go }) {
  const seasons = index.seasons.map((s) => s.season);
  const season = state.s;
  const all = await Promise.all(seasons.map((s) => loadPlayers(s)));
  const bySeason = Object.fromEntries(seasons.map((s, i) => [s, all[i]]));
  const players = bySeason[season];
  const p = players.find((x) => x.id === id);
  const label = (s) => index.seasons.find((x) => x.season === s)?.label || s;

  if (!p) {
    const other = seasons.find((s) => bySeason[s].some((x) => x.id === id));
    root.innerHTML = `<section class="notfound">
      <h1>No rating for this player in ${escapeHTML(label(season))}</h1>
      <p>${other ? `He has a rating for <a href="#/player/${encodeURIComponent(id)}?s=${other}">${escapeHTML(label(other))}</a>.` : "Check the link, or find him from the player table."}</p>
      <p><a href="#/?s=${season}">Back to all players</a></p></section>`;
    return;
  }

  const scale = barScale(players.filter((x) => x.q), ["off", "def"], 0.999);
  const P = (m) => p["p_" + m];
  const isGK = p.pos === "G";
  const leagueName = index.leagues[p.league] || p.league;

  const history = seasons.map((s) => [s, bySeason[s].find((x) => x.id === id)]).filter(([, x]) => x);

  root.innerHTML = `
    <p class="crumb"><a href="#/?s=${season}">All players</a></p>
    <header class="phead">
      <h1 class="phead-name">${escapeHTML(p.name)}</h1>
      <p class="phead-meta">${escapeHTML(POSITION_NAMES[p.pos] || "Player")} for <a href="${clubHref(p.team, season)}">${escapeHTML(p.team || "")}</a>,
        ${escapeHTML(leagueName)}. ${int(p.min)} minutes in ${escapeHTML(label(season))}.</p>
      ${p.q ? "" : `<p class="caution">Under 900 minutes: treat these numbers as a rough guide.</p>`}
    </header>

    <section class="impact" aria-labelledby="impact-h">
      <h2 id="impact-h">Impact while on the pitch</h2>
      <p class="impact-lede">Expected goals per 90 minutes, compared with an average player in his league.
        Right of the line is better; the whisker shows the likely range.</p>
      <div class="impact-row">
        <div class="impact-name">Attack</div>
        <div class="impact-bar">${divergingBar(p.off, scale, "attack", { lo: p.off_lo, hi: p.off_hi, height: 18, label: "Attack" })}</div>
        <div class="impact-num">${signed(p.off)}</div>
        <p class="impact-say">His team creates ${fixed(Math.abs(p.off), 3)} xG per 90 ${p.off >= 0 ? "more" : "less"} with him on the pitch, ${rangeText(p.off_lo, p.off_hi)}.</p>
      </div>
      <div class="impact-row">
        <div class="impact-name">Defence</div>
        <div class="impact-bar">${divergingBar(-p.def, scale, "defence", { lo: typeof p.def_hi === "number" ? -p.def_hi : null, hi: typeof p.def_lo === "number" ? -p.def_lo : null, height: 18, label: "Defence" })}</div>
        <div class="impact-num">${signed(-p.def)}</div>
        <p class="impact-say">Opponents create ${fixed(Math.abs(p.def), 3)} xG per 90 ${p.def <= 0 ? "less" : "more"} against his team when he plays.</p>
      </div>
      <div class="impact-row impact-net">
        <div class="impact-name">Net</div>
        <div class="impact-bar">${divergingBar(p.net, scale * 1.6, "net", { height: 18, label: "Net" })}</div>
        <div class="impact-num">${signed(p.net)}</div>
      </div>
    </section>

    <section class="headline-stats" aria-label="Season value">
      <div class="hs"><span class="hs-num">${fixed(p.xpar, 1)}</span><span class="hs-label">expected points above a replacement-level player</span></div>
      ${isGK
        ? `<div class="hs"><span class="hs-num">${signed(p.save_g, 1)}</span><span class="hs-label">goals saved compared with an average keeper</span></div>`
        : `<div class="hs"><span class="hs-num">${signed(p.fin_g, 1)}</span><span class="hs-label">goals added by finishing compared with an average shooter</span></div>`}
      ${isGK ? "" : `<div class="hs"><span class="hs-num">${fixed(p.npxg, 1)}</span><span class="hs-label">non-penalty xG from ${int(p.shots)} shots</span></div>`}
    </section>

    <section class="percentiles" aria-labelledby="pct-h">
      <h2 id="pct-h">Percentiles</h2>
      <p class="impact-lede">Compared with players who played at least 900 minutes across the top five leagues.</p>
      ${percentileStrip("Attack", P("off"))}
      ${percentileStrip("Defence", P("def"))}
      ${percentileStrip("Net impact", P("net"))}
      ${isGK ? "" : percentileStrip("Finishing", P("fin"), p.shots < 10 ? "too few shots to rate" : "")}
      ${percentileStrip("xPAR", P("xpar"))}
    </section>

    ${history.length > 1 ? `
    <section class="history" aria-labelledby="hist-h">
      <h2 id="hist-h">Season by season</h2>
      <div class="table-wrap"><table class="htable">
        <thead><tr><th scope="col">Season</th><th scope="col">Club</th><th class="c-num" scope="col">Minutes</th>
          <th class="c-num" scope="col">Attack</th><th class="c-num" scope="col">Defence</th><th class="c-num" scope="col">Net</th><th class="c-num" scope="col">xPAR</th></tr></thead>
        <tbody>${history.map(([s, x]) => `<tr${s === season ? ' class="is-current"' : ""}>
          <td><a href="#/player/${encodeURIComponent(id)}?s=${s}">${escapeHTML(label(s))}</a></td>
          <td><a href="${clubHref(x.team, s)}">${escapeHTML(x.team || "")}</a></td><td class="c-num">${int(x.min)}</td>
          <td class="c-num">${signed(x.off)}</td><td class="c-num">${signed(-x.def)}</td>
          <td class="c-num">${signed(x.net)}</td><td class="c-num">${fixed(x.xpar, 1)}</td></tr>`).join("")}</tbody>
      </table></div>
    </section>` : ""}
  `;

}
