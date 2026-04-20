import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { createManagedUser, generateRecoveryForEmail } from "@/lib/adminUsers.functions";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** When true, restrict role choice to 'member' (used from Members page). */
  memberOnly?: boolean;
  /** Allow super_admin to create staff/admin roles. */
  canAssignStaff?: boolean;
  /** Pre-filled values when creating a login for an existing member context */
  initial?: {
    full_name?: string;
    email?: string;
    phone?: string;
  };
}

interface CreatedCredentials {
  email: string;
  tempPassword: string;
  recoveryLink: string | null;
}

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  church_admin: "Admin Igreja",
  admin: "Admin",
  finance_manager: "Staff (Tesoureiro/Pastor)",
  member: "Membro",
};

export function CreateUserModal({
  open,
  onClose,
  onCreated,
  memberOnly = false,
  canAssignStaff = false,
  initial,
}: Props) {
  const createUser = useServerFn(createManagedUser);
  const sendRecovery = useServerFn(generateRecoveryForEmail);

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [role, setRole] = useState<AppRole>(memberOnly ? "member" : "finance_manager");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
  const [duplicateRecovery, setDuplicateRecovery] = useState<{ link: string | null; email: string } | null>(null);

  if (!open) return null;

  const reset = () => {
    setFullName(initial?.full_name ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setRole(memberOnly ? "member" : "finance_manager");
    setError(null);
    setCredentials(null);
    setDuplicateRecovery(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await createUser({
        data: {
          full_name: fullName,
          email,
          phone: phone || null,
          role,
        },
      });
      if (!res.ok) {
        if (res.reason === "email_exists") {
          setDuplicateRecovery({ link: res.recoveryLink, email });
        } else {
          setError("Falha ao criar conta");
        }
        return;
      }
      setCredentials({
        email: res.email,
        tempPassword: res.tempPassword,
        recoveryLink: res.recoveryLink,
      });
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendRecovery = async () => {
    if (!duplicateRecovery) return;
    setSubmitting(true);
    try {
      const res = await sendRecovery({ data: { email: duplicateRecovery.email } });
      setDuplicateRecovery({ ...duplicateRecovery, link: res.recoveryLink });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">
            {credentials ? "Conta criada" : memberOnly ? "Criar login para membro" : "Criar nova conta"}
          </h2>
          <button onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {credentials ? (
          <CredentialsView credentials={credentials} onClose={close} />
        ) : duplicateRecovery ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-900 dark:text-amber-200">
                <p className="font-medium">Este email já está cadastrado</p>
                <p className="text-xs mt-1 opacity-80">
                  Você pode enviar um link de recuperação para que a pessoa defina uma nova senha.
                </p>
              </div>
            </div>
            {duplicateRecovery.link ? (
              <CopyField label="Link de recuperação de senha" value={duplicateRecovery.link} />
            ) : (
              <button
                onClick={handleResendRecovery}
                disabled={submitting}
                className="btn-google w-full disabled:opacity-50"
              >
                {submitting ? "Gerando..." : "Gerar link de recuperação"}
              </button>
            )}
            <button
              onClick={() => {
                setDuplicateRecovery(null);
                setError(null);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Voltar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
            )}

            <Field label="Nome completo" required>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                placeholder="Nome da pessoa"
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="email@exemplo.com"
              />
            </Field>

            <Field label="Telefone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                placeholder="(opcional)"
              />
            </Field>

            {!memberOnly && (
              <Field label="Função" required>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                  className="form-input"
                  required
                >
                  <option value="member">{ROLE_LABEL.member}</option>
                  {canAssignStaff && (
                    <>
                      <option value="finance_manager">{ROLE_LABEL.finance_manager}</option>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                      <option value="church_admin">{ROLE_LABEL.church_admin}</option>
                    </>
                  )}
                </select>
                {!canAssignStaff && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas Super Admin pode criar contas Staff/Admin.
                  </p>
                )}
              </Field>
            )}

            <div className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Como funciona:</strong> uma senha temporária será gerada e
              um link de recuperação será mostrado na próxima tela. Copie e envie ao novo usuário —
              no primeiro login ele será obrigado a definir uma nova senha.
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={close} className="flex-1 px-4 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-muted">
                Cancelar
              </button>
              <button type="submit" disabled={submitting} className="btn-google flex-1 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Criando..." : "Criar conta"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CredentialsView({ credentials, onClose }: { credentials: CreatedCredentials; onClose: () => void }) {
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-foreground">
        <p className="font-medium">Conta criada com sucesso!</p>
        <p className="text-xs text-muted-foreground mt-1">
          Copie as credenciais abaixo e envie ao novo usuário. Após o primeiro login, ele será obrigado a
          trocar a senha.
        </p>
      </div>

      <CopyField label="Email de login" value={credentials.email} />
      <CopyField label="Senha temporária" value={credentials.tempPassword} mono />
      {credentials.recoveryLink && (
        <CopyField label="Link de recuperação (alternativa)" value={credentials.recoveryLink} />
      )}

      <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
        <strong>Importante:</strong> esta senha não será mostrada novamente. Salve agora.
      </div>

      <button onClick={onClose} className="btn-google w-full">
        Concluir
      </button>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          className={`flex-1 rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}
        />
        <button
          type="button"
          onClick={copy}
          className="px-3 rounded-xl border border-input bg-background hover:bg-muted text-sm inline-flex items-center gap-1.5"
        >
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
