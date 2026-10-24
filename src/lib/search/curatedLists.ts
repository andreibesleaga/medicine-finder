// Static brand lists kept from the first prototype. They were typed in by hand, are not taken
// from any regulator and may be incomplete or out of date, so results from them are always
// labelled "Curated sample". Entries that were only the generic name were dropped.

export interface CuratedBrand {
  brand: string;
  manufacturer?: string;
  /** the ingredients when the brand is a combination product */
  ingredients?: string;
}

export interface CuratedList {
  id: string;
  country: string;
  brands: Record<string, CuratedBrand[]>;
}

const names = (...list: string[]): CuratedBrand[] => list.map((brand) => ({ brand }));

export const CURATED_LISTS: CuratedList[] = [
  {
    id: "eu",
    country: "European Union",
    brands: {
      ibuprofen: [
        { brand: "Nurofen", manufacturer: "Reckitt Benckiser" },
        { brand: "Brufen", manufacturer: "Abbott" },
      ],
      paracetamol: [{ brand: "Panadol", manufacturer: "GSK" }],
      omeprazole: [{ brand: "Losec", manufacturer: "AstraZeneca" }],
      atorvastatin: [{ brand: "Lipitor", manufacturer: "Pfizer" }],
      amoxicillin: [{ brand: "Amoxil", manufacturer: "GSK" }],
    },
  },
  {
    id: "germany",
    country: "Germany",
    brands: {
      ibuprofen: [{ brand: "Dolgit", manufacturer: "Dolorgiet" }, ...names("IBU-ratiopharm", "Nurofen", "Brufen")],
      paracetamol: names("ben-u-ron", "Paracetamol-ratiopharm", "Tylenol"),
      aspirin: names("Aspirin", "ASS-ratiopharm", "Godamed"),
      omeprazole: [{ brand: "Antra", manufacturer: "AstraZeneca" }, ...names("Omep", "Gastracid")],
      diclofenac: names("Voltaren", "Diclac", "Diclo-ratiopharm"),
      atorvastatin: [{ brand: "Sortis", manufacturer: "Pfizer" }],
    },
  },
  {
    id: "france",
    country: "France",
    brands: {
      ibuprofen: names("Advil", "Nurofen", "Spedifen", "Antarène"),
      paracetamol: [
        { brand: "Doliprane", manufacturer: "Sanofi" },
        { brand: "Efferalgan", manufacturer: "Bristol Myers Squibb" },
        ...names("Dafalgan", "Panadol"),
      ],
      aspirin: names("Aspégic", "Kardégic", "Aspirin UPSA"),
      omeprazole: [{ brand: "Mopral", manufacturer: "AstraZeneca" }, ...names("Zoltum")],
      amoxicillin: [{ brand: "Clamoxyl", manufacturer: "GSK" }, ...names("Bristamox")],
    },
  },
  {
    id: "italy",
    country: "Italy",
    brands: {
      ibuprofen: [{ brand: "Moment", manufacturer: "Angelini" }, ...names("Brufen", "Nurofen", "Cibalgina")],
      paracetamol: [{ brand: "Tachipirina", manufacturer: "Angelini" }, ...names("Efferalgan", "Panadol")],
      aspirin: names("Aspirina", "Cardioaspirin", "Aspirin C"),
      omeprazole: names("Antra", "Mepral", "Omeprazen"),
      diclofenac: names("Voltaren", "Dicloreum", "Flector"),
    },
  },
  {
    id: "spain",
    country: "Spain",
    brands: {
      ibuprofen: names("Espidifen", "Neobrufen", "Dalsy", "Junifen"),
      paracetamol: names("Gelocatil", "Apiretal", "Panadol", "Tempra"),
      aspirin: names("Adiro", "Aspirina", "AAS"),
      omeprazole: names("Losec", "Prilosec", "Ulceral"),
      diclofenac: [...names("Voltarén"), { brand: "Artrotec", ingredients: "diclofenac + misoprostol" }],
      atorvastatin: [{ brand: "Cardyl", manufacturer: "Pfizer" }],
    },
  },
  {
    id: "netherlands",
    country: "Netherlands",
    brands: {
      ibuprofen: names("Brufen", "Nurofen", "Advil"),
      paracetamol: names("Panadol", "Tylenol"),
      aspirin: names("Aspirine", "Ascal", "Carbasalaat"),
      omeprazole: names("Losec"),
      amoxicillin: [{ brand: "Flemoxin", manufacturer: "Astellas" }, ...names("Clamoxyl")],
    },
  },
  {
    id: "united-kingdom",
    country: "United Kingdom",
    brands: {
      ibuprofen: names("Nurofen", "Brufen", "Calprofen", "Cuprofen"),
      paracetamol: names("Panadol", "Calpol", "Lemsip", "Tylenol"),
      aspirin: names("Aspirin", "Disprin", "Nu-Seals"),
      omeprazole: names("Losec", "Prilosec"),
      diclofenac: names("Voltarol", "Diclomax", "Motifene"),
    },
  },
  {
    id: "india",
    country: "India",
    brands: {
      ibuprofen: [
        { brand: "Brufen", manufacturer: "Abbott India" },
        { brand: "Combiflam", manufacturer: "Sanofi India", ingredients: "ibuprofen + paracetamol" },
      ],
      paracetamol: [
        { brand: "Crocin", manufacturer: "GSK Pharma" },
        { brand: "Dolo", manufacturer: "Micro Labs" },
        { brand: "Combiflam", manufacturer: "Sanofi India", ingredients: "ibuprofen + paracetamol" },
      ],
      aspirin: [{ brand: "Disprin", manufacturer: "Reckitt Benckiser" }],
    },
  },
];

/** Other names for the same ingredient, so "acetaminophen" also finds the "paracetamol" lists. */
export const SYNONYMS: Record<string, string> = {
  acetaminophen: "paracetamol",
  "acetylsalicylic acid": "aspirin",
};
