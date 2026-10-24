import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { fetchServerSources, type ServerSourceInfo } from "@/lib/search/serverApi";
import { KIND_CLASS, KIND_LABEL, STATE_LABEL } from "@/components/sourceLabels";
import { Disclaimer } from "@/components/Disclaimer";
import type { SourceKind } from "@/types/medicine";

interface Row {
  name: string;
  kind: SourceKind;
  coverage: string;
  homepage: string;
  terms?: string;
  where: string;
  state?: string;
  detail?: string;
}

const BROWSER_ROWS: Row[] = [
  { name: "RxNorm (US National Library of Medicine)", kind: "reference", coverage: "United States, brand names linked to the ingredient", homepage: "https://www.nlm.nih.gov/research/umls/rxnorm/", where: "your browser" },
  { name: "openFDA drug labels (US FDA)", kind: "reference", coverage: "United States, product labels", homepage: "https://open.fda.gov/apis/drug/label/", where: "your browser" },
  { name: "Wikidata", kind: "reference", coverage: "Any country; items with this active ingredient", homepage: "https://www.wikidata.org/wiki/Property:P3781", where: "your browser" },
  { name: "PubChem synonyms (US NIH)", kind: "reference", coverage: "Names recorded for the substance; some are brands", homepage: "https://pubchem.ncbi.nlm.nih.gov/", where: "your browser" },
  { name: "ClinicalTrials.gov", kind: "reference", coverage: "Number of registered studies (shown above the results)", homepage: "https://clinicaltrials.gov/", where: "your browser" },
];

const Sources = () => {
  const [server, setServer] = useState<ServerSourceInfo[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    fetchServerSources()
      .then((r) => setServer(r.sources))
      .catch((e: unknown) => setServerError(e instanceof Error ? e.message : String(e)));
  }, []);

  const rows: Row[] = [
    ...(server ?? []).map((s) => ({
      name: s.name,
      kind: s.kind,
      coverage: s.coverage,
      homepage: s.homepage,
      terms: s.terms,
      where:
        s.kind === "ai"
          ? "search server (key on server)"
          : s.kind === "curated"
            ? "search server (built-in list)"
            : s.id === "cima" || s.id === "health-canada-live"
              ? "search server (live API)"
              : "search server (database, refreshed automatically)",
      state: s.state,
      detail: [
        s.rows ? `${s.rows.toLocaleString("en")} products` : "",
        s.updatedAt ? `updated ${new Date(s.updatedAt).toLocaleString("en-GB")}` : "",
        s.detail ?? "",
      ]
        .filter(Boolean)
        .join("; "),
    })),
    ...BROWSER_ROWS,
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-1 text-blue-700 hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to search
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">Data sources</h1>
        <p className="text-gray-700 mb-2">
          Every result is labelled with the source it came from. Official databases are the reliable ones; open references
          are good but not complete; curated samples and AI suggestions must be checked.
        </p>
        <ul className="flex flex-wrap gap-2 text-xs mb-4">
          {(Object.keys(KIND_LABEL) as SourceKind[]).map((k) => (
            <li key={k} className={`rounded border px-2 py-0.5 ${KIND_CLASS[k]}`}>
              {KIND_LABEL[k]}
            </li>
          ))}
        </ul>
        {serverError && (
          <p className="mb-4 text-sm text-amber-900">
            The search server is not reachable from this page ({serverError}); only browser sources and curated lists will
            be used.
          </p>
        )}
        {!server && !serverError && <p className="mb-4 text-sm text-gray-700">Loading server status…</p>}

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-800">
              <tr>
                <th scope="col" className="p-3">Source</th>
                <th scope="col" className="p-3">Type</th>
                <th scope="col" className="p-3">Coverage</th>
                <th scope="col" className="p-3">Queried by</th>
                <th scope="col" className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-gray-100 align-top">
                  <td className="p-3">
                    <a href={r.homepage} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">
                      {r.name}
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                    {r.terms && (
                      <a href={r.terms} target="_blank" rel="noopener noreferrer" className="block text-xs text-gray-600 hover:underline mt-1">
                        Terms of use<span className="sr-only"> of {r.name} (opens in a new tab)</span>
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`rounded border px-2 py-0.5 text-xs whitespace-nowrap ${KIND_CLASS[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                  </td>
                  <td className="p-3 text-gray-700">{r.coverage}</td>
                  <td className="p-3 text-gray-700">{r.where}</td>
                  <td className="p-3 text-gray-700">
                    {r.state ? STATE_LABEL[r.state] ?? r.state : "on demand"}
                    {r.detail && <span className="block text-xs text-gray-600">{r.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6">
          <Disclaimer />
        </div>
      </div>
    </main>
  );
};

export default Sources;
