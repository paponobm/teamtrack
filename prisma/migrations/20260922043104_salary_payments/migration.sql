-- CreateTable
CREATE TABLE "salary_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expense_id" UUID,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_salary_payments_date" ON "salary_payments"("payment_date");

-- CreateIndex
CREATE INDEX "idx_salary_payments_employee" ON "salary_payments"("employee_id");

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
