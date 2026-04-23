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
      { title: "Bíblia & Devocional — WAY MAKER FLOW" },
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

type Tab = "today" | "bible" | "notes" | "progress";
type Translation = "web" | "kjv" | "almeida";

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

function BiblePage() {
  const { i18n } = useTranslation();
  const member = useCurrentMember();
  const [tab, setTab] = useState<Tab>("today");

  const lang = (i18n.language?.split("-")[0] || "pt") as "pt" | "en" | "es";

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

      {tab === "today" && <TodayDevotional memberId={member?.id ?? null} lang={lang} />}
      {tab === "bible" && <BibleReader memberId={member?.id ?? null} />}
      {tab === "notes" && <MyNotes memberId={member?.id ?? null} />}
      {tab === "progress" && <Progress memberId={member?.id ?? null} />}
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
function TodayDevotional({ memberId, lang }: { memberId: string | null; lang: "pt" | "en" | "es" }) {
  const [dev, setDev] = useState<Devotional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);
  const [readToday, setReadToday] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { devotional, error: e } = await getOrGenerateTodayDevotional({ data: { language: lang } });
        if (cancelled) return;
        if (e) setError(e);
        setDev(devotional ?? null);

        if (devotional && memberId) {
          const { data: comp } = await supabase
            .from("devotional_completions")
            .select("id")
            .eq("member_id", memberId)
            .eq("devotional_id", devotional.id)
            .maybeSingle();
          if (!cancelled) setCompleted(!!comp);
        }

        if (memberId) {
          const today = todayNYC();
          const { data: r } = await supabase
            .from("bible_readings")
            .select("id")
            .eq("member_id", memberId)
            .eq("read_date", today)
            .limit(1);
          if (!cancelled) setReadToday(!!r && r.length > 0);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Não foi possível carregar o devocional");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang, memberId]);

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
      {readToday === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-200">
          📖 Você ainda não leu hoje. Que tal abrir a Bíblia agora?
        </div>
      )}

      <article className="card-elevated p-6 md:p-8 space-y-5">
        <div>
          <div className="text-xs font-medium text-primary uppercase tracking-wider">📅 Devocional de Hoje</div>
          <h3 className="font-display text-2xl md:text-3xl font-semibold text-foreground mt-1 leading-tight">{dev.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{dev.bible_reference}</p>
        </div>

        {dev.verse_text && (
          <blockquote className="border-l-4 border-primary pl-4 py-2 text-foreground italic leading-relaxed">
            "{dev.verse_text}"
          </blockquote>
        )}

        <Section title="Reflexão" body={dev.reflection} />
        <Section title="Aplicação" body={dev.application} />
        <Section title="Oração" body={dev.prayer} />

        <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
          <a
            href={`https://www.bible.com/bible/search/search?q=${encodeURIComponent(dev.bible_reference)}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <BookOpen className="h-4 w-4" /> Ler Versículo
          </a>
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

// ============== BIBLE READER ==============
function BibleReader({ memberId }: { memberId: string | null }) {
  const [book, setBook] = useState<string>("John");
  const [chapter, setChapter] = useState<number>(3);
  const [translation, setTranslation] = useState<Translation>("almeida");
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [notesMap, setNotesMap] = useState<Map<number, BibleNote>>(new Map());
  const [openVerse, setOpenVerse] = useState<number | null>(null);

  const currentBook = BIBLE_BOOKS.find((b) => b.name === book) ?? BIBLE_BOOKS[42];

  // Load chapter
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ref = `${book} ${chapter}`;
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${translation}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (!cancelled) setVerses(json.verses || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("Não foi possível carregar o capítulo");
          setVerses([]);
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
              return (
                <div key={v.verse}>
                  <button
                    onClick={() => setOpenVerse(isOpen ? null : v.verse)}
                    className={`w-full text-left rounded-md p-2 transition-colors ${
                      hasNote ? "bg-amber-50 dark:bg-amber-950/20 border-l-2 border-amber-400" : "hover:bg-muted"
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
          {filtered.map((n) => (
            <div key={n.id} className="card-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-primary">{n.book} {n.chapter}:{n.verse}</span>
                <span className="text-xs text-muted-foreground">
                  {n.share_with_pastor ? <Share2 className="inline h-3 w-3 mr-1" /> : <Lock className="inline h-3 w-3 mr-1" />}
                  {new Date(n.updated_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{n.note_text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== PROGRESS ==============
function Progress({ memberId }: { memberId: string | null }) {
  const [stats, setStats] = useState({ streak: 0, devotionals: 0, chapters: 0, notes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [{ count: dCount }, { count: nCount }, { data: readings }] = await Promise.all([
        supabase.from("devotional_completions").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        supabase.from("bible_notes").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        supabase.from("bible_readings").select("read_date").eq("member_id", memberId).order("read_date", { ascending: false }),
      ]);
      if (cancelled) return;

      const uniqueDates = Array.from(new Set((readings || []).map((r) => r.read_date as string))).sort().reverse();
      // Compute streak
      let streak = 0;
      const today = todayNYC();
      const yest = (() => {
        const d = new Date(today + "T12:00:00");
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      let cursor = uniqueDates[0] === today ? today : (uniqueDates[0] === yest ? yest : null);
      if (cursor) {
        const set = new Set(uniqueDates);
        const start = new Date(cursor + "T12:00:00");
        for (let i = 0; i < uniqueDates.length + 365; i++) {
          const key = start.toISOString().slice(0, 10);
          if (set.has(key)) { streak++; start.setDate(start.getDate() - 1); }
          else break;
        }
      }

      const chapters = new Set((readings || []).map((r) => r.read_date)).size; // unique reading days
      // Better: count unique book+chapter from a fresh query
      const { data: ch } = await supabase
        .from("bible_readings")
        .select("book, chapter")
        .eq("member_id", memberId);
      const uniqChapters = new Set((ch || []).map((r) => `${r.book}-${r.chapter}`)).size;

      if (!cancelled) {
        setStats({ streak, devotionals: dCount || 0, chapters: uniqChapters || chapters, notes: nCount || 0 });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const cards = [
    { label: "Sequência (dias)", value: stats.streak, icon: Flame, color: "text-orange-500" },
    { label: "Devocionais", value: stats.devotionals, icon: Sparkles, color: "text-primary" },
    { label: "Capítulos lidos", value: stats.chapters, icon: BookOpen, color: "text-emerald-600" },
    { label: "Notas", value: stats.notes, icon: NotebookPen, color: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="card-elevated p-4">
          <c.icon className={`h-5 w-5 ${c.color}`} />
          <div className="mt-2 text-2xl font-display font-semibold text-foreground">{c.value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
