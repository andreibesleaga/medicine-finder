// SQLite store for the downloaded national datasets (Node's built-in node:sqlite, no npm package).

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { normalize } from "../lib/text.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  brand TEXT NOT NULL,
  ingredient TEXT NOT NULL,
  country TEXT NOT NULL,
  holder TEXT,
  strength TEXT,
  form TEXT,
  status TEXT,
  url TEXT
);
CREATE INDEX IF NOT EXISTS products_source ON products(source);
CREATE TABLE IF NOT EXISTS words (
  source TEXT NOT NULL,
  word TEXT NOT NULL,
  product_id INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS words_lookup ON words(source, word);
CREATE TABLE IF NOT EXISTS brands (
  source TEXT NOT NULL,
  key TEXT NOT NULL,
  product_id INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS brands_lookup ON brands(source, key);
CREATE TABLE IF NOT EXISTS answers (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS answers_expiry ON answers(expires_at);
CREATE TABLE IF NOT EXISTS queries (
  term TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS datasets (
  source TEXT PRIMARY KEY,
  loaded_at INTEGER,
  rows INTEGER,
  error TEXT,
  attempted_at INTEGER
);
`;

/** Normalised words of an ingredient name, used for lookups ("IBUPROFÈNE LYSINE" -> ibuprofene, lysine). */
export function ingredientWords(ingredient) {
  return [...new Set(normalize(ingredient).split(/[^a-z0-9]+/).filter(Boolean))];
}

// stems this short ("d" in "vitamin d") must match a whole word, not the start of one
const SHORT_STEM = 3;

/** "Nurofen Junior 100 mg" -> "nurofen junior 100 mg": the form a brand is indexed and looked up in. */
export const brandKey = (s) => normalize(s).replace(/[^a-z0-9]+/g, " ").trim();

/** Opens (and creates if needed) the database. `file` may be ":memory:". */
export function openStore(file) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  db.exec(SCHEMA);
  // added in 2.3.1: which data format (parsers and word index) each dataset was loaded with
  if (!db.prepare("PRAGMA table_info(datasets)").all().some((c) => c.name === "format")) {
    db.exec("ALTER TABLE datasets ADD COLUMN format INTEGER");
  }

  const insertProduct = db.prepare(
    "INSERT INTO products (source, brand, ingredient, country, holder, strength, form, status, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertWord = db.prepare("INSERT INTO words (source, word, product_id) VALUES (?, ?, ?)");
  const insertBrand = db.prepare("INSERT INTO brands (source, key, product_id) VALUES (?, ?, ?)");
  const upsertDataset = db.prepare(
    `INSERT INTO datasets (source, loaded_at, rows, error, attempted_at, format) VALUES (?, ?, ?, NULL, ?, ?)
     ON CONFLICT(source) DO UPDATE SET loaded_at = excluded.loaded_at, rows = excluded.rows, error = NULL,
       attempted_at = excluded.attempted_at, format = excluded.format`,
  );
  const markError = db.prepare(
    `INSERT INTO datasets (source, error, attempted_at) VALUES (?, ?, ?)
     ON CONFLICT(source) DO UPDATE SET error = excluded.error, attempted_at = excluded.attempted_at`,
  );
  const findIds = db.prepare("SELECT product_id FROM words WHERE source = ? AND word >= ? AND word < ?");
  const findExact = db.prepare("SELECT product_id FROM words WHERE source = ? AND word = ?");
  const getInfo = db.prepare("SELECT loaded_at, rows, error, attempted_at, format FROM datasets WHERE source = ?");
  const getAnswer = db.prepare("SELECT body, expires_at FROM answers WHERE key = ?");
  const putAnswer = db.prepare("INSERT OR REPLACE INTO answers (key, body, expires_at) VALUES (?, ?, ?)");
  const countQuery = db.prepare(
    "INSERT INTO queries (term, n, last_at) VALUES (?, 1, ?) ON CONFLICT(term) DO UPDATE SET n = n + 1, last_at = excluded.last_at",
  );
  const anyWordFrom = db.prepare("SELECT 1 FROM words WHERE source = ? AND word >= ? AND word < ? LIMIT 1");
  const anyWord = db.prepare("SELECT 1 FROM words WHERE source = ? AND word = ? LIMIT 1");
  const findBrands = db.prepare(
    `SELECT p.brand, p.ingredient, p.country FROM brands b JOIN products p ON p.id = b.product_id
     WHERE b.source = ? AND b.key >= ? AND b.key < ? LIMIT ?`,
  );

  return {
    /** Replaces all rows of one source in a single transaction; `format` is the data format version. */
    replace(source, rows, now, format = null) {
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM words WHERE source = ?").run(source);
        db.prepare("DELETE FROM brands WHERE source = ?").run(source);
        db.prepare("DELETE FROM products WHERE source = ?").run(source);
        for (const r of rows) {
          const { lastInsertRowid } = insertProduct.run(
            source,
            r.brand,
            r.ingredient,
            r.country,
            r.holder ?? null,
            r.strength ?? null,
            r.form ?? null,
            r.status ?? null,
            r.url ?? null,
          );
          for (const w of ingredientWords(r.ingredient)) insertWord.run(source, w, lastInsertRowid);
          insertBrand.run(source, brandKey(r.brand), lastInsertRowid);
        }
        upsertDataset.run(source, now, rows.length, now, format);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },

    markError(source, message, now) {
      markError.run(source, message, now);
    },

    info(source) {
      return getInfo.get(source) ?? null;
    },

    /**
     * Products whose ingredient words start with every stem (a stem of one or two characters must
     * be the whole word), one entry per brand and country (the first
     * strengths and forms joined). Returns { total, results } where total counts brands.
     * `country` keeps one country's products (a source covering several); `perCountry` caps the
     * results of each country, so one country does not fill the whole list.
     */
    search(source, stems, limit = 60, { country, perCountry } = {}) {
      if (!stems.length) return { total: 0, results: [] };
      let ids = null;
      for (const s of stems) {
        const hits = s.length < SHORT_STEM ? findExact.all(source, s) : findIds.all(source, s, `${s}￿`);
        const found = new Set(hits.map((r) => r.product_id));
        ids = ids ? new Set([...ids].filter((id) => found.has(id))) : found;
        if (ids.size === 0) return { total: 0, results: [] };
      }
      const list = [...ids].sort((a, b) => a - b);
      const rows = [];
      for (let i = 0; i < list.length; i += 500) {
        const chunk = list.slice(i, i + 500);
        rows.push(...db.prepare(`SELECT * FROM products WHERE id IN (${chunk.map(() => "?").join(",")})`).all(...chunk));
      }
      const byBrand = new Map();
      for (const r of rows) {
        if (country && r.country !== country) continue;
        const key = `${brandKey(r.brand)}|${r.country}`;
        const hit = byBrand.get(key);
        if (!hit) {
          byBrand.set(key, { ...r, strengths: r.strength ? [r.strength] : [] });
        } else if (r.strength && hit.strengths.length < 4 && !hit.strengths.includes(r.strength)) {
          hit.strengths.push(r.strength);
        }
      }
      // single-ingredient products first (what the user asked for), then combinations; then by name
      const isCombo = (r) => (r.ingredient.includes(" + ") ? 1 : 0);
      const brands = [...byBrand.values()].sort((a, b) => isCombo(a) - isCombo(b) || a.brand.localeCompare(b.brand));
      const perCountryCount = new Map();
      const kept = perCountry
        ? brands.filter((r) => {
            const n = perCountryCount.get(r.country) ?? 0;
            perCountryCount.set(r.country, n + 1);
            return n < perCountry;
          })
        : brands.slice(0, limit);
      return {
        total: brands.length,
        results: kept.map((r) => ({
          brandName: r.brand,
          activeIngredient: r.ingredient,
          country: r.country,
          manufacturer: r.holder ?? undefined,
          strength: r.strengths.length ? r.strengths.join(", ") : undefined,
          dosageForm: r.form ?? undefined,
          status: r.status ?? undefined,
          url: r.url ?? undefined,
        })),
      };
    },

    /**
     * Search answers kept across restarts (Railway stops the server when idle), under a prefix such
     * as "search" or "ai": { get(key), set(key, body, expiresAt) }. Expired rows are removed when
     * read and pruned beyond `maxRows`.
     */
    answers(prefix, { now = Date.now, maxRows = 300, pruneEveryMs = 5 * 60e3 } = {}) {
      // pruning reads the index only, and runs at most every few minutes: SQLite blocks the server
      let lastPrune = 0;
      const prune = () => {
        if (now() - lastPrune < pruneEveryMs) return;
        lastPrune = now();
        db.prepare("DELETE FROM answers WHERE expires_at <= ?").run(now());
        const { n } = db.prepare("SELECT COUNT(*) AS n FROM answers").get();
        if (n > maxRows) {
          db.prepare("DELETE FROM answers WHERE key IN (SELECT key FROM answers ORDER BY expires_at LIMIT ?)").run(n - maxRows);
        }
      };
      return {
        get(key) {
          const row = getAnswer.get(`${prefix}:${key}`);
          if (!row) return undefined;
          if (row.expires_at <= now()) {
            db.prepare("DELETE FROM answers WHERE key = ?").run(`${prefix}:${key}`);
            return undefined;
          }
          return { body: JSON.parse(row.body), expiresAt: row.expires_at };
        },
        set(key, body, expiresAt) {
          putAnswer.run(`${prefix}:${key}`, JSON.stringify(body), expiresAt);
          prune();
        },
      };
    },

    /** Counts a searched term (no address or other personal data), for the daily warm-up. */
    countQuery(term, now) {
      countQuery.run(term, now);
    },

    /** The most searched terms since `since`. */
    topQueries(limit, since = 0) {
      return db.prepare("SELECT term FROM queries WHERE last_at >= ? ORDER BY n DESC, term LIMIT ?").all(since, limit).map((r) => r.term);
    },

    /** True when every stem starts (or, if short, is) a word of some ingredient of this source. */
    hasIngredientWords(source, stems) {
      if (!stems.length) return false;
      return stems.every((s) => (s.length < SHORT_STEM ? anyWord.get(source, s) : anyWordFrom.get(source, s, `${s}\uffff`)) !== undefined);
    },

    /** Products whose brand is `key` or starts with `key` and a space ("nurofen" -> "Nurofen Junior"). */
    findBrands(source, key, limit = 200) {
      if (!key) return [];
      return findBrands.all(source, key, `${key}\uffff`, limit).filter((r) => {
        const k = brandKey(r.brand);
        return k === key || k.startsWith(`${key} `);
      });
    },

    close() {
      db.close();
    },
  };
}
