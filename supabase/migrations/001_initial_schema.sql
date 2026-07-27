-- ============================================
-- TEAMTRACK DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ROLES
-- ============================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  level INT NOT NULL, -- 1=Owner, 2=SuperAdmin, 3=Admin, 4=Manager, 5=Member
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, level) VALUES
  ('Owner', 1),
  ('Super Admin', 2),
  ('Admin', 3),
  ('Manager', 4),
  ('Member', 5);

-- ============================================
-- 2. DEPARTMENTS
-- ============================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_bn TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO departments (name, name_bn) VALUES
  ('Sales', 'সেলস'),
  ('Marketing', 'মার্কেটিং'),
  ('Courier', 'কুরিয়ার'),
  ('Warehouse', 'ওয়্যারহাউস'),
  ('All Department', 'সকল বিভাগ');

-- ============================================
-- 3. EMPLOYEES
-- ============================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id TEXT UNIQUE,
  name TEXT NOT NULL,
  photo_url TEXT,
  designation TEXT,
  address TEXT,
  nid_no TEXT,
  blood_group TEXT,
  personal_contact TEXT,
  whatsapp_number TEXT,
  family_contact_1 TEXT,
  family_contact_2 TEXT,
  email TEXT UNIQUE,
  department_id UUID REFERENCES departments(id),
  role_id UUID REFERENCES roles(id),
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. FEATURES (the operational areas)
-- ============================================
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_bn TEXT,
  category TEXT,
  slug TEXT UNIQUE NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert features from the Access sheet
INSERT INTO features (name, name_bn, category, slug, sort_order) VALUES
  ('Ecomdrive', 'ইকমড্রাইভ', 'Platform', 'ecomdrive', 1),
  ('Smartcomm', 'স্মার্টকম', 'Platform', 'smartcomm', 2),
  ('Steadfast', 'স্টেডফাস্ট', 'Platform', 'steadfast', 3),
  ('Facebook', 'ফেসবুক', 'Platform', 'facebook', 4),
  ('WhatsApp Group', 'হোয়াটসঅ্যাপ গ্রুপ', 'All Department', 'whatsapp-group', 5),
  ('Main Group', 'অনলাইন বার্মিজ মার্কেট', 'All Department', 'main-group', 6),
  ('Notice Board', 'নোটিশ বোর্ড', 'All Department', 'notice-board', 7),
  ('Problem Box', 'প্রবলেম বক্স', 'All Department', 'problem-box', 8),
  ('Idea Sharing', 'আইডিয়া শেয়ার', 'All Department', 'idea-sharing', 9),
  ('2000+ Orders', '২০০০+ অর্ডার', 'Sales', 'orders-2000-plus', 10),
  ('Suggest Orders', 'সাজেস্ট অর্ডার', 'Sales', 'suggest-orders', 11),
  ('Pending Orders', 'পেন্ডিং অর্ডার', 'Sales', 'pending-orders', 12),
  ('Payment Confirmation', 'পেমেন্ট কনফার্মেশন', 'Sales', 'payment-confirmation', 13),
  ('Daily Order Submit', 'দৈনিক অর্ডার জমা', 'Sales', 'daily-order-submit', 14),
  ('Refund/Exchange', 'রিফান্ড/একচেঞ্জ', 'Sales', 'refund-exchange', 15),
  ('Customer Review', 'কাস্টমার রিভিউ', 'Sales & Marketing', 'customer-review', 16),
  ('PR Sending', 'PR Sending', 'Sales & Marketing', 'pr-sending', 17),
  ('Content Draft', 'কন্টেন্ট ড্রাফ', 'Marketing', 'content-draft', 18),
  ('Final Content', 'ফাইনাল কন্টেন্ট', 'Marketing', 'final-content', 19),
  ('Promotional Video', 'প্রমোশনাল ভিডিও', 'Marketing', 'promotional-video', 20),
  ('Courier Management', 'কুরিয়ার ম্যানেজমেন্ট', 'Courier', 'courier-management', 21),
  ('Packing Dept', 'প্যাকিং ডিপার্টমেন্ট', 'Warehouse', 'packing-dept', 22),
  ('Stock In/Out', 'স্টক ইন/আউট', 'Warehouse', 'stock-in-out', 23);

-- ============================================
-- 5. EMPLOYEE PERMISSIONS
-- ============================================
CREATE TABLE employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
  access_level TEXT CHECK (access_level IN ('admin', 'member', 'no_access')) DEFAULT 'no_access',
  UNIQUE(employee_id, feature_id)
);

-- ============================================
-- 6. ATTENDANCE
-- ============================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave')),
  notes TEXT,
  UNIQUE(employee_id, date)
);

-- ============================================
-- 7. POINT CATEGORIES
-- ============================================
CREATE TABLE point_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  max_points INT DEFAULT 10,
  sort_order INT DEFAULT 0
);

INSERT INTO point_categories (name, name_bn, max_points, sort_order) VALUES
  ('Time Management', 'টাইম ম্যানেজমেন্ট পয়েন্ট', 10, 1),
  ('Problem Solving', 'প্রবলেম সলভ', 10, 2),
  ('Content/Planning/Marketing/PR', 'কন্টেন্ট, প্লানিং, মার্কেটিং, PR', 10, 3),
  ('Discipline', 'ডিসিপ্লিন পয়েন্ট', 10, 4),
  ('Team & Leader Management', 'টিম ও লিডার ম্যানেজমেন্ট', 10, 5),
  ('Retargeting Orders', 'রিটার্গেটিং অর্ডার', 10, 6),
  ('Incomplete Orders', 'ইনকমপ্লিট অর্ডার', 10, 7),
  ('Office Management & Monitoring', 'অফিস ম্যানেজমেন্ট ও মনিটরিং', 10, 8),
  ('Warehouse & Product Checking', 'ওয়্যারহাউস ও প্রোডাক্ট চেকিং', 10, 9);

-- ============================================
-- 8. PERFORMANCE SCORES
-- ============================================
CREATE TABLE performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  category_id UUID REFERENCES point_categories(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  points INT CHECK (points >= 0 AND points <= 10),
  scored_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, category_id, date)
);

-- ============================================
-- 9. WORK ENTRIES (Daily Orders)
-- ============================================
CREATE TABLE work_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sl INT,
  customer_phone TEXT,
  invoice_no TEXT,
  courier_id TEXT,
  source TEXT CHECK (source IN ('facebook', 'whatsapp', 'web', 'direct', 'other')),
  amount DECIMAL(10,2),
  suggested_amount DECIMAL(10,2),
  advance DECIMAL(10,2),
  note TEXT,
  order_type TEXT CHECK (order_type IN ('normal', 'suggested', '2000_plus')),
  delivery_status TEXT CHECK (delivery_status IN ('delivered', 'cancelled', 'pending', 'partial')),
  management_check UUID REFERENCES employees(id),
  authority_check UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. PROBLEMS
-- ============================================
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_no TEXT UNIQUE,
  entry_date DATE DEFAULT CURRENT_DATE,
  customer_name TEXT,
  customer_phone TEXT,
  problem_details TEXT,
  problem_peek UUID REFERENCES employees(id),
  problem_solver UUID REFERENCES employees(id),
  solved_date DATE,
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'escalated')) DEFAULT 'open',
  management_check UUID REFERENCES employees(id),
  authority_check UUID REFERENCES employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. EXPENSES
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  category TEXT,
  description TEXT,
  amount DECIMAL(10,2),
  payment_method TEXT,
  submitted_by UUID REFERENCES employees(id),
  approved_by UUID REFERENCES employees(id),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'rejected')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. REQUISITIONS
-- ============================================
CREATE TABLE requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_no SERIAL,
  date DATE DEFAULT CURRENT_DATE,
  requested_by UUID REFERENCES employees(id),
  item_description TEXT,
  quantity INT,
  reason TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  manager_approval TEXT DEFAULT 'pending' CHECK (manager_approval IN ('pending', 'approved', 'rejected')),
  management_approval TEXT DEFAULT 'pending' CHECK (management_approval IN ('pending', 'approved', 'rejected')),
  purchase_date DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. IDEAS
-- ============================================
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  title TEXT,
  description TEXT,
  contributor UUID REFERENCES employees(id),
  category TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'implemented')),
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  feedback TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_bn TEXT,
  message TEXT,
  message_bn TEXT,
  type TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 15. COURIER ISSUES
-- ============================================
CREATE TABLE courier_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  parcel_id TEXT,
  contact_number TEXT,
  problem_details TEXT,
  problem_category TEXT,
  source TEXT,
  call_peek UUID REFERENCES employees(id),
  problem_status TEXT DEFAULT 'pending',
  delivery_status TEXT,
  problem_solver UUID REFERENCES employees(id),
  fraud_note BOOLEAN DEFAULT false,
  solved_description TEXT,
  management_check UUID REFERENCES employees(id),
  verified_by UUID REFERENCES employees(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. CONTENT TRACKER
-- ============================================
CREATE TABLE content_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  video_shoot_count INT DEFAULT 0,
  video_info TEXT,
  video_edited BOOLEAN DEFAULT false,
  video_uploaded BOOLEAN DEFAULT false,
  platform_fb1 BOOLEAN DEFAULT false,
  platform_fb2 BOOLEAN DEFAULT false,
  platform_instagram BOOLEAN DEFAULT false,
  platform_tiktok BOOLEAN DEFAULT false,
  platform_youtube BOOLEAN DEFAULT false,
  management_check UUID REFERENCES employees(id),
  note TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_role ON employees(role_id);
CREATE INDEX idx_work_entries_employee_date ON work_entries(employee_id, date);
CREATE INDEX idx_performance_scores_employee_date ON performance_scores(employee_id, date);
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX idx_problems_status ON problems(status);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_entries ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (allow authenticated users to read, will refine later)
CREATE POLICY "Authenticated users can read employees" ON employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read features" ON features
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read departments" ON departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read roles" ON roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read point_categories" ON point_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read permissions" ON employee_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read work_entries" ON work_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read performance_scores" ON performance_scores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read attendance" ON attendance
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read problems" ON problems
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read expenses" ON expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read requisitions" ON requisitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ideas" ON ideas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read notifications" ON notifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read courier_issues" ON courier_issues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read content_entries" ON content_entries
  FOR SELECT TO authenticated USING (true);

-- Insert policies for work entries, problems, etc.
CREATE POLICY "Authenticated users can insert work_entries" ON work_entries
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert problems" ON problems
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert expenses" ON expenses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert requisitions" ON requisitions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert ideas" ON ideas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Update policies
CREATE POLICY "Authenticated users can update employees" ON employees
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update work_entries" ON work_entries
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update problems" ON problems
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update performance_scores" ON performance_scores
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage attendance" ON attendance
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage permissions" ON employee_permissions
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage courier_issues" ON courier_issues
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage content_entries" ON content_entries
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can update expenses" ON expenses
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update requisitions" ON requisitions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update ideas" ON ideas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update notifications" ON notifications
  FOR UPDATE TO authenticated USING (true);
