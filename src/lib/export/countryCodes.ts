// ISO 3166-1 alpha-2 codes for the country names in results, from the runtime's own list of
// region names (Intl.DisplayNames), so no table has to be kept here.

// names the sources use that differ from the runtime's English names
const ALIASES: Record<string, string> = {
  "czech republic": "CZ",
  turkey: "TR",
  "united states of america": "US",
  usa: "US",
  "united kingdom": "GB",
  "northern ireland": "GB",
  "south korea": "KR",
  "republic of korea": "KR",
  "north korea": "KP",
  russia: "RU",
  "russian federation": "RU",
  "people's republic of china": "CN",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
  "côte d'ivoire": "CI",
  burma: "MM",
  "cape verde": "CV",
  swaziland: "SZ",
  "east timor": "TL",
  macedonia: "MK",
  vatican: "VA",
  "holy see": "VA",
  myanmar: "MM",
  congo: "CG",
  "republic of the congo": "CG",
  "democratic republic of the congo": "CD",
  palestine: "PS",
  "cabo verde": "CV",
  "sao tome and principe": "ST",
  "saint vincent and the grenadines": "VC",
  "timor-leste": "TL",
  "micronesia": "FM",
};

// "Bosnia & Herzegovina", "St. Lucia", "Myanmar (Burma)", "São Tomé" all compare as plain words
const key = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

let byName: Map<string, string> | null = null;

function table(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      // unknown codes come back as the code itself; ZZ is "unknown region"
      if (name && name !== code && code !== "ZZ") {
        byName.set(name.toLowerCase(), code);
        byName.set(key(name), code);
      }
    }
  }
  for (const [name, code] of Object.entries(ALIASES)) byName.set(key(name), code);
  return byName;
}

/** "Finland" -> "FI", "European Union" -> "EU" (an ISO 3166 exceptional reservation); unknown -> undefined. */
export function countryCode(name: string): string | undefined {
  const t = table();
  return t.get(name.trim().toLowerCase()) ?? t.get(key(name));
}
