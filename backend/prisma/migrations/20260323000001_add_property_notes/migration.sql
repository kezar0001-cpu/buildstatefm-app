-- CreateTable
CREATE TABLE "PropertyNote" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PropertyNote" ADD CONSTRAINT "PropertyNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyNote" ADD CONSTRAINT "PropertyNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PropertyNote_propertyId_idx" ON "PropertyNote"("propertyId");
CREATE INDEX "PropertyNote_authorId_idx" ON "PropertyNote"("authorId");
