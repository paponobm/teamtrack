CREATE TABLE "content_calendar_products" (
    "code" TEXT NOT NULL,
    "name" TEXT,
    "cat" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_products_pkey" PRIMARY KEY ("code")
);
