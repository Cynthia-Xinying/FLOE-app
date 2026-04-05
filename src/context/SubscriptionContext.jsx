import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import { useSubscription } from "../hooks/useSubscription";

const SubscriptionContext = createContext(null);

function subscriptionEnforced() {
  return (
    Boolean(supabase) && import.meta.env.VITE_SUBSCRIPTION_DISABLE !== "true"
  );
}

export function SubscriptionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const { sub, loading, isAIEnabled: rowAllowsAI, trialDaysLeft, isTrialExpired } =
    useSubscription(user?.id);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        setUser(session.user);
        setAuthReady(true);
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (error) {
        console.warn("[Floe] Anonymous sign-in failed:", error.message);
        setAuthReady(true);
        return;
      }
      setUser(data.user);
      setAuthReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const isAIEnabled = useCallback(() => {
    if (!subscriptionEnforced()) return true;
    if (!authReady) return false;
    if (!user) return true;
    if (loading) return false;
    return rowAllowsAI();
  }, [authReady, user, loading, rowAllowsAI]);

  const value = useMemo(
    () => ({
      user,
      authReady,
      sub,
      subLoading: loading,
      paywallOpen,
      setPaywallOpen,
      isAIEnabled,
      trialDaysLeft,
      isTrialExpired,
    }),
    [
      user,
      authReady,
      sub,
      loading,
      paywallOpen,
      isAIEnabled,
      trialDaysLeft,
      isTrialExpired,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useFloeSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useFloeSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}
