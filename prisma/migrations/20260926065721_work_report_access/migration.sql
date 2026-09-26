-- CreateTable
CREATE TABLE "work_report_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "viewer_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_report_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_work_report_access_viewer" ON "work_report_access"("viewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_report_access_viewer_id_target_id_key" ON "work_report_access"("viewer_id", "target_id");

-- AddForeignKey
ALTER TABLE "work_report_access" ADD CONSTRAINT "work_report_access_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "work_report_access" ADD CONSTRAINT "work_report_access_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "work_report_access" ADD CONSTRAINT "work_report_access_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
