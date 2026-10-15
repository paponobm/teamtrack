CREATE TABLE "content_calendar_ideas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "type_id" UUID,
    "product_code" TEXT,
    "by_employee_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_ideas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_ideas_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "content_calendar_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "content_calendar_ideas_by_employee_id_fkey" FOREIGN KEY ("by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX "content_calendar_ideas_type_id_idx" ON "content_calendar_ideas"("type_id");
