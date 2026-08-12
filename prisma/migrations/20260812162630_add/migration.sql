/*
  Warnings:

  - Added the required column `applePassId` to the `AppleRegistration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AppleRegistration" ADD COLUMN     "applePassId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "ApplePass" (
    "id" UUID NOT NULL,
    "cardPublicId" VARCHAR(64) NOT NULL,
    "serialNumber" VARCHAR(128) NOT NULL,
    "passTypeId" VARCHAR(80) NOT NULL,
    "pkpassData" BYTEA NOT NULL,
    "stampCount" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ApplePass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplePass_cardPublicId_key" ON "ApplePass"("cardPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplePass_serialNumber_key" ON "ApplePass"("serialNumber");

-- CreateIndex
CREATE INDEX "ApplePass_status_idx" ON "ApplePass"("status");

-- CreateIndex
CREATE INDEX "ApplePass_updatedAt_idx" ON "ApplePass"("updatedAt");

-- CreateIndex
CREATE INDEX "AppleRegistration_applePassId_idx" ON "AppleRegistration"("applePassId");

-- AddForeignKey
ALTER TABLE "AppleRegistration" ADD CONSTRAINT "AppleRegistration_applePassId_fkey" FOREIGN KEY ("applePassId") REFERENCES "ApplePass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
