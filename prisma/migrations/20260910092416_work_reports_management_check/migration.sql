-- AlterTable
ALTER TABLE "work_reports" ADD COLUMN     "checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "checked_by" UUID,
ADD COLUMN     "management_check" TEXT;

-- AddForeignKey
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
