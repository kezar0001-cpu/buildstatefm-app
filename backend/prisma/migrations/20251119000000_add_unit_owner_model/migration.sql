-- CreateTable
CREATE TABLE "UnitOwner" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownershipPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOwner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitOwner_unitId_idx" ON "UnitOwner"("unitId");

-- CreateIndex
CREATE INDEX "UnitOwner_ownerId_idx" ON "UnitOwner"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOwner_unitId_ownerId_key" ON "UnitOwner"("unitId", "ownerId");

-- AddForeignKey
ALTER TABLE "UnitOwner" ADD CONSTRAINT "UnitOwner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOwner" ADD CONSTRAINT "UnitOwner_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
