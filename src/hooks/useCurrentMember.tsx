import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CurrentMemberLite {
  id: string;
  name: string;
  profile_photo_url: string | null;
}

/**
 * Loads the current authenticated user's `members` row (lite) and subscribes
 * to realtime UPDATEs so the sidebar avatar refreshes immediately after a
 * photo upload from anywhere in the app.
 */
export function useCurrentMember(): CurrentMemberLite | null {
  const { user } = useAuth();
  const [member, setMember] = useState<CurrentMemberLite | null>(null);

  useEffect(() => {
    if (!user) {
      setMember(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, profile_photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setMember(data ?? null);
    };
    load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`current-member-${user.id}-${Math.random().toString(36).slice(2, 8)}`);
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "members", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id: string; name: string; profile_photo_url: string | null };
          if (!cancelled) setMember({ id: row.id, name: row.name, profile_photo_url: row.profile_photo_url });
        }
      );
      channel.subscribe();
    } catch (err) {
      console.warn("[useCurrentMember] realtime subscription failed", err);
    }

    return () => {
      cancelled = true;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, [user]);

  return member;
}
