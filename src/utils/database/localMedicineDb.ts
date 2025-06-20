
import { MedicineResult } from "@/types/medicine";

// Local IndexedDB database for medicine data
export class LocalMedicineDatabase {
  private dbName = 'medicine_database';
  private version = 2; // Increment version for schema updates
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
          medicineStore.createIndex('combined', ['brandName', 'activeIngredient'], { unique: false });
          console.log("Created medicines object store with indexes");
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
          
          // Enhanced search matching
          const termLower = term.toLowerCase();
          const brandLower = medicine.brandName.toLowerCase();
          const ingredientLower = medicine.activeIngredient.toLowerCase();
          
          const matchesTerm = brandLower.includes(termLower) ||
                             ingredientLower.includes(termLower) ||
                             brandLower.startsWith(termLower) ||
                             ingredientLower.startsWith(termLower);
          
          const matchesCountry = !country || country === 'all' || 
                               medicine.country.toLowerCase().includes(country.toLowerCase()) ||
                               medicine.country.toLowerCase() === 'global';
          
          if (matchesTerm && matchesCountry) {
            results.push(medicine);
          }
          
          cursor.continue();
        } else {
          // Sort results by relevance
          const sortedResults = results.sort((a, b) => {
            const termLower = term.toLowerCase();
            
            // Exact matches first
            const aExact = a.brandName.toLowerCase() === termLower ? 1 : 0;
            const bExact = b.brandName.toLowerCase() === termLower ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;
            
            // Starts with matches second
            const aStarts = a.brandName.toLowerCase().startsWith(termLower) ? 1 : 0;
            const bStarts = b.brandName.toLowerCase().startsWith(termLower) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;
            
            // Alphabetical order
            return a.brandName.localeCompare(b.brandName);
          });
          
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

  async bulkInsert(medicines: MedicineResult[]): Promise<void> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['medicines'], 'readwrite');
    const store = transaction.objectStore('medicines');
    
    // Insert medicines in batches to avoid blocking the UI
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < medicines.length; i += batchSize) {
      const batch = medicines.slice(i, i + batchSize);
      
      for (const medicine of batch) {
        try {
          await new Promise<void>((resolve, reject) => {
            const request = store.put(medicine);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
          inserted++;
        } catch (error) {
          console.warn("Failed to insert medicine:", medicine.id, error);
        }
      }
      
      // Small delay between batches to prevent blocking
      if (i + batchSize < medicines.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    console.log(`Successfully inserted ${inserted}/${medicines.length} medicines into local database`);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
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
