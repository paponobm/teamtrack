CREATE TABLE "content_calendar_channel_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_id" UUID NOT NULL,
    "month" TEXT NOT NULL DEFAULT '',
    "posts" INTEGER NOT NULL DEFAULT 0,
    "videos" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "content_calendar_channel_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_channel_targets_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "content_calendar_channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "content_calendar_channel_targets_channel_id_month_key" ON "content_calendar_channel_targets"("channel_id", "month");

CREATE TABLE "content_calendar_member_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "month" TEXT NOT NULL DEFAULT '',
    "target" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "content_calendar_member_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_member_targets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "content_calendar_member_targets_employee_id_month_key" ON "content_calendar_member_targets"("employee_id", "month");
