// Reusable bits of markup. All return HTML strings.
import { escapeHTML, signed } from "./format.js";

/**
 * One diverging bar around a centre line. Right of centre = good.
 * For defence, pass the *negated* def90 (fewer chances conceded = positive).
 * kind: "attack" | "defence" | "net"; lo/hi draw an interval whisker.
 */
export function divergingBar(value, scale, kind, { lo = null, hi = null, height = 8, label = "" } = {}) {
  const W = 200, C = W / 2, clamp = (v) => Math.max(-1, Math.min(1, v / scale));
  const x = (v) => C + clamp(v) * C;
  const v = typeof value === "number" ? value : 0;
  const x0 = Math.min(C, x(v)), w = Math.abs(x(v) - C);
  const good = v >= 0;
  const H = height + 6, y = 3;
  let whisker = "";
  if (typeof lo === "number" && typeof hi === "number") {
    const a = x(lo), b = x(hi), wy = y + height / 2;
    whisker = `<line class="whisker" x1="${a}" x2="${b}" y1="${wy}" y2="${wy}"/>` +
      `<line class="whisker" x1="${a}" x2="${a}" y1="${wy - 3}" y2="${wy + 3}"/>` +
      `<line class="whisker" x1="${b}" x2="${b}" y1="${wy - 3}" y2="${wy + 3}"/>`;
  }
  return `<svg class="bar bar-${kind}${good ? "" : " is-neg"}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
      role="img" aria-label="${escapeHTML(label)}">
    <rect class="bar-fill" x="${x0}" y="${y}" width="${Math.max(w, 0.6)}" height="${height}"/>
    ${whisker}
    <line class="bar-zero" x1="${C}" x2="${C}" y1="0" y2="${H}"/>
  </svg>`;
}

/** The two-row attack/defence mark used in the table. */
export function splitBars(p, scale) {
  return `<div class="split">
    ${divergingBar(p.off, scale, "attack", { height: 6, label: `Attack ${signed(p.off)} xG per 90` })}
    ${divergingBar(-p.def, scale, "defence", { height: 6, label: `Defence ${signed(-p.def)} xG per 90 prevented` })}
  </div>`;
}

/** A 0–100 track with a marker. */
export function percentileStrip(label, value, note = "") {
  const v = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
  return `<div class="pstrip">
    <span class="pstrip-label">${escapeHTML(label)}</span>
    <span class="pstrip-track" role="img" aria-label="${escapeHTML(label)}: ${v === null ? "not rated" : `percentile ${Math.round(v)}`}">
      ${v === null ? "" : `<span class="pstrip-fill" style="width:${v}%"></span><span class="pstrip-mark" style="left:${v}%"></span>`}
    </span>
    <span class="pstrip-value">${v === null ? "–" : Math.round(v)}</span>
    ${note ? `<span class="pstrip-note">${escapeHTML(note)}</span>` : ""}
  </div>`;
}

export function segmented(name, options, current, label) {
  return `<div class="seg" role="radiogroup" aria-label="${escapeHTML(label)}">
    ${options.map(([value, text]) => `
      <label class="seg-opt">
        <input type="radio" name="${name}" value="${escapeHTML(value)}" ${String(value) === String(current) ? "checked" : ""}>
        <span>${escapeHTML(text)}</span>
      </label>`).join("")}
  </div>`;
}

/** "Nice" tick step for a symmetric axis. */
export function niceStep(limit, target = 3) {
  const raw = limit / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n >= 7.5 ? 10 : n >= 3.5 ? 5 : n >= 1.5 ? 2 : 1) * mag;
}

/**
 * Attack (x) vs defence (y, = −def90) scatter for a squad, as an SVG string.
 * Every point is a link to the player page with an accessible label; the view
 * attaches the tooltip. Both axes share one symmetric scale, so distances compare.
 * points: [{id, name, pos, min, off, def, net, xpar, href}]
 */
export function impactScatter(points, { labelIds = new Set(), limit = null } = {}) {
  const W = 640, H = 520, m = { l: 56, r: 24, t: 24, b: 52 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const lim = limit || Math.max(0.02, ...points.flatMap((p) => [Math.abs(p.off), Math.abs(p.def)])) * 1.12;
  const x = (v) => m.l + ((v + lim) / (2 * lim)) * iw;
  const y = (v) => m.t + ((lim - v) / (2 * lim)) * ih;
  const maxMin = Math.max(1, ...points.map((p) => p.min || 0));
  const r = (mins) => 4 + 9 * Math.sqrt((mins || 0) / maxMin);
  const step = niceStep(lim);
  const ticks = [];
  for (let t = -Math.floor(lim / step) * step; t <= lim + 1e-9; t += step) ticks.push(+t.toFixed(6));
  const grid = ticks.map((t) => `
    <line class="sc-grid" x1="${x(t)}" x2="${x(t)}" y1="${m.t}" y2="${m.t + ih}"/>
    <line class="sc-grid" x1="${m.l}" x2="${m.l + iw}" y1="${y(t)}" y2="${y(t)}"/>
    <text class="sc-tick" x="${x(t)}" y="${m.t + ih + 18}" text-anchor="middle">${signed(t, 2)}</text>
    <text class="sc-tick" x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${signed(t, 2)}</text>`).join("");
  // place labels in priority order (the caller's labelIds order): right of the dot,
  // else left of it; skip any that would leave the plot or overlap a placed label
  const placed = [], labelPos = new Map();
  const overlaps = (b) => placed.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
  for (const id of labelIds) {
    const p = points.find((q) => q.id === id);
    if (!p) continue;
    // generous width estimate (12px semibold, plus the halo) so real labels never touch
    const cx = x(p.off), cy = y(-p.def), rr = r(p.min), w = shortName(p.name).length * 7.4 + 6, h = 16;
    for (const side of ["right", "left"]) {
      const x0 = side === "right" ? cx + rr + 4 : cx - rr - 4 - w;
      const box = { x0, x1: x0 + w, y0: cy - h / 2, y1: cy + h / 2 };
      if (box.x0 < m.l || box.x1 > m.l + iw || overlaps(box)) continue;
      placed.push(box);
      labelPos.set(id, { x: side === "right" ? box.x0 : box.x1, anchor: side === "right" ? "start" : "end" });
      break;
    }
  }
  // biggest minutes drawn first so small dots stay clickable on top
  const order = points.slice().sort((a, b) => (b.min || 0) - (a.min || 0));
  const dots = order.map((p) => {
    const cx = x(p.off), cy = y(-p.def), lp = labelPos.get(p.id);
    const label = `${p.name}, ${POS_SHORT[p.pos] || ""}, ${Math.round(p.min)} minutes: attack ${signed(p.off)}, defence ${signed(-p.def)}, xPAR ${p.xpar?.toFixed(1)}`;
    return `<a class="sc-pt pos-${p.pos}" href="${escapeHTML(p.href)}" data-id="${escapeHTML(p.id)}" aria-label="${escapeHTML(label)}">
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r(p.min).toFixed(1)}"/>
      ${lp ? `<text class="sc-label" x="${lp.x.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="${lp.anchor}">${escapeHTML(shortName(p.name))}</text>` : ""}
    </a>`;
  }).join("");
  return `<svg class="scatter" viewBox="0 0 ${W} ${H}" role="group" aria-label="Squad: attack against defence, xG per 90">
    <rect class="sc-good" x="${x(0)}" y="${m.t}" width="${iw / 2}" height="${ih / 2}"/>
    ${grid}
    <line class="sc-zero" x1="${x(0)}" x2="${x(0)}" y1="${m.t}" y2="${m.t + ih}"/>
    <line class="sc-zero" x1="${m.l}" x2="${m.l + iw}" y1="${y(0)}" y2="${y(0)}"/>
    <text class="sc-corner" x="${m.l + iw - 6}" y="${m.t + 16}" text-anchor="end">Better in attack and defence</text>
    <text class="sc-corner" x="${m.l + 6}" y="${m.t + ih - 8}">Worse in both</text>
    <text class="sc-axis" x="${m.l + iw / 2}" y="${H - 8}" text-anchor="middle">Attack: xG per 90 added for his team</text>
    <text class="sc-axis" transform="translate(14 ${m.t + ih / 2}) rotate(-90)" text-anchor="middle">Defence: xG per 90 kept off opponents</text>
    ${dots}
  </svg>`;
}

const POS_SHORT = { G: "goalkeeper", D: "defender", M: "midfielder", F: "forward" };

/** Chart label: short names as they are; "Riccardo Calafiori" -> "R. Calafiori". */
export function shortName(name) {
  const full = String(name || "").trim();
  const parts = full.split(/\s+/);
  if (full.length <= 13 || parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}
