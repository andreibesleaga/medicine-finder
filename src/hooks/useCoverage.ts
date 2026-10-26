import { useEffect, useState } from "react";
import { loadCoverage, type Coverage } from "@/lib/search/coverage";

/** The countries with official data, once the server has answered (null before, or without a server). */
export function useCoverage(): Coverage | null {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  useEffect(() => {
    let live = true;
    void loadCoverage().then((c) => live && setCoverage(c));
    return () => {
      live = false;
    };
  }, []);
  return coverage;
}
