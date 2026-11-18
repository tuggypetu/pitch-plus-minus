// One club: interactive attack-vs-defence chart of the squad, managers, squad table.
import { loadPlayers, loadManagers } from "../data.js";
import { escapeHTML, fixed, int, signed, POSITION_NAMES } from "../format.js";
import { barScale, clubIndex, clubHref } from "../filters.js";
import { impactScatter, segmented, splitBars } from "../components.js";

const MIN_OPTIONS = [0, 270, 450, 900];

export async function renderClub(root, { index, team, state, go }) {
  const season = state.s;
  const players = await loadPlayers(season);
  const club = clubIndex(players).get(team);
  const label = (s) => index.seasons.find((x) => x.season === s)?.label || s;
  if (!club) {
    root.innerHTML = `<section class="notfound"><h1>${escapeHTML(team)} isn't in the ${escapeHTML(label(season))} ratings</h1>
      <p>The club may have played in a different season or league. <a href="#/clubs?s=${season}">See all clubs</a>.</p></section>`;
    return;
  }
  const managers = (await loadManagers(season)).filter((m) => (m.teams || "").split(", ").includes(team));
  const leagueName = index.leagues[club.league] || club.league;
  const scale = barScale(players.filter((p) => p.q));
  // one axis range for every club so charts compare, widened only if a player would fall outside it
  const limit = barScale(players.filter((p) => p.min >= 450), ["off", "def"], 0.995) * 1.15;
  const view = { min: state.cmin ?? 450, pos: state.pos || "all" };

  root.innerHTML = `
    <p class="crumb"><a href="#/clubs?s=${season}">All clubs</a></p>
    <header class="phead">
      <h1 class="phead-name">${escapeHTML(team)}</h1>
      <p class="phead-meta">${escapeHTML(leagueName)}, ${escapeHTML(label(season))}. ${club.players.length} players rated.
        Squad net impact ${signed(club.net)} xG per 90.</p>
      ${index.seasons.length > 1 ? `<div class="season-switch">${segmented("s", index.seasons.map((x) => [x.season, x.label]), season, "Season")}</div>` : ""}
    </header>

    <section class="club-chart" aria-labelledby="chart-h">
      <div class="section-head">
        <h2 id="chart-h">The squad at a glance</h2>
      </div>
      <p class="impact-lede">Each dot is a player; bigger dots played more. Up and to the right is better.
        Hover or tab to a dot for his numbers, select it to open his page.</p>
      <div class="chart-controls">
        ${segmented("cpos", [["all", "Everyone"], ["F", "Forwards"], ["M", "Midfielders"], ["D", "Defenders"], ["G", "Keepers"]], view.pos, "Highlight position")}
        <label class="inline-select">Minutes at least
          <select id="cmin">${MIN_OPTIONS.map((m) => `<option value="${m}" ${m === view.min ? "selected" : ""}>${m === 0 ? "any" : int(m)}</option>`).join("")}</select>
        </label>
      </div>
      <div class="chart-wrap" id="chart"></div>
      <p class="chart-key"><span><i style="background:var(--attack)"></i>Forwards</span><span><i style="background:var(--ink);opacity:.55"></i>Midfielders</span><span><i style="background:var(--defence)"></i>Defenders and keepers</span></p>
      <div class="chart-tip" id="tip" role="status" aria-live="polite" hidden></div>
    </section>

    ${managers.length ? `
    <section class="club-managers" aria-labelledby="mgr-h">
      <h2 id="mgr-h">${managers.length > 1 ? "Managers" : "Manager"}</h2>
      <ul class="mgr-list">${managers.map((m) => `<li><strong>${escapeHTML(m.name)}</strong>
        ${int(m.matches)} matches${m.teams.includes(",") ? ` (also ${escapeHTML(m.teams.split(", ").filter((t) => t !== team).join(", "))})` : ""}:
        net ${signed(m.net)} xG per 90${typeof m.net_lo === "number" ? `, likely between ${signed(m.net_lo)} and ${signed(m.net_hi)}` : ""}</li>`).join("")}</ul>
    </section>` : ""}

    <section class="squad" aria-labelledby="squad-h">
      <h2 id="squad-h">Squad</h2>
      <div class="table-wrap">
        <table class="ptable">
          <caption class="visually-hidden">${escapeHTML(team)} squad ratings</caption>
          <thead><tr><th scope="col">Player</th><th class="c-pos" scope="col">Pos</th><th class="c-num c-min" scope="col">Minutes</th>
            <th class="c-num c-att" scope="col">Attack</th><th class="c-num c-def" scope="col">Defence</th><th class="c-split" scope="col">Split</th>
            <th class="c-num c-xpar" scope="col">xPAR</th><th class="c-num c-pct" scope="col">Pct</th></tr></thead>
          <tbody id="squad-rows"></tbody>
        </table>
      </div>
    </section>`;

  const chart = root.querySelector("#chart"), tip = root.querySelector("#tip");
  const byId = new Map(club.players.map((p) => [p.id, p]));

  function draw() {
    const shown = club.players.filter((p) => (p.min || 0) >= view.min && typeof p.off === "number");
    const pts = shown.map((p) => ({ ...p, href: `#/player/${encodeURIComponent(p.id)}?s=${season}` }));
    // label the regulars with the most extreme net impact, so names don't pile up
    const labelIds = new Set(shown.filter((p) => p.min >= 900).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 9).map((p) => p.id));
    chart.innerHTML = pts.length
      ? impactScatter(pts, { labelIds, limit: Math.max(limit, ...pts.flatMap((p) => [Math.abs(p.off), Math.abs(p.def)]).map((v) => v * 1.12)) })
      : `<p class="empty">No players with at least ${int(view.min)} minutes. Lower the minutes filter.</p>`;
    chart.classList.toggle("is-filtered", view.pos !== "all");
    chart.querySelectorAll(".sc-pt").forEach((a) => {
      const p = byId.get(a.dataset.id);
      a.classList.toggle("is-dim", view.pos !== "all" && p.pos !== view.pos);
      const show = () => showTip(a, p);
      a.addEventListener("pointerenter", show);
      a.addEventListener("focus", show);
      a.addEventListener("pointerleave", hideTip);
      a.addEventListener("blur", hideTip);
    });
    root.querySelector("#squad-rows").innerHTML = club.players.slice().sort((a, b) => (b.xpar ?? -99) - (a.xpar ?? -99)).map((p) => `
      <tr class="${view.pos !== "all" && p.pos !== view.pos ? "is-dim" : ""}">
        <td class="c-player"><a class="pname" href="#/player/${encodeURIComponent(p.id)}?s=${season}">${escapeHTML(p.name)}</a></td>
        <td class="c-pos">${escapeHTML(p.pos || "")}</td>
        <td class="c-num c-min">${int(p.min)}</td>
        <td class="c-num c-att">${signed(p.off)}</td>
        <td class="c-num c-def">${signed(-p.def)}</td>
        <td class="c-split">${splitBars(p, scale)}</td>
        <td class="c-num c-xpar"><strong>${fixed(p.xpar, 1)}</strong></td>
        <td class="c-num c-pct">${p.p_xpar ?? "–"}</td>
      </tr>`).join("");
  }

  function showTip(a, p) {
    tip.innerHTML = `<strong>${escapeHTML(p.name)}</strong>
      <span>${escapeHTML(POSITION_NAMES[p.pos] || "")}, ${int(p.min)} minutes</span>
      <span class="t-att">Attack ${signed(p.off)}</span><span class="t-def">Defence ${signed(-p.def)}</span>
      <span>Net ${signed(p.net)}, xPAR ${fixed(p.xpar, 1)}</span>`;
    tip.hidden = false;
    const box = chart.getBoundingClientRect(), dot = a.getBoundingClientRect();
    const left = Math.min(dot.left - box.left + dot.width + 10, box.width - tip.offsetWidth - 4);
    const top = Math.max(0, dot.top - box.top - tip.offsetHeight / 2 + dot.height / 2);
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${top + chart.offsetTop}px`;
  }
  function hideTip() { tip.hidden = true; }

  root.querySelectorAll('.seg input[name="cpos"]').forEach((inp) => inp.addEventListener("change", (e) => { view.pos = e.target.value; draw(); }));
  root.querySelector("#cmin").addEventListener("change", (e) => { view.min = Number(e.target.value); draw(); });
  root.querySelectorAll('.seg input[name="s"]').forEach((inp) =>
    inp.addEventListener("change", (e) => go(clubHref(team, Number(e.target.value)))));
  draw();
}
