import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getFallbackDevotional, dayOfYearFromISODate } from "@/lib/devotionalFallback";

function todayNYC(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const getOrGenerateTodayDevotional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { language: "pt" | "en" | "es" }) => input)
  .handler(async ({ data }) => {
    const date = todayNYC();
    const lang = data.language || "pt";

    // Debug (temporary): confirm same date + day-of-year for every user.
    console.log("[devotional] NY date:", date, "day-of-year:", dayOfYearFromISODate(date), "lang:", lang);

    // 1. Try to fetch today's devotional in requested language
    const { data: existing } = await supabaseAdmin
      .from("devotionals")
      .select("*")
      .eq("devotional_date", date)
      .eq("language", lang)
      .maybeSingle();

    if (existing) {
      console.log("[devotional] loaded from DB id:", existing.id);
      return { devotional: existing };
    }

    // 2. Generate via Lovable AI
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // No AI available — try any language for today, then deterministic fallback.
      const { data: anyLang } = await supabaseAdmin
        .from("devotionals")
        .select("*")
        .eq("devotional_date", date)
        .limit(1)
        .maybeSingle();
      if (anyLang) return { devotional: anyLang };
      return { devotional: getFallbackDevotional(date, lang) };
    }

    const langName = lang === "pt" ? "Portuguese (Brazilian)" : lang === "es" ? "Spanish" : "English";

    const systemPrompt = `You are a pastor writing a daily devotional in ${langName}. Generate uplifting, biblically-grounded content. Always respond using the provided tool.`;
    const userPrompt = `Generate today's devotional for ${date}. Pick a meaningful Bible passage. Provide:
- A short inspiring title
- A specific bible reference (book chapter:verse, e.g. "John 3:16")
- A reflection (2-3 sentences)
- A practical application (1-2 sentences)
- A short prayer (2-3 sentences)
All in ${langName}.`;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_devotional",
                description: "Create today's devotional",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    bible_reference: { type: "string", description: "Format: 'Book Chapter:Verse', e.g. 'John 3:16'" },
                    reflection: { type: "string" },
                    application: { type: "string" },
                    prayer: { type: "string" },
                  },
                  required: ["title", "bible_reference", "reflection", "application", "prayer"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_devotional" } },
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        console.error("AI gateway error", response.status, txt);
        return { devotional: getFallbackDevotional(date, lang) };
      }

      const ai = await response.json();
      const toolCall = ai?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return { devotional: getFallbackDevotional(date, lang) };

      const args = JSON.parse(toolCall.function.arguments);

      // 3. Fetch verse text from bible-api.com
      let verseText: string | null = null;
      try {
        const translation = lang === "pt" ? "almeida" : lang === "es" ? "rvr" : "web";
        const verseRes = await fetch(
          `https://bible-api.com/${encodeURIComponent(args.bible_reference)}?translation=${translation}`,
        );
        if (verseRes.ok) {
          const v = await verseRes.json();
          verseText = v.text?.trim() || null;
        }
      } catch (e) {
        console.error("verse fetch failed", e);
      }

      // 4. Persist
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("devotionals")
        .insert({
          devotional_date: date,
          title: args.title,
          bible_reference: args.bible_reference,
          verse_text: verseText,
          reflection: args.reflection,
          application: args.application,
          prayer: args.prayer,
          language: lang,
        })
        .select()
        .single();

      if (insErr) {
        // Likely a race — fetch again
        const { data: retry } = await supabaseAdmin
          .from("devotionals")
          .select("*")
          .eq("devotional_date", date)
          .eq("language", lang)
          .maybeSingle();
        return { devotional: retry ?? getFallbackDevotional(date, lang) };
      }

      return { devotional: inserted };
    } catch (e) {
      console.error("generate devotional failed", e);
      return { devotional: getFallbackDevotional(date, lang) };
    }
  });

