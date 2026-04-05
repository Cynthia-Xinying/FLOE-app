import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useSubscription(userId) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !supabase) {
      setSub(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== "PGRST116") {
          console.warn("[Floe] subscriptions:", error.message);
        }
        setSub(data ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isAIEnabled = useCallback(() => {
    if (!sub) return false;
    const now = new Date();
    if (sub.status === "trial") {
      return new Date(sub.trial_end) > now;
    }
    if (sub.status === "active") {
      return sub.expires_at ? new Date(sub.expires_at) > now : false;
    }
    return false;
  }, [sub]);

  const trialDaysLeft = useCallback(() => {
    if (!sub || sub.status !== "trial") return 0;
    const diff = new Date(sub.trial_end) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [sub]);

  const isTrialExpired = useCallback(() => {
    if (!sub) return false;
    return sub.status === "trial" && new Date(sub.trial_end) <= new Date();
  }, [sub]);

  return { sub, loading, isAIEnabled, trialDaysLeft, isTrialExpired };
}
