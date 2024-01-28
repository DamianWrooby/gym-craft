/*
  Warnings:

  - You are about to drop the column `generatedPlans` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "generatedPlans",
ADD COLUMN     "generatedPlansNumber" INTEGER NOT NULL DEFAULT 0;
