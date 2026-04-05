import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { safeGetItem, safeSetItem } from "../lib/safeStorage";
import { en } from "../locales/en";
import { zh } from "../locales/zh";

const STORAGE_KEY = "floe-lang";

const LanguageContext = createContext(null);

function getNested(obj, path) {
  return path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function interpolate(str, vars) {
  if (!vars || typeof str !== "string") return str;
  return str.replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] != null ? String(vars[name]) : `{${name}}`,
  );
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const s = safeGetItem(STORAGE_KEY);
    if (s === "en" || s === "zh") return s;
    return "zh";
  });

  const setLang = useCallback((next) => {
    setLangState(next);
    safeSetItem(STORAGE_KEY, next);
  }, []);

  const dict = lang === "en" ? en : zh;

  const t = useCallback(
    (key, vars) => {
      const v = getNested(dict, key);
      if (typeof v === "string") return interpolate(v, vars);
      if (v != null) return v;
      const fb = getNested(zh, key);
      if (typeof fb === "string") return interpolate(fb, vars);
      return key;
    },
    [dict],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, locale: lang === "en" ? "en-US" : "zh-CN" }),
    [lang, setLang, t],
  );

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }, [lang]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
