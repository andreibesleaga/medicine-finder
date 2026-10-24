// Text helpers shared by the data sources.

const TERM_RE = /^[\p{L}\p{N}][\p{L}\p{N} .,'()/+-]{1,79}$/u;

/** Lower-case, strip accents and collapse spaces: "IBUPROFÈNE " -> "ibuprofene". */
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the cleaned search term, or null when it is not an acceptable ingredient name. */
export function validateTerm(raw) {
  const term = String(raw ?? "").replace(/\s+/g, " ").trim();
  return TERM_RE.test(term) ? term : null;
}

/**
 * Word stems used to match an English ingredient name against French or Spanish
 * names: "amoxicillin" -> "amoxici" matches "amoxicilline" and "amoxicilina". The term is split
 * into words the same way the database indexes them (`ingredientWords`), so "paracetamol
 * (acetaminophen)" and "St. John's wort" match too; words of one or two characters ("d" in
 * "vitamin d") are kept whole and must match a whole word.
 */
export function stems(term) {
  return normalize(term)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length >= 9 ? w.slice(0, -3) : w.length >= 6 ? w.slice(0, -2) : w));
}

/** Decodes the XML entities of a text or attribute value ("&amp;" -> "&", "&#233;" -> "é"). */
export const decodeXml = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** Splits "ADVIL 200 mg, comprimé enrobé" into brand "ADVIL", strength "200 mg", form "comprimé enrobé". */
export function splitProductName(name) {
  // ", " separates the form; a comma without a space is a decimal comma ("2,4 %")
  const [head, ...rest] = String(name).split(/,\s+/);
  const form = rest.join(", ").trim() || undefined;
  const m = head.match(/^(.*?)\s+(\d[\d.,\s]*\s*(?:mg|g|gm|µg|microgrammes?|micrograms?|mcg|ml|mL|%|UI|U\.?I\.?|IU|units?|kiu|mCi|mmol)(?=[\s,/]|$).*)$/i);
  if (m && m[1].trim()) return { brand: m[1].trim(), strength: m[2].trim(), form };
  return { brand: head.trim(), strength: undefined, form };
}

/** "IBUPROFENO CINFA" -> "Ibuprofeno Cinfa"; leaves mixed-case names alone. */
export function tidyCase(name) {
  const s = String(name).trim();
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
}

// Product titles ("Maalox Plus Chewable Tablets", "Cezolin Injection 1 gm/vial") carry the dosage
// form and strength after the brand; these helpers cut a name back to the brand.
const FORMS =
  "tablets?|tabs?|caplets?|capsules?|softgels?|injections?|injectables?|solutions?|syrups?|creams?|ointments?|gels?|powders?|suspensions?|" +
  "granules?|drops|lotions?|sprays?|suppositor(?:y|ies)|patch(?:es)?|emulsions?|elixirs?|infusions?|concentrates?|ampoules?|vials?|" +
  "inhalers?|lozenges?|sachets?|tabletas?|c[aá]psulas?|soluci[oó]n|suspensi[oó]n|cremas?|jarabes?|inyectables?|ampollas?|pomadas?|" +
  "ung[uü]entos?|polvo|gotas|supositorios?|parches?|comprimidos?|granulados?|emulsi[oó]n|liofilizado|colirio";
// descriptors that mean a form on their own, and ones that only count before a form word
const FORM_DESCRIPTORS = "(?:film|sugar)[- ]coated|f\\.?c\\.?|(?:prolonged|extended|modified|delayed)[- ]release|(?:hard|soft) gelatin|chewable|(?:oro)?dispersible|effervescent";
const FORM_PREFIXES = `oral|vaginal|rectal|ophthalmic|eye|ear|nasal|topical|sublingual|soluble|coated`;
const WORD_END = "(?![\\p{L}\\p{N}])";
const FORM_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:(?:${FORM_PREFIXES}|${FORM_DESCRIPTORS})[\\s-]+)*(?:${FORMS})(?!\\p{L})|(?<![\\p{L}\\p{N}])(?:${FORM_DESCRIPTORS})${WORD_END}`, "iu");
const UNITS = "mg|g|gm|kg|µg|mcg|microgram|milligram|ml|l|%|iu|ui|units?|kiu|mci|mmol|meq";
// a spaced number ("Zyceva 150"), or digits glued to a word with a unit or a decimal ("Domperidona10mg", "Dihidrato551.685")
const AMOUNT_RE = new RegExp(`\\s\\(?\\d|(?<=\\p{L})\\d+(?:[.,]\\d+)?\\s+(?:mg|g|ml|mcg|µg|iu|ui)|(?<=[\\p{L}.\\-])\\d+(?:[.,]\\d+)?\\s*(?:${UNITS})s?(?:\\(s\\))?${WORD_END}|(?<=[\\p{L}.\\-])\\d+[.,]\\d`, "iu");
// more strength markers in product titles: "Ezetimibe10 + Simvastatina 40", "Amtas-5", "Lactulaxjarabe"
const GLUED_RES = [
  /(?<=\p{Ll}{3})\d+(?=\s*[+/])/u,
  /(?<=\p{L}{3})[-*]\d/u,
  /(?:c[aá]psulas?|tabletas?|jarabe|soluci[oó]n|inyectable|crema)/iu,
];
const UNCLOSED_PAREN = /\s*\([^)]*$/;
const TRAILING_JUNK = /(?:\s+(?:for|and|with|in|of|i\.?v|i\.?m|s\.?c|e\.?s\.?c|e\.?c|f\.?c|d\.?c)\.?|[\s.,;:/+&(-])+$/i;

/** Cuts `text` at the earliest match (not at position 0) of the patterns and trims trailing punctuation; keeps `text` when nothing is left. */
export function cutAt(text, ...patterns) {
  const s = String(text).trim();
  const at = patterns.map((re) => s.search(re)).filter((i) => i > 0);
  const head = (at.length ? s.slice(0, Math.min(...at)) : s).replace(UNCLOSED_PAREN, "").replace(TRAILING_JUNK, "").trim();
  return head || s;
}

/** "Warfarin 5 mg" -> "Warfarin"; "Dihidrato551.685 Mg" -> "Dihidrato"; keeps "Vitamina B12". */
export const cutAtAmount = (text) => cutAt(text, AMOUNT_RE);

/** "Maalox Plus Chewable Tablets" -> "Maalox Plus"; "Cezolin Injection 1 gm/vial" -> "Cezolin"; keeps the title when the cut would leave nothing. */
export const cutProductTitle = (title) => cutAt(title, FORM_RE, AMOUNT_RE, ...GLUED_RES);

/** Drops exact duplicate rows (same fields, in order). */
export function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = JSON.stringify(r);
    return !seen.has(key) && seen.add(key);
  });
}
