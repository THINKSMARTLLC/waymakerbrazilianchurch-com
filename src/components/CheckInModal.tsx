import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, MapPin, Share2, X, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { haversineMeters, todayLocalISO } from "@/lib/engagement";
import { useAuth } from "@/hooks/useAuth";

interface CheckInModalProps {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Stage =
  | "locating"
  | "ready"
  | "out_of_range"
  | "no_settings"
  | "denied"
  | "photo"
  | "saving"
  | "checked_in"
  | "already_today"
  | "error";

interface ChurchSettings {
  latitude: number | null;
  longitude: number | null;
  checkin_radius_meters: number;
  church_name: string | null;
}

// Strict radius requirement per product spec: must be inside the church (≤40m).
// We cap whatever is configured server-side at 40m for self check-in.
const STRICT_MAX_RADIUS_METERS = 40;
const POINTS_PER_CHECKIN = 10;

export function CheckInModal({ memberId, memberName, onClose, onSuccess }: CheckInModalProps) {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("locating");
  const [errorMsg, setErrorMsg] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);

  // Engagement feedback
  const [streakDays, setStreakDays] = useState<number>(0);
  const [weeklyCount, setWeeklyCount] = useState<number>(0);

  // Photo state — REQUIRED
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveRadius = settings
    ? Math.min(settings.checkin_radius_meters ?? STRICT_MAX_RADIUS_METERS, STRICT_MAX_RADIUS_METERS)
    : STRICT_MAX_RADIUS_METERS;

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Pre-check: already checked in today?
      const today = todayLocalISO();
      const { data: existing } = await supabase
        .from("member_activities")
        .select("id")
        .eq("member_id", memberId)
        .eq("activity_type", "attendance")
        .eq("source", "self_checkin")
        .eq("activity_date", today)
        .limit(1);

      if (cancelled) return;

      if (existing && existing.length > 0) {
        setStage("already_today");
        return;
      }

      const { data: s } = await supabase
        .from("church_settings")
        .select("latitude, longitude, checkin_radius_meters, church_name")
        .maybeSingle();

      if (cancelled) return;

      if (!s || s.latitude === null || s.longitude === null) {
        setSettings(s ?? null);
        setStage("no_settings");
        return;
      }
      setSettings(s);

      if (!("geolocation" in navigator)) {
        setErrorMsg("Seu dispositivo não suporta geolocalização.");
        setStage("error");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const d = haversineMeters(lat, lng, Number(s.latitude), Number(s.longitude));
          const limit = Math.min(s.checkin_radius_meters ?? STRICT_MAX_RADIUS_METERS, STRICT_MAX_RADIUS_METERS);
          setCoords({ lat, lng });
          setDistance(d);
          setStage(d <= limit ? "ready" : "out_of_range");
        },
        (err) => {
          if (cancelled) return;
          if (err.code === err.PERMISSION_DENIED) {
            setStage("denied");
          } else {
            setErrorMsg(err.message);
            setStage("error");
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const handleStartPhoto = () => {
    if (!coords) return;
    setStage("photo");
    // Auto-open the camera picker
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Foto muito grande. Máximo 5MB.");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const computeEngagementStats = async () => {
    // Streak: walk back day-by-day from today while attendance exists
    const { data: recent } = await supabase
      .from("member_activities")
      .select("activity_date")
      .eq("member_id", memberId)
      .eq("activity_type", "attendance")
      .order("activity_date", { ascending: false })
      .limit(60);

    const dates = new Set((recent ?? []).map((r) => r.activity_date));
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      if (dates.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    setStreakDays(streak);

    // Weekly count: last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const cutoff = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgo.getDate()).padStart(2, "0")}`;
    const weekly = (recent ?? []).filter((r) => r.activity_date >= cutoff).length;
    setWeeklyCount(weekly);
  };

  const handleConfirmCheckIn = async () => {
    if (!coords || !photoFile || !user) return;
    setStage("saving");

    // 1. Insert activity (gated by photo presence — never saved without photo)
    const { data: inserted, error: insertErr } = await supabase
      .from("member_activities")
      .insert([
        {
          member_id: memberId,
          activity_type: "attendance",
          source: "self_checkin",
          latitude: coords.lat,
          longitude: coords.lng,
        },
      ])
      .select("id")
      .single();

    if (insertErr || !inserted) {
      if (insertErr?.code === "23505") {
        setStage("already_today");
      } else {
        setErrorMsg(insertErr?.message ?? "Não foi possível registrar o check-in.");
        setStage("error");
      }
      return;
    }

    // 2. Upload photo
    const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${inserted.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("checkin-photos")
      .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

    let photoUrl: string | null = null;
    if (!uploadErr) {
      const { data: pub } = supabase.storage.from("checkin-photos").getPublicUrl(path);
      photoUrl = pub.publicUrl;
      await supabase
        .from("member_activities")
        .update({ photo_url: photoUrl })
        .eq("id", inserted.id);
      setPhotoPreview(photoUrl);
    }

    setActivityId(inserted.id);
    await computeEngagementStats();
    setStage("checked_in");
  };

  const buildShareText = () =>
    `I'm at ${settings?.church_name || "Way Maker Church"} 🙌 #WayMakerChurch`;

  const handleShareNative = async () => {
    const shareText = buildShareText();
    const shareData: ShareData = {
      title: settings?.church_name || "Way Maker Church",
      text: shareText,
    };
    if (photoFile) {
      try {
        shareData.files = [photoFile];
      } catch {
        // ignore — not all browsers support files
      }
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled or blocked → fall through to copy
      }
    }
    await navigator.clipboard?.writeText(shareText);
    alert("Mensagem copiada! Cole onde quiser compartilhar.");
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(buildShareText())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareInstagram = async () => {
    // Instagram has no web share intent on desktop; copy text + open IG
    await navigator.clipboard?.writeText(buildShareText()).catch(() => undefined);
    if (navigator.share) {
      // On mobile, prefer the native share sheet (user can pick Instagram)
      void handleShareNative();
      return;
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    alert("Texto copiado! Cole na sua story do Instagram.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">Check-in na Igreja</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {stage === "locating" && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Localizando você...</p>
            </div>
          )}

          {stage === "no_settings" && (
            <div className="text-center py-6">
              <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">Localização da igreja não configurada</p>
              <p className="text-xs text-muted-foreground mt-2">
                Peça ao administrador para configurar a localização nas configurações.
              </p>
            </div>
          )}

          {stage === "denied" && (
            <div className="text-center py-6">
              <MapPin className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">Permissão negada</p>
              <p className="text-xs text-muted-foreground mt-2">
                Habilite a localização nas configurações do navegador para fazer check-in.
              </p>
            </div>
          )}

          {stage === "out_of_range" && (
            <div className="text-center py-6">
              <MapPin className="h-10 w-10 text-warning mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">
                You must be inside the church to check in
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Distância: ~{Math.round(distance ?? 0)}m (limite: {effectiveRadius}m)
              </p>
            </div>
          )}

          {stage === "already_today" && (
            <div className="text-center py-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/15 mb-3">
                <Check className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm text-foreground font-medium">Você já fez check-in hoje</p>
              <p className="text-xs text-muted-foreground mt-2">Volte amanhã para continuar sua sequência 🙌</p>
              <button
                onClick={onClose}
                className="mt-4 rounded-xl border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                Fechar
              </button>
            </div>
          )}

          {stage === "ready" && (
            <div className="text-center py-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/15 mb-3">
                <MapPin className="h-7 w-7 text-success" />
              </div>
              <p className="text-sm text-foreground font-medium">Você está na igreja!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Distância: ~{Math.round(distance ?? 0)}m
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Para confirmar, você precisará tirar uma foto.
              </p>
              <button
                onClick={handleStartPhoto}
                className="btn-google mt-4 w-full inline-flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Continuar e tirar foto
              </button>
            </div>
          )}

          {stage === "photo" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Tire uma foto para confirmar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A foto é obrigatória para registrar o check-in.
                </p>
              </div>

              {photoPreview ? (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={photoPreview} alt="Pré-visualização" className="w-full h-56 object-cover" />
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  Abrir câmera
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {photoPreview && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
                >
                  Tirar outra foto
                </button>
              )}

              <button
                onClick={handleConfirmCheckIn}
                disabled={!photoFile}
                className="btn-google w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                Confirmar Check-in
              </button>
            </div>
          )}

          {stage === "saving" && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Registrando seu check-in...</p>
            </div>
          )}

          {stage === "checked_in" && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/15 mb-2">
                  <Check className="h-7 w-7 text-success" />
                </div>
                <p className="text-base font-medium text-foreground">Check-in registrado!</p>
                <p className="text-xs text-muted-foreground mt-1">Bem-vindo(a), {memberName} 🙏</p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-sm font-medium">+{POINTS_PER_CHECKIN} pontos</p>
                </div>
                <p className="text-sm text-foreground mt-2">You're growing in your journey 🙌</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-background/60 p-2">
                    <p className="text-muted-foreground">Sequência</p>
                    <p className="text-base font-semibold text-foreground">{streakDays} {streakDays === 1 ? "dia" : "dias"}</p>
                  </div>
                  <div className="rounded-lg bg-background/60 p-2">
                    <p className="text-muted-foreground">Esta semana</p>
                    <p className="text-base font-semibold text-foreground">{weeklyCount}</p>
                  </div>
                </div>
              </div>

              {photoPreview && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={photoPreview} alt="Sua foto" className="w-full h-40 object-cover" />
                </div>
              )}

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-1">Compartilhe seu momento</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Opcional — escolha onde quer compartilhar.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleShareInstagram}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    <Share2 className="h-4 w-4" />
                    Instagram
                  </button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-medium hover:opacity-90"
                  >
                    <Share2 className="h-4 w-4" />
                    WhatsApp
                  </button>
                </div>

                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground py-2"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center py-6">
              <p className="text-sm text-destructive">{errorMsg || "Algo deu errado."}</p>
              <button
                onClick={onClose}
                className="mt-4 rounded-xl border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
