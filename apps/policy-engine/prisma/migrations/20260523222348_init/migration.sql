-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "marketingEmail" BOOLEAN NOT NULL DEFAULT true,
    "marketingPush" BOOLEAN NOT NULL DEFAULT true,
    "transactionalSms" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER NOT NULL DEFAULT 22,
    "quietHoursEnd" INTEGER NOT NULL DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT '2026-01-01 00:00:00 +00:00',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");
