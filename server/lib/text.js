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
 * names: "amoxicillin" -> "amoxici" matches "amoxicilline" and "amoxicilina".
 */
export function stems(term) {
  return normalize(term)
    .split(/[\s/+,-]+/)
    .filter(Boolean)
    .map((w) => (w.length >= 9 ? w.slice(0, -3) : w.length >= 6 ? w.slice(0, -2) : w));
}

/** True when every stem of the term starts one of the words of the substance name. */
export function matchesSubstance(termStems, substance) {
  const words = normalize(substance).split(/[\s/+,()-]+/).filter(Boolean);
  return termStems.length > 0 && termStems.every((s) => words.some((w) => w.startsWith(s)));
}

/** Splits "ADVIL 200 mg, comprimé enrobé" into brand "ADVIL", strength "200 mg", form "comprimé enrobé". */
export function splitProductName(name) {
  // ", " separates the form; a comma without a space is a decimal comma ("2,4 %")
  const [head, ...rest] = String(name).split(/,\s+/);
  const form = rest.join(", ").trim() || undefined;
  const m = head.match(/^(.*?)\s+(\d[\d.,\s]*\s*(?:mg|g|µg|microgrammes?|mcg|ml|mL|%|UI|U\.?I\.?|IU|mmol)(?=[\s,/]|$).*)$/i);
  if (m && m[1].trim()) return { brand: m[1].trim(), strength: m[2].trim(), form };
  return { brand: head.trim(), strength: undefined, form };
}

/** "IBUPROFENO CINFA" -> "Ibuprofeno Cinfa"; leaves mixed-case names alone. */
export function tidyCase(name) {
  const s = String(name).trim();
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
}
