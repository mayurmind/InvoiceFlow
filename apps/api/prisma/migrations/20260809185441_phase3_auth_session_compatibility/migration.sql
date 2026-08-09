-- AlterTable
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "replacedBySessionId" UUID,
ADD COLUMN "rotatedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_replacedBySessionId_key" ON "sessions"("replacedBySessionId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_replacedBySessionId_fkey" FOREIGN KEY ("replacedBySessionId") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddCheck
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_replacement_not_self_check"
CHECK (
  "replacedBySessionId" IS NULL
  OR "replacedBySessionId" <> "id"
);

-- AddCheck
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_rotation_replacement_consistency_check"
CHECK (
  (
    "rotatedAt" IS NULL
    AND "replacedBySessionId" IS NULL
  )
  OR
  (
    "rotatedAt" IS NOT NULL
    AND "replacedBySessionId" IS NOT NULL
  )
);
