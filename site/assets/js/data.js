// Loading and decoding the JSON written by scripts/export_data.py.
// Pure functions are exported separately so they can be tested without a browser.

/** {"columns": [...], "rows": [[...]]} -> array of objects */
export function decodeTable(t) {
  if (!t || !Array.isArray(t.columns) || !Array.isArray(t.rows)) return [];
  const cols = t.columns;
  return t.rows.map((r) => {
    const o = {};
    for (let i = 0; i < cols.length; i++) o[cols[i]] = r[i];
    return o;
  });
}

const cache = new Map();

async function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(path);
}

export async function loadIndex() {
  return getJSON("data/index.json");
}

export async function loadPlayers(season) {
  return decodeTable(await getJSON(`data/${season}/players.json`));
}

export async function loadManagers(season) {
  try {
    return decodeTable(await getJSON(`data/${season}/managers.json`));
  } catch {
    return [];
  }
}
