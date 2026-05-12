import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MapPin, Save, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/settings/church")({
  head: () => ({
    meta: [{ title: "Church Settings — Way Maker Church" }],
  }),
  component: ChurchSettingsPage,
});

interface Settings {
  id: string;
  church_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  checkin_radius_meters: number;
  inactivity_days: number;
}

function ChurchSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("100");
  const [inactivity, setInactivity] = useState("30");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("church_settings")
        .select("*")
        .maybeSingle();
      if (data) {
        setSettings(data as Settings);
        setName(data.church_name ?? "");
        setAddress(data.address ?? "");
        setLat(data.latitude !== null ? String(data.latitude) : "");
        setLng(data.longitude !== null ? String(data.longitude) : "");
        setRadius(String(data.checkin_radius_meters ?? 100));
        setInactivity(String(data.inactivity_days ?? 30));
      }
      setLoading(false);
    };
    load();
  }, []);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      alert(t("settingsPage.geolocationNotSupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
      },
      (err) => alert(`${t("settingsPage.errorPrefix")}: ${err.message}`),
      { enableHighAccuracy: true },
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("church_settings")
      .update({
        church_name: name || null,
        address: address || null,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        checkin_radius_meters: Number(radius) || 100,
        inactivity_days: Number(inactivity) || 30,
        updated_by: user?.id ?? null,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      setMessage(`${t("settingsPage.errorPrefix")}: ${error.message}`);
      return;
    }
    setMessage(t("settingsPage.saved"));
    setTimeout(() => setMessage(""), 3000);
  };

  if (roleLoading || loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">{t("settingsPage.onlySuperAdmin")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">{t("settingsPage.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settingsPage.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSave} className="card-elevated p-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">{t("settingsPage.churchName")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Way Maker Brazilian Church"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">{t("settingsPage.address")}</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("settingsPage.addressPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Latitude</label>
            <input
              type="text"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
              placeholder="-23.5505199"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Longitude</label>
            <input
              type="text"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
              placeholder="-46.6333094"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          <Crosshair className="h-4 w-4" /> Usar minha localização atual
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Raio do check-in (metros)</label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min="10"
              max="1000"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Dias para inatividade</label>
            <input
              type="number"
              value={inactivity}
              onChange={(e) => setInactivity(e.target.value)}
              min="7"
              max="365"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {lat && lng && (
          <div className="rounded-lg bg-accent/40 p-3 text-sm flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-foreground">Coordenadas configuradas</p>
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Ver no Google Maps ↗
              </a>
            </div>
          </div>
        )}

        {message && (
          <p className={`text-sm ${message.startsWith("Erro") ? "text-destructive" : "text-success"}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-google inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </button>
      </form>
    </div>
  );
}
