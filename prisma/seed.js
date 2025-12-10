// prisma/seed.js
// Script para popular a base de dados com dados de teste

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

async function main() {
    console.log('🌱 Iniciando seed da base de dados...');

    try {
        // Limpar dados
        console.log('Limpando tabelas...');
        await prisma.orderLineItem.deleteMany();
        await prisma.order.deleteMany();
        await prisma.cartItem.deleteMany();
        await prisma.shoppingCart.deleteMany();
        await prisma.wishlist.deleteMany();
        await prisma.productImage.deleteMany();
        await prisma.productVariant.deleteMany();
        await prisma.product.deleteMany();
        await prisma.category.deleteMany();
        await prisma.brand.deleteMany();
        await prisma.userAddress.deleteMany();
        await prisma.user.deleteMany();
        console.log('✅ Tabelas limpas');

        // ===================================================================
        // 1. CRIAR USERS
        // ===================================================================
        const passwordHash = await hashPassword('password');

        const owner = await prisma.user.create({
            data: {
                email: 'owner@ecommerce.com',
                firstName: 'Owner',
                lastName: 'System',
                passwordHash,
                role: 'OWNER',
            },
        });
        console.log('✅ Owner criado');

        const admins = await Promise.all([
            prisma.user.create({
                data: {
                    email: 'admin1@ecommerce.com',
                    firstName: 'Admin',
                    lastName: 'One',
                    passwordHash,
                    role: 'ADMIN',
                },
            }),
            prisma.user.create({
                data: {
                    email: 'admin2@ecommerce.com',
                    firstName: 'Admin',
                    lastName: 'Two',
                    passwordHash,
                    role: 'ADMIN',
                },
            }),
            prisma.user.create({
                data: {
                    email: 'admin3@ecommerce.com',
                    firstName: 'Admin',
                    lastName: 'Three',
                    passwordHash,
                    role: 'ADMIN',
                },
            }),
        ]);
        console.log('✅ 3 admins criados');

        const users = await Promise.all([
            prisma.user.create({
                data: {
                    email: 'user1@example.com',
                    firstName: 'João',
                    lastName: 'Silva',
                    passwordHash,
                    role: 'USER',
                },
            }),
            prisma.user.create({
                data: {
                    email: 'user2@example.com',
                    firstName: 'Maria',
                    lastName: 'Santos',
                    passwordHash,
                    role: 'USER',
                },
            }),
            prisma.user.create({
                data: {
                    email: 'user3@example.com',
                    firstName: 'Pedro',
                    lastName: 'Oliveira',
                    passwordHash,
                    role: 'USER',
                },
            }),
            prisma.user.create({
                data: {
                    email: 'user4@example.com',
                    firstName: 'Ana',
                    lastName: 'Costa',
                    passwordHash,
                    role: 'USER',
                },
            }),
            prisma.user.create({
                data: {
                    email: 'user5@example.com',
                    firstName: 'Carlos',
                    lastName: 'Ferreira',
                    passwordHash,
                    role: 'USER',
                },
            }),
        ]);
        console.log('✅ 5 utilizadores criados');

        // ===================================================================
        // 2. CRIAR ENDEREÇOS
        // ===================================================================
        await Promise.all(
            users.map((user) =>
                prisma.userAddress.create({
                    data: {
                        userId: user.id,
                        type: 'shipping',
                        addressLine1: `Rua ${user.firstName}, ${Math.floor(Math.random() * 100) + 1}`,
                        city: 'Lisboa',
                        state: 'Lisboa',
                        postalCode: '1000-001',
                        country: 'Portugal',
                        isDefault: true,
                    },
                })
            )
        );
        console.log('✅ 5 endereços criados');

        // ===================================================================
        // 3. CRIAR MARCAS
        // ===================================================================
        const brands = await Promise.all([
            prisma.brand.create({
                data: { name: 'Nike', slug: 'nike', description: 'Marca de desporto americana' },
            }),
            prisma.brand.create({
                data: { name: 'Adidas', slug: 'adidas', description: 'Marca de desporto alemã' },
            }),
            prisma.brand.create({
                data: { name: 'Puma', slug: 'puma', description: 'Marca de desporto alemã' },
            }),
            prisma.brand.create({
                data: { name: 'New Balance', slug: 'new-balance', description: 'Marca de desporto americana' },
            }),
            prisma.brand.create({
                data: { name: 'Tommy Hilfiger', slug: 'tommy-hilfiger', description: 'Marca de moda premium' },
            }),
            prisma.brand.create({
                data: { name: 'Calvin Klein', slug: 'calvin-klein', description: 'Marca de moda premium' },
            }),
        ]);
        console.log('✅ 6 marcas criadas');

        // ===================================================================
        // 4. CRIAR CATEGORIAS
        // ===================================================================
        const categoriaRoupa = await prisma.category.create({
            data: { name: 'Roupa', slug: 'roupa', description: 'Toda a roupa' },
        });

        const subcategoriaRoupa = await Promise.all([
            prisma.category.create({
                data: { name: 'T-Shirts', slug: 't-shirts', parentId: categoriaRoupa.id },
            }),
            prisma.category.create({
                data: { name: 'Calças', slug: 'calcas', parentId: categoriaRoupa.id },
            }),
            prisma.category.create({
                data: { name: 'Casacos', slug: 'casacos', parentId: categoriaRoupa.id },
            }),
            prisma.category.create({
                data: { name: 'Shorts', slug: 'shorts', parentId: categoriaRoupa.id },
            }),
        ]);

        const categoriaSapatilhas = await prisma.category.create({
            data: { name: 'Sapatilhas', slug: 'sapatilhas', description: 'Sapatilhas e ténis' },
        });

        const subcategoriaSapatilhas = await Promise.all([
            prisma.category.create({
                data: { name: 'Ténis', slug: 'tenis', parentId: categoriaSapatilhas.id },
            }),
            prisma.category.create({
                data: { name: 'Sapatos Casual', slug: 'sapatos-casual', parentId: categoriaSapatilhas.id },
            }),
            prisma.category.create({
                data: { name: 'Botas', slug: 'botas', parentId: categoriaSapatilhas.id },
            }),
            prisma.category.create({
                data: { name: 'Sandálias', slug: 'sandalias', parentId: categoriaSapatilhas.id },
            }),
        ]);

        const categoriaAcessorios = await prisma.category.create({
            data: { name: 'Acessórios', slug: 'acessorios', description: 'Acessórios diversos' },
        });

        const subcategoriaAcessorios = await Promise.all([
            prisma.category.create({
                data: { name: 'Bonés', slug: 'bones', parentId: categoriaAcessorios.id },
            }),
            prisma.category.create({
                data: { name: 'Mochilas', slug: 'mochilas', parentId: categoriaAcessorios.id },
            }),
            prisma.category.create({
                data: { name: 'Meias', slug: 'meias', parentId: categoriaAcessorios.id },
            }),
            prisma.category.create({
                data: { name: 'Lenços e Cachecol', slug: 'lencos-cachecol', parentId: categoriaAcessorios.id },
            }),
        ]);
        console.log('✅ 3 categorias + 12 subcategorias criadas');

        // ===================================================================
        // 5. CRIAR PRODUTOS
        // ===================================================================
        const productsData = [
            { name: 'Nike Air T-Shirt', slug: 'nike-air-t-shirt', price: 29.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaRoupa[0].id, isFeatured: true },
            { name: 'Adidas Woman T-Shirt', slug: 'adidas-woman-t-shirt', price: 34.99, gender: 'FEMALE', brandId: brands[1].id, categoryId: subcategoriaRoupa[0].id },
            { name: 'Nike Joggers', slug: 'nike-joggers', price: 59.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaRoupa[1].id },
            { name: 'Adidas Jeans', slug: 'adidas-jeans', price: 79.99, gender: 'MALE', brandId: brands[1].id, categoryId: subcategoriaRoupa[1].id },
            { name: 'Nike Jacket Winter', slug: 'nike-jacket-winter', price: 139.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaRoupa[2].id, isFeatured: true },
            { name: 'Nike Shorts', slug: 'nike-shorts', price: 44.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaRoupa[3].id },
            { name: 'Nike Air Max', slug: 'nike-air-max', price: 129.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaSapatilhas[0].id, isFeatured: true },
            { name: 'Adidas Ultra Boost', slug: 'adidas-ultra-boost', price: 179.99, gender: 'FEMALE', brandId: brands[1].id, categoryId: subcategoriaSapatilhas[0].id, isFeatured: true },
            { name: 'Puma Running Shoes', slug: 'puma-running-shoes', price: 99.99, gender: 'MALE', brandId: brands[2].id, categoryId: subcategoriaSapatilhas[0].id },
            { name: 'Nike Winter Boots', slug: 'nike-winter-boots', price: 149.99, gender: 'FEMALE', brandId: brands[0].id, categoryId: subcategoriaSapatilhas[2].id },
            { name: 'Adidas Summer Sandals', slug: 'adidas-sandals', price: 44.99, gender: 'MALE', brandId: brands[1].id, categoryId: subcategoriaSapatilhas[3].id },
            { name: 'Nike Cap', slug: 'nike-cap', price: 24.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaAcessorios[0].id },
            { name: 'Nike Backpack', slug: 'nike-backpack', price: 89.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaAcessorios[1].id, isFeatured: true },
            { name: 'Adidas Backpack', slug: 'adidas-backpack', price: 79.99, gender: 'FEMALE', brandId: brands[1].id, categoryId: subcategoriaAcessorios[1].id },
            { name: 'Nike Socks', slug: 'nike-socks', price: 19.99, gender: 'MALE', brandId: brands[0].id, categoryId: subcategoriaAcessorios[2].id },
            { name: 'Tommy Scarf', slug: 'tommy-scarf', price: 59.99, gender: 'FEMALE', brandId: brands[4].id, categoryId: subcategoriaAcessorios[3].id },
        ];

        const products = await Promise.all(
            productsData.map((p) =>
                prisma.product.create({
                    data: {
                        ...p,
                        description: `Descrição do produto ${p.name}`,
                        isActive: true,
                    },
                })
            )
        );
        console.log(`✅ ${products.length} produtos criados`);

        // ===================================================================
        // 6. CRIAR VARIANTES (TAMANHOS)
        // ===================================================================
        for (const product of products) {
            const sizes = product.categoryId === subcategoriaSapatilhas[0].id ||
                product.categoryId === subcategoriaSapatilhas[1].id ||
                product.categoryId === subcategoriaSapatilhas[2].id ||
                product.categoryId === subcategoriaSapatilhas[3].id
                ? ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44']
                : ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

            for (const size of sizes) {
                await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        size,
                        sku: `${product.slug}-${size}`.toUpperCase(),
                        stock: Math.floor(Math.random() * 50) + 10,
                        title: `${product.name} - ${size}`,
                        price: product.price || 0,
                        costPrice: (product.price || 0) * 0.4,
                    },
                });
            }
        }
        console.log('✅ Variantes criadas para todos os tamanhos');

        // ===================================================================
        // 7. CRIAR IMAGENS
        // ===================================================================
        for (const product of products) {
            const imageCount = Math.floor(Math.random() * 2) + 1;
            for (let i = 1; i <= imageCount; i++) {
                await prisma.productImage.create({
                    data: {
                        productId: product.id,
                        imageUrl: `${product.slug}-image-${i}.jpg`,
                        isPrimary: i === 1,
                        altText: `${product.name} imagem ${i}`,
                    },
                });
            }
        }
        console.log('✅ Imagens de produtos criadas');

        // ===================================================================
        // 8. CRIAR CARRINHOS
        // ===================================================================
        for (const user of users) {
            const cart = await prisma.shoppingCart.create({
                data: {
                    userId: user.id,
                    cartStatus: 'ACTIVE',
                    totalPrice: 0,
                },
            });

            const itemCount = Math.floor(Math.random() * 3) + 1;
            const randomProducts = products.sort(() => 0.5 - Math.random()).slice(0, itemCount);

            for (const product of randomProducts) {
                const variant = await prisma.productVariant.findFirst({
                    where: { productId: product.id },
                });

                if (variant) {
                    await prisma.cartItem.create({
                        data: {
                            cartId: cart.id,
                            productId: product.id,
                            variantId: variant.id,
                            quantity: Math.floor(Math.random() * 3) + 1,
                            itemPrice: product.price || 0,
                        },
                    });
                }
            }
        }
        console.log('✅ Carrinhos criados');

        // ===================================================================
        // 9. CRIAR WISHLIST
        // ===================================================================
        for (const user of users) {
            const randomProducts = products.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 5) + 2);
            for (const product of randomProducts) {
                await prisma.wishlist.create({
                    data: {
                        userId: user.id,
                        productId: product.id,
                    },
                }).catch(() => null); // Ignorar duplicatas
            }
        }
        console.log('✅ Wishlist criada');

        // ===================================================================
        // 10. CRIAR PEDIDOS
        // ===================================================================
        const orderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        const financialStatuses = ['pending', 'paid', 'refunded', 'voided'];
        const fulfillmentStatuses = ['unfulfilled', 'partial', 'fulfilled', 'returned'];

        for (const user of users) {
            const orderCount = Math.floor(Math.random() * 3) + 1;

            for (let j = 0; j < orderCount; j++) {
                const randomProducts = products.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);

                let orderTotal = 0;
                const orderItems = [];

                for (const product of randomProducts) {
                    const quantity = Math.floor(Math.random() * 3) + 1;
                    const itemTotal = (product.price || 0) * quantity;
                    orderTotal += itemTotal;

                    const variant = await prisma.productVariant.findFirst({
                        where: { productId: product.id },
                    });

                    if (variant) {
                        orderItems.push({
                            productId: product.id,
                            variantId: variant.id,
                            quantity,
                            price: product.price || 0,
                            total: itemTotal,
                            title: product.name,
                            variantTitle: variant.title,
                            sku: variant.sku,
                        });
                    }
                }

                const taxAmount = Math.round(orderTotal * 0.23 * 100) / 100;
                const totalAmount = Math.round((orderTotal + 5 + taxAmount) * 100) / 100;

                const order = await prisma.order.create({
                    data: {
                        userId: user.id,
                        email: user.email,
                        orderNumber: `ORD-${Date.now()}-${user.id}-${j}`,
                        status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
                        financialStatus: financialStatuses[Math.floor(Math.random() * financialStatuses.length)],
                        fulfillmentStatus: fulfillmentStatuses[Math.floor(Math.random() * fulfillmentStatuses.length)],
                        subtotal: orderTotal,
                        shippingAmount: 5.00,
                        taxAmount,
                        totalAmount,
                    },
                });

                for (const item of orderItems) {
                    await prisma.orderLineItem.create({
                        data: {
                            orderId: order.id,
                            productId: item.productId,
                            variantId: item.variantId,
                            quantity: item.quantity,
                            price: item.price,
                            total: item.total,
                            title: item.title,
                            variantTitle: item.variantTitle,
                            sku: item.sku,
                        },
                    });
                }
            }
        }
        console.log('✅ Pedidos criados');

        console.log('\n✨ Seed concluído com sucesso!');
        console.log('\n📊 Dados criados:');
        console.log('   ✓ 1 Owner');
        console.log('   ✓ 3 Admins');
        console.log('   ✓ 5 Utilizadores');
        console.log('   ✓ 6 Marcas');
        console.log('   ✓ 3 Categorias + 12 Subcategorias');
        console.log(`   ✓ ${products.length} Produtos`);
        console.log('   ✓ Variantes para todos os tamanhos');
        console.log('   ✓ Imagens de produtos');
        console.log('   ✓ Carrinhos de compras');
        console.log('   ✓ Wishlist');
        console.log('   ✓ Pedidos com itens');
        console.log('\n🔑 Password para todos: password');
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
