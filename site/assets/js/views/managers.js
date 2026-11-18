// Manager ratings.
import { loadManagers } from "../data.js";
import { escapeHTML, int, signed } from "../format.js";
import { divergingBar, segmented } from "../components.js";
import { clubHref } from "../filters.js";

export async function renderManagers(root, { index, state, go }) {
  const season = state.s;
  const all = await loadManagers(season);
  const label = index.seasons.find((x) => x.season === season)?.label || season;
  const maxAbs = Math.max(0.05, ...all.map((m) => Math.max(Math.abs(m.net_lo ?? m.net), Math.abs(m.net_hi ?? m.net))));

  root.innerHTML = `
    <section class="page-head">
      <h1>Managers</h1>
      <p class="hero-sub">Each manager's effect on his team's net xG per 90, after accounting for the players he fielded.
        Managers who stayed at one club all season are hard to separate from their squad, so read these as partly team-level.</p>
    </section>
    <section class="controls" aria-label="Filters">
      <div class="control"><span class="control-label">Season</span>
        ${segmented("s", index.seasons.map((x) => [x.season, x.label]), season, "Season")}</div>
      <div class="control"><span class="control-label">League</span>
        ${segmented("lg", [["all", "All five"], ...Object.entries(index.leagues)], state.lg, "League")}</div>
      <div class="control"><label class="control-label" for="mmin">Minimum matches</label>
        <select id="mmin">${[1, 5, 10, 19].map((m) => `<option value="${m}" ${m === (state.mm || 10) ? "selected" : ""}>${m}</option>`).join("")}</select></div>
    </section>
    <p class="result-count" id="count" aria-live="polite"></p>
    <div class="table-wrap">
      <table class="ptable mtable">
        <caption class="visually-hidden">Manager ratings, ${escapeHTML(label)}</caption>
        <thead><tr><th class="c-rank" scope="col">#</th><th scope="col">Manager</th><th class="c-num" scope="col">Matches</th>
          <th class="c-split-wide" scope="col">Net impact and likely range</th><th class="c-num" scope="col">Net</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>`;

  const rowsEl = root.querySelector("#rows"), countEl = root.querySelector("#count");
  function update() {
    const mm = state.mm || 10;
    const list = all.filter((m) => (state.lg === "all" || m.league === state.lg) && m.matches >= mm)
      .sort((a, b) => b.net - a.net);
    rowsEl.innerHTML = list.map((m, i) => `<tr>
      <td class="c-rank">${i + 1}</td>
      <td class="c-player"><span class="pname">${escapeHTML(m.name)}</span><span class="pteam">${(m.teams || "").split(", ").map((t) => `<a class="club-link" href="${clubHref(t, season)}">${escapeHTML(t)}</a>`).join(", ")}${state.lg === "all" ? `<span class="pleague">${escapeHTML(index.leagues[m.league] || m.league)}</span>` : ""}</span></td>
      <td class="c-num">${int(m.matches)}</td>
      <td class="c-split-wide">${divergingBar(m.net, maxAbs, "net", { lo: m.net_lo, hi: m.net_hi, height: 8, label: `Net ${signed(m.net)}` })}</td>
      <td class="c-num"><strong>${signed(m.net)}</strong></td></tr>`).join("")
      || `<tr><td colspan="5" class="empty">No managers match these filters. Lower the minimum matches.</td></tr>`;
    countEl.textContent = `${list.length} manager${list.length === 1 ? "" : "s"}`;
  }
  root.querySelectorAll(".seg input").forEach((inp) => inp.addEventListener("change", (e) => {
    if (e.target.name === "s") { go(`#/managers?s=${e.target.value}`); return; }
    state.lg = e.target.value;
    update();
  }));
  root.querySelector("#mmin").addEventListener("change", (e) => { state.mm = Number(e.target.value); update(); });
  update();
}
