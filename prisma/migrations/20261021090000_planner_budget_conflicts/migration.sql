-- CreateEnum
CREATE TYPE "BudgetAbsence" AS ENUM ('NO_TRACKED_ACTIVITY', 'SHORT_HISTORY');

-- CreateEnum
CREATE TYPE "WeekDecision" AS ENUM ('PENDING', 'DROPPED', 'DOWNGRADED', 'KEPT');

-- AlterTable
ALTER TABLE "PlanWeek" ADD COLUMN "chronicFallbackShare" DOUBLE PRECISION,
ADD COLUMN "budgetAbsence" "BudgetAbsence",
ADD COLUMN "conflict" JSONB,
ADD COLUMN "decision" "WeekDecision";
