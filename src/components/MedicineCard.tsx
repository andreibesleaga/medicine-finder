import { MedicineResult } from "@/types/medicine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Building, Pill, Database, ExternalLink } from "lucide-react";
import { getRegionForCountry } from "@/constants/countries";

interface MedicineCardProps {
  medicine: MedicineResult;
}

export const MedicineCard = ({ medicine }: MedicineCardProps) => {
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'rxnorm':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">RxNorm</Badge>;
      case 'ai':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">AI Enhanced</Badge>;
      case 'both':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Verified</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getExternalLink = () => {
    // If RxNorm data is available, link to RxNav
    if (medicine.rxNormData?.rxcui) {
      return `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${medicine.rxNormData.rxcui}`;
    }

    // For FDA/US medicines, use correct Orange Book format
    if (medicine.country.toLowerCase().includes('united states')) {
      return `https://www.accessdata.fda.gov/scripts/cder/ob/index.cfm?panel=0&drugname=${encodeURIComponent(medicine.brandName)}`;
    }

    // For European medicines, use EMA's correct search URL format with only the active ingredient
    if (medicine.country.toLowerCase().includes('europe') || 
        medicine.country.toLowerCase().includes('eu') ||
        ['germany', 'france', 'italy', 'spain', 'netherlands', 'united kingdom', 'ireland', 'belgium', 'austria', 'portugal', 'sweden', 'denmark', 'finland', 'poland', 'czech republic', 'hungary', 'slovakia', 'slovenia', 'estonia', 'latvia', 'lithuania', 'luxembourg', 'malta', 'cyprus'].some(country => 
          medicine.country.toLowerCase().includes(country))) {
      // Use only the active ingredient as search term
      return `https://www.ema.europa.eu/en/search?f%5B0%5D=ema_search_entity_is_document%3ADocument&search_api_fulltext=${encodeURIComponent(medicine.activeIngredient)}`;
    }

    // Default to a comprehensive drug information search
    return `https://go.drugbank.com/unearth/q?searcher=drugs&query=${encodeURIComponent(medicine.brandName + ' ' + medicine.activeIngredient)}&button=`;
  };

  const getLinkText = () => {
    if (medicine.rxNormData?.rxcui) return "View in RxNav";
    if (medicine.country.toLowerCase().includes('united states')) return "FDA Orange Book";
    if (medicine.country.toLowerCase().includes('europe') || 
        medicine.country.toLowerCase().includes('eu') ||
        ['germany', 'france', 'italy', 'spain', 'netherlands', 'united kingdom', 'ireland', 'belgium', 'austria', 'portugal', 'sweden', 'denmark', 'finland', 'poland', 'czech republic', 'hungary', 'slovakia', 'slovenia', 'estonia', 'latvia', 'lithuania', 'luxembourg', 'malta', 'cyprus'].some(country => 
          medicine.country.toLowerCase().includes(country))) {
      return "Search EMA";
    }
    return "More Info";
  };

  const region = getRegionForCountry(medicine.country);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 leading-tight">
            {medicine.brandName}
          </CardTitle>
          {getSourceBadge(medicine.source)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Active Ingredient */}
        <div className="flex items-center gap-2 text-sm">
          <Pill className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-gray-600">Active:</span>
          <span className="font-medium text-gray-900">{medicine.activeIngredient}</span>
        </div>

        {/* Country and Region */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-gray-600">Location:</span>
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{medicine.country}</span>
            <span className="text-xs text-gray-500">{region}</span>
          </div>
        </div>

        {/* Manufacturer */}
        {medicine.manufacturer && (
          <div className="flex items-center gap-2 text-sm">
            <Building className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span className="text-gray-600">Manufacturer:</span>
            <span className="font-medium text-gray-900 text-xs">{medicine.manufacturer}</span>
          </div>
        )}

        {/* Dosage Form & Strength */}
        {(medicine.dosageForm || medicine.strength) && (
          <div className="flex items-start gap-2 text-sm">
            <Database className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {medicine.dosageForm && (
                <div>
                  <span className="text-gray-600">Form:</span>
                  <span className="font-medium text-gray-900 ml-1">{medicine.dosageForm}</span>
                </div>
              )}
              {medicine.strength && (
                <div>
                  <span className="text-gray-600">Strength:</span>
                  <span className="font-medium text-gray-900 ml-1">{medicine.strength}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RxNorm Data */}
        {medicine.rxNormData && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">RxNorm Details:</div>
            <div className="text-xs space-y-1">
              <div><span className="text-gray-600">RXCUI:</span> <span className="font-mono">{medicine.rxNormData.rxcui}</span></div>
              {medicine.rxNormData.tty && (
                <div><span className="text-gray-600">Type:</span> <span>{medicine.rxNormData.tty}</span></div>
              )}
            </div>
          </div>
        )}

        {/* External Link Button */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            className="w-full flex items-center gap-2 hover:bg-blue-50"
            onClick={() => window.open(getExternalLink(), '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-4 h-4" />
            {getLinkText()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
