import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchInput } from "@/components/SearchInput";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { SearchProgressComponent } from "@/components/SearchProgress";
import { Disclaimer } from "@/components/Disclaimer";
import { useSearchMedicine } from "@/hooks/useSearchMedicine";
import { useCoverage } from "@/hooks/useCoverage";
import type { SearchOutcome, SourceRun } from "@/types/medicine";
import { linkSearch, searchParams } from "@/lib/search/searchLink";

const Index = () => {
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<SourceRun[]>([]);
  const [params, setParams] = useSearchParams();
  const coverage = useCoverage();
  const search = useSearchMedicine({
    // the address shows the search, so it can be bookmarked or sent
    onSearchStart: (term, country) => setParams(searchParams(term, country), { replace: true }),
    onResult: setOutcome,
    onLoadingChange: (loading) => {
      setIsLoading(loading);
      if (loading) setProgress([]);
    },
    onProgress: setProgress,
  });

  // a link such as /?q=ibuprofen&country=Germany runs its search once, on arrival
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current) return;
    linked.current = true;
    const from = linkSearch(params);
    if (from) void search.handleSearch(false, from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <main className="container mx-auto px-4 py-8 flex-1">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4" aria-hidden="true">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Medicine Brand Finder</h1>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Find the brand names of a medicine's active ingredient in other countries, from official medicines databases,
            open references and, optionally, AI.
          </p>
          <Disclaimer />
        </header>

        <SearchInput
          searchTerm={search.searchTerm}
          onTermChange={search.setSearchTerm}
          selectedCountry={search.selectedCountry}
          onCountryChange={search.setSelectedCountry}
          isLoading={search.isLoading}
          onSearch={() => search.handleSearch()}
          onKeyDown={search.handleKeyDown}
          withData={coverage?.countries}
          euData={coverage?.eu}
        />
        <SearchProgressComponent isSearching={isLoading} sources={progress} />
        <ResultsDashboard
          coverage={coverage}
          outcome={outcome}
          isLoading={isLoading}
          onReset={() => {
            search.reset();
            setOutcome(null);
            setParams({}, { replace: true });
          }}
          onRefresh={() => search.handleSearch(true)}
        />
      </main>
    </div>
  );
};

export default Index;
