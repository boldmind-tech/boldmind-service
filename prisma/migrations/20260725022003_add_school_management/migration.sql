-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "school_assignments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classGroup" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "subject" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_assignments_schoolId_idx" ON "school_assignments"("schoolId");

-- AddForeignKey
ALTER TABLE "school_assignments" ADD CONSTRAINT "school_assignments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
