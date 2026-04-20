import { useState, useMemo } from "react";
import { X, FileSpreadsheet, AlertTriangle, CheckCircle2, Users, Loader2, Upload } from "lucide-react";
import {
  parseImportFile,
  classifyImportRows,
  executeImport,
  type ParsedImportRow,
  type ImportClassification,
  type ImportDecision,
  type ImportResult,
} from "@/lib/dataExportImport";
import { logActivity } from "@/lib/activityLog";

type Stage = "select" | "parsing" | "preview" | "importing" | "done";
type DupAction = "skip" | "update";

interface DuplicateRow extends ParsedImportRow {
  matchedMemberId: string;
  matchedName: string;
  matchedBy: ("email" | "phone")[];
}

interface ImportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

export function ImportPreviewModal({ open, onClose, onImported }: ImportPreviewModalProps) {
  const [stage, setStage] = useState<Stage>("select");
  const [fileName, setFileName] = useState("");
  const [classification, setClassification] = useState<ImportClassification | null>(null);
  const [dupActions, setDupActions] = useState<Record<number, DupAction>>({});
  const [skipNew, setSkipNew] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStage("select");
    setFileName("");
    setClassification(null);
    setDupActions({});
    setSkipNew({});
    setResult(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    setStage("parsing");
    try {
      const parsed = await parseImportFile(file);
      if (parsed.length === 0) {
        setError("File is empty or has no recognizable rows.");
        setStage("select");
        return;
      }
      const cls = await classifyImportRows(parsed);
      setClassification(cls);
      // Default actions: skip duplicates, import new
      const da: Record<number, DupAction> = {};
      for (const d of cls.duplicateRows) da[d.rowIndex] = "skip";
      setDupActions(da);
      setSkipNew({});
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
      setStage("select");
    }
  };

  const decisions = useMemo<ImportDecision[]>(() => {
    if (!classification) return [];
    const out: ImportDecision[] = [];
    for (const r of classification.newRows) {
      out.push({ row: r, action: skipNew[r.rowIndex] ? "skip" : "create" });
    }
    for (const d of classification.duplicateRows) {
      const action = dupActions[d.rowIndex] ?? "skip";
      out.push({ row: d, action, updateMemberId: action === "update" ? d.matchedMemberId : undefined });
    }
    return out;
  }, [classification, dupActions, skipNew]);

  const counts = useMemo(() => {
    const willCreate = decisions.filter((d) => d.action === "create").length;
    const willUpdate = decisions.filter((d) => d.action === "update").length;
    const willSkip = decisions.filter((d) => d.action === "skip").length + (classification?.invalidRows.length ?? 0);
    return { willCreate, willUpdate, willSkip };
  }, [decisions, classification]);

  const runImport = async () => {
    if (!classification) return;
    setStage("importing");
    const r = await executeImport(decisions);
    setResult(r);
    await logActivity("members_imported", {
      file: fileName,
      created: r.created,
      updated: r.updated,
      skipped: r.skipped,
      failed: r.failed.length,
    });
    setStage("done");
    onImported?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-card rounded-2xl shadow-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Import Members</h2>
              <p className="text-xs text-muted-foreground">Upload CSV or Excel — preview before saving</p>
            </div>
          </div>
          <button onClick={close} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {stage === "select" && (
            <SelectStage onFile={onFile} error={error} />
          )}
          {stage === "parsing" && (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3 text-primary" />
              <p>Reading and checking duplicates…</p>
            </div>
          )}
          {stage === "preview" && classification && (
            <PreviewStage
              fileName={fileName}
              classification={classification}
              dupActions={dupActions}
              setDupActions={setDupActions}
              skipNew={skipNew}
              setSkipNew={setSkipNew}
            />
          )}
          {stage === "importing" && (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3 text-primary" />
              <p>Importing members…</p>
            </div>
          )}
          {stage === "done" && result && (
            <DoneStage result={result} />
          )}
        </div>

        {stage === "preview" && (
          <div className="border-t border-border px-5 py-4 flex items-center justify-between gap-3 bg-muted/30">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{counts.willCreate}</span> create ·
              {" "}<span className="font-medium text-foreground">{counts.willUpdate}</span> update ·
              {" "}<span className="font-medium text-foreground">{counts.willSkip}</span> skip
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="px-4 py-2 rounded-xl border border-input bg-background hover:bg-muted text-sm">
                Cancel
              </button>
              <button
                onClick={runImport}
                disabled={counts.willCreate + counts.willUpdate === 0}
                className="btn-google disabled:opacity-50 disabled:pointer-events-none"
              >
                Confirm Import
              </button>
            </div>
          </div>
        )}
        {stage === "done" && (
          <div className="border-t border-border px-5 py-4 flex justify-end gap-2 bg-muted/30">
            <button onClick={reset} className="px-4 py-2 rounded-xl border border-input bg-background hover:bg-muted text-sm">
              Import Another
            </button>
            <button onClick={close} className="btn-google">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SelectStage({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div>
      <label className="block border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
        <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium text-foreground mb-1">Click to choose a file</p>
        <p className="text-xs text-muted-foreground">CSV, XLSX or XLS — exported from your phone, Google Contacts, Excel, etc.</p>
        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handle} />
      </label>
      <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm">
        <p className="font-medium mb-2">Recognized columns (case-insensitive):</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>• <strong className="text-foreground">Name</strong> — name, full name, nome</li>
          <li>• <strong className="text-foreground">Email</strong> — email, e-mail, mail</li>
          <li>• <strong className="text-foreground">Phone</strong> — phone, telefone, celular, mobile</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Each row needs at least an email or phone, plus a name.</p>
      </div>
      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

function PreviewStage({
  fileName,
  classification,
  dupActions,
  setDupActions,
  skipNew,
  setSkipNew,
}: {
  fileName: string;
  classification: ImportClassification;
  dupActions: Record<number, DupAction>;
  setDupActions: (v: Record<number, DupAction>) => void;
  skipNew: Record<number, boolean>;
  setSkipNew: (v: Record<number, boolean>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="text-sm text-muted-foreground">
        File: <span className="text-foreground font-medium">{fileName}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryTile color="primary" icon={<Users className="h-4 w-4" />} label="New" count={classification.newRows.length} />
        <SummaryTile color="amber" icon={<AlertTriangle className="h-4 w-4" />} label="Duplicates" count={classification.duplicateRows.length} />
        <SummaryTile color="destructive" icon={<X className="h-4 w-4" />} label="Invalid" count={classification.invalidRows.length} />
      </div>

      {classification.duplicateRows.length > 0 && (
        <Section title="Duplicates — choose action per row">
          <div className="space-y-2">
            {classification.duplicateRows.map((r) => (
              <div key={r.rowIndex} className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.name || <em className="text-muted-foreground">(no name)</em>}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.email || "—"} · {r.phone || "—"}
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Matches existing member: <strong>{r.matchedName}</strong> (by {r.matchedBy.join(" + ")})
                  </div>
                </div>
                <select
                  value={dupActions[r.rowIndex] ?? "skip"}
                  onChange={(e) => setDupActions({ ...dupActions, [r.rowIndex]: e.target.value as DupAction })}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                >
                  <option value="skip">Skip</option>
                  <option value="update">Update existing</option>
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      {classification.newRows.length > 0 && (
        <Section title={`New members (${classification.newRows.length})`}>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 w-12">Skip</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                {classification.newRows.map((r) => (
                  <tr key={r.rowIndex} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(skipNew[r.rowIndex])}
                        onChange={(e) => setSkipNew({ ...skipNew, [r.rowIndex]: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {classification.invalidRows.length > 0 && (
        <Section title={`Invalid rows (${classification.invalidRows.length}) — will be skipped`}>
          <div className="space-y-2">
            {classification.invalidRows.map((r) => (
              <div key={r.rowIndex} className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm">
                <span className="text-muted-foreground">Row {r.rowIndex}: </span>
                <span className="font-medium">{r.name || "(no name)"}</span>
                <span className="text-destructive"> — {r.errors.join(", ")}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function DoneStage({ result }: { result: ImportResult }) {
  return (
    <div className="py-8 text-center">
      <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
      <h3 className="font-display text-xl font-semibold mb-1">Import complete</h3>
      <p className="text-sm text-muted-foreground mb-6">Your member list has been updated.</p>
      <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
        <Stat label="Created" value={result.created} tone="primary" />
        <Stat label="Updated" value={result.updated} tone="primary" />
        <Stat label="Skipped" value={result.skipped} tone="muted" />
      </div>
      {result.failed.length > 0 && (
        <div className="mt-4 max-w-md mx-auto rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm">
          <p className="font-medium text-destructive mb-2">{result.failed.length} failed:</p>
          <ul className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
            {result.failed.map((f, i) => (
              <li key={i}>{f.row.name || "(no name)"} — {f.error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function SummaryTile({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: "primary" | "amber" | "destructive" }) {
  const cls = color === "primary"
    ? "bg-primary/10 text-primary border-primary/20"
    : color === "amber"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/40"
    : "bg-destructive/10 text-destructive border-destructive/20";
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="flex items-center gap-2 text-xs uppercase font-medium opacity-80">{icon}{label}</div>
      <div className="text-2xl font-display font-semibold mt-1">{count}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "muted" }) {
  return (
    <div className={`rounded-xl border border-border p-3 ${tone === "primary" ? "bg-primary/5" : "bg-muted/40"}`}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-display font-semibold">{value}</div>
    </div>
  );
}
