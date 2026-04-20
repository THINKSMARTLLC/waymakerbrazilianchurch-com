// Centralized date/time/timezone utilities.
// Policy:
//  - Fixed display timezone: America/New_York (NYC) for TIMESTAMPS (created_at, updated_at, completed_at...)
//  - Pure dates (YYYY-MM-DD with no time) are rendered as local-only — no TZ shift.
//  - Default display locale: en-US (system standard). Per-language overrides come via i18n.

import { format, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { enUS, ptBR, es } from "date-fns/locale";

export const APP_TIMEZONE = "America/New_York";

const LOCALES = { en: enUS, pt: ptBR, es } as const;
type Lang = keyof typeof LOCALES;

function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage?.getItem("i18nextLng") || "en";
  const base = stored.toLowerCase().split("-")[0];
  if (base === "pt" || base === "es") return base;
  return "en";
}

function uses24h(lang: Lang): boolean {
  return lang !== "en";
}

/** Format a TIMESTAMP (ISO string, Date, or null) in NYC TZ — date only (MM/DD/YYYY in EN). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (isNaN(date.getTime())) return "";
  const lang = getLang();
  const pattern = lang === "en" ? "MM/dd/yyyy" : "dd/MM/yyyy";
  return formatInTimeZone(date, APP_TIMEZONE, pattern, { locale: LOCALES[lang] });
}

/** Format a TIMESTAMP in NYC TZ — date + time (12h AM/PM in EN, 24h in PT/ES). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (isNaN(date.getTime())) return "";
  const lang = getLang();
  const pattern = lang === "en" ? "MM/dd/yyyy hh:mm a" : "dd/MM/yyyy HH:mm";
  return formatInTimeZone(date, APP_TIMEZONE, pattern, { locale: LOCALES[lang] });
}

/** Format a TIMESTAMP in NYC TZ — time only. */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (isNaN(date.getTime())) return "";
  const lang = getLang();
  const pattern = uses24h(lang) ? "HH:mm" : "hh:mm a";
  return formatInTimeZone(date, APP_TIMEZONE, pattern, { locale: LOCALES[lang] });
}

/**
 * Format a PURE DATE string ("YYYY-MM-DD" or Date) without any timezone shift.
 * Use for: birthdays, activity_date, payment_date, scheduled_date.
 */
export function formatLocalDateOnly(value: string | Date | null | undefined): string {
  if (!value) return "";
  let y: number, m: number, d: number;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    y = value.getFullYear();
    m = value.getMonth() + 1;
    d = value.getDate();
  }
  const lang = getLang();
  // Construct as local-noon Date to avoid any DST edge.
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const pattern = lang === "en" ? "MM/dd/yyyy" : "dd/MM/yyyy";
  return format(dt, pattern, { locale: LOCALES[lang] });
}

/** Convert any Date to a NYC zoned Date (useful for UI date pickers anchored to NYC). */
export function toNYC(date: Date): Date {
  return toZonedTime(date, APP_TIMEZONE);
}

/** Today's date in NYC as YYYY-MM-DD (for date input defaults). */
export function todayNYC(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}
