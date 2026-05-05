// Phone numbers are standardized to US format: (XXX) XXX-XXXX

/** Strip everything but digits. */
export function digitsOnly(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Take any input, return up to 10 digits formatted as a US phone mask while typing. */
export function formatUSPhoneInput(raw: string | null | undefined): string {
  let d = digitsOnly(raw);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** True when value contains exactly 10 US digits. */
export function isValidUSPhone(raw: string | null | undefined): boolean {
  let d = digitsOnly(raw);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10;
}

/** Storage form: (XXX) XXX-XXXX when valid, else digits-only fallback. */
export function toUSPhoneStorage(raw: string | null | undefined): string {
  return isValidUSPhone(raw) ? formatUSPhoneInput(raw) : digitsOnly(raw);
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  // Always prefer US format when we have 10 digits (or 11 starting with 1).
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

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

  // Generic international: +CC followed by digits — group the rest in 4-4 chunks.
  if (trimmed.startsWith("+")) {
    const ccMatch = trimmed.match(/^(\+\d{1,3})(.*)$/);
    if (ccMatch) {
      const cc = ccMatch[1];
      const rest = ccMatch[2].replace(/\D/g, "");
      if (rest.length >= 8) {
        const ddd = rest.slice(0, 2);
        const mid = rest.slice(2, rest.length - 4);
        const last = rest.slice(-4);
        return `${cc} (${ddd}) ${mid}-${last}`;
      }
    }
  }

  // Fallback — return original
  return trimmed;
}
