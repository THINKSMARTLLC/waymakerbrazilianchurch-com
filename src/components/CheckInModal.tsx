import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, MapPin, Share2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { haversineMeters } from "@/lib/engagement";
import { useAuth } from "@/hooks/useAuth";

interface CheckInModalProps {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Stage = "locating" | "ready" | "out_of_range" | "no_settings" | "denied" | "checked_in" | "error";

interface ChurchSettings {
  latitude: number | null;
  longitude: number | null;
  checkin_radius_meters: number;
  church_name: string | null;
}

export function CheckInModal({ memberId, memberName, onClose, onSuccess }: CheckInModalProps) {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("locating");
  const [errorMsg, setErrorMsg] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activityId, setActivityId] = useState<string | null>(null);

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
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
          setCoords({ lat, lng });
          setDistance(d);
          setStage(d <= s.checkin_radius_meters ? "ready" : "out_of_range");
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
  }, []);

  const handleCheckIn = async () => {
    if (!coords) return;
    setSubmitting(true);
    const { data, error } = await supabase
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
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        setErrorMsg("Você já fez check-in hoje. Volte amanhã!");
      } else {
        setErrorMsg(error.message);
      }
      setStage("error");
      return;
    }
    setActivityId(data.id);
    setStage("checked_in");
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

  const handleUploadPhoto = async () => {
    if (!photoFile || !user || !activityId) return;
    setUploadingPhoto(true);
    const ext = photoFile.name.split(".").pop() || "jpg";
    const path = `${user.id}/${activityId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("checkin-photos")
      .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
    if (uploadErr) {
      setUploadingPhoto(false);
      alert(`Erro ao enviar foto: ${uploadErr.message}`);
      return;
    }
    const { data: pub } = supabase.storage.from("checkin-photos").getPublicUrl(path);
    await supabase
      .from("member_activities")
      .update({ photo_url: pub.publicUrl })
      .eq("id", activityId);
    setPhotoPreview(pub.publicUrl);
    setUploadingPhoto(false);
  };

  const handleShare = async () => {
    const shareText = "Hoje foi dia de culto 🙏 #WayMaker";
    const shareData: ShareData = {
      title: settings?.church_name || "Way Maker",
      text: shareText,
    };
    if (photoPreview && photoFile) {
      try {
        shareData.files = [photoFile];
      } catch {
        // ignore
      }
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard?.writeText(shareText);
      alert("Mensagem copiada! Cole onde quiser compartilhar.");
    }
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
              <p className="text-sm text-foreground font-medium">Você está distante da igreja</p>
              <p className="text-xs text-muted-foreground mt-2">
                Distância: ~{Math.round(distance ?? 0)}m (limite: {settings?.checkin_radius_meters}m)
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Aproxime-se da igreja para fazer check-in.
              </p>
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
              <button
                onClick={handleCheckIn}
                disabled={submitting}
                className="btn-google mt-4 w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar Check-in
              </button>
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

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-2">Compartilhe seu momento</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Tire uma foto para guardar este momento (opcional).
                </p>

                {photoPreview ? (
                  <div className="rounded-xl overflow-hidden border border-border mb-3">
                    <img src={photoPreview} alt="Pré-visualização" className="w-full h-48 object-cover" />
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Camera className="h-5 w-5" />
                    Tirar/escolher foto
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

                {photoFile && !photoPreview?.startsWith("http") && (
                  <button
                    onClick={handleUploadPhoto}
                    disabled={uploadingPhoto}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Salvar foto
                  </button>
                )}

                <button
                  onClick={handleShare}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </button>

                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="mt-2 w-full text-sm text-muted-foreground hover:text-foreground py-2"
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
