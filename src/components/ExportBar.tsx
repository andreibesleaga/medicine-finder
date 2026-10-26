import { useState } from "react";
import { Download } from "lucide-react";
import type { SearchOutcome } from "@/types/medicine";
import { fetchServerSources } from "@/lib/search/serverApi";
import { exportFileName, exportRows, missingTerms, sourceTerms, toCsv, toJson } from "@/lib/export/exportResults";
import { useToast } from "@/hooks/use-toast";

function save(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download buttons at the end of the results. */
export const ExportBar = ({ outcome }: { outcome: SearchOutcome }) => {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const download = async (kind: "csv" | "json") => {
    setBusy(true);
    try {
      // the search answer carries each source's terms; only a result saved before 2.4.0 needs the list
      let terms = sourceTerms(outcome);
      if (missingTerms(outcome, terms)) {
        const server = await fetchServerSources().then((r) => r.sources).catch(() => null);
        if (server) terms = sourceTerms(outcome, server);
        else toast({ title: "Terms of use not loaded", description: "The file says where to read them: the Data sources page." });
      }
      const rows = exportRows(outcome, terms);
      const generatedAt = new Date().toISOString();
      const name = exportFileName(outcome, generatedAt, kind);
      if (kind === "csv") save(name, "text/csv;charset=utf-8", toCsv(rows));
      else save(name, "application/json", toJson(outcome, rows, terms, { link: window.location.href, generatedAt }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="export" className="mb-10 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
      <h3 id="export" className="font-semibold text-gray-900 mb-2">
        Download these {outcome.results.length} results
      </h3>
      <div className="flex flex-wrap gap-3 mb-2">
        <button
          onClick={() => download("csv")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded border border-blue-600 px-3 py-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          CSV (Excel, LibreOffice)
        </button>
        <button
          onClick={() => download("json")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded border border-blue-600 px-3 py-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          JSON (programs, scripts)
        </button>
      </div>
      <p className="text-xs text-gray-600">
        Each row names its source, the source's terms of use and any condition of reuse; keep them when you share the data.
        AI suggestions are marked as such.
      </p>
    </section>
  );
};
