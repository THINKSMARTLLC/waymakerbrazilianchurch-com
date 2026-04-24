import { createFileRoute } from "@tanstack/react-router";

const BOOK_ALIASES: Record<string, string> = {
  "genesis": "genesis", "gênesis": "genesis", "exodo": "exodus", "êxodo": "exodus",
  "levitico": "leviticus", "levítico": "leviticus", "numeros": "numbers", "números": "numbers",
  "deuteronomio": "deuteronomy", "josue": "joshua", "josué": "joshua",
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

function toApiBook(name: string): string {
  const key = stripAccents(name).toLowerCase().trim();
  const mapped = BOOK_ALIASES[key] ?? key;
  return mapped.replace(/\s+/g, "+");
}

const FALLBACK = {
  reference: "John 3:16",
  verses: [
    {
      verse: 16,
      text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
    },
  ],
  fallback: true,
};

async function fetchWithRetry(apiBook: string, chapter: string, translation?: string): Promise<any | null> {
  const base = `https://bible-api.com/${apiBook}+${chapter}`;
  const primary = translation ? `${base}?translation=${encodeURIComponent(translation)}` : base;
  const delays = [0, 400, 1200];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt] + Math.floor(Math.random() * 200)));
    }
    for (const url of [primary, base]) {
      try {
        console.log(`[api/bible] attempt ${attempt + 1} GET`, url);
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[api/bible] non-ok ${res.status}`, url);
          continue;
        }
        const json = await res.json();
        if (json?.verses?.length) return json;
      } catch (err) {
        console.warn("[api/bible] fetch threw", err);
      }
    }
  }
  return null;
}

export const Route = createFileRoute("/api/bible")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const book = url.searchParams.get("book") || "";
        const chapter = url.searchParams.get("chapter") || "";
        const translation = url.searchParams.get("translation") || undefined;

        console.log("[api/bible] request", { book, chapter, translation });

        if (!book || !chapter) {
          return Response.json(
            { ...FALLBACK, error: "Missing book or chapter" },
            { status: 200 }
          );
        }

        const apiBook = toApiBook(book);
        const json = await fetchWithRetry(apiBook, chapter, translation);

        if (!json) {
          console.warn("[api/bible] all attempts failed → fallback John 3:16");
          return Response.json(FALLBACK, { status: 200 });
        }

        const verses = (json.verses || []).map((v: any) => ({
          verse: v.verse,
          text: v.text,
        }));

        console.log(`[api/bible] success ${verses.length} verses for ${apiBook}+${chapter}`);

        return Response.json(
          {
            reference: json.reference,
            translation_id: json.translation_id,
            translation_name: json.translation_name,
            verses,
          },
          {
            status: 200,
            headers: { "Cache-Control": "public, max-age=3600" },
          }
        );
      },
    },
  },
});
