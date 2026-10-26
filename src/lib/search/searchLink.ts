// A search in the page address: /?q=ibuprofen&country=Germany (country or region value as in the
// country list; none means all countries).

import { countries } from "@/constants/countries";

const KNOWN = new Set(countries.map((c) => c.value));
// as permissive as the search box (the server checks the term again); no control characters
const TERM_RE = /^[^\p{C}]{2,80}$/u;

/** The address parameters of a search. */
export function searchParams(term: string, country: string): Record<string, string> {
  return country && country !== "all" ? { q: term, country } : { q: term };
}

/** The search a link asks for, or null when it has none or an invalid one. */
export function linkSearch(params: URLSearchParams): { term: string; country: string } | null {
  const term = (params.get("q") ?? "").replace(/\s+/g, " ").trim();
  if (!TERM_RE.test(term)) return null;
  const country = params.get("country") ?? "all";
  return { term, country: KNOWN.has(country) ? country : "all" };
}
