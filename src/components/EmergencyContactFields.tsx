import type { EmergencyContact } from "@/lib/emergencyContact";
import { RELATIONSHIP_OPTIONS } from "@/lib/emergencyContact";

interface Props {
  value: EmergencyContact;
  onChange: (next: EmergencyContact) => void;
  required?: boolean;
  /** Optional class for inputs/selects to match host form. */
  inputClassName?: string;
  labelClassName?: string;
}

const DEFAULT_INPUT =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const DEFAULT_LABEL = "block text-sm font-medium text-foreground mb-1.5";

export function EmergencyContactFields({
  value,
  onChange,
  required,
  inputClassName = DEFAULT_INPUT,
  labelClassName = DEFAULT_LABEL,
}: Props) {
  const set = <K extends keyof EmergencyContact>(k: K, v: EmergencyContact[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Nome do Contato {required && <span className="text-destructive">*</span>}</label>
          <input
            type="text"
            required={required}
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nome completo"
            className={inputClassName}
          />
        </div>
        <div>
          <label className={labelClassName}>Telefone do Contato {required && <span className="text-destructive">*</span>}</label>
          <input
            type="tel"
            required={required}
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="(11) 99999-9999"
            className={inputClassName}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Parentesco {required && <span className="text-destructive">*</span>}</label>
          <select
            required={required}
            value={value.relationship}
            onChange={(e) => set("relationship", e.target.value as EmergencyContact["relationship"])}
            className={inputClassName}
          >
            <option value="">Selecione...</option>
            {RELATIONSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {value.relationship === "other" && (
          <div>
            <label className={labelClassName}>Especifique</label>
            <input
              type="text"
              value={value.relationshipOther ?? ""}
              onChange={(e) => set("relationshipOther", e.target.value)}
              placeholder="Ex: Padrinho, Vizinho..."
              className={inputClassName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
