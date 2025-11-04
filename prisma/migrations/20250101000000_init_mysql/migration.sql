-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(255) NOT NULL,
    `state` VARCHAR(255) NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `scope` TEXT NULL,
    `expires` DATETIME(3) NULL,
    `accessToken` TEXT NOT NULL,
    `userId` BIGINT NULL,
    `firstName` VARCHAR(255) NULL,
    `lastName` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `accountOwner` BOOLEAN NOT NULL DEFAULT false,
    `locale` VARCHAR(10) NULL,
    `collaborator` BOOLEAN NULL,
    `emailVerified` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Session_shop_idx` ON `Session`(`shop`);

-- CreateTable
CREATE TABLE `ShopConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(255) NOT NULL,
    `ecomdropApiKey` TEXT NULL,
    `nuevoPedidoFlowId` VARCHAR(255) NULL,
    `carritoAbandonadoFlowId` VARCHAR(255) NULL,
    `dropiStoreName` VARCHAR(255) NULL,
    `dropiCountry` VARCHAR(10) NULL,
    `dropiToken` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShopConfiguration_shop_key`(`shop`),
    INDEX `ShopConfiguration_shop_idx`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductAssociation` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(255) NOT NULL,
    `dropiProductId` VARCHAR(255) NOT NULL,
    `shopifyProductId` VARCHAR(255) NOT NULL,
    `dropiProductName` VARCHAR(500) NULL,
    `shopifyProductTitle` VARCHAR(500) NULL,
    `importType` VARCHAR(50) NOT NULL,
    `dropiVariations` TEXT NULL,
    `saveDropiName` BOOLEAN NOT NULL DEFAULT true,
    `saveDropiDescription` BOOLEAN NOT NULL DEFAULT true,
    `customPrice` VARCHAR(50) NULL,
    `useSuggestedBarcode` BOOLEAN NOT NULL DEFAULT false,
    `saveDropiImages` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductAssociation_shop_dropiProductId_shopifyProductId_key`(`shop`, `dropiProductId`, `shopifyProductId`),
    INDEX `ProductAssociation_shop_idx`(`shop`),
    INDEX `ProductAssociation_dropiProductId_idx`(`dropiProductId`),
    INDEX `ProductAssociation_shopifyProductId_idx`(`shopifyProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(255) NOT NULL,
    `agentName` VARCHAR(255) NULL,
    `companyName` VARCHAR(255) NULL,
    `companyDescription` TEXT NULL,
    `paymentMethods` TEXT NULL,
    `companyPolicies` TEXT NULL,
    `faq` TEXT NULL,
    `postSaleFaq` TEXT NULL,
    `rules` TEXT NULL,
    `notifications` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AIConfiguration_shop_key`(`shop`),
    INDEX `AIConfiguration_shop_idx`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

