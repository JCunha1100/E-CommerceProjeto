-- DropForeignKey
ALTER TABLE "public"."shopping_carts" DROP CONSTRAINT "shopping_carts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."wishlists" DROP CONSTRAINT "wishlists_variant_id_fkey";

-- AddForeignKey
ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
