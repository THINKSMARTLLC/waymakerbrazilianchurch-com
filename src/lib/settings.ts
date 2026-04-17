// System-wide configuration values.
// These are intentionally exported as constants so they can later be moved
// into a Settings table / admin panel without touching consumer code.

export const WEEKLY_TARGET_AMOUNT_PER_PERSON = 20;
export const WEEKLY_TARGET_NUMBER_OF_PEOPLE = 80;

export function getWeeklyExpectedTarget(): number {
  return WEEKLY_TARGET_AMOUNT_PER_PERSON * WEEKLY_TARGET_NUMBER_OF_PEOPLE;
}
