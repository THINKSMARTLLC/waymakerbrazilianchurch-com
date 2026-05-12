// Birthday helpers — all date math is done in local time to avoid TZ shifts.
import i18n from "i18next";

export interface BirthdayInfo {
  /** Days until next birthday (0 = today). */
  daysUntil: number;
  /** Date of the next occurrence (local). */
  nextDate: Date;
  /** Month/day formatted for display ("DD/MM"). */
  monthDay: string;
  /** Age the person will turn on next birthday. */
  turningAge: number | null;
}

/** Parse a YYYY-MM-DD date string as local-time (no UTC shift). */
function parseLocalYMD(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
}

export function getBirthdayInfo(dateOfBirth: string | null | undefined): BirthdayInfo | null {
  if (!dateOfBirth) return null;
  const dob = parseLocalYMD(dateOfBirth);
  if (!dob) return null;

  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const year = todayMid.getFullYear();

  let next = new Date(year, dob.getMonth(), dob.getDate());
  if (next < todayMid) next = new Date(year + 1, dob.getMonth(), dob.getDate());

  const msPerDay = 86_400_000;
  const daysUntil = Math.round((next.getTime() - todayMid.getTime()) / msPerDay);

  const turningAge = next.getFullYear() - dob.getFullYear();
  const monthDay = `${String(dob.getDate()).padStart(2, "0")}/${String(dob.getMonth() + 1).padStart(2, "0")}`;

  return { daysUntil, nextDate: next, monthDay, turningAge };
}

export type BirthdayWindow = "today" | "week" | "month";

export function isInWindow(info: BirthdayInfo, window: BirthdayWindow): boolean {
  if (window === "today") return info.daysUntil === 0;
  if (window === "week") return info.daysUntil >= 0 && info.daysUntil <= 7;
  return info.daysUntil >= 0 && info.daysUntil <= 30;
}

export function formatBirthdayLabel(info: BirthdayInfo): string {
  if (info.daysUntil === 0) return i18n.t("birthdays.today") + " 🎂";
  if (info.daysUntil === 1) return i18n.t("birthdays.tomorrow");
  if (info.daysUntil <= 7) return i18n.t("birthdays.in", { days: info.daysUntil });
  return info.nextDate.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}
