// Clubs index: every club of the season, grouped by league.
import { loadPlayers } from "../data.js";
import { escapeHTML, signed } from "../format.js";
import { clubIndex, clubHref } from "../filters.js";
import { divergingBar, segmented } from "../components.js";

export async function renderClubs(root, { index, state, go }) {
  const season = state.s;
  const clubs = [...clubIndex(await loadPlayers(season)).values()];
  const meta = index.seasons.find((x) => x.season === season);
  const scale = Math.max(0.02, ...clubs.map((c) => Math.abs(c.net)));
  const leagues = Object.keys(index.leagues).filter((k) => meta?.leagues.includes(k));

  root.innerHTML = `
    <section class="page-head">
      <h1>Clubs</h1>
      <p class="hero-sub">Each club's squad on one chart: who adds chances, who stops them, and how much they played.
        The bar is the squad's net impact per 90, weighted by minutes.</p>
    </section>
    <section class="controls" aria-label="Filters">
      <div class="control"><span class="control-label">Season</span>
        ${segmented("s", index.seasons.map((x) => [x.season, x.label]), season, "Season")}</div>
    </section>
    <div class="club-grid">
      ${leagues.map((lg) => {
        const list = clubs.filter((c) => c.league === lg).sort((a, b) => b.net - a.net);
        return `<section class="club-league" aria-labelledby="lg-${lg}">
          <h2 id="lg-${lg}">${escapeHTML(index.leagues[lg])}</h2>
          <ol class="club-list">${list.map((c) => `
            <li><a href="${clubHref(c.team, season)}">${escapeHTML(c.team)}</a>
              <span class="club-bar">${divergingBar(c.net, scale, "net", { height: 6, label: `Squad net ${signed(c.net)} xG per 90` })}</span>
              <span class="club-net">${signed(c.net)}</span></li>`).join("")}
          </ol></section>`;
      }).join("")}
    </div>`;
  root.querySelectorAll('.seg input[name="s"]').forEach((inp) =>
    inp.addEventListener("change", (e) => go(`#/clubs?s=${e.target.value}`)));
}
