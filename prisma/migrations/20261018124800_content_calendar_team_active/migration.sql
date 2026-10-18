-- Lets a content-calendar team member be hidden from assignment pickers / workload views
-- without touching their company-wide employee record.
ALTER TABLE "content_calendar_team_roles" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
