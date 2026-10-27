import { useI18n } from "@/i18n";

/** A country, a region ("region:Asia") or "European Union" in the chosen language. */
export function usePlaceLabel() {
  const { t, countryName } = useI18n();
  return (place: string) => {
    if (!place) return "";
    if (place.startsWith("region:")) return t(`region.${place.slice("region:".length)}`);
    if (["Europe", "North America", "South America", "Asia", "Middle East", "Africa", "Oceania"].includes(place)) return t(`region.${place}`);
    return countryName(place);
  };
}
