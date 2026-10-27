import { useState } from "react";
import { Download } from "lucide-react";
import type { SearchOutcome } from "@/types/medicine";
import { fetchServerSources } from "@/lib/search/serverApi";
import { exportFileName, exportRows, missingTerms, sourceTerms, toCsv, toJson, toXlsxFile, type ExportKind } from "@/lib/export/exportResults";
import { fhirSubstances, toFhirR4 } from "@/lib/export/fhir";
import { rxcuis } from "@/lib/export/rxnorm";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

function save(name: string, type: string, content: string | Uint8Array) {
  // a copy of the bytes as a plain ArrayBuffer (a Blob does not take a view of a shared buffer)
  const part: BlobPart = typeof content === "string" ? content : (content.slice().buffer as ArrayBuffer);
  const url = URL.createObjectURL(new Blob([part], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const FORMATS: ExportKind[] = ["csv", "xlsx", "json", "fhir"];

/** Download buttons at the end of the results. */
export const ExportBar = ({ outcome }: { outcome: SearchOutcome }) => {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const download = async (kind: ExportKind) => {
    setBusy(true);
    try {
      // the search answer carries each source's terms; only a result saved before 2.4.0 needs the list
      let terms = sourceTerms(outcome);
      if (missingTerms(outcome, terms)) {
        const server = await fetchServerSources().then((r) => r.sources).catch(() => null);
        if (server) terms = sourceTerms(outcome, server);
        else toast({ title: t("export.termsMissing.title"), description: t("export.termsMissing.text") });
      }
      const rows = exportRows(outcome, terms);
      const generatedAt = new Date().toISOString();
      const name = exportFileName(outcome, generatedAt, kind);
      const ctx = { link: window.location.href, generatedAt };
      if (kind === "csv") save(name, "text/csv;charset=utf-8", toCsv(rows));
      else if (kind === "json") save(name, "application/json", toJson(outcome, rows, terms, ctx));
      else if (kind === "xlsx") save(name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", toXlsxFile(outcome, rows, terms, ctx));
      else {
        // RxNorm codes for the ingredients, looked up once per name (US NLM, no key)
        const codes = await rxcuis(fhirSubstances(rows));
        save(name, "application/fhir+json", await toFhirR4(outcome, rows, codes, ctx));
      }
    } catch {
      toast({ title: t("export.failed.title"), description: t("export.failed.text"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="export" className="mb-10 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
      <h3 id="export" className="font-semibold text-gray-900 mb-2">
        {t("export.title", { n: outcome.results.length })}
      </h3>
      <div className="flex flex-wrap gap-3 mb-2">
        {FORMATS.map((kind) => (
          <button
            key={kind}
            onClick={() => download(kind)}
            disabled={busy}
            aria-busy={busy}
            className="inline-flex items-center gap-2 rounded border border-blue-600 px-3 py-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            {t(`export.${kind}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-600">{t("export.note")}</p>
    </section>
  );
};
