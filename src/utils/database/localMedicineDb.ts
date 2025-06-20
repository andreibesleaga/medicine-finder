
import { MedicineResult } from "@/types/medicine";

// Local IndexedDB database for medicine data
export class LocalMedicineDatabase {
  private dbName = 'medicine_database';
  private version = 3; // Increment version for enhanced schema
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    if (this.db) return; // Already initialized

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log("Local medicine database initialized successfully");
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create medicine store if it doesn't exist
        if (!db.objectStoreNames.contains('medicines')) {
          const medicineStore = db.createObjectStore('medicines', { keyPath: 'id' });
          medicineStore.createIndex('brandName', 'brandName', { unique: false });
          medicineStore.createIndex('activeIngredient', 'activeIngredient', { unique: false });
          medicineStore.createIndex('country', 'country', { unique: false });
          medicineStore.createIndex('manufacturer', 'manufacturer', { unique: false });
          medicineStore.createIndex('source', 'source', { unique: false });
          medicineStore.createIndex('combined', ['brandName', 'activeIngredient'], { unique: false });
          medicineStore.createIndex('searchable', ['activeIngredient', 'brandName', 'country'], { unique: false });
          console.log("Created medicines object store with enhanced indexes");
        }
      };
    });
  }

  async searchLocal(term: string, country?: string): Promise<MedicineResult[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['medicines'], 'readonly');
      const store = transaction.objectStore('medicines');
      const results: MedicineResult[] = [];
      
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const medicine: MedicineResult = cursor.value;
          
          // Enhanced search matching with fuzzy search capabilities
          const termLower = term.toLowerCase().trim();
          const brandLower = medicine.brandName.toLowerCase();
          const ingredientLower = medicine.activeIngredient.toLowerCase();
          const manufacturerLower = medicine.manufacturer?.toLowerCase() || '';
          
          // Multiple matching strategies
          const exactBrandMatch = brandLower === termLower;
          const exactIngredientMatch = ingredientLower === termLower;
          const brandStartsWith = brandLower.startsWith(termLower);
          const ingredientStartsWith = ingredientLower.startsWith(termLower);
          const brandContains = brandLower.includes(termLower);
          const ingredientContains = ingredientLower.includes(termLower);
          const manufacturerContains = manufacturerLower.includes(termLower);
          
          // Fuzzy matching for common misspellings
          const fuzzyMatch = this.fuzzySearch(termLower, brandLower) || 
                            this.fuzzySearch(termLower, ingredientLower);
          
          const matchesTerm = exactBrandMatch || exactIngredientMatch || 
                             brandStartsWith || ingredientStartsWith || 
                             brandContains || ingredientContains || 
                             manufacturerContains || fuzzyMatch;
          
          const matchesCountry = !country || country === 'all' || 
                               medicine.country.toLowerCase().includes(country.toLowerCase()) ||
                               medicine.country.toLowerCase() === 'global' ||
                               medicine.country.toLowerCase() === 'european union';
          
          if (matchesTerm && matchesCountry) {
            // Add relevance score for better sorting
            let relevanceScore = 0;
            if (exactBrandMatch) relevanceScore += 100;
            if (exactIngredientMatch) relevanceScore += 90;
            if (brandStartsWith) relevanceScore += 80;
            if (ingredientStartsWith) relevanceScore += 70;
            if (brandContains) relevanceScore += 50;
            if (ingredientContains) relevanceScore += 40;
            if (manufacturerContains) relevanceScore += 20;
            if (fuzzyMatch) relevanceScore += 10;
            
            const medicineWithScore: MedicineResult = { ...medicine, relevanceScore };
            results.push(medicineWithScore);
          }
          
          cursor.continue();
        } else {
          // Sort results by relevance score and then alphabetically
          const sortedResults = results.sort((a, b) => {
            const scoreA = a.relevanceScore || 0;
            const scoreB = b.relevanceScore || 0;
            
            if (scoreA !== scoreB) return scoreB - scoreA;
            
            // If same score, sort alphabetically
            return a.brandName.localeCompare(b.brandName);
          }).slice(0, 200); // Limit to 200 results for performance
          
          console.log(`Local search found ${sortedResults.length} results for "${term}"`);
          resolve(sortedResults);
        }
      };
      
      request.onerror = () => {
        console.error("Local search error:", request.error);
        reject(request.error);
      };
    });
  }

  // Simple fuzzy search for common misspellings
  private fuzzySearch(term: string, target: string): boolean {
    if (term.length < 3 || target.length < 3) return false;
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(term, target);
    const maxDistance = Math.floor(Math.max(term.length, target.length) * 0.3); // Allow 30% difference
    
    return distance <= maxDistance;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async bulkInsert(medicines: MedicineResult[]): Promise<void> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['medicines'], 'readwrite');
    const store = transaction.objectStore('medicines');
    
    // Insert medicines in optimized batches
    const batchSize = 100; // Increased batch size for better performance
    let inserted = 0;
    let errors = 0;
    
    console.log(`Starting bulk insert of ${medicines.length} medicines...`);
    
    for (let i = 0; i < medicines.length; i += batchSize) {
      const batch = medicines.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(medicine => 
        new Promise<void>((resolve, reject) => {
          const request = store.put(medicine);
          request.onsuccess = () => {
            inserted++;
            resolve();
          };
          request.onerror = () => {
            errors++;
            console.warn("Failed to insert medicine:", medicine.id, request.error);
            resolve(); // Continue with other inserts
          };
        })
      );
      
      await Promise.all(batchPromises);
      
      // Progress logging
      if (i % (batchSize * 5) === 0) {
        console.log(`Bulk insert progress: ${inserted}/${medicines.length} (${Math.round(inserted/medicines.length * 100)}%)`);
      }
      
      // Small delay between large batches to prevent blocking
      if (i + batchSize < medicines.length && batch.length === batchSize) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    
    console.log(`Bulk insert completed: ${inserted} successful, ${errors} errors out of ${medicines.length} total`);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`Successfully bulk inserted ${inserted} medicines into local database`);
        resolve();
      };
      transaction.onerror = () => {
        console.error("Bulk insert transaction error:", transaction.error);
        reject(transaction.error);
      };
    });
  }

  async getCount(): Promise<number> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['medicines'], 'readonly');
      const store = transaction.objectStore('medicines');
      const request = store.count();
      
      request.onsuccess = () => {
        console.log(`Local database contains ${request.result} medicines`);
        resolve(request.result);
      };
      request.onerror = () => {
        console.error("Error counting medicines:", request.error);
        reject(request.error);
      };
    });
  }

  async getStatistics(): Promise<{count: number, countries: string[], sources: string[], topIngredients: string[]}> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['medicines'], 'readonly');
      const store = transaction.objectStore('medicines');
      const request = store.openCursor();
      
      const countries = new Set<string>();
      const sources = new Set<string>();
      const ingredients = new Map<string, number>();
      let count = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const medicine: MedicineResult = cursor.value;
          count++;
          countries.add(medicine.country);
          sources.add(medicine.source);
          
          const ingredient = medicine.activeIngredient;
          ingredients.set(ingredient, (ingredients.get(ingredient) || 0) + 1);
          
          cursor.continue();
        } else {
          // Get top 10 ingredients
          const topIngredients = Array.from(ingredients.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([ingredient]) => ingredient);
          
          resolve({
            count,
            countries: Array.from(countries).sort(),
            sources: Array.from(sources).sort(),
            topIngredients
          });
        }
      };
      
      request.onerror = () => {
        console.error("Error getting statistics:", request.error);
        reject(request.error);
      };
    });
  }

  async clearDatabase(): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['medicines'], 'readwrite');
      const store = transaction.objectStore('medicines');
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log("Local database cleared successfully");
        resolve();
      };
      request.onerror = () => {
        console.error("Error clearing database:", request.error);
        reject(request.error);
      };
    });
  }
}

export const localMedicineDb = new LocalMedicineDatabase();
