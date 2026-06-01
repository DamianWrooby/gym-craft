-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('RACE', 'GENERAL_FITNESS', 'BASE_BUILDING', 'TEMPO_WORK', 'RECOVERY');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'MICROCYCLE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reportGenerationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "weightKg" DECIMAL(5,2) NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "restingHR" INTEGER,
    "maxHR" INTEGER,
    "hrZoneBounds" JSONB,
    "vo2max" DECIMAL(4,1),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunningGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "targetEventName" TEXT,
    "targetEventDate" TIMESTAMP(3),
    "targetDistanceM" INTEGER,
    "targetTimeSec" INTEGER,
    "notes" VARCHAR(500),
    "priority" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunningGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "periodStart" VARCHAR(10) NOT NULL,
    "periodEnd" VARCHAR(10) NOT NULL,
    "metrics" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "goalContext" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE INDEX "RunningGoal_userId_idx" ON "RunningGoal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingReport_userId_type_periodStart_key" ON "TrainingReport"("userId", "type", "periodStart");

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunningGoal" ADD CONSTRAINT "RunningGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingReport" ADD CONSTRAINT "TrainingReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
