-- CreateTable
CREATE TABLE `EmbeddedDocument` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NOT NULL,
    `embedding` vector(1536) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmbeddedDocument` ADD CONSTRAINT `EmbeddedDocument_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
