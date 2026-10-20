-- CreateEnum
CREATE TYPE "WeekOutlook" AS ENUM ('NORMAL', 'BUSY', 'TRAVEL', 'ILL');

-- AlterTable
ALTER TABLE "PlanWeek" ADD COLUMN "outlook" "WeekOutlook";
