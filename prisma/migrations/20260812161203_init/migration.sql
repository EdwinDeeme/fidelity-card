-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'REWARDED', 'REDEEMED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SalonDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "CardEventType" AS ENUM ('CARD_CREATED', 'STAMP_ADDED', 'STAMP_REMOVED', 'REWARD_REDEEMED', 'CARD_DISABLED', 'ONBOARDING_STARTED', 'ONBOARDING_COMPLETED');

-- CreateTable
CREATE TABLE "Card" (
    "id" UUID NOT NULL,
    "publicId" VARCHAR(64) NOT NULL,
    "walletState" JSONB NOT NULL DEFAULT '{}',
    "stampCount" SMALLINT NOT NULL DEFAULT 0,
    "stampLimit" SMALLINT NOT NULL,
    "rewardName" VARCHAR(80) NOT NULL,
    "rewardDescription" VARCHAR(160),
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "updateTag" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingToken" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "cardId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardEvent" (
    "id" BIGSERIAL NOT NULL,
    "cardId" UUID NOT NULL,
    "eventType" "CardEventType" NOT NULL,
    "idempotencyKey" VARCHAR(80),
    "actorType" VARCHAR(24) NOT NULL,
    "actorRef" VARCHAR(80),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppleDevice" (
    "deviceLibraryId" VARCHAR(128) NOT NULL,
    "pushToken" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AppleDevice_pkey" PRIMARY KEY ("deviceLibraryId")
);

-- CreateTable
CREATE TABLE "AppleRegistration" (
    "id" BIGSERIAL NOT NULL,
    "deviceLibraryId" VARCHAR(128) NOT NULL,
    "cardId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppleRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonDevice" (
    "id" UUID NOT NULL,
    "deviceName" VARCHAR(80) NOT NULL,
    "deviceSecretHash" CHAR(64) NOT NULL,
    "status" "SalonDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalonDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_publicId_key" ON "Card"("publicId");

-- CreateIndex
CREATE INDEX "Card_status_idx" ON "Card"("status");

-- CreateIndex
CREATE INDEX "Card_updatedAt_idx" ON "Card"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingToken_tokenHash_key" ON "OnboardingToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OnboardingToken_cardId_idx" ON "OnboardingToken"("cardId");

-- CreateIndex
CREATE INDEX "OnboardingToken_expiresAt_idx" ON "OnboardingToken"("expiresAt");

-- CreateIndex
CREATE INDEX "OnboardingToken_consumedAt_idx" ON "OnboardingToken"("consumedAt");

-- CreateIndex
CREATE INDEX "CardEvent_cardId_createdAt_idx" ON "CardEvent"("cardId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "card_events_card_id_idempotency_key_unique" ON "CardEvent"("cardId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AppleRegistration_deviceLibraryId_cardId_key" ON "AppleRegistration"("deviceLibraryId", "cardId");

-- AddForeignKey
ALTER TABLE "OnboardingToken" ADD CONSTRAINT "OnboardingToken_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardEvent" ADD CONSTRAINT "CardEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppleRegistration" ADD CONSTRAINT "AppleRegistration_deviceLibraryId_fkey" FOREIGN KEY ("deviceLibraryId") REFERENCES "AppleDevice"("deviceLibraryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppleRegistration" ADD CONSTRAINT "AppleRegistration_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
