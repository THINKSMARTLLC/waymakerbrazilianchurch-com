// Format phone numbers for display while preserving the raw E.164 value in storage.
// US:    +1XXXXXXXXXX        -> (XXX) XXX-XXXX
// Brazil:+55XXXXXXXXXXX      -> +55 (XX) XXXXX-XXXX
// Other: returns input as-is (or with light spacing).
export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");

  // USA: +1 followed by 10 digits, OR a bare 10-digit US number
  if (trimmed.startsWith("+1") && digits.length === 11) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (!trimmed.startsWith("+") && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Brazil: +55 + 10 or 11 digits (DDD + number)
  if (trimmed.startsWith("+55")) {
    const d = digits.slice(2); // strip 55
    if (d.length === 11) {
      return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
  }

  // Fallback — return original
  return trimmed;
}
