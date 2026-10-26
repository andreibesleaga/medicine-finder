import type { SearchOutcome, SourceKind } from "@/types/medicine";
import type { Coverage } from "@/lib/search/coverage";
import { selectionLabel } from "@/lib/search/countryScope";
import { MedicineCard } from "./MedicineCard";
import { ExportBar } from "./ExportBar";
import { Loader2, Package, RotateCcw, FlaskConical, Info, TriangleAlert, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { KIND_CLASS, KIND_LABEL, STATE_LABEL } from "./sourceLabels";

interface ResultsDashboardProps {
  outcome: SearchOutcome | null;
  isLoading: boolean;
  onReset?: () => void;
  /** searches again without this browser's saved copy */
  onRefresh?: () => void;
  /** countries with official data, for the text before the first search */
  coverage?: Coverage | null;
}

const KINDS: SourceKind[] = ["official", "reference", "curated", "ai"];

const Byline = () => <p className="text-gray-600 text-sm mt-8">by Andrei N. Besleaga</p>;

const KEYS_GUIDE = "https://github.com/andreibesleaga/medicine-finder#api-keys";

export const ResultsDashboard = ({ outcome, isLoading, onReset, onRefresh, coverage }: ResultsDashboardProps) => {
  const { toast } = useToast();
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Anyone with the link sees this search." });
    } catch {
      toast({ title: "Could not copy the link", description: "Copy it from the address bar instead." });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-4" role="status">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" aria-hidden="true" />
        <p className="text-gray-700">Searching official databases, open references and AI providers…</p>
      </div>
    );
  }

  if (!outcome) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
          <Package className="w-10 h-10 text-gray-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Ready to search</h2>
        <div className="text-gray-700 max-w-2xl mx-auto space-y-2 text-left sm:text-center">
          <p>
            Type an active ingredient (for example <em>ibuprofen</em>) or a brand name. You get the names it is sold under,
            country by country, from official medicines registers
            {coverage?.countries.length ? ` (${coverage.eu ? "EU and " : ""}${coverage.countries.length} countries)` : ""}, open
            references and, where the operator has set a key, AI suggestions.
          </p>
          <p>
            Every result names its source and links to the record. Download any result as CSV or JSON for your own tools.
          </p>
          <p className="text-sm text-gray-600">
            Operators: add an AI key (OpenAI, Perplexity, DeepSeek or OpenRouter) in the{" "}
            <a href={KEYS_GUIDE} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
              server settings
            </a>{" "}
            to get suggestions for countries without open data.
          </p>
        </div>
        <Byline />
      </div>
    );
  }

  const { results, sources, trials, term, note, aiPending, savedAt, brand } = outcome;
  const countries = new Set(results.map((r) => r.country).filter((c) => c !== "Not stated")).size;
  const failed = sources.filter((s) => s.state === "error" || s.state === "unavailable");

  return (
    <div className="max-w-6xl mx-auto">
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-8 [overflow-wrap:anywhere]" aria-labelledby="summary">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h2 id="summary" className="text-2xl font-bold text-gray-900 mb-2">
              Results for "{term}"
            </h2>
            <button onClick={copyLink} className="mb-3 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
              <Link2 className="w-4 h-4" aria-hidden="true" />
              Copy link to this search
            </button>
            {brand && (
              <p className="text-gray-800 mb-2">
                <strong>{brand.name}</strong> is a brand name of <strong>{brand.ingredient}</strong>. Showing the brands of{" "}
                {brand.ingredient} {outcome.country ? `for ${selectionLabel(outcome.country)}` : "in every country"}.
              </p>
            )}
            {brand?.others.map((o) => (
              <p key={o.ingredient} className="mb-2 flex items-start gap-1 text-sm text-amber-950 bg-amber-50 rounded p-2">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Careful: in {o.countries.join(", ")} the name {brand.name} is also used for {o.ingredient}. Check the active
                  ingredient on the pack.
                </span>
              </p>
            ))}
            <p className="text-gray-700 mb-3" role="status">
              {results.length} brand {results.length === 1 ? "name" : "names"} in {countries}{" "}
              {countries === 1 ? "country" : "countries"}
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {KINDS.map((k) => {
                const n = results.filter((r) => r.kind === k).length;
                return n ? (
                  <span key={k} className={`rounded border px-2 py-0.5 ${KIND_CLASS[k]}`}>
                    {n} {KIND_LABEL[k].toLowerCase()}
                  </span>
                ) : null;
              })}
            </div>
            {trials && trials.count > 0 && (
              <p className="mt-3 text-sm text-gray-700 flex items-center gap-1">
                <FlaskConical className="w-4 h-4" aria-hidden="true" />
                <a href={trials.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                  {trials.count.toLocaleString("en")} clinical studies on ClinicalTrials.gov
                </a>
              </p>
            )}
          </div>
          <details className="text-sm text-gray-700 lg:max-w-sm">
            <summary className="cursor-pointer text-blue-700">What each source returned</summary>
            <ul className="mt-2 space-y-1">
              {sources.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>{s.name}</span>
                  <span className="text-gray-600 text-right">
                    {s.state === "ok" ? s.count : STATE_LABEL[s.state]}
                    {s.detail && s.state !== "ok" ? ` (${s.detail})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
        {note && (
          <p className="mt-3 flex items-start gap-1 text-sm text-blue-950 bg-blue-50 rounded p-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {note}
          </p>
        )}
        {aiPending && (
          <p className="mt-3 flex items-center gap-2 text-sm text-purple-900" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Asking AI providers for more suggestions…
          </p>
        )}
        {savedAt && (
          <p className="mt-3 text-sm text-gray-700">
            Saved in this browser at {new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.{" "}
            {onRefresh && (
              <button onClick={onRefresh} className="text-blue-700 underline">
                Search again
              </button>
            )}
          </p>
        )}
        {failed.length > 0 && (
          <p className="mt-3 text-xs text-amber-900">
            Not reached this time: {failed.map((s) => s.name).join(", ")}. Results may be incomplete.
          </p>
        )}
      </section>

      {results.length === 0 ? (
        <div className="text-center py-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No results</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Nothing found for "{term}". Check the spelling, or try the active ingredient as written on the pack (for example
            paracetamol).
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {results.map((r) => (
              <MedicineCard key={r.id} medicine={r} />
            ))}
          </div>
          <ExportBar outcome={outcome} />
        </>
      )}

      <div className="text-center py-8 border-t border-gray-200">
        {onReset && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-900 text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            New search
          </button>
        )}
        <Byline />
      </div>
    </div>
  );
};
