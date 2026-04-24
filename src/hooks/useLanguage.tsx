import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import i18n from "i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type SupportedLang = "en" | "pt" | "es";
const SUPPORTED: SupportedLang[] = ["en", "pt", "es"];
const STORAGE_KEY = "i18nextLng";

function normalize(code: string | null | undefined): SupportedLang {
  if (!code) return "en";
  const base = code.toLowerCase().split("-")[0];
  return (SUPPORTED as string[]).includes(base) ? (base as SupportedLang) : "en";
}

interface LanguageContextValue {
  language: SupportedLang;
  setLanguage: (lang: SupportedLang) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<SupportedLang>(() =>
    normalize(typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
  );
  const lastLoadedUserId = useRef<string | null>(null);

  // Apply to i18n + <html lang> whenever language changes
  useEffect(() => {
    if (i18n.language?.split("-")[0] !== language) {
      void i18n.changeLanguage(language);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, language);
    }
  }, [language]);

  // When user logs in, load their saved preferred_language from profile
  useEffect(() => {
    if (!user) {
      lastLoadedUserId.current = null;
      return;
    }
    if (lastLoadedUserId.current === user.id) return;
    lastLoadedUserId.current = user.id;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const profileLang = normalize(data?.preferred_language);
      if (profileLang !== language) {
        setLanguageState(profileLang);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setLanguage = async (lang: SupportedLang) => {
    const next = normalize(lang);
    setLanguageState(next);
    if (user) {
      await supabase
        .from("user_profiles")
        .update({ preferred_language: next })
        .eq("user_id", user.id);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
