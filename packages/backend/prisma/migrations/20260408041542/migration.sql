/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,dayOfWeek,blockIndex]` on the table `Schedule` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Schedule_employeeId_dayOfWeek_key";

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "blockIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "longitude" DECIMAL(10,7);

-- CreateTable
CREATE TABLE "ServiceAvailability" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "ServiceAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAvailability_serviceId_idx" ON "ServiceAvailability"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAvailability_serviceId_dayOfWeek_key" ON "ServiceAvailability"("serviceId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_employeeId_dayOfWeek_blockIndex_key" ON "Schedule"("employeeId", "dayOfWeek", "blockIndex");

-- AddForeignKey
ALTER TABLE "ServiceAvailability" ADD CONSTRAINT "ServiceAvailability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
