-- ============================================
-- 020: app_settings table
-- Stores global feature toggles for the app.
-- Only one row should exist (singleton pattern).
-- ============================================

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_enabled BOOLEAN DEFAULT false,
  auto_assign_problems BOOLEAN DEFAULT true,
  smart_notifications BOOLEAN DEFAULT true,
  quick_entry_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the default settings row
INSERT INTO app_settings (whatsapp_enabled, auto_assign_problems, smart_notifications, quick_entry_default)
VALUES (false, true, true, false)
ON CONFLICT DO NOTHING;

-- RLS: only authenticated users can read, only service role can write (API handles auth)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage app_settings" ON app_settings
  FOR ALL TO service_role USING (true);
