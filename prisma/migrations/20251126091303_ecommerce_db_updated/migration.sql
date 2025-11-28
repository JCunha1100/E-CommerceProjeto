/*
  Warnings:

  - You are about to drop the column `color` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the `product_option_values` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `variant_option_values` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[product_id,size]` on the table `product_variants` will be added. If there are existing duplicate values, this will fail.
  - Made the column `size` on table `product_variants` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNISEX');

-- DropForeignKey
ALTER TABLE "public"."product_option_values" DROP CONSTRAINT "product_option_values_option_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_options" DROP CONSTRAINT "product_options_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."variant_option_values" DROP CONSTRAINT "variant_option_values_option_value_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."variant_option_values" DROP CONSTRAINT "variant_option_values_variant_id_fkey";

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "color",
ALTER COLUMN "size" SET NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'UNISEX';

-- DropTable
DROP TABLE "public"."product_option_values";

-- DropTable
DROP TABLE "public"."product_options";

-- DropTable
DROP TABLE "public"."variant_option_values";

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_size_key" ON "product_variants"("product_id", "size");
