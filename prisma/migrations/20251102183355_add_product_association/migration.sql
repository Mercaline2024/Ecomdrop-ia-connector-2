-- CreateTable
CREATE TABLE "ProductAssociation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "dropiProductId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "dropiProductName" TEXT,
    "shopifyProductTitle" TEXT,
    "importType" TEXT NOT NULL,
    "dropiVariations" TEXT,
    "saveDropiName" BOOLEAN NOT NULL DEFAULT true,
    "saveDropiDescription" BOOLEAN NOT NULL DEFAULT true,
    "customPrice" TEXT,
    "useSuggestedBarcode" BOOLEAN NOT NULL DEFAULT false,
    "saveDropiImages" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ProductAssociation_shop_idx" ON "ProductAssociation"("shop");

-- CreateIndex
CREATE INDEX "ProductAssociation_dropiProductId_idx" ON "ProductAssociation"("dropiProductId");

-- CreateIndex
CREATE INDEX "ProductAssociation_shopifyProductId_idx" ON "ProductAssociation"("shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssociation_shop_dropiProductId_shopifyProductId_key" ON "ProductAssociation"("shop", "dropiProductId", "shopifyProductId");
