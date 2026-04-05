import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";

export const USAGE_LIMITS = {
  ai_turns: 30,
  journal_generates: 5,
};

export function useUsage(userId) {
  const [usage, setUsage] = useState({
    ai_turns: 0,
    journal_generates: 0,
  });
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    if (!userId || !supabase) {
      setUsage({ ai_turns: 0, journal_generates: 0 });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("usage_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== "PGRST116") {
          console.warn("[Floe] usage_logs:", error.message);
        }
        if (data) {
          setUsage({
            ai_turns: data.ai_turns ?? 0,
            journal_generates: data.journal_generates ?? 0,
          });
        } else {
          setUsage({ ai_turns: 0, journal_generates: 0 });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, today]);

  const increment = useCallback(
    async (type) => {
      if (!supabase || !userId) return;
      let next;
      setUsage((u) => {
        next = {
          ai_turns:
            type === "ai_turns" ? u.ai_turns + 1 : u.ai_turns,
          journal_generates:
            type === "journal_generates"
              ? u.journal_generates + 1
              : u.journal_generates,
        };
        return next;
      });
      const { error } = await supabase.from("usage_logs").upsert(
        {
          user_id: userId,
          date: today,
          ai_turns: next.ai_turns,
          journal_generates: next.journal_generates,
        },
        { onConflict: "user_id,date" },
      );
      if (error) console.warn("[Floe] usage upsert:", error.message);
    },
    [userId, today],
  );

  const canUse = useCallback(
    (type) => {
      if (!supabase || !userId) return true;
      if (loading) return false;
      return (usage[type] || 0) < USAGE_LIMITS[type];
    },
    [supabase, userId, loading, usage],
  );

  const remaining = useCallback(
    (type) => {
      if (!supabase || !userId) return USAGE_LIMITS[type];
      return Math.max(0, USAGE_LIMITS[type] - (usage[type] || 0));
    },
    [supabase, userId, usage],
  );

  return {
    usage,
    loading,
    canUse,
    remaining,
    increment,
    LIMITS: USAGE_LIMITS,
  };
}
