-- CreateTable
CREATE TABLE "AIConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "agentName" TEXT,
    "companyName" TEXT,
    "companyDescription" TEXT,
    "paymentMethods" TEXT,
    "companyPolicies" TEXT,
    "faq" TEXT,
    "postSaleFaq" TEXT,
    "rules" TEXT,
    "notifications" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AIConfiguration_shop_key" ON "AIConfiguration"("shop");

-- CreateIndex
CREATE INDEX "AIConfiguration_shop_idx" ON "AIConfiguration"("shop");
