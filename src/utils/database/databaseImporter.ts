
import { MedicineResult } from "@/types/medicine";
import { localMedicineDb } from "./localMedicineDb";

export interface DatabaseSource {
  name: string;
  url: string;
  format: 'csv' | 'json' | 'xml' | 'txt';
  parser: (data: string) => MedicineResult[];
  description: string;
  country: string;
  lastUpdated?: string;
  size?: string;
}

// Official free medicine databases
export const officialDatabaseSources: DatabaseSource[] = [
  {
    name: "FDA Orange Book",
    url: "https://www.fda.gov/media/76860/download",
    format: "txt",
    country: "United States",
    description: "FDA approved drug products with therapeutic equivalence evaluations",
    size: "~50MB",
    parser: parseFDAOrangeBook
  },
  {
    name: "FDA Purple Book", 
    url: "https://www.fda.gov/media/157400/download",
    format: "txt", 
    country: "United States",
    description: "FDA licensed biological products",
    size: "~5MB",
    parser: parseFDAPurpleBook
  },
  {
    name: "Health Canada Drug Product Database",
    url: "https://health-products.canada.ca/dpd-bdpp/index-eng.jsp",
    format: "json",
    country: "Canada", 
    description: "All drug products approved for sale in Canada",
    size: "~100MB",
    parser: parseHealthCanadaData
  },
  {
    name: "EMA Human Medicine Database",
    url: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
    format: "xml",
    country: "European Union",
    description: "European Medicines Agency approved products",
    size: "~200MB", 
    parser: parseEMAData
  },
  {
    name: "WHO Essential Medicines List",
    url: "https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02",
    format: "json",
    country: "Global",
    description: "WHO Model List of Essential Medicines",
    size: "~1MB",
    parser: parseWHOEssentialMedicines
  },
  {
    name: "Australian TGA ARTG Database",
    url: "https://www.tga.gov.au/resources/artg",
    format: "csv",
    country: "Australia",
    description: "Australian Register of Therapeutic Goods",
    size: "~30MB",
    parser: parseTGAData
  },
  {
    name: "Indian CDSCO Database",
    url: "https://cdsco.gov.in/opencms/opencms/en/Home/",
    format: "csv",
    country: "India", 
    description: "Central Drugs Standard Control Organization approved drugs",
    size: "~25MB",
    parser: parseIndianCDSCOData
  },
  {
    name: "Brazil ANVISA Database",
    url: "https://consultas.anvisa.gov.br/",
    format: "json",
    country: "Brazil",
    description: "Brazilian Health Regulatory Agency drug database", 
    size: "~40MB",
    parser: parseBrazilANVISAData
  },
  {
    name: "Japanese PMDA Database",
    url: "https://www.pmda.go.jp/english/",
    format: "xml",
    country: "Japan",
    description: "Pharmaceuticals and Medical Devices Agency approved products",
    size: "~20MB", 
    parser: parseJapanesePMDAData
  },
  {
    name: "Chinese NMPA Database",
    url: "https://www.nmpa.gov.cn/",
    format: "json",
    country: "China",
    description: "National Medical Properties Administration drug database",
    size: "~60MB",
    parser: parseChineseNMPAData
  }
];

// Parser functions for different database formats
function parseFDAOrangeBook(data: string): MedicineResult[] {
  const lines = data.split('\n').slice(1); // Skip header
  const results: MedicineResult[] = [];
  
  lines.forEach((line, index) => {
    const fields = line.split('~');
    if (fields.length >= 8) {
      results.push({
        id: `fda-orange-${index}`,
        brandName: fields[2] || 'Unknown',
        activeIngredient: fields[0] || 'Unknown',
        country: "United States",
        manufacturer: fields[7] || 'Unknown',
        source: 'ai',
        dosageForm: fields[4] || undefined,
        strength: fields[5] || undefined
      });
    }
  });
  
  return results;
}

function parseFDAPurpleBook(data: string): MedicineResult[] {
  const lines = data.split('\n').slice(1);
  const results: MedicineResult[] = [];
  
  lines.forEach((line, index) => {
    const fields = line.split('\t');
    if (fields.length >= 4) {
      results.push({
        id: `fda-purple-${index}`,
        brandName: fields[1] || 'Unknown',
        activeIngredient: fields[0] || 'Unknown', 
        country: "United States",
        manufacturer: fields[3] || 'Unknown',
        source: 'ai'
      });
    }
  });
  
  return results;
}

function parseHealthCanadaData(data: string): MedicineResult[] {
  try {
    const jsonData = JSON.parse(data);
    const results: MedicineResult[] = [];
    
    if (jsonData.results) {
      jsonData.results.forEach((item: any, index: number) => {
        results.push({
          id: `health-canada-${item.drug_identification_number || index}`,
          brandName: item.brand_name || item.product_name || 'Unknown',
          activeIngredient: item.active_ingredient_name || 'Unknown',
          country: "Canada",
          manufacturer: item.company_name || 'Unknown',
          source: 'ai'
        });
      });
    }
    
    return results;
  } catch (error) {
    console.error("Error parsing Health Canada data:", error);
    return [];
  }
}

function parseEMAData(data: string): MedicineResult[] {
  // XML parsing for EMA data
  const results: MedicineResult[] = [];
  
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, "text/xml");
    const medicines = xmlDoc.getElementsByTagName("medicine");
    
    Array.from(medicines).forEach((medicine, index) => {
      const name = medicine.getElementsByTagName("name")[0]?.textContent || 'Unknown';
      const activeSubstance = medicine.getElementsByTagName("activeSubstance")[0]?.textContent || 'Unknown';
      const holder = medicine.getElementsByTagName("marketingAuthorisationHolder")[0]?.textContent || 'Unknown';
      
      results.push({
        id: `ema-${index}`,
        brandName: name,
        activeIngredient: activeSubstance,
        country: "European Union",
        manufacturer: holder,
        source: 'ai'
      });
    });
  } catch (error) {
    console.error("Error parsing EMA XML data:", error);
  }
  
  return results;
}

function parseWHOEssentialMedicines(data: string): MedicineResult[] {
  try {
    const jsonData = JSON.parse(data);
    const results: MedicineResult[] = [];
    
    if (jsonData.medicines) {
      jsonData.medicines.forEach((medicine: any, index: number) => {
        results.push({
          id: `who-essential-${index}`,
          brandName: medicine.name || 'WHO Essential Medicine',
          activeIngredient: medicine.activeIngredient || medicine.name || 'Unknown',
          country: "Global",
          manufacturer: "WHO Listed",
          source: 'ai'
        });
      });
    }
    
    return results;
  } catch (error) {
    console.error("Error parsing WHO data:", error);
    return [];
  }
}

function parseTGAData(data: string): MedicineResult[] {
  const lines = data.split('\n').slice(1);
  const results: MedicineResult[] = [];
  
  lines.forEach((line, index) => {
    const fields = line.split(',');
    if (fields.length >= 3) {
      results.push({
        id: `tga-${index}`,
        brandName: fields[1]?.replace(/"/g, '') || 'Unknown',
        activeIngredient: fields[2]?.replace(/"/g, '') || 'Unknown',
        country: "Australia",
        manufacturer: fields[3]?.replace(/"/g, '') || 'Unknown',
        source: 'ai'
      });
    }
  });
  
  return results;
}

function parseIndianCDSCOData(data: string): MedicineResult[] {
  const lines = data.split('\n').slice(1);
  const results: MedicineResult[] = [];
  
  lines.forEach((line, index) => {
    const fields = line.split(',');
    if (fields.length >= 3) {
      results.push({
        id: `cdsco-${index}`,
        brandName: fields[0]?.replace(/"/g, '') || 'Unknown',
        activeIngredient: fields[1]?.replace(/"/g, '') || 'Unknown',
        country: "India",
        manufacturer: fields[2]?.replace(/"/g, '') || 'Unknown',
        source: 'ai'
      });
    }
  });
  
  return results;
}

function parseBrazilANVISAData(data: string): MedicineResult[] {
  try {
    const jsonData = JSON.parse(data);
    const results: MedicineResult[] = [];
    
    if (jsonData.medicamentos) {
      jsonData.medicamentos.forEach((med: any, index: number) => {
        results.push({
          id: `anvisa-${index}`,
          brandName: med.nome || 'Unknown',
          activeIngredient: med.principio_ativo || 'Unknown',
          country: "Brazil",
          manufacturer: med.empresa || 'Unknown',
          source: 'ai'
        });
      });
    }
    
    return results;
  } catch (error) {
    console.error("Error parsing ANVISA data:", error);
    return [];
  }
}

function parseJapanesePMDAData(data: string): MedicineResult[] {
  const results: MedicineResult[] = [];
  
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, "text/xml");
    const medicines = xmlDoc.getElementsByTagName("medicine");
    
    Array.from(medicines).forEach((medicine, index) => {
      const name = medicine.getElementsByTagName("name")[0]?.textContent || 'Unknown';
      const ingredient = medicine.getElementsByTagName("ingredient")[0]?.textContent || 'Unknown';
      const company = medicine.getElementsByTagName("company")[0]?.textContent || 'Unknown';
      
      results.push({
        id: `pmda-${index}`,
        brandName: name,
        activeIngredient: ingredient,
        country: "Japan",
        manufacturer: company,
        source: 'ai'
      });
    });
  } catch (error) {
    console.error("Error parsing PMDA XML data:", error);
  }
  
  return results;
}

function parseChineseNMPAData(data: string): MedicineResult[] {
  try {
    const jsonData = JSON.parse(data);
    const results: MedicineResult[] = [];
    
    if (jsonData.drugs) {
      jsonData.drugs.forEach((drug: any, index: number) => {
        results.push({
          id: `nmpa-${index}`,
          brandName: drug.tradeName || drug.name || 'Unknown',
          activeIngredient: drug.activeIngredient || 'Unknown',
          country: "China",
          manufacturer: drug.manufacturer || 'Unknown',
          source: 'ai'
        });
      });
    }
    
    return results;
  } catch (error) {
    console.error("Error parsing NMPA data:", error);
    return [];
  }
}

export const downloadAndImportDatabase = async (source: DatabaseSource): Promise<number> => {
  try {
    console.log(`Downloading ${source.name} database...`);
    
    // Note: Direct downloads may be blocked by CORS in browser
    // In production, these would be proxied through a backend service
    const response = await fetch(source.url);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${source.name}: ${response.statusText}`);
    }
    
    const data = await response.text();
    const medicines = source.parser(data);
    
    console.log(`Parsed ${medicines.length} medicines from ${source.name}`);
    
    await localMedicineDb.bulkInsert(medicines);
    
    return medicines.length;
  } catch (error) {
    console.error(`Error importing ${source.name}:`, error);
    throw error;
  }
};

export const importAllDatabases = async (): Promise<void> => {
  const results: { source: string; count: number; error?: string }[] = [];
  
  for (const source of officialDatabaseSources) {
    try {
      const count = await downloadAndImportDatabase(source);
      results.push({ source: source.name, count });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ source: source.name, count: 0, error: errorMsg });
    }
  }
  
  console.log("Database import results:", results);
};
