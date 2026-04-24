import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BookOpen, Sparkles, NotebookPen, Search, Flame, Check, Loader2,
  ChevronLeft, ChevronRight, Lock, Share2, BookMarked,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { getOrGenerateTodayDevotional } from "@/lib/devotional.functions";
import { todayNYC } from "@/lib/datetime";

export const Route = createFileRoute("/portal/bible")({
  head: () => ({
    meta: [
      { title: "Bíblia & Devocional — Way Maker Church" },
      { name: "description", content: "Sua jornada diária com a Palavra: devocional, leitura e anotações." },
    ],
  }),
  component: BiblePage,
});

// ---------- Bible book list (English, ordered) ----------
const BIBLE_BOOKS: { name: string; chapters: number }[] = [
  { name: "Genesis", chapters: 50 }, { name: "Exodus", chapters: 40 }, { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 }, { name: "Deuteronomy", chapters: 34 }, { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 }, { name: "Ruth", chapters: 4 }, { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 }, { name: "1 Kings", chapters: 22 }, { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 }, { name: "2 Chronicles", chapters: 36 }, { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 }, { name: "Esther", chapters: 10 }, { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 }, { name: "Proverbs", chapters: 31 }, { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 }, { name: "Isaiah", chapters: 66 }, { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 }, { name: "Ezekiel", chapters: 48 }, { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 }, { name: "Joel", chapters: 3 }, { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 }, { name: "Jonah", chapters: 4 }, { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 }, { name: "Habakkuk", chapters: 3 }, { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 }, { name: "Zechariah", chapters: 14 }, { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 }, { name: "Mark", chapters: 16 }, { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 }, { name: "Acts", chapters: 28 }, { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 }, { name: "2 Corinthians", chapters: 13 }, { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 }, { name: "Philippians", chapters: 4 }, { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 }, { name: "2 Thessalonians", chapters: 3 }, { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 }, { name: "Titus", chapters: 3 }, { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 }, { name: "James", chapters: 5 }, { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 }, { name: "1 John", chapters: 5 }, { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 }, { name: "Jude", chapters: 1 }, { name: "Revelation", chapters: 22 },
];

// Map Portuguese / Spanish book names to English (for bible-api.com)
const BOOK_ALIASES: Record<string, string> = {
  // Portuguese
  "genesis": "genesis", "gênesis": "genesis", "exodo": "exodus", "êxodo": "exodus",
  "levitico": "leviticus", "levítico": "leviticus", "numeros": "numbers", "números": "numbers",
  "deuteronomio": "deuteronomy", "deuteronomio ": "deuteronomy", "josue": "joshua", "josué": "joshua",
  "juizes": "judges", "juízes": "judges", "rute": "ruth",
  "1 samuel": "1 samuel", "2 samuel": "2 samuel",
  "1 reis": "1 kings", "2 reis": "2 kings",
  "1 cronicas": "1 chronicles", "1 crônicas": "1 chronicles",
  "2 cronicas": "2 chronicles", "2 crônicas": "2 chronicles",
  "esdras": "ezra", "neemias": "nehemiah", "ester": "esther",
  "jo": "job", "jó": "job", "salmos": "psalms", "salmo": "psalms",
  "proverbios": "proverbs", "provérbios": "proverbs",
  "eclesiastes": "ecclesiastes", "cantares": "song of solomon", "canticos": "song of solomon",
  "isaias": "isaiah", "isaías": "isaiah", "jeremias": "jeremiah",
  "lamentacoes": "lamentations", "lamentações": "lamentations",
  "ezequiel": "ezekiel", "daniel": "daniel", "oseias": "hosea", "oséias": "hosea",
  "joel": "joel", "amos": "amos", "amós": "amos", "obadias": "obadiah",
  "jonas": "jonah", "miqueias": "micah", "miquéias": "micah",
  "naum": "nahum", "habacuque": "habakkuk", "sofonias": "zephaniah",
  "ageu": "haggai", "zacarias": "zechariah", "malaquias": "malachi",
  "mateus": "matthew", "marcos": "mark", "lucas": "luke", "joao": "john", "joão": "john",
  "atos": "acts", "romanos": "romans",
  "1 corintios": "1 corinthians", "1 coríntios": "1 corinthians",
  "2 corintios": "2 corinthians", "2 coríntios": "2 corinthians",
  "galatas": "galatians", "gálatas": "galatians",
  "efesios": "ephesians", "efésios": "ephesians",
  "filipenses": "philippians", "colossenses": "colossians",
  "1 tessalonicenses": "1 thessalonians", "2 tessalonicenses": "2 thessalonians",
  "1 timoteo": "1 timothy", "1 timóteo": "1 timothy",
  "2 timoteo": "2 timothy", "2 timóteo": "2 timothy",
  "tito": "titus", "filemom": "philemon", "filemon": "philemon",
  "hebreus": "hebrews", "tiago": "james",
  "1 pedro": "1 peter", "2 pedro": "2 peter",
  "1 joao": "1 john", "1 joão": "1 john",
  "2 joao": "2 john", "2 joão": "2 john",
  "3 joao": "3 john", "3 joão": "3 john",
  "judas": "jude", "apocalipse": "revelation",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Parse a reference like "Mateus 11:28", "John 3:16-17", "1 João 4:7"
// Returns the canonical English book name (matching BIBLE_BOOKS) plus chapter/verse.
function parseBibleReference(ref: string): { book: string; chapter: number; verse: number | null } | null {
  if (!ref) return null;
  const cleaned = ref.trim().replace(/\s+/g, " ");
  // Match optional leading number, book words, then "chapter:verse" or just "chapter"
  const m = cleaned.match(/^((?:[1-3]\s+)?[A-Za-zÀ-ÿ.\s]+?)\s+(\d+)(?::(\d+))?/);
  if (!m) return null;
  const rawBook = m[1].trim().replace(/\.$/, "");
  const chapter = parseInt(m[2], 10);
  const verse = m[3] ? parseInt(m[3], 10) : null;
  const key = stripAccents(rawBook).toLowerCase();
  const englishLower = BOOK_ALIASES[key] ?? key;
  // Find canonical book in BIBLE_BOOKS (case-insensitive)
  const canonical = BIBLE_BOOKS.find((b) => b.name.toLowerCase() === englishLower);
  if (!canonical) return null;
  return { book: canonical.name, chapter, verse };
}

function toApiBook(name: string): string {
  const key = stripAccents(name).toLowerCase().trim();
  const mapped = BOOK_ALIASES[key] ?? BOOK_ALIASES[stripAccents(name).toLowerCase()] ?? key;
  // bible-api.com expects "+" as separator inside book name too (e.g. "1+samuel")
  return mapped.replace(/\s+/g, "+");
}

type Tab = "today" | "bible" | "notes" | "progress";
type Translation = "web" | "kjv" | "almeida" | "rvr";

interface Devotional {
  id: string;
  devotional_date: string;
  title: string;
  bible_reference: string;
  verse_text: string | null;
  reflection: string;
  application: string;
  prayer: string;
}

interface BibleVerse { book_id: string; book_name: string; chapter: number; verse: number; text: string; }
interface BibleNote { id: string; book: string; chapter: number; verse: number; note_text: string; share_with_pastor: boolean; updated_at: string; }

const LAST_POS_KEY = "wmf:bible:lastPosition";

type LastPosition = {
  tab: Tab;
  section?: "devotional" | "verse" | "reflection" | "application" | "prayer" | "note";
  noteId?: string;
  updatedAt: string;
};

function loadLastPosition(): LastPosition | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LAST_POS_KEY) : null;
    if (!raw) return null;
    return JSON.parse(raw) as LastPosition;
  } catch { return null; }
}

function saveLastPosition(pos: Partial<LastPosition>) {
  try {
    if (typeof window === "undefined") return;
    const prev = loadLastPosition() ?? { tab: "today" as Tab, updatedAt: new Date().toISOString() };
    const next: LastPosition = { ...prev, ...pos, updatedAt: new Date().toISOString() };
    localStorage.setItem(LAST_POS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function BiblePage() {
  const { i18n } = useTranslation();
  const member = useCurrentMember();
  const [tab, setTab] = useState<Tab>(() => loadLastPosition()?.tab ?? "today");
  const [target, setTarget] = useState<{ book: string; chapter: number; verse: number | null } | null>(null);

  const lang = (i18n.language?.split("-")[0] || "pt") as "pt" | "en" | "es";

  useEffect(() => {
    saveLastPosition({ tab });
  }, [tab]);

  const openInBible = (ref: string) => {
    const parsed = parseBibleReference(ref);
    if (!parsed) {
      toast.error("Não foi possível abrir esta referência.");
      return;
    }
    setTarget(parsed);
    setTab("bible");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground tracking-tight">
          📖 Bíblia & Devocional
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sua jornada diária com a Palavra de Deus.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        <TabBtn active={tab === "today"} onClick={() => setTab("today")} icon={<Sparkles className="h-4 w-4" />} label="Hoje" />
        <TabBtn active={tab === "bible"} onClick={() => setTab("bible")} icon={<BookOpen className="h-4 w-4" />} label="Bíblia" />
        <TabBtn active={tab === "notes"} onClick={() => setTab("notes")} icon={<NotebookPen className="h-4 w-4" />} label="Minhas Notas" />
        <TabBtn active={tab === "progress"} onClick={() => setTab("progress")} icon={<Flame className="h-4 w-4" />} label="Progresso" />
      </div>

      {tab === "today" && <TodayDevotional memberId={member?.id ?? null} lang={lang} onReadVerse={openInBible} />}
      {tab === "bible" && <BibleReader memberId={member?.id ?? null} target={target} onTargetConsumed={() => setTarget(null)} />}
      {tab === "notes" && <MyNotes memberId={member?.id ?? null} />}
      {tab === "progress" && <Progress memberId={member?.id ?? null} onNavigate={setTab} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{label}
    </button>
  );
}

// ============== TODAY'S DEVOTIONAL ==============
function TodayDevotional({ memberId, lang, onReadVerse }: { memberId: string | null; lang: "pt" | "en" | "es"; onReadVerse: (ref: string) => void }) {
  const [dev, setDev] = useState<Devotional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);
  const [readToday, setReadToday] = useState<boolean | null>(null);
  const [notesToday, setNotesToday] = useState(0);
  const [resumeSection, setResumeSection] = useState<LastPosition["section"] | null>(null);
  const [showResume, setShowResume] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const reqIdRef = useRef(0);

  // Load the devotional itself (depends only on language).
  // Keeping member-related side queries in a separate effect avoids the
  // full-screen loader flashing when memberId resolves after the devotional.
  useEffect(() => {
    const myReq = ++reqIdRef.current;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { devotional, error: e } = await getOrGenerateTodayDevotional({ data: { language: lang } });
        if (cancelled || myReq !== reqIdRef.current) return;
        if (e) setError(e);
        setDev(devotional ?? null);
      } catch (err) {
        console.error(err);
        if (!cancelled && myReq === reqIdRef.current) setError("Não foi possível carregar o devocional");
      } finally {
        if (!cancelled && myReq === reqIdRef.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  // Load member-specific completion / read / notes state.
  // Runs without toggling the main loader.
  useEffect(() => {
    if (!memberId || !dev) return;
    let cancelled = false;
    (async () => {
      const today = todayNYC();
      const [compRes, readingsRes, notesRes] = await Promise.all([
        supabase
          .from("devotional_completions")
          .select("id")
          .eq("member_id", memberId)
          .eq("devotional_id", dev.id)
          .maybeSingle(),
        supabase.from("bible_readings").select("id").eq("member_id", memberId).eq("read_date", today).limit(1),
        supabase
          .from("bible_notes")
          .select("id, updated_at")
          .eq("member_id", memberId)
          .gte("updated_at", `${today}T00:00:00`)
          .order("updated_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setCompleted(!!compRes.data);
      setReadToday(!!readingsRes.data && readingsRes.data.length > 0);
      setNotesToday(notesRes.data?.length ?? 0);

      const last = loadLastPosition();
      const startedSomething =
        (last?.section && last?.tab === "today") ||
        (notesRes.data?.length ?? 0) > 0 ||
        !!readingsRes.data?.length;
      if (startedSomething) {
        setResumeSection(last?.section ?? "devotional");
        setShowResume(true);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId, dev]);

  const scrollToSection = (section: NonNullable<LastPosition["section"]>) => {
    const el = sectionRefs.current[section];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleResume = () => {
    if (resumeSection) scrollToSection(resumeSection);
    setShowResume(false);
  };

  const trackSection = (section: NonNullable<LastPosition["section"]>) => {
    saveLastPosition({ tab: "today", section });
  };

  const markCompleted = async () => {
    if (!memberId || !dev || completed) return;
    setMarking(true);
    const today = todayNYC();
    const { error: e } = await supabase.from("devotional_completions").insert({
      member_id: memberId,
      devotional_id: dev.id,
      completed_date: today,
    });
    if (e && !e.message.includes("duplicate")) {
      toast.error("Erro ao registrar conclusão");
      setMarking(false);
      return;
    }
    setCompleted(true);
    saveLastPosition({ tab: "today", section: "prayer" });
    toast.success("Devocional concluído! +10 pts ✨");
    setMarking(false);
  };

  if (loading) {
    return <div className="card-elevated p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparando seu devocional...</div>;
  }
  if (error || !dev) {
    return <div className="card-elevated p-6 text-sm text-muted-foreground">{error || "Sem devocional disponível."}</div>;
  }

  return (
    <div className="space-y-4">
      {!completed && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="text-foreground mb-2">
            Você ainda não fez seu devocional hoje. Que tal começar agora seu momento com Deus?
          </p>
          <button
            type="button"
            onClick={() => sectionRefs.current.devotional?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Abrir devocional de hoje
          </button>
        </div>
      )}
      {showResume && !completed && (
        <button
          type="button"
          onClick={handleResume}
          className="w-full text-left rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-foreground hover:bg-primary/10 transition-colors"
        >
          <span className="font-medium text-primary">↩ Continue de onde parou</span>
          <span className="text-muted-foreground ml-2">
            {notesToday > 0 ? `${notesToday} nota(s) hoje` : "Retomar devocional"}
          </span>
        </button>
      )}

      {readToday === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-200">
          📖 Você ainda não leu hoje. Que tal abrir a Bíblia agora?
        </div>
      )}

      <article className="card-elevated p-6 md:p-8 space-y-5">
        <div ref={(el) => { sectionRefs.current.devotional = el; }}>
          <div className="text-xs font-medium text-primary uppercase tracking-wider">📅 Devocional de Hoje</div>
          <h3 className="font-display text-2xl md:text-3xl font-semibold text-foreground mt-1 leading-tight">{dev.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{dev.bible_reference}</p>
        </div>

        {dev.verse_text && (
          <blockquote
            ref={(el) => { sectionRefs.current.verse = el; }}
            onMouseEnter={() => trackSection("verse")}
            className="border-l-4 border-primary pl-4 py-2 text-foreground italic leading-relaxed"
          >
            "{dev.verse_text}"
          </blockquote>
        )}

        <div ref={(el) => { sectionRefs.current.reflection = el; }} onMouseEnter={() => trackSection("reflection")}>
          <Section title="Reflexão" body={dev.reflection} />
        </div>
        <div ref={(el) => { sectionRefs.current.application = el; }} onMouseEnter={() => trackSection("application")}>
          <Section title="Aplicação" body={dev.application} />
        </div>
        <div ref={(el) => { sectionRefs.current.prayer = el; }} onMouseEnter={() => trackSection("prayer")}>
          <Section title="Oração" body={dev.prayer} />
        </div>

        <MyReflection memberId={memberId} devotionalId={dev.id} />

        <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => { trackSection("verse"); onReadVerse(dev.bible_reference); }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <BookOpen className="h-4 w-4" /> Ler Versículo
          </button>
          <button
            onClick={markCompleted}
            disabled={completed || marking || !memberId}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              completed
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            }`}
          >
            {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {completed ? "Concluído (+10 pts)" : "Marcar como Concluído"}
          </button>
        </div>
      </article>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      <p className="text-foreground/90 leading-relaxed mt-1 whitespace-pre-wrap">{body}</p>
    </div>
  );
}

// ============== MY REFLECTION (auto-saved personal devotional notes) ==============
type DevotionalNote = {
  learned_text: string;
  keywords: string[];
  god_spoke_text: string;
};

function MyReflection({ memberId, devotionalId }: { memberId: string | null; devotionalId: string }) {
  const [note, setNote] = useState<DevotionalNote>({ learned_text: "", keywords: [], god_spoke_text: "" });
  const [keywordInput, setKeywordInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [lastEditedAt, setLastEditedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef<string | null>(null);
  const skipNextSave = useRef(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!memberId || !devotionalId) return;
    (async () => {
      const { data } = await supabase
        .from("devotional_notes")
        .select("id, learned_text, keywords, god_spoke_text, updated_at")
        .eq("member_id", memberId)
        .eq("devotional_id", devotionalId)
        .maybeSingle();
      if (cancelled) return;
      const hasContent =
        !!data &&
        ((data.learned_text && data.learned_text.trim().length > 0) ||
          (data.god_spoke_text && data.god_spoke_text.trim().length > 0) ||
          (Array.isArray(data.keywords) && data.keywords.length > 0));
      if (data) {
        noteIdRef.current = data.id;
        setNote({
          learned_text: data.learned_text ?? "",
          keywords: data.keywords ?? [],
          god_spoke_text: data.god_spoke_text ?? "",
        });
        setLastEditedAt((data as { updated_at?: string }).updated_at ?? null);
      }
      skipNextSave.current = true;
      setLoaded(true);
      // Default to view mode if there's existing content; else edit so the user can start
      setMode(hasContent ? "view" : "edit");
    })();
    return () => { cancelled = true; };
  }, [memberId, devotionalId]);

  useEffect(() => {
    if (!loaded || !memberId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Debounce only — do NOT flip to "saving" on every keystroke.
    // Status changes when the save actually fires.
    saveTimer.current = setTimeout(async () => {
      const isEmpty = !note.learned_text.trim() && !note.god_spoke_text.trim() && note.keywords.length === 0;
      if (isEmpty && !noteIdRef.current) {
        return;
      }
      setStatus("saving");
      const { data, error } = await supabase
        .from("devotional_notes")
        .upsert(
          {
            member_id: memberId,
            devotional_id: devotionalId,
            learned_text: note.learned_text,
            keywords: note.keywords,
            god_spoke_text: note.god_spoke_text,
          },
          { onConflict: "member_id,devotional_id" }
        )
        .select("id, updated_at")
        .maybeSingle();
      if (error) {
        setStatus("error");
        return;
      }
      if (data?.id) noteIdRef.current = data.id;
      if ((data as { updated_at?: string } | null)?.updated_at) {
        setLastEditedAt((data as { updated_at?: string }).updated_at ?? null);
      } else {
        setLastEditedAt(new Date().toISOString());
      }
      setStatus("saved");
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [note, loaded, memberId, devotionalId]);

  // Click outside the reflection card → return to view mode (only explicit exit path)
  useEffect(() => {
    if (mode !== "edit") return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        const hasContent =
          note.learned_text.trim().length > 0 ||
          note.god_spoke_text.trim().length > 0 ||
          note.keywords.length > 0;
        if (hasContent) setMode("view");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [mode, note]);

  const addKeyword = () => {
    const v = keywordInput.trim();
    if (!v) return;
    if (note.keywords.includes(v)) {
      setKeywordInput("");
      return;
    }
    setNote((p) => ({ ...p, keywords: [...p.keywords, v] }));
    setKeywordInput("");
  };

  const removeKeyword = (k: string) => {
    setNote((p) => ({ ...p, keywords: p.keywords.filter((x) => x !== k) }));
  };

  if (!memberId) return null;

  const hasContent =
    note.learned_text.trim().length > 0 ||
    note.god_spoke_text.trim().length > 0 ||
    note.keywords.length > 0;

  const lastEditedLabel = lastEditedAt
    ? new Date(lastEditedAt).toLocaleString(undefined, {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div ref={containerRef} className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          Minha Reflexão
        </h4>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground min-h-[1rem]">
            {status === "saving" && "Salvando..."}
            {status === "saved" && <span className="text-emerald-600 dark:text-emerald-400">Salvo ✔</span>}
            {status === "error" && <span className="text-destructive">Erro ao salvar</span>}
            {status === "idle" && lastEditedLabel && (
              <span>Última edição: {lastEditedLabel}</span>
            )}
          </span>
          {mode === "view" && hasContent && (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="text-xs font-medium text-primary hover:underline"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {mode === "view" && hasContent ? (
        <div className="space-y-4">
          {note.learned_text.trim() && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">O que aprendi hoje</div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed rounded-md bg-muted/40 px-3 py-2">
                {note.learned_text}
              </p>
            </div>
          )}

          {note.keywords.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Palavras-chave</div>
              <div className="flex flex-wrap gap-1.5">
                {note.keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {note.god_spoke_text.trim() && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Deus falou comigo</div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed rounded-md bg-muted/40 px-3 py-2">
                {note.god_spoke_text}
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">O que aprendi hoje</label>
            <textarea
              value={note.learned_text}
              onChange={(e) => setNote((p) => ({ ...p, learned_text: e.target.value }))}
              onFocus={() => setMode("edit")}
              rows={3}
              placeholder="Escreva o que Deus te ensinou hoje..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Palavras-chave</label>
            {note.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => removeKeyword(k)}
                      className="hover:text-destructive"
                      aria-label={`Remover ${k}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onFocus={() => setMode("edit")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              onBlur={addKeyword}
              placeholder="Digite e pressione Enter (ex: fé, esperança)"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Deus falou comigo</label>
            <textarea
              value={note.god_spoke_text}
              onChange={(e) => setNote((p) => ({ ...p, god_spoke_text: e.target.value }))}
              onFocus={() => setMode("edit")}
              rows={3}
              placeholder="Como Deus falou ao seu coração hoje?"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {hasContent && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMode("view")}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Concluir
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============== BIBLE READER ==============
function BibleReader({
  memberId,
  target,
  onTargetConsumed,
}: {
  memberId: string | null;
  target?: { book: string; chapter: number; verse: number | null } | null;
  onTargetConsumed?: () => void;
}) {
  const [book, setBook] = useState<string>("Genesis");
  const [chapter, setChapter] = useState<number>(1);
  const [translation, setTranslation] = useState<Translation>("almeida");
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [notesMap, setNotesMap] = useState<Map<number, BibleNote>>(new Map());
  const [openVerse, setOpenVerse] = useState<number | null>(null);
  const [highlightVerse, setHighlightVerse] = useState<number | null>(null);
  const verseRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Apply incoming target (from devotional "Read Verse")
  useEffect(() => {
    if (!target) return;
    setBook(target.book);
    setChapter(target.chapter);
    setHighlightVerse(target.verse);
    onTargetConsumed?.();
  }, [target, onTargetConsumed]);

  const currentBook = BIBLE_BOOKS.find((b) => b.name === book) ?? BIBLE_BOOKS[42];

  // Load chapter
  useEffect(() => {
    let cancelled = false;

    async function tryFetch(url: string): Promise<any | null> {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn("[bible-api] non-ok", res.status, url);
          return null;
        }
        const json = await res.json();
        if (!json?.verses?.length) return null;
        return json;
      } catch (err) {
        console.warn("[bible-api] fetch threw", err);
        return null;
      }
    }

    async function fetchWithRetry(): Promise<any | null> {
      const url = `/api/bible?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(String(chapter))}&translation=${encodeURIComponent(translation)}`;
      console.log("[bible] proxy GET", url);
      const json = await tryFetch(url);
      return json;
    }

    (async () => {
      setLoading(true);
      try {
        const json = await fetchWithRetry();
        if (cancelled) return;
        if (!json) {
          toast.error("Unable to load Bible. Please try again.");
          setVerses([]);
        } else {
          setVerses(json.verses);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Track reading
      if (memberId) {
        const today = todayNYC();
        const { error } = await supabase.from("bible_readings").insert({
          member_id: memberId, book, chapter, read_date: today,
        });
        if (!error) {
          // First time today for this chapter → +3pts toast (silent if duplicate)
        }
      }
    })();
    return () => { cancelled = true; };
  }, [book, chapter, translation, memberId]);

  // Scroll to + highlight target verse once verses are loaded
  useEffect(() => {
    if (loading || verses.length === 0 || highlightVerse == null) return;
    const el = verseRefs.current.get(highlightVerse);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const t = setTimeout(() => setHighlightVerse(null), 3500);
    return () => clearTimeout(t);
  }, [loading, verses, highlightVerse]);

  // Load notes for this chapter
  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bible_notes")
        .select("*")
        .eq("member_id", memberId)
        .eq("book", book)
        .eq("chapter", chapter);
      if (cancelled) return;
      const map = new Map<number, BibleNote>();
      (data || []).forEach((n: BibleNote) => map.set(n.verse, n));
      setNotesMap(map);
    })();
    return () => { cancelled = true; };
  }, [book, chapter, memberId]);

  const upsertNote = (verse: number, note: BibleNote) => {
    setNotesMap((prev) => {
      const next = new Map(prev);
      next.set(verse, note);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Livro</label>
            <select
              value={book}
              onChange={(e) => { setBook(e.target.value); setChapter(1); }}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {BIBLE_BOOKS.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Capítulo</label>
            <select
              value={chapter}
              onChange={(e) => setChapter(Number(e.target.value))}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tradução</label>
            <select
              value={translation}
              onChange={(e) => setTranslation(e.target.value as Translation)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="almeida">Almeida (PT)</option>
              <option value="rvr">Reina-Valera (ES)</option>
              <option value="web">World English (EN)</option>
              <option value="kjv">King James (EN)</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setChapter((c) => Math.max(1, c - 1))}
            disabled={chapter <= 1}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <div className="text-sm font-medium text-foreground">{book} {chapter}</div>
          <button
            onClick={() => setChapter((c) => Math.min(currentBook.chapters, c + 1))}
            disabled={chapter >= currentBook.chapters}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            Próximo <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="card-elevated p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>
        ) : verses.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Nenhum versículo encontrado.</div>
        ) : (
          <div className="space-y-1">
            {verses.map((v) => {
              const note = notesMap.get(v.verse);
              const hasNote = !!note;
              const isOpen = openVerse === v.verse;
              const isHighlighted = highlightVerse === v.verse;
              return (
                <div
                  key={v.verse}
                  ref={(el) => {
                    if (el) verseRefs.current.set(v.verse, el);
                    else verseRefs.current.delete(v.verse);
                  }}
                >
                  <button
                    onClick={() => setOpenVerse(isOpen ? null : v.verse)}
                    className={`w-full text-left rounded-md p-2 transition-colors ${
                      isHighlighted
                        ? "bg-primary/15 ring-2 ring-primary/60 animate-pulse"
                        : hasNote
                          ? "bg-amber-50 dark:bg-amber-950/20 border-l-2 border-amber-400"
                          : "hover:bg-muted"
                    }`}
                  >
                    <span className="font-semibold text-primary text-sm mr-2">{v.verse}.</span>
                    <span className="text-foreground leading-relaxed">{v.text.trim()}</span>
                    {hasNote && <BookMarked className="inline-block h-3.5 w-3.5 text-amber-600 ml-2" />}
                  </button>
                  {isOpen && memberId && (
                    <NoteEditor
                      memberId={memberId}
                      book={book}
                      chapter={chapter}
                      verse={v.verse}
                      existing={note ?? null}
                      onSaved={(n) => upsertNote(v.verse, n)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== NOTE EDITOR (autosave) ==============
function NoteEditor({
  memberId, book, chapter, verse, existing, onSaved,
}: {
  memberId: string;
  book: string; chapter: number; verse: number;
  existing: BibleNote | null;
  onSaved: (n: BibleNote) => void;
}) {
  const [text, setText] = useState(existing?.note_text ?? "");
  const [share, setShare] = useState(existing?.share_with_pastor ?? false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(existing ? new Date(existing.updated_at) : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const isNew = !existing;

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length === 0 && !existing) return; // don't autosave empty new notes
    timer.current = setTimeout(async () => {
      setSaving(true);
      const payload = {
        member_id: memberId, book, chapter, verse,
        note_text: text, share_with_pastor: share,
      };
      const { data, error } = await supabase
        .from("bible_notes")
        .upsert(payload, { onConflict: "member_id,book,chapter,verse" })
        .select()
        .single();
      setSaving(false);
      if (error) { toast.error("Erro ao salvar nota"); return; }
      if (data) {
        onSaved(data as BibleNote);
        setSavedAt(new Date());
        if (isNew && existing === null) {
          toast.success("Nota criada (+5 pts) ✨");
        }
      }
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, share]);

  return (
    <div className="ml-6 mt-2 mb-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/10 p-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva sua reflexão..."
        rows={3}
        autoFocus
        className="w-full bg-transparent border-0 resize-none focus:outline-none text-sm text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer text-muted-foreground">
          <input
            type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)}
            className="rounded border-border"
          />
          {share ? <Share2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {share ? "Compartilhada com o pastor" : "Privada"}
        </label>
        <span className="text-muted-foreground">
          {saving ? "salvando..." : savedAt ? `salvo ${savedAt.toLocaleTimeString()}` : ""}
        </span>
      </div>
    </div>
  );
}

// ============== MY NOTES ==============
function MyNotes({ memberId }: { memberId: string | null }) {
  const [notes, setNotes] = useState<BibleNote[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bible_notes")
        .select("*")
        .eq("member_id", memberId)
        .order("updated_at", { ascending: false });
      if (!cancelled) {
        setNotes((data || []) as BibleNote[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.note_text.toLowerCase().includes(q) ||
      `${n.book} ${n.chapter}:${n.verse}`.toLowerCase().includes(q)
    );
  }, [notes, query]);

  const handleSaved = (updated: BibleNote) => {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === updated.id ? updated : n));
      // re-sort by updated_at desc
      return [...next].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar notas (ex: fé)..."
          className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
          {query ? "Nenhuma nota encontrada." : "Você ainda não criou notas. Abra um capítulo e clique em um versículo para começar."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const isEditing = editingId === n.id;
            return (
              <div key={n.id} className="card-elevated p-4">
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : n.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-primary">{n.book} {n.chapter}:{n.verse}</span>
                    <span className="text-xs text-muted-foreground">
                      {n.share_with_pastor ? <Share2 className="inline h-3 w-3 mr-1" /> : <Lock className="inline h-3 w-3 mr-1" />}
                      {new Date(n.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  {!isEditing && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{n.note_text}</p>
                  )}
                </button>
                {isEditing && memberId && (
                  <NoteEditor
                    memberId={memberId}
                    book={n.book}
                    chapter={n.chapter}
                    verse={n.verse}
                    existing={n}
                    onSaved={handleSaved}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============== PROGRESS ==============
function Progress({ memberId, onNavigate }: { memberId: string | null; onNavigate: (tab: Tab) => void }) {
  const [stats, setStats] = useState({
    streak: 0,
    devotionals: 0,
    chapters: 0,
    notes: 0,
    reflections: 0,
    points: 0,
  });
  const [todayActions, setTodayActions] = useState({
    completed: false,
    reflectedToday: false,
    notesToday: 0,
    readToday: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const today = todayNYC();
      const [
        { count: dCount },
        { count: nCount },
        { data: readings },
        { data: reflections },
        { data: ch },
        { data: completedTodayRows },
      ] = await Promise.all([
        supabase.from("devotional_completions").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        supabase.from("bible_notes").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        supabase.from("bible_readings").select("read_date").eq("member_id", memberId).order("read_date", { ascending: false }),
        supabase
          .from("devotional_notes")
          .select("id, learned_text, keywords, god_spoke_text, updated_at")
          .eq("member_id", memberId)
          .order("updated_at", { ascending: false }),
        supabase.from("bible_readings").select("book, chapter").eq("member_id", memberId),
        supabase.from("devotional_completions").select("id").eq("member_id", memberId).eq("completed_date", today).limit(1),
      ]);
      if (cancelled) return;

      // Filter reflections that have actual content
      const filledReflections = (reflections || []).filter((r) => {
        const hasText = (r.learned_text?.trim().length ?? 0) > 0 || (r.god_spoke_text?.trim().length ?? 0) > 0;
        const hasKeywords = Array.isArray(r.keywords) && r.keywords.length > 0;
        return hasText || hasKeywords;
      });

      // Streak: combine reading days + reflection days + completion days
      const reflectionDates = filledReflections.map((r) => (r.updated_at as string).slice(0, 10));
      const readingDates = (readings || []).map((r) => r.read_date as string);
      const allActiveDates = Array.from(new Set([...readingDates, ...reflectionDates])).sort().reverse();

      let streak = 0;
      const yest = (() => {
        const d = new Date(today + "T12:00:00");
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      let cursor = allActiveDates[0] === today ? today : (allActiveDates[0] === yest ? yest : null);
      if (cursor) {
        const set = new Set(allActiveDates);
        const start = new Date(cursor + "T12:00:00");
        for (let i = 0; i < allActiveDates.length + 365; i++) {
          const key = start.toISOString().slice(0, 10);
          if (set.has(key)) { streak++; start.setDate(start.getDate() - 1); }
          else break;
        }
      }

      const uniqChapters = new Set((ch || []).map((r) => `${r.book}-${r.chapter}`)).size;

      // Today actions
      const reflectedToday = filledReflections.some((r) => (r.updated_at as string).slice(0, 10) === today);
      const completedToday = (completedTodayRows?.length ?? 0) > 0;

      // Points: +10 per devotional completion, +7 per reflection, +5 per note
      const points = (dCount || 0) * 10 + filledReflections.length * 7 + (nCount || 0) * 5;

      if (!cancelled) {
        setStats({
          streak,
          devotionals: dCount || 0,
          chapters: uniqChapters,
          notes: nCount || 0,
          reflections: filledReflections.length,
          points,
        });
        setTodayActions({
          completed: completedToday,
          reflectedToday,
          notesToday: 0, // computed below if needed
          readToday: readingDates.includes(today),
        });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const cards: Array<{
    label: string;
    value: number;
    icon: typeof Flame;
    color: string;
    target?: Tab;
  }> = [
    { label: "Sequência (dias)", value: stats.streak, icon: Flame, color: "text-orange-500", target: "today" },
    { label: "Devocionais", value: stats.devotionals, icon: Sparkles, color: "text-primary", target: "today" },
    { label: "Reflexões", value: stats.reflections, icon: NotebookPen, color: "text-violet-600", target: "today" },
    { label: "Capítulos lidos", value: stats.chapters, icon: BookOpen, color: "text-emerald-600", target: "bible" },
    { label: "Notas", value: stats.notes, icon: BookMarked, color: "text-amber-600", target: "notes" },
    { label: "Pontos totais", value: stats.points, icon: Sparkles, color: "text-primary" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const clickable = !!c.target;
          const Wrapper: React.ElementType = clickable ? "button" : "div";
          return (
            <Wrapper
              key={c.label}
              {...(clickable
                ? {
                    type: "button",
                    onClick: () => onNavigate(c.target as Tab),
                    "aria-label": `Ver detalhes de ${c.label}`,
                  }
                : {})}
              className={`card-elevated p-4 text-left ${clickable ? "cursor-pointer hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" : ""}`}
            >
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <div className="mt-2 text-2xl font-display font-semibold text-foreground">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
            </Wrapper>
          );
        })}
      </div>

      <div className="card-elevated p-4">
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">Hoje</h4>
        <ul className="space-y-2 text-sm">
          <li>
            <button
              type="button"
              onClick={() => onNavigate("today")}
              className="w-full flex items-center gap-2 text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              {todayActions.completed
                ? <Check className="h-4 w-4 text-emerald-600" />
                : <span className="h-4 w-4 rounded-full border border-border inline-block" />}
              <span className={todayActions.completed ? "text-foreground" : "text-muted-foreground"}>
                {todayActions.completed ? "Devocional concluído (+10 pts)" : "Devocional pendente"}
              </span>
            </button>
          </li>
          <li className="flex items-center gap-2">
            {todayActions.reflectedToday
              ? <Check className="h-4 w-4 text-emerald-600" />
              : <span className="h-4 w-4 rounded-full border border-border inline-block" />}
            <span className={todayActions.reflectedToday ? "text-foreground" : "text-muted-foreground"}>
              {todayActions.reflectedToday ? "Você escreveu uma reflexão hoje (+7 pts)" : "Sem reflexão hoje"}
            </span>
          </li>
          <li className="flex items-center gap-2">
            {todayActions.readToday
              ? <Check className="h-4 w-4 text-emerald-600" />
              : <span className="h-4 w-4 rounded-full border border-border inline-block" />}
            <span className={todayActions.readToday ? "text-foreground" : "text-muted-foreground"}>
              {todayActions.readToday ? "Leitura bíblica registrada" : "Sem leitura hoje"}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
