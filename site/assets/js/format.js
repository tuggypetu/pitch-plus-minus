// Number and text formatting shared by all views.

const MINUS = "−";

/** +0.143 / −0.055 with a real minus sign; dec decimals. */
export function signed(v, dec = 3) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const s = Math.abs(v).toFixed(dec);
  if (Number(s) === 0) return (0).toFixed(dec);
  return (v > 0 ? "+" : MINUS) + s;
}

export function fixed(v, dec = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const s = Math.abs(v).toFixed(dec);
  return (v < 0 && Number(s) !== 0 ? MINUS : "") + s;
}

export function int(v) {
  if (v === null || v === undefined) return "–";
  return Math.round(v).toLocaleString("en-GB");
}

export function pct(v) {
  if (v === null || v === undefined) return "–";
  return `${Math.round(v)}`;
}

export function ordinal(n) {
  const v = Math.round(n);
  const s = ["th", "st", "nd", "rd"];
  const m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

export const POSITION_NAMES = { G: "Goalkeeper", D: "Defender", M: "Midfielder", F: "Forward" };

/** Text for search: lower-case, accents removed (so "Odegaard" finds "Ødegaard"). */
export function fold(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // combining accents
    .replace(/ø/g, "o")            // ø
    .replace(/æ/g, "ae")           // æ
    .replace(/ß/g, "ss")           // ß
    .replace(/ł/g, "l")            // ł
    .replace(/đ/g, "d")            // đ
    .replace(/ı/g, "i");           // dotless ı
}

export function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
