import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Debug environment variables in production
console.log("App initialized. Environment check:", {
    hasOpenRouter: !!import.meta.env.VITE_OPENROUTER_API_KEY,
    hasOpenAI: !!import.meta.env.VITE_OPENAI_API_KEY,
    mode: import.meta.env.MODE,
    baseUrl: import.meta.env.BASE_URL
});
