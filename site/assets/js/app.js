// Entry point: hash router, shared state, layout chrome.
import { CONFIG } from "./config.js";
import { loadIndex } from "./data.js";
import { DEFAULT_STATE, parseState } from "./filters.js";
import { renderPlayers } from "./views/players.js";
import { renderPlayer } from "./views/player.js";
import { renderManagers } from "./views/managers.js";
import { renderClubs } from "./views/clubs.js";
import { renderClub } from "./views/club.js";
import { renderMethod, renderSupport } from "./views/pages.js";

const main = document.getElementById("main");
let index = null;

/**
 * Navigate to a hash. {replace: true} rewrites the current history entry instead of
 * adding one (replaceState never fires "hashchange"), and {silent: true} only updates
 * the address bar, e.g. to keep filter state shareable without re-rendering.
 */
function go(hash, { replace = false, silent = false } = {}) {
  if (location.hash === hash) return;
  if (replace) {
    history.replaceState(null, "", hash);
    if (!silent) route();
  } else {
    location.hash = hash;   // fires "hashchange" -> route()
  }
}

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query };
}

function setActiveNav(name) {
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

async function route() {
  const { parts, query } = parseHash();
  const latest = index.seasons[index.seasons.length - 1]?.season;
  const state = parseState(query, { ...DEFAULT_STATE, s: latest, min: CONFIG.defaultMinMinutes });
  if (!index.seasons.some((x) => x.season === state.s)) state.s = latest;
  const ctx = { index, state, go };
  main.setAttribute("aria-busy", "true");
  try {
    if (parts[0] === "player" && parts[1]) {
      setActiveNav("players");
      await renderPlayer(main, { ...ctx, id: decodeURIComponent(parts[1]) });
      document.title = `${document.querySelector(".phead-name")?.textContent || "Player"} | ${CONFIG.siteName}`;
    } else if (parts[0] === "club" && parts[1]) {
      setActiveNav("clubs");
      const team = decodeURIComponent(parts[1]);
      await renderClub(main, { ...ctx, team });
      document.title = `${team} | ${CONFIG.siteName}`;
    } else if (parts[0] === "clubs") {
      setActiveNav("clubs");
      await renderClubs(main, ctx);
      document.title = `Clubs | ${CONFIG.siteName}`;
    } else if (parts[0] === "managers") {
      setActiveNav("managers");
      await renderManagers(main, ctx);
      document.title = `Managers | ${CONFIG.siteName}`;
    } else if (parts[0] === "method") {
      setActiveNav("method");
      renderMethod(main, ctx);
      document.title = `How it works | ${CONFIG.siteName}`;
    } else if (parts[0] === "support") {
      setActiveNav("support");
      renderSupport(main, ctx);
      document.title = `Support | ${CONFIG.siteName}`;
    } else {
      setActiveNav("players");
      await renderPlayers(main, ctx);
      document.title = `${CONFIG.siteName}: ${CONFIG.tagline}`;
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = `<section class="notfound"><h1>The ratings didn't load</h1>
      <p>The data files couldn't be read (${String(err.message || err)}). Reload the page; if it keeps
      happening, the site may be mid-update.</p></section>`;
  } finally {
    main.removeAttribute("aria-busy");
  }
  if (parts[0] === "player" || parts[0] === "club") window.scrollTo(0, 0);
}

async function start() {
  document.querySelectorAll("[data-site-name]").forEach((el) => { el.textContent = CONFIG.siteName; });
  const support = document.querySelector('[data-nav="support"]');
  if (support && !CONFIG.donateUrl) support.textContent = "About";
  try {
    index = await loadIndex();
  } catch (err) {
    main.innerHTML = `<section class="notfound"><h1>The ratings didn't load</h1>
      <p>data/index.json is missing. Run scripts/export_data.py and publish again.</p></section>`;
    return;
  }
  const foot = document.getElementById("updated");
  if (foot) foot.textContent = `Data updated ${index.generated}.`;
  window.addEventListener("hashchange", route);
  route();
}

start();
