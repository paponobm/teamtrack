-- ============================================
-- MISSING FEATURE SLUGS MIGRATION
-- Adds slugs for pages that have RequireFeature guards
-- but were missing from the features table.
-- ============================================

INSERT INTO features (name, name_bn, category, slug, sort_order) VALUES
  ('Work Log', 'ওয়ার্ক লগ', 'Sales', 'work-log', 24),
  ('Courier', 'কুরিয়ার', 'Courier', 'courier', 25),
  ('Content', 'কন্টেন্ট', 'Marketing', 'content', 26),
  ('Tasks', 'টাস্ক', 'All Department', 'tasks', 27),
  ('Requisitions', 'রিকুইজিশন', 'All Department', 'requisitions', 28),
  ('Memories', 'স্মৃতি', 'All Department', 'memories', 29)
ON CONFLICT (slug) DO NOTHING;
