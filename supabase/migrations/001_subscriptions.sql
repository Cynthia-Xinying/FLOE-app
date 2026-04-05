-- Run in Supabase SQL editor or via CLI. Enables per-user subscription + 7-day trial.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT DEFAULT 'trial', -- 'trial' | 'active' | 'expired'
  trial_start TIMESTAMPTZ DEFAULT now(),
  trial_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  subscribed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  plan TEXT DEFAULT 'monthly'
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own subscription" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION create_subscription_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_subscription_for_new_user();
