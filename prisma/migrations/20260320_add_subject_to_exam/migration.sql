-- AlterTable: exams에 subjectId 컬럼 추가
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;

-- AddForeignKey
ALTER TABLE "exams"
  ADD CONSTRAINT "exams_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
