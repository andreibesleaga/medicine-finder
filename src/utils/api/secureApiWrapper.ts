
import { MedicineResult } from "@/types/medicine";
import { ApiSecurity } from "../security/apiSecurity";
import { supabase } from "@/integrations/supabase/client";

// Secure API wrapper using Supabase Edge Functions
export class SecureApiWrapper {
  
  // Call Supabase Edge Functions securely
  static async callSecureEndpoint(
    functionName: string, 
    payload: any
  ): Promise<any> {
    try {
      ApiSecurity.logSecurityEvent('SECURE_ENDPOINT_CALL', { 
        functionName, 
        payload: JSON.stringify(payload).substring(0, 100) 
      });

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      return data;
    } catch (error) {
      ApiSecurity.logSecurityEvent('SECURE_ENDPOINT_ERROR', { 
        functionName, 
        error: error?.toString() 
      });
      throw error;
    }
  }

  static async searchOpenAISecure(term: string, country?: string): Promise<MedicineResult[]> {
    try {
      const results = await this.callSecureEndpoint('openai-search', { term, country });
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.warn("OpenAI secure search failed:", error);
      return [];
    }
  }

  static async searchPerplexitySecure(term: string, country?: string): Promise<MedicineResult[]> {
    try {
      const results = await this.callSecureEndpoint('perplexity-search', { term, country });
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.warn("Perplexity secure search failed:", error);
      return [];
    }
  }

  static async searchDeepSeekSecure(term: string, country?: string): Promise<MedicineResult[]> {
    try {
      const results = await this.callSecureEndpoint('deepseek-search', { term, country });
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.warn("DeepSeek secure search failed:", error);
      return [];
    }
  }

  static async queryDrugBankSecure(term: string, country?: string): Promise<MedicineResult[]> {
    try {
      const results = await this.callSecureEndpoint('drugbank-search', { term, country });
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.warn("DrugBank secure search failed:", error);
      return [];
    }
  }

  static async queryChemSpiderSecure(term: string, country?: string): Promise<MedicineResult[]> {
    try {
      const results = await this.callSecureEndpoint('chemspider-search', { term, country });
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.warn("ChemSpider secure search failed:", error);
      return [];
    }
  }

  // Method to check if secure APIs are available
  static isSecureApiAvailable(): boolean {
    // Check if we have Supabase connection
    return !!supabase;
  }

  // Method to get API status for dashboard
  static getApiStatus(): Record<string, { available: boolean; secure: boolean }> {
    const isSecure = this.isSecureApiAvailable();
    
    return {
      openai: { available: isSecure, secure: isSecure },
      perplexity: { available: isSecure, secure: isSecure },
      deepseek: { available: isSecure, secure: isSecure },
      drugbank: { available: isSecure, secure: isSecure },
      chemspider: { available: isSecure, secure: isSecure },
    };
  }
}
