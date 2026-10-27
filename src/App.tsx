import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Sources from "./pages/Sources";
import NotFound from "./pages/NotFound";
import { I18nProvider } from "./i18n/I18nProvider";
import type { Dict } from "./i18n/core";
import { countryCode } from "./lib/export/countryCodes";

// Vercel Web Analytics is off by default; a Vercel deployment turns it on with VITE_VERCEL_ANALYTICS=true.
const VercelAnalytics =
  import.meta.env.VITE_VERCEL_ANALYTICS === "true"
    ? lazy(() => import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })))
    : null;

const App = ({ i18n }: { i18n?: { lang: string; dict: Dict } }) => (
  <I18nProvider countryCode={countryCode} initial={i18n}>
  <TooltipProvider>
    <Toaster />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/database" element={<Navigate to="/sources" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    {VercelAnalytics && (
      <Suspense fallback={null}>
        <VercelAnalytics />
      </Suspense>
    )}
  </TooltipProvider>
  </I18nProvider>
);

export default App;
