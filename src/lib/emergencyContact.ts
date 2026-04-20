// Structured emergency contact stored as JSON inside the existing
// `members.emergency_contact` TEXT column. Backward compatible with legacy
// free-text values: when parsing fails, we surface the raw string as `name`.

export type EmergencyRelationship =
  | "mother"
  | "father"
  | "spouse"
  | "brother"
  | "sister"
  | "grandmother"
  | "grandfather"
  | "uncle"
  | "aunt"
  | "friend"
  | "other";

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: EmergencyRelationship | "";
  /** Free-text label when relationship === "other". */
  relationshipOther?: string;
}

export const RELATIONSHIP_OPTIONS: { value: EmergencyRelationship; label: string }[] = [
  { value: "mother", label: "Mãe" },
  { value: "father", label: "Pai" },
  { value: "spouse", label: "Cônjuge" },
  { value: "brother", label: "Irmão" },
  { value: "sister", label: "Irmã" },
  { value: "grandmother", label: "Avó" },
  { value: "grandfather", label: "Avô" },
  { value: "uncle", label: "Tio" },
  { value: "aunt", label: "Tia" },
  { value: "friend", label: "Amigo(a)" },
  { value: "other", label: "Outro" },
];

const RELATIONSHIP_LABEL: Record<EmergencyRelationship, string> = Object.fromEntries(
  RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label]),
) as Record<EmergencyRelationship, string>;

export function relationshipLabel(c: EmergencyContact): string {
  if (!c.relationship) return "";
  if (c.relationship === "other") return c.relationshipOther?.trim() || "Outro";
  return RELATIONSHIP_LABEL[c.relationship];
}

const EMPTY: EmergencyContact = { name: "", phone: "", relationship: "" };

/** Parse a stored value (JSON or legacy free-text) into structured form. */
export function parseEmergencyContact(raw: string | null | undefined): EmergencyContact {
  if (!raw) return { ...EMPTY };
  const trimmed = raw.trim();
  if (!trimmed) return { ...EMPTY };
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Partial<EmergencyContact>;
      return {
        name: typeof obj.name === "string" ? obj.name : "",
        phone: typeof obj.phone === "string" ? obj.phone : "",
        relationship: (obj.relationship as EmergencyContact["relationship"]) ?? "",
        relationshipOther: typeof obj.relationshipOther === "string" ? obj.relationshipOther : "",
      };
    } catch {
      // fallthrough to legacy
    }
  }
  // Legacy free-text — try to split "Name, phone" or "Name - phone"
  const phoneMatch = trimmed.match(/(\+?\d[\d\s().-]{6,})/);
  const phone = phoneMatch ? phoneMatch[1].trim() : "";
  const name = phone ? trimmed.replace(phone, "").replace(/[,\-–|]\s*$/, "").trim() : trimmed;
  return { name, phone, relationship: "" };
}

/** Serialize structured form to a JSON string for DB storage. Returns null if all empty. */
export function serializeEmergencyContact(c: EmergencyContact): string | null {
  const name = c.name.trim();
  const phone = c.phone.trim();
  const relationship = c.relationship;
  const relationshipOther = (c.relationshipOther ?? "").trim();
  if (!name && !phone && !relationship) return null;
  const payload: EmergencyContact = {
    name,
    phone,
    relationship,
    ...(relationship === "other" && relationshipOther ? { relationshipOther } : {}),
  };
  return JSON.stringify(payload);
}

/** True if the raw value looks like legacy free-text (no JSON structure). */
export function isLegacyEmergencyContact(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const t = raw.trim();
  if (!t) return false;
  if (!t.startsWith("{")) return true;
  try {
    JSON.parse(t);
    return false;
  } catch {
    return true;
  }
}
