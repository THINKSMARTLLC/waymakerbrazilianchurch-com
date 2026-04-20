import { useEffect, useState } from "react";
import { Cake, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBirthdayInfo } from "@/lib/birthday";
import { toTitleCase } from "@/lib/format";

const SESSION_KEY = "birthday_alert_dismissed_date";

export function BirthdayLoginAlert() {
  const [names, setNames] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(SESSION_KEY) === todayStr) {
      setDismissed(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("name, date_of_birth, status")
        .eq("status", "active")
        .not("date_of_birth", "is", null);
      const todays: string[] = [];
      for (const m of data ?? []) {
        const info = getBirthdayInfo(m.date_of_birth);
        if (info?.daysUntil === 0) todays.push(toTitleCase(m.name));
      }
      setNames(todays);
    })();
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, new Date().toISOString().slice(0, 10));
    setDismissed(true);
  };

  if (dismissed || names.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">🎂</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Cake className="h-3.5 w-3.5" />
          {names.length === 1 ? "1 aniversariante hoje!" : `${names.length} aniversariantes hoje!`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {names.slice(0, 4).join(", ")}{names.length > 4 ? ` e mais ${names.length - 4}...` : ""}
        </p>
      </div>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" title="Dispensar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
