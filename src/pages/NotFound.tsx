import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";

const NotFound = () => {
  const { t } = useI18n();
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-700 mb-4">{t("notFound.text")}</p>
        <Link to="/" className="text-blue-700 hover:text-blue-900 underline">
          {t("notFound.home")}
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
