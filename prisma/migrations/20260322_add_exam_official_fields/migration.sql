-- AlterTable: Exam 모델에 공식 시험 필드 추가 (직접 입력용)
ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "organization"      TEXT,
  ADD COLUMN IF NOT EXISTS "registrationStart" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationEnd"   TEXT,
  ADD COLUMN IF NOT EXISTS "resultDate"        TEXT,
  ADD COLUMN IF NOT EXISTS "fee"               INTEGER,
  ADD COLUMN IF NOT EXISTS "location"          TEXT,
  ADD COLUMN IF NOT EXISTS "url"               TEXT,
  ADD COLUMN IF NOT EXISTS "year"              INTEGER,
  ADD COLUMN IF NOT EXISTS "session"           INTEGER,
  ADD COLUMN IF NOT EXISTS "description"       TEXT;
