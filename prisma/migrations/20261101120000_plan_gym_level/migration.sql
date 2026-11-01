-- CreateEnum
CREATE TYPE "GymLevel" AS ENUM ('NONE', 'MINIMAL', 'STANDARD', 'MORE');

-- AlterTable
ALTER TABLE "HorizonPlan" ADD COLUMN     "gymLevel" "GymLevel" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "sameDaySessions" BOOLEAN NOT NULL DEFAULT true;
