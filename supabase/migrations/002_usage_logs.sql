CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  ai_turns INTEGER DEFAULT 0,
  journal_generates INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own usage" ON usage_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
