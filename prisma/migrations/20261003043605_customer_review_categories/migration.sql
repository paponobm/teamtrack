/*
  Warnings:

  - You are about to drop the column `category` on the `customer_reviews` table. All the data in the column will be lost.
  - Added the required column `category_id` to the `customer_reviews` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "idx_customer_reviews_category";

-- AlterTable
ALTER TABLE "customer_reviews" DROP COLUMN "category",
ADD COLUMN     "category_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "customer_review_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_review_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_customer_review_categories_name" ON "customer_review_categories"("name");

-- CreateIndex
CREATE INDEX "idx_customer_reviews_category" ON "customer_reviews"("category_id");

-- AddForeignKey
ALTER TABLE "customer_review_categories" ADD CONSTRAINT "customer_review_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "customer_review_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
