
import { MedicineResult } from "@/types/medicine";

// Local SQLite-compatible database for medicine data
export class LocalMedicineDatabase {
  private dbName = 'medicine_database';
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create medicine store
        if (!db.objectStoreNames.contains('medicines')) {
          const medicineStore = db.createObjectStore('medicines', { keyPath: 'id' });
          medicineStore.createIndex('brandName', 'brandName', { unique: false });
          medicineStore.createIndex('activeIngredient', 'activeIngredient', { unique: false });
          medicineStore.createIndex('country', 'country', { unique: false });
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
          
          // Search by brand name or active ingredient
          const matchesTerm = medicine.brandName.toLowerCase().includes(term.toLowerCase()) ||
                             medicine.activeIngredient.toLowerCase().includes(term.toLowerCase());
          
          const matchesCountry = !country || country === 'all' || 
                               medicine.country.toLowerCase().includes(country.toLowerCase());
          
          if (matchesTerm && matchesCountry) {
            results.push(medicine);
          }
          
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async bulkInsert(medicines: MedicineResult[]): Promise<void> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['medicines'], 'readwrite');
    const store = transaction.objectStore('medicines');
    
    for (const medicine of medicines) {
      store.put(medicine);
    }
    
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
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const localMedicineDb = new LocalMedicineDatabase();
