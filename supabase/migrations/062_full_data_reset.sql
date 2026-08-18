-- Full data reset (dev/test project) — wipes every user-generated content table so the app can
-- start fresh, while deliberately leaving migration-seeded reference/config data untouched:
-- roles, departments, features, finance_categories, point_categories, source_options,
-- app_settings. Those are structural (the role hierarchy's levels are hardcoded throughout the
-- app's requireAuth(N) checks, category/feature lists back various dropdowns), not test content,
-- so wiping them would leave the app non-functional rather than "fresh."
--
-- auth.users is intentionally NOT touched here — it's managed by Supabase Auth, not a plain
-- table a migration should TRUNCATE directly. Existing auth users are deleted, and the one
-- fresh Super Admin login is created, via the Admin API in a separate one-off script.
--
-- CASCADE is a safety net (auto-includes any table with an FK into one of these that was missed
-- here) — it only cascades to tables that reference these, never to the preserved reference
-- tables above, since none of those reference anything in this list.
TRUNCATE TABLE
    advances, attendance, attendance_breaks, audit_log, activity_log,
    content_batches, content_entries, content_items, courier_issues,
    emis, employee_access_records, employee_permissions, employees,
    expenses, finance_budgets, finance_funds, fines, fund_allocations,
    ideas, income, influencers, leave_records, memories, notice_reads,
    notices, notifications, performance_scores, personal_todos,
    point_transactions, point_withdrawals, pr_management, problems,
    product_buys, provident_funds, requisitions, salary_entries,
    salary_sheets, task_assignments, tasks, work_entries,
    work_evaluation_items, work_evaluations, work_reports
    CASCADE;
