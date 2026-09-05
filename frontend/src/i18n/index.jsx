import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import en from "./en.js";
import es from "./es.js";
import fr from "./fr.js";
import ar from "./ar.js";
import zh from "./zh.js";

/**
 * SwiftKifisha site languages — the top international languages we serve.
 * `dir` drives RTL layout (Arabic).
 */
export const LANGUAGES = [
  { code: "en", name: "English", native: "English", dir: "ltr" },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr" },
  { code: "fr", name: "French", native: "Français", dir: "ltr" },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文", dir: "ltr" },
];

const PACKS = { en, es, fr, ar, zh };

export const STORAGE_KEY = "swiftkifisha_lang";
export const DEFAULT_LANG = "en";

export function detectInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && PACKS[saved]) return saved;
    const nav = (navigator.language || "en").toLowerCase().split("-")[0];
    if (PACKS[nav]) return nav;
  } catch {
    /* storage unavailable — fall through to English */
  }
  return DEFAULT_LANG;
}

export function applyDocumentLocale(lang) {
  const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
  }
  return meta;
}

function lookup(dict, path) {
  let node = dict;
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function translate(lang, path, vars) {
  let text = lookup(PACKS[lang] ?? {}, path) ?? lookup(en, path);
  if (text === undefined) {
    if (typeof console !== "undefined") console.warn(`[i18n] missing key "${path}" (${lang})`);
    return path;
  }
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      text = text.split(`{${key}}`).join(String(value ?? ""));
    }
  }
  return text;
}

const I18nContext = createContext(null);

/** Provides `{ lang, setLang, t, dir, languages }` to the whole tree. */
export function I18nProvider({ children }) {
  const [lang, setLang] = useState(DEFAULT_LANG);

  useEffect(() => {
    setLang(detectInitialLang());
  }, []);

  useEffect(() => {
    applyDocumentLocale(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const t = useCallback((path, vars) => translate(lang, path, vars), [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      dir: (LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]).dir,
      languages: LANGUAGES,
    }),
    [lang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
