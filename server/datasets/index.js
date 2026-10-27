// Loads the national datasets into SQLite in the background (one at a time) and exposes each
// one as a search source.

import { normalize, stems, validateTerm } from "../lib/text.js";
import { brandKey } from "../db/store.js";
import { MAX_PER_SOURCE } from "../search.js";
import { preferredName, searchNames, withSynonyms } from "../lib/synonyms.js";
import { ema } from "./ema.js";
import { bdpm } from "./bdpm.js";
import { aifa } from "./aifa.js";
import { urpl } from "./urpl.js";
import { cbg } from "./cbg.js";
import { hpra } from "./hpra.js";
import { swissmedic } from "./swissmedic.js";
import { sukl } from "./sukl.js";
import { dkma } from "./dkma.js";
import { dpd } from "./dpd.js";
import { mpa } from "./mpa.js";
import { vvkt } from "./vvkt.js";
import { drlz } from "./drlz.js";
import { maltama } from "./maltama.js";
import { usfda } from "./usfda.js";
import { invima } from "./invima.js";
import { tfda } from "./tfda.js";
import { hsa } from "./hsa.js";
import { pharmac } from "./pharmac.js";
import { fimea } from "./fimea.js";
import { article57 } from "./article57.js";
import { curated } from "./curated.js";

// loaded in this order after a start: Europe, then the Americas, then Asia-Pacific
export const DATASETS = [
  ema, bdpm, aifa, urpl, cbg, hpra, swissmedic, sukl, dkma, mpa, vvkt, drlz, maltama, fimea, article57,
  dpd, usfda, invima,
  tfda, hsa, pharmac,
  curated,
];

const RETRY_AFTER_MS = 3600e3;
const DAY = 24 * 3600e3;
// a source covering several countries returns at most this many brands per country when no
// country is chosen (60 for a chosen country, as any source)
export const PER_COUNTRY = 20;
// Raise by one when a loader's output or the word index changes: every dataset saved with an older
// format is then reloaded once after the deploy (its old rows are served until then).
// 3: brand names indexed too (brand-name search, 2.4.0)
export const DATA_FORMAT = 3;

// sources whose ingredient names are English INN, preferred when a brand is resolved to its ingredient
const ENGLISH_FIRST = ["ema-article57", "ema", "hpra", "usfda", "dpd", "pharmac", "hsa", "tfda", "malta-ma", "curated"];
// salt and form words dropped from a resolved ingredient so the search finds every salt of it
const SALT_WORDS = new Set(
  ("hydrochloride hydrobromide sodium potassium calcium magnesium phosphate sulfate sulphate maleate besilate besylate " +
    "mesilate mesylate tartrate citrate acetate fumarate succinate lysine arginine dihydrate monohydrate trihydrate hemihydrate " +
    "anhydrous base hyclate dipropionate propionate valerate dihydrochloride diethylamine epolamine trometamol meglumine disodium " +
    "dipotassium hemifumarate bitartrate oxalate malate tosilate hcl").split(" "),
);

// a substance whose first word is one of these is a salt of that metal ("Magnesium Sulfate"): kept
// whole, or the search would find every magnesium product
const METALS = new Set("sodium potassium calcium magnesium zinc ferrous ferric iron ammonium lithium aluminium aluminum copper silver".split(" "));
const HYDRATES = new Set("dihydrate monohydrate trihydrate hemihydrate anhydrous".split(" "));

/**
 * "Dexamethasone Sodium Phosphate" -> "dexamethasone": salt words after the first word are dropped,
 * so every salt of the substance is found. Salts of a metal ("Magnesium Sulfate", "Sodium Chloride")
 * keep their name, without hydrate words; "Acetylsalicylic Acid" stays whole.
 */
export function coreIngredient(ingredient) {
  return ingredient
    .split(/\s*\+\s*/)
    .map((part) => {
      // "Anhydrous Lidocaine Hydrochloride": a leading hydrate word is not the substance
      const [first, ...rest] = normalize(part).split(/[^a-z0-9]+/).filter((w) => w && !HYDRATES.has(w));
      const drop = METALS.has(first) ? HYDRATES : SALT_WORDS;
      return [first, ...rest.filter((w) => !drop.has(w))].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" + ");
}

// words that do not tell two substances apart: salts in several languages, "acid", "recombinant"…
const NOT_SUBSTANCE = new Set([
  ...[...SALT_WORDS].filter((w) => !METALS.has(w)),
  ..."chlorhydrate dichlorhydrate clorhidrato cloridrato hydrochlorid hydrochloridum de of from and acid acide acido acidum recombinant vitamin".split(" "),
]);
// spellings fold together for comparison only: Ciklosporin/Ciclosporin, Metyrapone/Metirapone,
// Cholique/Cholic, Kizartinib/Quizartinib, Aloperidolo/Haloperidol
const fold = (w) =>
  w.replace(/ph/g, "f").replace(/th/g, "t").replace(/ch/g, "c").replace(/qu/g, "c").replace(/y/g, "i").replace(/k/g, "c").replace(/^h/, "");
const substanceWords = (ingredient) =>
  normalize(ingredient)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !NOT_SUBSTANCE.has(w))
    .map(fold);
function sameWord(a, b) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 6 && long.includes(short)) return true;
  let n = 0;
  while (n < short.length && short[n] === long[n]) n++;
  return short.length >= 4 && n >= Math.min(5, short.length - 1);
}
/**
 * Whether two ingredient names are one substance: another name in the synonym list (Paracetamol,
 * Acetaminophen), or the main word of either found among the other's words, allowing for spelling
 * ("Dichlorhydrate De Flupentixol" = "Flupentixol Hydrochloride"; "Sodium Chloride" is not
 * "Potassium Chloride").
 */
export function sameIngredient(a, b) {
  const names = (x) => withSynonyms(coreIngredient(x));
  const [na, nb] = [names(a), names(b)];
  if (na.some((x) => nb.includes(x))) return true;
  const [wa, wb] = [substanceWords(a), substanceWords(b)];
  if (!wa.length || !wb.length) return normalize(a) === normalize(b);
  return wb.some((w) => sameWord(wa[0], w)) || wa.some((w) => sameWord(wb[0], w));
}
const isCombination = (ingredient) => ingredient.includes(" + ");

// A dataset may also define available(ctx) (false: shown as off, not loaded; e.g. a file imported by
// hand that is not there yet), modifiedAt(ctx) (reload when its source is newer than the data) and
// requires: "VAR" (a key the operator sets in the environment; off until it is set; load() reads it
// from ctx.env).
export function createDatasetSources({ store, datasets = DATASETS, fetch, now = Date.now, log = () => {}, limit = MAX_PER_SOURCE, importDir, env = {} }) {
  const ctx = { importDir, env };
  const hasKey = (d) => !d.requires || Boolean(String(env[d.requires] ?? "").trim());
  const available = (d) => hasKey(d) && (!d.available || d.available(ctx));
  const loading = new Set();
  // datasets with refreshMs 0 (built-in data) are reloaded once per start, so edits apply on deploy
  const loadedThisRun = new Set();

  function status(d) {
    if (!hasKey(d)) return { state: "disabled", detail: `set ${d.requires} to enable` };
    if (!available(d)) return { state: "disabled", detail: d.unavailableDetail };
    const info = store.info(d.id);
    const base = info?.loaded_at
      ? { state: "ready", rows: info.rows, updatedAt: new Date(info.loaded_at).toISOString() }
      : { state: loading.has(d.id) ? "loading" : info?.error ? "error" : "loading" };
    if (loading.has(d.id) && info?.loaded_at) base.detail = "refreshing";
    if (info?.error) base.detail = info.loaded_at ? `last refresh failed: ${info.error}` : info.error;
    // a file imported by hand that nobody replaced for a while: say so, the data is getting old
    const days = d.staleAfterMs && d.modifiedAt ? Math.floor((now() - d.modifiedAt(ctx)) / DAY) : 0;
    if (days * DAY > d.staleAfterMs) base.detail = [base.detail, `imported file is ${days} days old; replace it (docs/DEPLOY.md)`].filter(Boolean).join("; ");
    return base;
  }

  const sources = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    coverage: d.coverage,
    homepage: d.homepage,
    terms: d.terms,
    reuse: d.reuse,
    countries: d.countries,
    ...((d.countries?.length ?? 0) > 1 ? { maxResults: PER_COUNTRY * d.countries.length } : {}),
    enabled: () => available(d),
    status: () => status(d),
    async search(term, ctx = {}) {
      if (!store.info(d.id)?.loaded_at) {
        throw new Error(loading.has(d.id) ? "data is still loading" : "data not loaded yet");
      }
      // a source covering several countries (Article 57): the chosen country only, or a few
      // results from each country when none is chosen
      const multi = (d.countries?.length ?? 0) > 1;
      const country = multi && d.countries.includes(ctx.country) ? ctx.country : undefined;
      const perCountry = multi && !country ? PER_COUNTRY : undefined;
      // search each name of the ingredient (e.g. paracetamol and acetaminophen), brands merged
      const seen = new Map();
      let total = 0;
      for (const name of searchNames(term)) {
        const { total: t, results } = store.search(d.id, stems(name), limit, { country, perCountry });
        // names of one ingredient often find the same products: the largest count, not their sum
        total = Math.max(total, t);
        for (const r of results) {
          const key = `${r.brandName.toLowerCase()}|${r.country}`;
          if (!seen.has(key)) seen.set(key, r);
        }
      }
      const all = [...seen.values()];
      return { total: Math.max(total, seen.size), results: perCountry ? all : all.slice(0, limit) };
    },
  }));

  /**
   * When `term` is not an ingredient in any dataset but is a brand name, the ingredient it stands
   * for: { name, ingredient, searchFor, others }. `others` lists the different ingredients the
   * same name stands for in other countries (a known source of medication errors). Else null.
   */
  function resolveBrand(term) {
    const key = brandKey(term);
    if (key.length < 3) return null;
    const loaded = datasets.filter((d) => available(d) && store.info(d.id)?.loaded_at);
    if (searchNames(term).some((name) => loaded.some((d) => store.hasIngredientWords(d.id, stems(name))))) return null;
    const matches = loaded.flatMap((d) => store.findBrands(d.id, key).map((m) => ({ ...m, source: d.id })));
    if (!matches.length) return null;
    const exact = matches.filter((m) => brandKey(m.brand) === key);
    const pool = exact.length ? exact : matches;
    const english = (m) => {
      const i = ENGLISH_FIRST.indexOf(m.source);
      return i < 0 ? ENGLISH_FIRST.length : i;
    };
    // how many products (in how many sources) name each ingredient: the commonest wins
    const support = (m) => pool.filter((o) => sameIngredient(o.ingredient, m.ingredient)).length;
    const best = [...pool].sort(
      (a, b) =>
        Number(isCombination(a.ingredient)) - Number(isCombination(b.ingredient)) ||
        support(b) - support(a) ||
        english(a) - english(b),
    )[0];
    const others = [];
    for (const m of pool) {
      if (isCombination(m.ingredient) || sameIngredient(m.ingredient, best.ingredient)) continue;
      const known = others.find((o) => sameIngredient(o.ingredient, m.ingredient));
      if (known) {
        if (!known.countries.includes(m.country)) known.countries.push(m.country);
      } else if (others.length < 3) {
        others.push({ ingredient: m.ingredient, countries: [m.country] });
      }
    }
    // a brand of three or more substances (infusions, homeopathic mixtures) is not searched by
    // ingredient: the term would be too long for the sources and too narrow to be useful
    const searchFor = coreIngredient(best.ingredient);
    if (searchFor.split(" + ").length > 2 || !validateTerm(searchFor)) return null;
    // no product has exactly this name ("dolormin" -> "Dolormin Extra"): the register's spelling of the typed words
    const words = term.trim().split(/\s+/).length;
    const name = exact[0]?.brand ?? matches[0].brand.split(/\s+/).slice(0, words).join(" ");
    return { name, ingredient: preferredName(best.ingredient), searchFor, others };
  }

  /** Loads every dataset that is missing or older than its refresh interval, one after another. */
  async function refreshDue() {
    for (const d of datasets) {
      const info = store.info(d.id);
      if (!available(d)) continue;
      const modified = d.modifiedAt?.(ctx);
      const newerSource = Boolean(info?.loaded_at) && modified > info.loaded_at;
      const current = Boolean(info?.loaded_at) && info.format === DATA_FORMAT;
      const fresh = d.refreshMs === 0 ? loadedThisRun.has(d.id) : current && now() - info.loaded_at < d.refreshMs && !newerSource;
      if (fresh || loading.has(d.id)) continue;
      // after a failed download, wait an hour before trying again (at once if a newer file was imported)
      const retryLater = info?.error && info.attempted_at && now() - info.attempted_at < RETRY_AFTER_MS;
      if (retryLater && !(modified > info.attempted_at)) continue;
      loading.add(d.id);
      const started = now();
      try {
        const rows = await d.load(fetch, ctx);
        if (!rows.length) throw new Error("the download contained no usable rows");
        store.replace(d.id, rows, now(), DATA_FORMAT);
        loadedThisRun.add(d.id);
        log(`dataset ${d.id}: ${rows.length} rows in ${Math.round((now() - started) / 1000)} s`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        store.markError(d.id, msg.slice(0, 200), now());
        log(`dataset ${d.id} failed: ${msg}`);
      } finally {
        loading.delete(d.id);
      }
    }
  }

  return { sources, refreshDue, resolveBrand };
}
