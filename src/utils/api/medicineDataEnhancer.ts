
import { MedicineResult } from "@/types/medicine";

// Enhanced medicine data with additional information
export interface EnhancedMedicineResult extends MedicineResult {
  dosageForms?: string[];
  strengths?: string[];
  therapeuticClass?: string;
  atcCode?: string;
  regulatoryStatus?: string;
  genericAvailable?: boolean;
  priceRange?: string;
  lastUpdated?: string;
}

// Medicine data enrichment service
export const enhanceMedicineData = async (results: MedicineResult[]): Promise<EnhancedMedicineResult[]> => {
  console.log("Enhancing medicine data for", results.length, "results");
  
  const enhanced: EnhancedMedicineResult[] = [];
  
  for (const result of results) {
    const enhancedResult: EnhancedMedicineResult = {
      ...result,
      dosageForms: await getDosageForms(result.activeIngredient),
      strengths: await getCommonStrengths(result.activeIngredient),
      therapeuticClass: await getTherapeuticClass(result.activeIngredient),
      atcCode: await getATCCode(result.activeIngredient),
      regulatoryStatus: await getRegulatoryStatus(result.brandName, result.country),
      genericAvailable: await checkGenericAvailability(result.activeIngredient, result.country),
      priceRange: await getPriceRange(result.brandName, result.country),
      lastUpdated: new Date().toISOString()
    };
    
    enhanced.push(enhancedResult);
  }
  
  return enhanced;
};

const getDosageForms = async (activeIngredient: string): Promise<string[]> => {
  // Common dosage forms by active ingredient
  const dosageFormMap: Record<string, string[]> = {
    "ibuprofen": ["Tablet", "Capsule", "Oral Suspension", "Topical Gel", "Injectable"],
    "acetaminophen": ["Tablet", "Capsule", "Oral Suspension", "Suppository", "Injectable"],
    "aspirin": ["Tablet", "Chewable Tablet", "Enteric Coated", "Effervescent"],
    "amoxicillin": ["Capsule", "Tablet", "Oral Suspension", "Chewable Tablet"],
    "diclofenac": ["Tablet", "Topical Gel", "Injectable", "Suppository", "Eye Drops"]
  };
  
  return dosageFormMap[activeIngredient.toLowerCase()] || ["Tablet", "Capsule"];
};

const getCommonStrengths = async (activeIngredient: string): Promise<string[]> => {
  const strengthMap: Record<string, string[]> = {
    "ibuprofen": ["200mg", "400mg", "600mg", "800mg"],
    "acetaminophen": ["325mg", "500mg", "650mg", "1000mg"],
    "aspirin": ["81mg", "325mg", "500mg"],
    "amoxicillin": ["250mg", "500mg", "875mg"],
    "diclofenac": ["25mg", "50mg", "75mg", "100mg"]
  };
  
  return strengthMap[activeIngredient.toLowerCase()] || ["Various"];
};

const getTherapeuticClass = async (activeIngredient: string): Promise<string> => {
  const classMap: Record<string, string> = {
    "ibuprofen": "NSAID - Anti-inflammatory",
    "acetaminophen": "Analgesic - Pain reliever",
    "aspirin": "NSAID - Antiplatelet",
    "amoxicillin": "Antibiotic - Penicillin",
    "diclofenac": "NSAID - Anti-inflammatory"
  };
  
  return classMap[activeIngredient.toLowerCase()] || "Unknown";
};

const getATCCode = async (activeIngredient: string): Promise<string> => {
  const atcMap: Record<string, string> = {
    "ibuprofen": "M01AE01",
    "acetaminophen": "N02BE01", 
    "aspirin": "N02BA01",
    "amoxicillin": "J01CA04",
    "diclofenac": "M01AB05"
  };
  
  return atcMap[activeIngredient.toLowerCase()] || "Unknown";
};

const getRegulatoryStatus = async (brandName: string, country: string): Promise<string> => {
  // Simulate regulatory status check
  const statusOptions = ["Approved", "Under Review", "Withdrawn", "Conditional Approval"];
  return statusOptions[0]; // Default to approved
};

const checkGenericAvailability = async (activeIngredient: string, country: string): Promise<boolean> => {
  // Most common medicines have generics available
  const commonMedicines = ["ibuprofen", "acetaminophen", "aspirin", "amoxicillin", "diclofenac"];
  return commonMedicines.includes(activeIngredient.toLowerCase());
};

const getPriceRange = async (brandName: string, country: string): Promise<string> => {
  // Simulate price range data
  const priceRanges = ["$", "$$", "$$$", "$$$$"];
  return priceRanges[Math.floor(Math.random() * priceRanges.length)];
};

// Alternative name finder
export const findAlternativeNames = async (activeIngredient: string): Promise<string[]> => {
  const alternativeMap: Record<string, string[]> = {
    "acetaminophen": ["paracetamol", "APAP", "N-acetyl-p-aminophenol"],
    "ibuprofen": ["iso-butyl-propionic-phenolic acid", "2-RS-1-(4-isobutylphenyl)propionic acid"],
    "aspirin": ["acetylsalicylic acid", "ASA", "2-acetoxybenzoic acid"],
    "diclofenac": ["2-[(2,6-dichlorophenyl)amino]phenylacetic acid", "dichlofenac"]
  };
  
  return alternativeMap[activeIngredient.toLowerCase()] || [];
};
