-- CreateEnum
CREATE TYPE "Feeling" AS ENUM ('GOOD', 'SO_SO', 'POOR');

-- CreateEnum
CREATE TYPE "CheckInReason" AS ENUM ('ILL', 'TIRED', 'SORE', 'STRESSED', 'POOR_SLEEP');

-- AlterTable
ALTER TABLE "HorizonPlan" ADD COLUMN     "recutDismissedFor" DATE;

-- AlterTable
ALTER TABLE "PlanWeek" ADD COLUMN     "checkInDismissedOn" DATE,
ADD COLUMN     "revisionCause" JSONB,
ADD COLUMN     "revisionGeneration" "WeekGeneration",
ADD COLUMN     "revisionReason" JSONB,
ADD COLUMN     "revisionRequestId" TEXT;

-- CreateTable
CREATE TABLE "WellbeingCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "feeling" "Feeling" NOT NULL,
    "reason" "CheckInReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellbeingCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WellbeingCheckIn_userId_date_key" ON "WellbeingCheckIn"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlanWeek_revisionRequestId_key" ON "PlanWeek"("revisionRequestId");

-- AddForeignKey
ALTER TABLE "PlanWeek" ADD CONSTRAINT "PlanWeek_revisionRequestId_fkey" FOREIGN KEY ("revisionRequestId") REFERENCES "AiRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingCheckIn" ADD CONSTRAINT "WellbeingCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

