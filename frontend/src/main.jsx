import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { store } from "@/store/store";
import { I18nProvider, detectInitialLang, applyDocumentLocale } from "./i18n";
import "./index.css";

// Apply the saved/browser language before first paint to avoid a flash.
applyDocumentLocale(detectInitialLang());

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <I18nProvider>
      <App />
    </I18nProvider>
  </Provider>
);
