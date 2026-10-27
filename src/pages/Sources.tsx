import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { fetchServerSources, type ServerSourceInfo } from "@/lib/search/serverApi";
import { KIND_CLASS } from "@/components/sourceLabels";
import { useI18n } from "@/i18n";
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
  { name: "RxNorm (US National Library of Medicine)", kind: "reference", coverage: "United States, brand names linked to the ingredient", homepage: "https://www.nlm.nih.gov/research/umls/rxnorm/", where: "sources.where.browser" },
  { name: "openFDA drug labels (US FDA)", kind: "reference", coverage: "United States, product labels", homepage: "https://open.fda.gov/apis/drug/label/", where: "sources.where.browser" },
  { name: "Wikidata", kind: "reference", coverage: "Any country; items with this active ingredient", homepage: "https://www.wikidata.org/wiki/Property:P3781", where: "sources.where.browser" },
  { name: "PubChem synonyms (US NIH)", kind: "reference", coverage: "Names recorded for the substance; some are brands", homepage: "https://pubchem.ncbi.nlm.nih.gov/", where: "sources.where.browser" },
  { name: "ClinicalTrials.gov", kind: "reference", coverage: "Number of registered studies (shown above the results)", homepage: "https://clinicaltrials.gov/", where: "sources.where.browser" },
];

const Sources = () => {
  const { t, lang } = useI18n();
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
      // a dictionary key (src/i18n), shown in the page's language
      where:
        s.kind === "ai"
          ? "sources.where.ai"
          : s.kind === "curated"
            ? "sources.where.curated"
            : ["cima", "health-canada-live", "openfda-server"].includes(s.id)
              ? "sources.where.live"
              : "sources.where.dataset",
      state: s.state,
      detail: [
        s.rows ? t("sources.products", { n: s.rows.toLocaleString(lang) }) : "",
        s.updatedAt ? t("sources.updated", { date: new Date(s.updatedAt).toLocaleString(lang) }) : "",
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
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t("sources.back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">{t("sources.title")}</h1>
        <p className="text-gray-700 mb-2">{t("sources.intro")}</p>
        <ul className="flex flex-wrap gap-2 text-xs mb-4">
          {(Object.keys(KIND_CLASS) as SourceKind[]).map((k) => (
            <li key={k} className={`rounded border px-2 py-0.5 ${KIND_CLASS[k]}`}>
              {t(`kind.${k}`)}
            </li>
          ))}
        </ul>
        {serverError && (
          <p className="mb-4 text-sm text-amber-900">{t("sources.unreachable", { error: serverError })}</p>
        )}
        {!server && !serverError && <p className="mb-4 text-sm text-gray-700" role="status">{t("sources.loading")}</p>}

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-800">
              <tr>
                <th scope="col" className="p-3">{t("sources.col.source")}</th>
                <th scope="col" className="p-3">{t("sources.col.type")}</th>
                <th scope="col" className="p-3">{t("sources.col.coverage")}</th>
                <th scope="col" className="p-3">{t("sources.col.queriedBy")}</th>
                <th scope="col" className="p-3">{t("sources.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-gray-100 align-top">
                  <td className="p-3">
                    <a href={r.homepage} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">
                      {r.name}
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="sr-only">{t("sources.newTab")}</span>
                    </a>
                    {r.terms && (
                      <a href={r.terms} target="_blank" rel="noopener noreferrer" className="block text-xs text-gray-600 hover:underline mt-1">
                        {t("sources.terms")}
                        <span className="sr-only">{t("sources.termsSr", { name: r.name })}</span>
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`rounded border px-2 py-0.5 text-xs whitespace-nowrap ${KIND_CLASS[r.kind]}`}>{t(`kind.${r.kind}`)}</span>
                  </td>
                  <td className="p-3 text-gray-700">{r.coverage}</td>
                  <td className="p-3 text-gray-700">{t(r.where)}</td>
                  <td className="p-3 text-gray-700">
                    {r.state ? t(`state.${r.state}`) : t("state.onDemand")}
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
