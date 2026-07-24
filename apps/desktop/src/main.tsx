import React from "react";
import ReactDOM from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en, flattenCatalog } from "@pi-desktop/i18n";
import App from "./App";
import "./styles/globals.css";

document.documentElement.dataset.theme = "dark";

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: flattenCatalog(en as unknown as Record<string, unknown>) },
  },
  interpolation: { escapeValue: false },
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("root element missing");
}

try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
  rootEl.innerHTML = `<div style="padding:24px;font:14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#181818;color:#fff;height:100%">
    <h1 style="margin:0 0 8px;font-size:16px">PI-Desktop failed to start UI</h1>
    <pre style="white-space:pre-wrap;color:#fca5a5">${String(error)}</pre>
  </div>`;
}
