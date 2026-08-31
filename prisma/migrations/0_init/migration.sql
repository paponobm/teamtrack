-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."activity_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."advances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "advance_date" DATE NOT NULL,
    "note" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expense_id" UUID,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."app_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "whatsapp_enabled" BOOLEAN DEFAULT false,
    "auto_assign_problems" BOOLEAN DEFAULT true,
    "smart_notifications" BOOLEAN DEFAULT true,
    "quick_entry_default" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "date" DATE NOT NULL,
    "clock_in" TIMESTAMPTZ(6),
    "clock_out" TIMESTAMPTZ(6),
    "status" TEXT DEFAULT 'present',
    "notes" TEXT,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attendance_breaks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attendance_id" UUID,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "module" TEXT,
    "target_id" UUID,
    "details" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "old_value" TEXT,
    "new_value" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT DEFAULT 'video',
    "titles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shoot_done" BOOLEAN DEFAULT false,
    "edit_done" BOOLEAN DEFAULT false,
    "upload_done" BOOLEAN DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "uploaded_to" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "shoot_date" TIMESTAMPTZ(6),
    "edit_date" TIMESTAMPTZ(6),
    "upload_date" TIMESTAMPTZ(6),
    "metrics_likes" INTEGER DEFAULT 0,
    "metrics_comments" INTEGER DEFAULT 0,
    "metrics_reach" INTEGER DEFAULT 0,
    "rating" TEXT,

    CONSTRAINT "content_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE DEFAULT CURRENT_DATE,
    "video_shoot_count" INTEGER DEFAULT 0,
    "video_info" TEXT,
    "video_edited" BOOLEAN DEFAULT false,
    "video_uploaded" BOOLEAN DEFAULT false,
    "platform_fb1" BOOLEAN DEFAULT false,
    "platform_fb2" BOOLEAN DEFAULT false,
    "platform_instagram" BOOLEAN DEFAULT false,
    "platform_tiktok" BOOLEAN DEFAULT false,
    "platform_youtube" BOOLEAN DEFAULT false,
    "management_check" UUID,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "type" TEXT DEFAULT 'post',
    "platform" TEXT DEFAULT 'facebook',
    "status" TEXT DEFAULT 'draft',
    "assigned_to" UUID,
    "due_date" DATE,
    "content_url" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."courier_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE DEFAULT CURRENT_DATE,
    "parcel_id" TEXT,
    "contact_number" TEXT,
    "problem_details" TEXT,
    "problem_category" TEXT,
    "source" TEXT,
    "call_peek" UUID,
    "problem_status" TEXT DEFAULT 'pending',
    "delivery_status" TEXT,
    "problem_solver" UUID,
    "fraud_note" BOOLEAN DEFAULT false,
    "solved_description" TEXT,
    "management_check" UUID,
    "verified_by" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "payment_gateway" TEXT,
    "business_name" TEXT,
    "logistics" TEXT,

    CONSTRAINT "courier_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "name_bn" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."emis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "monthly_installment" DECIMAL(10,2) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expense_id" UUID,

    CONSTRAINT "emis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_access_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "platform_name" TEXT NOT NULL,
    "role_description" TEXT,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_access_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "feature_id" UUID,
    "access_level" TEXT DEFAULT 'no_access',

    CONSTRAINT "employee_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "employee_id" TEXT,
    "name" TEXT NOT NULL,
    "photo_url" TEXT,
    "designation" TEXT,
    "address" TEXT,
    "nid_no" TEXT,
    "blood_group" TEXT,
    "personal_contact" TEXT,
    "whatsapp_number" TEXT,
    "family_contact_1" TEXT,
    "family_contact_2" TEXT,
    "email" TEXT,
    "department_id" UUID,
    "role_id" UUID,
    "joining_date" DATE,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "gender" TEXT,
    "date_of_birth" DATE,
    "cv_url" TEXT,
    "duty_start_time" TIME(6),
    "duty_end_time" TIME(6),
    "total_points" INTEGER DEFAULT 0,
    "avatar_url" TEXT,
    "payroll_basic_salary" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payroll_transportation_bill" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payroll_snacks_bill" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "festival_bonus_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "festival_bonus_months" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "salary_increment_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salary_increment_effective_month" VARCHAR(7),
    "basic_salary_effective_month" VARCHAR(7),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE DEFAULT CURRENT_DATE,
    "category" TEXT,
    "description" TEXT,
    "amount" DECIMAL(10,2),
    "payment_method" TEXT,
    "submitted_by" UUID,
    "approved_by" UUID,
    "payment_status" TEXT DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "business_name" TEXT,
    "payment_gateway" TEXT,
    "invoice_id" TEXT,
    "fund_id" UUID,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "name_bn" TEXT,
    "category" TEXT,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "finance_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."finance_funds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "category" TEXT DEFAULT 'Uncategorized',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "issued_by" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "appeal_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "settled_month" TEXT,

    CONSTRAINT "fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fund_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "allocated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fund_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ideas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE DEFAULT CURRENT_DATE,
    "title" TEXT,
    "description" TEXT,
    "contributor" UUID,
    "category" TEXT,
    "priority" TEXT DEFAULT 'medium',
    "status" TEXT DEFAULT 'submitted',
    "approval_status" TEXT DEFAULT 'pending',
    "feedback" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "reference_links" TEXT,
    "idea_no" SERIAL NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."income" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE DEFAULT CURRENT_DATE,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "source" TEXT,
    "invoice_id" TEXT,
    "note" TEXT,
    "business_name" TEXT,
    "added_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "work_entry_id" UUID,
    "product_buy_id" UUID,
    "fund_id" UUID,

    CONSTRAINT "income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."influencers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "page_url" TEXT,
    "follower_count" INTEGER DEFAULT 0,
    "rating" INTEGER DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "photo_url" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "instagram_url" TEXT,
    "tiktok_url" TEXT,
    "youtube_url" TEXT,
    "rating_responsiveness" INTEGER,
    "rating_quality" INTEGER,
    "rating_professionalism" INTEGER,
    "rating_engagement" INTEGER,
    "rating_reliability" INTEGER,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "uploaded_platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contact_source" TEXT,
    "contact_value" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',

    CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leave_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "leave_date" DATE NOT NULL,
    "reason" TEXT,
    "status" TEXT DEFAULT 'pending',
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notice_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notice_id" UUID,
    "employee_id" UUID,
    "read_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "content" TEXT,
    "type" TEXT DEFAULT 'notice',
    "priority" TEXT DEFAULT 'normal',
    "is_pinned" BOOLEAN DEFAULT false,
    "created_by" UUID,
    "expires_at" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID,
    "title" TEXT NOT NULL,
    "title_bn" TEXT,
    "message" TEXT,
    "message_bn" TEXT,
    "type" TEXT,
    "related_entity_type" TEXT,
    "related_entity_id" UUID,
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."performance_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "category_id" UUID,
    "date" DATE NOT NULL,
    "points" INTEGER,
    "scored_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."personal_todos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN DEFAULT false,
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."point_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,
    "max_points" INTEGER DEFAULT 10,
    "sort_order" INTEGER DEFAULT 0,

    CONSTRAINT "point_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."point_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "points" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" UUID,
    "category" TEXT,
    "description" TEXT,
    "awarded_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."point_withdrawals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "processed_at" TIMESTAMPTZ(6),
    "processed_by" UUID,

    CONSTRAINT "point_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pr_management" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "send_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "address" TEXT,
    "parcel_details" TEXT,
    "source" TEXT,
    "delivery_status" TEXT DEFAULT 'Product Sent',
    "video_status" TEXT DEFAULT 'Pending',
    "payment_status" TEXT DEFAULT 'Unpaid',
    "video_link" TEXT,
    "view_note" TEXT,
    "ai_comments" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "influencer_id" UUID,
    "video_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_amount" DECIMAL(10,2),
    "advance_amount" DECIMAL(10,2),
    "due_amount" DECIMAL(10,2),
    "payment_method" TEXT,
    "transaction_id" TEXT,

    CONSTRAINT "pr_management_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."problems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "problem_no" TEXT,
    "entry_date" DATE DEFAULT CURRENT_DATE,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "problem_details" TEXT,
    "problem_peek" UUID,
    "problem_solver" UUID,
    "solved_date" DATE,
    "priority" TEXT DEFAULT 'medium',
    "status" TEXT DEFAULT 'open',
    "management_check" UUID,
    "authority_check" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "payment_gateway" TEXT,
    "business_name" TEXT,
    "resolution_note" TEXT,
    "category" TEXT,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_buys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "item" TEXT,
    "note" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "expense_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "product_price" DECIMAL(10,2),
    "discount_price" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "product_buys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."provident_funds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "principal_amount" DECIMAL(10,2) NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "monthly_installment" DECIMAL(10,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provident_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requisitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requisition_no" SERIAL NOT NULL,
    "date" DATE DEFAULT CURRENT_DATE,
    "requested_by" UUID,
    "item_description" TEXT,
    "quantity" INTEGER,
    "reason" TEXT,
    "priority" TEXT DEFAULT 'medium',
    "manager_approval" TEXT DEFAULT 'pending',
    "management_approval" TEXT DEFAULT 'pending',
    "purchase_date" DATE,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "business_name" TEXT,
    "purchase_status" TEXT DEFAULT 'pending',
    "payment_gateway" TEXT,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."salary_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "salary_sheet_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "basic_salary" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "extra_duty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "advance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "loan" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "other_deduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'Unpaid',
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "performance_bonus" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "festival_bonus" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "payment_date" DATE,
    "transportation_bill" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "snacks_bill" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expense_id" UUID,

    CONSTRAINT "salary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."salary_sheets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "month" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."source_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID,
    "employee_id" UUID,
    "status" TEXT DEFAULT 'pending',
    "assigned_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "priority" TEXT DEFAULT 'medium',
    "status" TEXT DEFAULT 'pending',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "task_no" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID,
    "date" DATE NOT NULL,
    "sl" INTEGER,
    "customer_phone" TEXT,
    "invoice_no" TEXT,
    "courier_id" TEXT,
    "source" TEXT,
    "amount" DECIMAL(10,2),
    "suggested_amount" DECIMAL(10,2),
    "advance" DECIMAL(10,2),
    "note" TEXT,
    "order_type" TEXT,
    "delivery_status" TEXT,
    "management_check" UUID,
    "authority_check" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "customer_name" TEXT,
    "payment_gateway" TEXT,
    "business_name" TEXT,
    "transaction_id" TEXT,
    "advance_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_evaluation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluation_id" UUID NOT NULL,
    "work_report_id" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_evaluation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_assigned_points" INTEGER NOT NULL DEFAULT 0,
    "total_earned_points" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "evaluated_by" UUID,
    "evaluated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "project" TEXT NOT NULL,
    "description" TEXT,
    "hours" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "attachment_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_activity_log_actor" ON "public"."activity_log"("actor_id" ASC);

-- CreateIndex
CREATE INDEX "idx_activity_log_created" ON "public"."activity_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_activity_log_module_target" ON "public"."activity_log"("module" ASC, "target_id" ASC);

-- CreateIndex
CREATE INDEX "idx_advances_date" ON "public"."advances"("advance_date" ASC);

-- CreateIndex
CREATE INDEX "idx_advances_employee" ON "public"."advances"("employee_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employee_id_date_key" ON "public"."attendance"("employee_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "idx_attendance_employee_date" ON "public"."attendance"("employee_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "idx_attendance_breaks_attendance_id" ON "public"."attendance_breaks"("attendance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_log_actor" ON "public"."audit_log"("actor_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_log_module" ON "public"."audit_log"("module" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_log_target" ON "public"."audit_log"("target_id" ASC);

-- CreateIndex
CREATE INDEX "idx_content_batches_created_by" ON "public"."content_batches"("created_by" ASC);

-- CreateIndex
CREATE INDEX "idx_content_items_assigned" ON "public"."content_items"("assigned_to" ASC);

-- CreateIndex
CREATE INDEX "idx_content_items_status" ON "public"."content_items"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_emis_employee" ON "public"."emis"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_emis_start_date" ON "public"."emis"("start_date" ASC);

-- CreateIndex
CREATE INDEX "idx_employee_access_employee" ON "public"."employee_access_records"("employee_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employee_permissions_employee_id_feature_id_key" ON "public"."employee_permissions"("employee_id" ASC, "feature_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "public"."employees"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_id_key" ON "public"."employees"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_employees_department" ON "public"."employees"("department_id" ASC);

-- CreateIndex
CREATE INDEX "idx_employees_dob" ON "public"."employees"("date_of_birth" ASC);

-- CreateIndex
CREATE INDEX "idx_employees_role" ON "public"."employees"("role_id" ASC);

-- CreateIndex
CREATE INDEX "idx_employees_user_id" ON "public"."employees"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "features_slug_key" ON "public"."features"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "finance_budgets_category_id_period_key" ON "public"."finance_budgets"("category_id" ASC, "period" ASC);

-- CreateIndex
CREATE INDEX "idx_fund_allocations_created_at" ON "public"."fund_allocations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_fund_allocations_employee" ON "public"."fund_allocations"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_leave_records_employee_date" ON "public"."leave_records"("employee_id" ASC, "leave_date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "leave_records_employee_id_leave_date_key" ON "public"."leave_records"("employee_id" ASC, "leave_date" ASC);

-- CreateIndex
CREATE INDEX "idx_notice_reads_employee" ON "public"."notice_reads"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_notice_reads_notice" ON "public"."notice_reads"("notice_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "notice_reads_notice_id_employee_id_key" ON "public"."notice_reads"("notice_id" ASC, "employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_notices_created_at" ON "public"."notices"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_recipient" ON "public"."notifications"("recipient_id" ASC, "is_read" ASC);

-- CreateIndex
CREATE INDEX "idx_performance_scores_employee_date" ON "public"."performance_scores"("employee_id" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "performance_scores_employee_id_category_id_date_key" ON "public"."performance_scores"("employee_id" ASC, "category_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "idx_personal_todos_completed" ON "public"."personal_todos"("completed" ASC);

-- CreateIndex
CREATE INDEX "idx_personal_todos_created_at" ON "public"."personal_todos"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_personal_todos_employee" ON "public"."personal_todos"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_point_transactions_created" ON "public"."point_transactions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_point_transactions_employee" ON "public"."point_transactions"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_point_transactions_source" ON "public"."point_transactions"("source" ASC);

-- CreateIndex
CREATE INDEX "idx_problems_status" ON "public"."problems"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "problems_problem_no_key" ON "public"."problems"("problem_no" ASC);

-- CreateIndex
CREATE INDEX "idx_product_buys_date" ON "public"."product_buys"("purchase_date" ASC);

-- CreateIndex
CREATE INDEX "idx_product_buys_employee" ON "public"."product_buys"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_provident_funds_employee" ON "public"."provident_funds"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_provident_funds_start_date" ON "public"."provident_funds"("start_date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name" ASC);

-- CreateIndex
CREATE INDEX "idx_salary_entries_employee" ON "public"."salary_entries"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_salary_entries_sheet" ON "public"."salary_entries"("salary_sheet_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "salary_entries_salary_sheet_id_employee_id_key" ON "public"."salary_entries"("salary_sheet_id" ASC, "employee_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "salary_sheets_month_key" ON "public"."salary_sheets"("month" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "source_options_name_key" ON "public"."source_options"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "source_options_slug_key" ON "public"."source_options"("slug" ASC);

-- CreateIndex
CREATE INDEX "idx_task_assignments_employee" ON "public"."task_assignments"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_task_assignments_task" ON "public"."task_assignments"("task_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_task_id_employee_id_key" ON "public"."task_assignments"("task_id" ASC, "employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_created_at" ON "public"."tasks"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_tasks_created_by" ON "public"."tasks"("created_by" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "public"."tasks"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "idx_work_entries_advance_verified" ON "public"."work_entries"("advance_verified" ASC);

-- CreateIndex
CREATE INDEX "idx_work_entries_employee_date" ON "public"."work_entries"("employee_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "idx_work_evaluation_items_evaluation" ON "public"."work_evaluation_items"("evaluation_id" ASC);

-- CreateIndex
CREATE INDEX "idx_work_evaluation_items_report" ON "public"."work_evaluation_items"("work_report_id" ASC);

-- CreateIndex
CREATE INDEX "idx_work_evaluations_employee" ON "public"."work_evaluations"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_work_evaluations_period" ON "public"."work_evaluations"("period_start" ASC, "period_end" ASC);

-- CreateIndex
CREATE INDEX "idx_work_reports_date" ON "public"."work_reports"("date" ASC);

-- CreateIndex
CREATE INDEX "idx_work_reports_employee" ON "public"."work_reports"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "idx_work_reports_status" ON "public"."work_reports"("status" ASC);

-- AddForeignKey
ALTER TABLE "public"."activity_log" ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."advances" ADD CONSTRAINT "advances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."advances" ADD CONSTRAINT "advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."advances" ADD CONSTRAINT "advances_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."attendance_breaks" ADD CONSTRAINT "attendance_breaks_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."content_batches" ADD CONSTRAINT "content_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."content_entries" ADD CONSTRAINT "content_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."content_entries" ADD CONSTRAINT "content_entries_management_check_fkey" FOREIGN KEY ("management_check") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."content_items" ADD CONSTRAINT "content_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."content_items" ADD CONSTRAINT "content_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."courier_issues" ADD CONSTRAINT "courier_issues_call_peek_fkey" FOREIGN KEY ("call_peek") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."courier_issues" ADD CONSTRAINT "courier_issues_management_check_fkey" FOREIGN KEY ("management_check") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."courier_issues" ADD CONSTRAINT "courier_issues_problem_solver_fkey" FOREIGN KEY ("problem_solver") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."courier_issues" ADD CONSTRAINT "courier_issues_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."emis" ADD CONSTRAINT "emis_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."emis" ADD CONSTRAINT "emis_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."emis" ADD CONSTRAINT "emis_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employee_access_records" ADD CONSTRAINT "employee_access_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employee_access_records" ADD CONSTRAINT "employee_access_records_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employee_permissions" ADD CONSTRAINT "employee_permissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employee_permissions" ADD CONSTRAINT "employee_permissions_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "public"."finance_funds"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."finance_budgets" ADD CONSTRAINT "finance_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."finance_categories" ADD CONSTRAINT "finance_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fines" ADD CONSTRAINT "fines_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fines" ADD CONSTRAINT "fines_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fund_allocations" ADD CONSTRAINT "fund_allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fund_allocations" ADD CONSTRAINT "fund_allocations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ideas" ADD CONSTRAINT "ideas_contributor_fkey" FOREIGN KEY ("contributor") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."income" ADD CONSTRAINT "income_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."income" ADD CONSTRAINT "income_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "public"."finance_funds"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."income" ADD CONSTRAINT "income_product_buy_id_fkey" FOREIGN KEY ("product_buy_id") REFERENCES "public"."product_buys"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."income" ADD CONSTRAINT "income_work_entry_id_fkey" FOREIGN KEY ("work_entry_id") REFERENCES "public"."work_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leave_records" ADD CONSTRAINT "leave_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."leave_records" ADD CONSTRAINT "leave_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."memories" ADD CONSTRAINT "memories_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notice_reads" ADD CONSTRAINT "notice_reads_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notice_reads" ADD CONSTRAINT "notice_reads_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notices" ADD CONSTRAINT "notices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."performance_scores" ADD CONSTRAINT "performance_scores_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."point_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."performance_scores" ADD CONSTRAINT "performance_scores_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."performance_scores" ADD CONSTRAINT "performance_scores_scored_by_fkey" FOREIGN KEY ("scored_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."personal_todos" ADD CONSTRAINT "personal_todos_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."point_transactions" ADD CONSTRAINT "point_transactions_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."point_transactions" ADD CONSTRAINT "point_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."point_withdrawals" ADD CONSTRAINT "point_withdrawals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."point_withdrawals" ADD CONSTRAINT "point_withdrawals_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pr_management" ADD CONSTRAINT "pr_management_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pr_management" ADD CONSTRAINT "pr_management_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "public"."influencers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."problems" ADD CONSTRAINT "problems_authority_check_fkey" FOREIGN KEY ("authority_check") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."problems" ADD CONSTRAINT "problems_management_check_fkey" FOREIGN KEY ("management_check") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."problems" ADD CONSTRAINT "problems_problem_peek_fkey" FOREIGN KEY ("problem_peek") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."problems" ADD CONSTRAINT "problems_problem_solver_fkey" FOREIGN KEY ("problem_solver") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_buys" ADD CONSTRAINT "product_buys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_buys" ADD CONSTRAINT "product_buys_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_buys" ADD CONSTRAINT "product_buys_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."provident_funds" ADD CONSTRAINT "provident_funds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."provident_funds" ADD CONSTRAINT "provident_funds_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."requisitions" ADD CONSTRAINT "requisitions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."salary_entries" ADD CONSTRAINT "salary_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."salary_entries" ADD CONSTRAINT "salary_entries_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."salary_entries" ADD CONSTRAINT "salary_entries_salary_sheet_id_fkey" FOREIGN KEY ("salary_sheet_id") REFERENCES "public"."salary_sheets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."salary_entries" ADD CONSTRAINT "salary_entries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."salary_sheets" ADD CONSTRAINT "salary_sheets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_assignments" ADD CONSTRAINT "task_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_entries" ADD CONSTRAINT "work_entries_authority_check_fkey" FOREIGN KEY ("authority_check") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_entries" ADD CONSTRAINT "work_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_entries" ADD CONSTRAINT "work_entries_management_check_fkey" FOREIGN KEY ("management_check") REFERENCES "public"."employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_entries" ADD CONSTRAINT "work_entries_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_evaluation_items" ADD CONSTRAINT "work_evaluation_items_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "public"."work_evaluations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_evaluation_items" ADD CONSTRAINT "work_evaluation_items_work_report_id_fkey" FOREIGN KEY ("work_report_id") REFERENCES "public"."work_reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_evaluations" ADD CONSTRAINT "work_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_evaluations" ADD CONSTRAINT "work_evaluations_evaluated_by_fkey" FOREIGN KEY ("evaluated_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."work_reports" ADD CONSTRAINT "work_reports_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

