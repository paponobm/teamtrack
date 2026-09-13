-- CreateTable
CREATE TABLE "about_us_content" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_title" TEXT,
    "story_body" TEXT,
    "story_image_url" TEXT,
    "policies" JSONB DEFAULT '[]',
    "journey" JSONB DEFAULT '[]',
    "banner_tagline" TEXT,
    "banner_image_url" TEXT,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "about_us_content_pkey" PRIMARY KEY ("id")
);
