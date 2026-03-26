-- AlterTable: courses — add totalDays
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "totalDays" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: course_items — add day, kakaoPlaceId
ALTER TABLE "course_items" ADD COLUMN IF NOT EXISTS "day" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "course_items" ADD COLUMN IF NOT EXISTS "kakaoPlaceId" TEXT;

-- DropIndex (old)
DROP INDEX IF EXISTS "course_items_courseId_order_idx";

-- CreateIndex (new)
CREATE INDEX IF NOT EXISTS "course_items_courseId_day_order_idx" ON "course_items"("courseId", "day", "order");
