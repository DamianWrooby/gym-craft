/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `GarminData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GarminData" DROP COLUMN "passwordHash";
