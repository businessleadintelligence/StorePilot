-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'member');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_store_id_idx" ON "users"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_store_idx" ON "users"("email", "storeId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
