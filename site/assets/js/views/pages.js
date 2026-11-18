// Static pages: method and support.
import { CONFIG } from "../config.js";
import { escapeHTML } from "../format.js";

export function renderMethod(root, { index }) {
  const latest = index.seasons[index.seasons.length - 1] || {};
  const ctx = latest.context || {};
  root.innerHTML = `
  <article class="prose">
    <h1>How the ratings work</h1>
    <p>Goals are rare and noisy, so these ratings are built on expected goals (xG): the quality of the
      chances a team creates and concedes. The question each rating answers is simple. With this player on
      the pitch, does his team create more chances, and do opponents create fewer, than you would expect
      from everyone else who was on the pitch with him?</p>

    <h2>Separating a player from his teammates</h2>
    <p>Every match is split into stretches where the 22 players, the score and the number of players on
      each side stay the same. For each stretch we know how much xG each team created per minute. One
      regression then estimates every player's effect at once, so a striker who plays next to a great
      creator does not get credit for the creator's work. It also accounts for the score (trailing teams
      attack more), home advantage, red cards and the manager.</p>
    <p>With hundreds of players who often play together, the raw estimates would be unstable. Each rating
      is pulled toward last season's rating, toward the average for players with few minutes, and
      toward a shared starting point for players new to the top five leagues. How strongly is chosen
      by testing which setting best predicts matches the model has not seen.</p>

    <h2>Reading the numbers</h2>
    <dl class="defs">
      <dt>Attack</dt><dd>xG per 90 minutes his team gains with him on the pitch.</dd>
      <dt>Defence</dt><dd>xG per 90 he keeps off the opponent. Positive is good: opponents create less.</dd>
      <dt>Net</dt><dd>Attack and defence together.</dd>
      <dt>xPAR</dt><dd>Expected points above replacement: his season's worth in league points, compared with
        a player from a relegation-level side, including finishing and, for keepers, shot-stopping.</dd>
      <dt>Likely range</dt><dd>The whisker on each bar. It comes from re-running the model on resampled
        matches; ratings for players with few minutes have wide ranges.</dd>
    </dl>
    <p>For scale: in ${escapeHTML(latest.label || "the latest season")} home advantage was worth about
      ${ctx.home !== undefined ? Math.abs(ctx.home).toFixed(2) : "0.2"} xG per 90, and playing with ten men cost about
      ${ctx.man_disadv !== undefined ? Math.abs(ctx.man_disadv).toFixed(2) : "0.5"}.</p>

    <h2>Comparing leagues</h2>
    <p>All five leagues are fitted together, so players share one scale and one replacement level, and a
      player who moved leagues keeps his history. The leagues never play each other here, though, so the
      model cannot say whether the Premier League is stronger than Ligue 1. Each rating is relative to the
      average player in his own league. Use the "his league" percentile when comparing across leagues.</p>

    <h2>What the ratings are not</h2>
    <ul>
      <li>They measure chances, not goals. A player can rate well in a season his team concedes a lot.</li>
      <li>Keepers' shot-stopping is noisy from one season to the next; treat it with care.</li>
      <li>Managers who stay at one club all season are hard to separate from their squad.</li>
      <li>Players with under 900 minutes are shown but not ranked in percentiles.</li>
    </ul>

    <h2>Testing</h2>
    <p>Settings were chosen by fitting the first half of a season and predicting the second. Compared with
      a straight reproduction of the original method, these settings roughly double the out-of-sample
      accuracy in the Premier League, and fitting all five leagues together helps further.</p>

    <h2>Credits</h2>
    <p>${escapeHTML(CONFIG.methodCredit)} <a href="${escapeHTML(CONFIG.methodCreditUrl)}">Macro-Football</a> is a
      separate site; this one is not affiliated with it. ${escapeHTML(CONFIG.dataCredit)}</p>
    <p>Data updated ${escapeHTML(index.generated || "")}.</p>
  </article>`;
}

export function renderSupport(root) {
  const has = Boolean(CONFIG.donateUrl);
  root.innerHTML = `
  <article class="prose">
    <h1>Support the site</h1>
    <p>Everything here is free to use and will stay that way. If the ratings are useful to you, a
      contribution helps cover the domain and the time it takes to update them through the season.</p>
    ${has
      ? `<p><a class="btn" href="${escapeHTML(CONFIG.donateUrl)}" rel="noopener">${escapeHTML(CONFIG.donateLabel)}</a></p>`
      : `<p class="caution">Donations are not open yet.</p>`}
    <h2>Other ways to help</h2>
    <ul>
      <li>Share a player page when a rating surprises you, and say why.</li>
      <li>Report a mistake: a wrong club, a missing player or a number that looks off.</li>
    </ul>
    <p>Made by <a href="${escapeHTML(CONFIG.authorUrl)}">${escapeHTML(CONFIG.author)}</a>.</p>
  </article>`;
}
