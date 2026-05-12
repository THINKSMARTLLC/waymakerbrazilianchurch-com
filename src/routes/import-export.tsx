import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Database as DatabaseIcon, Download, Upload, Archive, Shield, ArrowLeft, Loader2, Users, Receipt, FileSpreadsheet } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  exportMembersCSV,
  exportMembersXLSX,
  exportPaymentsCSV,
  exportPaymentsXLSX,
  exportFullBackup,
} from "@/lib/dataExportImport";
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
import { logActivity } from "@/lib/activityLog";

export const Route = createFileRoute("/import-export")({
  head: () => ({ meta: [{ title: "Import & Export Data — Way Maker Church" }] }),
  component: AdminDataPage,
});

type Action =
  | "members_csv" | "members_xlsx"
  | "payments_csv" | "payments_xlsx"
  | "backup";

function AdminDataPage() {
  const { t } = useTranslation();
  const { isSuperAdmin, loading } = useUserRole();
  const [busy, setBusy] = useState<Action | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  if (loading) return <div className="p-8 text-muted-foreground">{t("common.loading")}</div>;
  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold mb-2">{t("admin.restrictedTitle")}</h2>
        <p className="text-muted-foreground mb-4">{t("importExport.restricted")}</p>
        <Link to="/admin" className="btn-google inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
      </div>
    );
  }

  const run = async (action: Action, fn: () => Promise<number | { members: number; payments: number; contributions: number; subscriptions: number; profiles: number }>) => {
    setBusy(action);
    setLastMessage(null);
    try {
      const r = await fn();
      if (typeof r === "number") {
        setLastMessage(t("importExport.exportedRecords", { count: r }));
      } else {
        setLastMessage(t("importExport.backupReady", r));
      }
      await logActivity("data_exported", { action });
    } catch (e) {
      setLastMessage(e instanceof Error ? e.message : t("importExport.exportFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <DatabaseIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold font-display">{t("importExport.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("importExport.pageSubtitle")}</p>
        </div>
        <Link to="/admin" className="px-3 py-2 rounded-xl border border-input bg-background hover:bg-muted text-sm inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
      </div>

      {lastMessage && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {lastMessage}
        </div>
      )}

      <Card title={t("importExport.exportTitle")} icon={<Users className="h-5 w-5 text-primary" />} description={t("importExport.exportDescription")}>
        <div className="flex flex-wrap gap-2">
          <ExportBtn label="CSV" busy={busy === "members_csv"} onClick={() => run("members_csv", exportMembersCSV)} />
          <ExportBtn label="Excel (.xlsx)" busy={busy === "members_xlsx"} onClick={() => run("members_xlsx", exportMembersXLSX)} />
        </div>
      </Card>

      <Card title={t("importExport.exportPaymentsTitle")} icon={<Receipt className="h-5 w-5 text-primary" />} description={t("importExport.exportPaymentsDescription")}>
        <div className="flex flex-wrap gap-2">
          <ExportBtn label="CSV" busy={busy === "payments_csv"} onClick={() => run("payments_csv", exportPaymentsCSV)} />
          <ExportBtn label="Excel (.xlsx)" busy={busy === "payments_xlsx"} onClick={() => run("payments_xlsx", exportPaymentsXLSX)} />
        </div>
      </Card>

      <Card title={t("importExport.fullBackupTitle")} icon={<Archive className="h-5 w-5 text-primary" />} description={t("importExport.fullBackupDescription")}>
        <ExportBtn label={t("importExport.downloadBackup")} busy={busy === "backup"} onClick={() => run("backup", exportFullBackup)} icon={<Archive className="h-4 w-4" />} />
      </Card>

      <Card title={t("importExport.importTitle")} icon={<Upload className="h-5 w-5 text-primary" />} description={t("importExport.importDescription")}>
        <button onClick={() => setShowImport(true)} className="btn-google inline-flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {t("importExport.chooseFile")}
        </button>
      </Card>

      <ImportPreviewModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}

function Card({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ExportBtn({ label, busy, onClick, icon }: { label: string; busy: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-input bg-background hover:bg-muted px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (icon ?? <Download className="h-4 w-4" />)}
      {label}
    </button>
  );
}
