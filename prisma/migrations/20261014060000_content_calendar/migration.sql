-- Content Calendar: channels, post types, team roles, items, slots, stage logs, comments.
-- The old content_batches table/page are left in place (not dropped) — replaced in the UI only.

CREATE TABLE "content_calendar_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "photo_url" TEXT,
    "upload_link" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_channels_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "content_calendar_channels_platform_idx" ON "content_calendar_channels"("platform");

CREATE TABLE "content_calendar_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "caption_template" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_calendar_team_roles" (
    "employee_id" UUID NOT NULL,
    "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_team_roles_pkey" PRIMARY KEY ("employee_id"),
    CONSTRAINT "content_calendar_team_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "content_calendar_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "type_id" UUID NOT NULL,
    "product_code" TEXT,
    "caption" TEXT,
    "notes" TEXT,
    "stage" TEXT NOT NULL,
    "assignee_id" UUID,
    "stage_since" TIMESTAMPTZ(6),
    "start_date" DATE NOT NULL,
    "gap_days" INTEGER NOT NULL DEFAULT 3,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_items_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "content_calendar_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "content_calendar_items_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "content_calendar_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX "content_calendar_items_type_id_idx" ON "content_calendar_items"("type_id");
CREATE INDEX "content_calendar_items_assignee_id_idx" ON "content_calendar_items"("assignee_id");
CREATE INDEX "content_calendar_items_start_date_idx" ON "content_calendar_items"("start_date");

CREATE TABLE "content_calendar_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "hook" TEXT,
    "reach" INTEGER,
    "msgs" INTEGER,
    "orders" INTEGER,
    CONSTRAINT "content_calendar_slots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_slots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "content_calendar_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "content_calendar_slots_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "content_calendar_channels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "content_calendar_slots_item_id_idx" ON "content_calendar_slots"("item_id");
CREATE INDEX "content_calendar_slots_channel_id_date_idx" ON "content_calendar_slots"("channel_id", "date");

CREATE TABLE "content_calendar_stage_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "by_employee_id" UUID,
    "at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_stage_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_stage_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "content_calendar_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "content_calendar_stage_logs_by_employee_id_fkey" FOREIGN KEY ("by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX "content_calendar_stage_logs_item_id_idx" ON "content_calendar_stage_logs"("item_id");
CREATE INDEX "content_calendar_stage_logs_at_idx" ON "content_calendar_stage_logs"("at");

CREATE TABLE "content_calendar_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "by_employee_id" UUID,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_comments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "content_calendar_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "content_calendar_comments_by_employee_id_fkey" FOREIGN KEY ("by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX "content_calendar_comments_item_id_idx" ON "content_calendar_comments"("item_id");
