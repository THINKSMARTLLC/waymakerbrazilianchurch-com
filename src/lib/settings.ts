// System-wide configuration values.
// These are intentionally exported as constants so they can later be moved
// into a Settings table / admin panel without touching consumer code.

export const WEEKLY_TARGET_AMOUNT_PER_PERSON = 20;
export const WEEKLY_TARGET_NUMBER_OF_PEOPLE = 80;

export function getWeeklyExpectedTarget(): number {
  return WEEKLY_TARGET_AMOUNT_PER_PERSON * WEEKLY_TARGET_NUMBER_OF_PEOPLE;
}

/**
 * Number of service weeks in a given month/year.
 * Counts Sundays in the month (typical weekly-service cadence), so months with
 * 5 Sundays return 5 and months with 4 return 4.
 *  - month: 1-12
 */
export function getWeeksInMonth(month: number, year: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let sundays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month - 1, day).getDay() === 0) sundays++;
  }
  return sundays;
}

/**
 * Dynamic monthly expectation: weekly_amount * weeks_in_month.
 * Never store a fixed monthly_amount — always derive from the weekly amount
 * and the actual number of weeks in the target month.
 *  - month: 1-12 (defaults to current month)
 *  - year:  defaults to current year
 */
export function calculateExpectedMonthlyAmount(
  weeklyAmount: number,
  month?: number,
  year?: number,
): number {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  return Number(weeklyAmount) * getWeeksInMonth(m, y);
}

