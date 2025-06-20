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

export const officialDatabaseSources = [
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
    name: "NCI Drug Dictionary",
    country: "United States",
    url: "https://www.cancer.gov/publications/dictionaries/cancer-drug",
    format: "Web/API",
    description: "National Cancer Institute's Drug Dictionary",
    isActive: true
  },
  {
    name: "DailyMed",
    country: "United States",
    url: "https://dailymed.nlm.nih.gov/dailymed/",
    format: "XML",
    description: "Current medication content from drug labels",
    isActive: true
  },
  
  // European Union Medicine Databases
  {
    name: "EMA Product Database",
    country: "European Union",
    url: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
    format: "XML/JSON",
    description: "European Medicines Agency centrally authorized products",
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
    name: "Italian AIFA Database",
    country: "Italy",
    url: "https://www.aifa.gov.it/en/medicines-data",
    format: "CSV/XML",
    description: "Italian Medicines Agency database",
    isActive: true
  },
  {
    name: "Spanish AEMPS Database",
    country: "Spain",
    url: "https://cima.aemps.es/cima/publico/lista.html",
    format: "CSV",
    description: "Spanish Agency of Medicines and Medical Devices",
    isActive: true
  },
  {
    name: "Dutch MEB Database",
    country: "Netherlands",
    url: "https://www.geneesmiddeleninformatiebank.nl/",
    format: "JSON/XML",
    description: "Netherlands Medicines Evaluation Board",
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
    name: "EPAR Database",
    country: "European Union",
    url: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
    format: "XML",
    description: "European Public Assessment Reports",
    isActive: true
  }
];

export const downloadAndImportDatabase = async (source: DatabaseSource): Promise<void> => {
  console.log(`Downloading and importing data from ${source.name} (${source.country})...`);
  
  try {
    // Simulate downloading and parsing data
    const medicineData: MedicineResult[] = [];
    
    // Example: Add a dummy medicine entry
    medicineData.push({
      id: `dummy-${source.name.toLowerCase().replace(/\s+/g, '-')}`,
      brandName: `Example Medicine (${source.country})`,
      activeIngredient: "Example Ingredient",
      country: source.country,
      manufacturer: `${source.name} Approved`,
      source: 'ai'
    });
    
    // Bulk insert into local database
    await localMedicineDb.bulkInsert(medicineData);
    
    console.log(`Successfully imported ${medicineData.length} entries from ${source.name}.`);
    
  } catch (error) {
    console.error(`Error importing data from ${source.name}:`, error);
    throw error;
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
