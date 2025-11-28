/*
  Warnings:

  - Added the required column `item_price` to the `cart_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'ABANDONED', 'CHECKED_OUT');

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "item_price" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "shopping_carts" ADD COLUMN     "cart_status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "total_price" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
