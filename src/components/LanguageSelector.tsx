import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGS } from "@/i18n";
import { useLanguage, type SupportedLang } from "@/hooks/useLanguage";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const current = SUPPORTED_LANGS.find((l) => l.code === language) ?? SUPPORTED_LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          aria-label="Select language"
        >
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-base leading-none">{current.flag}</span>
          <span className="hidden sm:inline text-xs uppercase tracking-wide">{current.code}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SUPPORTED_LANGS.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => void setLanguage(lang.code as SupportedLang)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="text-base">{lang.flag}</span>
            <span className="flex-1">{lang.label}</span>
            {language === lang.code && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
