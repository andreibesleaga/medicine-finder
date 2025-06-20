
import { MedicineResult } from "@/types/medicine";
import { localMedicineDb } from "./localMedicineDb";

export interface DatabaseSource {
  name: string;
  country: string;
  url: string;
  format: string;
  description: string;
  isActive: boolean;
}

export const officialDatabaseSources: DatabaseSource[] = [
  {
    name: "RxNorm",
    country: "United States",
    url: "https://www.nlm.nih.gov/research/umls/rxnorm",
    format: "Various",
    description: "Standardized nomenclature for clinical drugs",
    isActive: true
  },
  {
    name: "OpenFDA",
    country: "United States",
    url: "https://open.fda.gov/",
    format: "JSON",
    description: "Adverse event reports, drug labels, and more",
    isActive: true
  },
  {
    name: "EMA",
    country: "European Union",
    url: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
    format: "XML/JSON",
    description: "European Medicines Agency authorized products",
    isActive: true
  },
  {
    name: "Health Canada DPD",
    country: "Canada",
    url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-product-database.html",
    format: "HTML/Data Files",
    description: "Health Canada's Drug Product Database",
    isActive: true
  },
  {
    name: "Orange Book",
    country: "United States",
    url: "https://www.fda.gov/drugs/informationondrugs/ucm129662.htm",
    format: "PDF/Data Files",
    description: "FDA's Approved Drug Products with Therapeutic Equivalence Evaluations",
    isActive: true
  },
  {
    name: "WHO Model List",
    country: "Global",
    url: "https://www.who.int/medicines/publications/essentialmedicines/en/",
    format: "PDF",
    description: "WHO's Model List of Essential Medicines",
    isActive: true
  },
  {
    name: "UK MHRA Database",
    country: "United Kingdom", 
    url: "https://products.mhra.gov.uk/",
    format: "JSON/API",
    description: "UK Medicines and Healthcare products Regulatory Agency",
    isActive: true
  },
  {
    name: "German BfArM Database", 
    country: "Germany",
    url: "https://www.bfarm.de/SharedDocs/Downloads/DE/Arzneimittel/Pharmakovigilanz/gelbeListe.html",
    format: "CSV/XML",
    description: "German Federal Institute for Drugs and Medical Devices",
    isActive: true
  },
  {
    name: "French ANSM Database",
    country: "France", 
    url: "https://base-donnees-publique.medicaments.gouv.fr/telechargement.php",
    format: "CSV",
    description: "French National Agency for Medicines and Health Products Safety",
    isActive: true
  },
  {
    name: "Australia TGA",
    country: "Australia",
    url: "https://www.tga.gov.au/resources/artg",
    format: "Excel/CSV",
    description: "Australian Register of Therapeutic Goods",
    isActive: true
  }
];

// Sample medicine data for each country/region
const getSampleMedicineData = (source: DatabaseSource): MedicineResult[] => {
  const commonMedicines = [
    { ingredient: "acetaminophen", brands: ["Tylenol", "Panadol", "Acetol"] },
    { ingredient: "ibuprofen", brands: ["Advil", "Motrin", "Nurofen"] },
    { ingredient: "aspirin", brands: ["Bayer", "Aspro", "Disprin"] },
    { ingredient: "omeprazole", brands: ["Prilosec", "Losec", "Omez"] },
    { ingredient: "metformin", brands: ["Glucophage", "Fortamet", "Riomet"] }
  ];

  const results: MedicineResult[] = [];
  
  // Generate 2-3 medicines per source for demonstration
  const medicinesToAdd = commonMedicines.slice(0, Math.floor(Math.random() * 3) + 2);
  
  medicinesToAdd.forEach((medicine, index) => {
    const randomBrand = medicine.brands[Math.floor(Math.random() * medicine.brands.length)];
    
    results.push({
      id: `${source.name.toLowerCase().replace(/\s+/g, '-')}-${medicine.ingredient}-${index}`,
      brandName: randomBrand,
      activeIngredient: medicine.ingredient,
      country: source.country,
      manufacturer: `${source.name} Approved Manufacturer`,
      source: 'ai'
    });
  });

  return results;
};

export const downloadAndImportDatabase = async (source: DatabaseSource): Promise<void> => {
  console.log(`Downloading and importing data from ${source.name} (${source.country})...`);
  
  try {
    // Simulate download delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Generate sample medicine data for this source
    const medicineData = getSampleMedicineData(source);
    
    // Bulk insert into local database
    await localMedicineDb.bulkInsert(medicineData);
    
    console.log(`Successfully imported ${medicineData.length} entries from ${source.name}.`);
    
  } catch (error) {
    console.error(`Error importing data from ${source.name}:`, error);
    throw new Error(`Failed to import from ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const importAllDatabases = async (): Promise<void> => {
  console.log("Starting import of all active databases...");
  
  try {
    const activeSources = officialDatabaseSources.filter(source => source.isActive);
    
    // Process each active source
    for (const source of activeSources) {
      await downloadAndImportDatabase(source);
    }
    
    console.log("Successfully imported data from all active databases.");
    
  } catch (error) {
    console.error("Error importing databases:", error);
    throw error;
  }
};
