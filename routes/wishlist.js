// routes/wishlist.js
// Gerencia lista de desejos do utilizador

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { wishlistAddSchema } from '../utils/schemas.js';

const prisma = new PrismaClient();
const router = Router();

// =================================================================
// ROTA 1: LISTAR ITENS NA WISHLIST (GET /api/wishlist) - PROTEGIDA
// =================================================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Recuperar todos os items da wishlist do utilizador com detalhes do produto e variante
        const wishlistItems = await prisma.wishlist.findMany({
            where: { userId: userId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        description: true,
                        images: { where: { isPrimary: true }, select: { url: true } },
                    },
                },
                variant: {
                    select: {
                        id: true,
                        title: true,
                        size: true,
                        price: true,
                        stock: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Formatar dados para retorno, incluindo URL da imagem principal
        const formattedItems = wishlistItems.map(item => ({
            id: item.id,
            product: {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                price: item.product.price,
                description: item.product.description,
                primaryImageUrl: item.product.images.length > 0 ? item.product.images[0].url : null,
            },
            variant: item.variant,
        }));

        res.status(200).json(formattedItems);

    } catch (error) {
        console.error('Erro ao listar wishlist:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao listar wishlist.' });
    }
});

// =================================================================
// ROTA 2: ADICIONAR ITEM À WISHLIST (POST /api/wishlist) - PROTEGIDA
// =================================================================
router.post('/', authenticateToken, validateRequest(wishlistAddSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, variantId } = req.body;

        const numericProductId = parseInt(productId);
        const numericVariantId = parseInt(variantId);

        // Validar que o produto existe
        const product = await prisma.product.findUnique({
            where: { id: numericProductId },
        });

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        // Validar que a variante existe e pertence ao produto
        const variant = await prisma.productVariant.findUnique({
            where: { id: numericVariantId },
        });

        if (!variant || variant.productId !== numericProductId) {
            return res.status(404).json({ error: 'Variante não encontrada ou não pertence a este produto.' });
        }

        // Verificar se o item já está na wishlist (combinação única de utilizador + variante)
        const existingWishlistItem = await prisma.wishlist.findUnique({
            where: {
                userId_variantId: {
                    userId: userId,
                    variantId: numericVariantId,
                },
            },
        });

        if (existingWishlistItem) {
            return res.status(409).json({ error: 'Este item já está na sua wishlist.' });
        }

        // Adicionar item à wishlist do utilizador
        const newWishlistItem = await prisma.wishlist.create({
            data: {
                userId: userId,
                productId: numericProductId,
                variantId: numericVariantId,
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        images: { where: { isPrimary: true }, select: { url: true } },
                    },
                },
                variant: {
                    select: {
                        id: true,
                        title: true,
                        size: true,
                        price: true,
                        stock: true,
                    },
                },
            },
        });

        res.status(201).json({
            id: newWishlistItem.id,
            product: newWishlistItem.product,
            variant: newWishlistItem.variant,
        });

    } catch (error) {
        // Erro P2003: Chave estrangeira violada
        if (error.code === 'P2003') {
            return res.status(400).json({ error: 'Produto ou variante inválida fornecida.' });
        }
        console.error('Erro ao adicionar item à wishlist:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao adicionar à wishlist.' });
    }
});

// =================================================================
// ROTA 3: REMOVER ITEM DA WISHLIST (DELETE /api/wishlist/:variantId) - PROTEGIDA
// =================================================================
router.delete('/:variantId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const variantId = parseInt(req.params.variantId);

        // Verificar se o item existe na wishlist do utilizador
        const wishlistItem = await prisma.wishlist.findUnique({
            where: {
                userId_variantId: {
                    userId: userId,
                    variantId: variantId,
                },
            },
        });

        if (!wishlistItem) {
            return res.status(404).json({ error: 'Item não encontrado na wishlist.' });
        }

        // Remover item da wishlist
        await prisma.wishlist.delete({
            where: {
                userId_variantId: {
                    userId: userId,
                    variantId: variantId,
                },
            },
        });

        res.status(204).send();

    } catch (error) {
        console.error('Erro ao remover item da wishlist:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao remover da wishlist.' });
    }
});

// =================================================================
// ROTA 4: VERIFICAR SE ITEM ESTÁ NA WISHLIST (HEAD /api/wishlist/:variantId) - PROTEGIDA
// =================================================================
router.head('/:variantId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const variantId = parseInt(req.params.variantId);

        // Verificar se a variante está na wishlist do utilizador
        const wishlistItem = await prisma.wishlist.findUnique({
            where: {
                userId_variantId: {
                    userId: userId,
                    variantId: variantId,
                },
            },
        });

        // Retornar 200 se existe, 404 se não existe (sem corpo na resposta)
        if (wishlistItem) {
            res.status(200).send();
        } else {
            res.status(404).send();
        }

    } catch (error) {
        console.error('Erro ao verificar wishlist:', error);
        res.status(500).send();
    }
});

export default router;
