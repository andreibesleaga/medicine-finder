import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-700 mb-4">Oops! Page not found</p>
        <Link to="/" className="text-blue-700 hover:text-blue-900 underline">
          Return to Home
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
