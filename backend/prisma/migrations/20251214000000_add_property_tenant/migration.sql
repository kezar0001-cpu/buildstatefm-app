-- CreateTable: Add PropertyTenant table
-- Supports assigning tenants directly to a property (e.g., houses with no units)

-- CreateTable
CREATE TABLE "PropertyTenant" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseStart" TIMESTAMP(3) NOT NULL,
    "leaseEnd" TIMESTAMP(3) NOT NULL,
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTenant_propertyId_tenantId_key" ON "PropertyTenant"("propertyId", "tenantId");

-- CreateIndex
CREATE INDEX "PropertyTenant_propertyId_idx" ON "PropertyTenant"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyTenant_tenantId_idx" ON "PropertyTenant"("tenantId");

-- CreateIndex
CREATE INDEX "PropertyTenant_isActive_idx" ON "PropertyTenant"("isActive");

-- CreateIndex
CREATE INDEX "PropertyTenant_tenantId_isActive_idx" ON "PropertyTenant"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "PropertyTenant" ADD CONSTRAINT "PropertyTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTenant" ADD CONSTRAINT "PropertyTenant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
