-- CreateEnum
CREATE TYPE "ImageType" AS ENUM ('LOGO', 'BANNER');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "bannerUrl" TEXT;

-- CreateTable
CREATE TABLE "ImageVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "imageType" "ImageType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageVersion_tenantId_imageType_idx" ON "ImageVersion"("tenantId", "imageType");

-- CreateIndex
CREATE INDEX "ImageVersion_tenantId_createdAt_idx" ON "ImageVersion"("tenantId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ImageVersion" ADD CONSTRAINT "ImageVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
