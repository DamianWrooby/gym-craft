-- CreateTable
CREATE TABLE "GarminData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" VARCHAR(50) NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "GarminData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GarminData_userId_key" ON "GarminData"("userId");

-- CreateIndex
CREATE INDEX "GarminData_userId_idx" ON "GarminData"("userId");

-- AddForeignKey
ALTER TABLE "GarminData" ADD CONSTRAINT "GarminData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
