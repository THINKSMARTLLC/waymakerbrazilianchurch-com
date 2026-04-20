import type { Database } from "@/integrations/supabase/types";

export type ActivityType = Database["public"]["Enums"]["activity_type"];
export type ActivitySource = Database["public"]["Enums"]["activity_source"];

export const ACTIVITY_POINTS: Record<ActivityType, number> = {
  attendance: 1,
  cell_group: 2,
  visit_scheduled: 3,
  leadership_contact: 2,
};

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  attendance: "Presença no Culto",
  cell_group: "Célula / Pequeno Grupo",
  visit_scheduled: "Visita",
  leadership_contact: "Contato com Liderança",
};

export const ACTIVITY_ICON: Record<ActivityType, string> = {
  attendance: "🙏",
  cell_group: "🤝",
  visit_scheduled: "🏠",
  leadership_contact: "💬",
};

export interface JourneyMilestone {
  points: number;
  label: string;
  message: string;
}

export const MILESTONES: JourneyMilestone[] = [
  { points: 0, label: "Início", message: "Sua jornada começa aqui." },
  { points: 10, label: "Primeiros Passos", message: "Você está dando os primeiros passos." },
  { points: 25, label: "Caminhando", message: "Você está crescendo na sua jornada." },
  { points: 50, label: "Fortalecido", message: "A consistência está construindo algo bonito." },
  { points: 100, label: "Enraizado", message: "Suas raízes estão profundas." },
  { points: 200, label: "Frutífero", message: "Sua presença faz diferença." },
  { points: 500, label: "Inspiração", message: "Você inspira outros a caminharem." },
];

export const MOTIVATIONAL_MESSAGES = [
  "Você está crescendo na sua jornada",
  "Consistência importa",
  "Continue caminhando no seu propósito",
  "Cada passo conta",
  "Sua presença é uma bênção",
  "O caminho se constrói caminhando",
];

export function calculatePoints(
  activities: Array<{ activity_type: ActivityType }>,
): number {
  return activities.reduce((sum, a) => sum + (ACTIVITY_POINTS[a.activity_type] ?? 0), 0);
}

export function getCurrentMilestone(points: number): {
  current: JourneyMilestone;
  next: JourneyMilestone | null;
  progressToNext: number;
} {
  let current = MILESTONES[0];
  let next: JourneyMilestone | null = MILESTONES[1] ?? null;
  for (let i = 0; i < MILESTONES.length; i++) {
    if (points >= MILESTONES[i].points) {
      current = MILESTONES[i];
      next = MILESTONES[i + 1] ?? null;
    }
  }
  const progressToNext = next
    ? Math.min(1, (points - current.points) / (next.points - current.points))
    : 1;
  return { current, next, progressToNext };
}

export function getRandomMessage(seed?: number): string {
  const idx = (seed ?? Math.floor(Date.now() / (1000 * 60 * 60 * 24))) % MOTIVATIONAL_MESSAGES.length;
  return MOTIVATIONAL_MESSAGES[idx];
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Parse a YYYY-MM-DD string as a LOCAL date (no timezone shift).
 * Plain `new Date("2026-04-20")` is interpreted as UTC midnight, which can
 * shift the displayed day by -1 in negative-UTC timezones. Use this everywhere
 * we read an `activity_date` (a date column) for display or arithmetic.
 */
export function parseLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a YYYY-MM-DD date string for display in pt-BR without timezone shift. */
export function formatLocalDate(value: string | Date | null | undefined): string {
  const d = parseLocalDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysSince(date: string | Date | null): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  if (!d) return null;
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

export interface EngagementLevel {
  level: "high" | "medium" | "low" | "inactive";
  label: string;
  className: string;
}

export function computeEngagementLevel(
  lastActivityDate: string | null,
  inactivityDays = 30,
): EngagementLevel {
  const days = daysSince(lastActivityDate);
  if (days === null) {
    return { level: "inactive", label: "Sem atividade", className: "bg-muted text-muted-foreground" };
  }
  if (days <= 7) return { level: "high", label: "Alto", className: "bg-success/15 text-success" };
  if (days <= 14) return { level: "medium", label: "Médio", className: "bg-warning/20 text-warning-foreground" };
  if (days <= inactivityDays) return { level: "low", label: "Baixo", className: "bg-warning/15 text-warning-foreground" };
  return { level: "inactive", label: "Inativo", className: "bg-destructive/15 text-destructive" };
}
