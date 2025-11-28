// routes/cart.js
// Gerencia carrinho de compras do utilizador (adicionar, atualizar, remover itens)

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../utils/auth.js';
import { calculateTotalPrice } from '../utils/cartUtils.js';
import { validateRequest } from '../utils/validateRequest.js';
import { cartItemAddSchema, cartItemUpdateSchema } from '../utils/schemas.js';

const prisma = new PrismaClient();
console.log('Cart - Prisma instance created:', !!prisma);
const router = Router();

// =================================================================
// ROTA 1: OBTER/CRIAR CARRINHO (GET /api/cart) - PROTEGIDA
// =================================================================
// Recuperar carrinho ativo ou criar novo, com atualização automática de totais
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('Cart GET - Prisma type:', typeof prisma, prisma ? 'DEFINED' : 'UNDEFINED');
        const userId = req.user.id;

        // Procurar carrinho ativo existente do utilizador
        const where = { 
            userId: userId,
            cartStatus: 'ACTIVE',
        };

        let cart = await prisma.cart.findFirst({
            where,
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, slug: true }
                        },
                        variant: true,
                    },
                    orderBy: { createdAt: 'asc' }
                },
            },
        });

        // Se não existe, criar novo carrinho ativo
        if (!cart) {
            cart = await prisma.cart.create({
                data: {
                    userId: userId,
                    cartStatus: 'ACTIVE',
                    totalPrice: 0.00,
                },
                include: { items: true },
            });
            return res.status(201).json(cart);
        }

        // Recalcular total baseado em items atuais (preços podem ter mudado)
        const totalPrice = calculateTotalPrice(cart.items);
        
        // Atualizar total se diferente do valor armazenado
        if (cart.totalPrice !== totalPrice) {
            cart = await prisma.cart.update({
                where: { id: cart.id },
                data: { totalPrice: totalPrice },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, name: true, slug: true } },
                            variant: true,
                        },
                        orderBy: { createdAt: 'asc' }
                    }
                }
            });
        }
        
        res.status(200).json(cart);

    } catch (error) {
        console.error('Erro ao obter/criar carrinho:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao processar o carrinho.' });
    }
});

// =================================================================
// ROTA 2: ADICIONAR ITEM AO CARRINHO (POST /api/cart/items) - PROTEGIDA
// =================================================================
// Adicionar item ao carrinho (ou incrementar quantidade se já existe)
router.post('/items', authenticateToken, validateRequest(cartItemAddSchema), async (req, res) => {
    const { productId, variantId, quantity } = req.body;
    const userId = req.user.id;
    const qty = parseInt(quantity);

    try {
        // Procurar ou criar carrinho ativo do utilizador
        let cart = await prisma.cart.findFirst({
            where: { userId, cartStatus: 'ACTIVE' },
        });

        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId, cartStatus: 'ACTIVE', totalPrice: 0.00 },
            });
        }
        
        const cartId = cart.id;

        // Verificar se o item (produto+variante) já existe no carrinho
        let cartItem = await prisma.cartItem.findFirst({
            where: {
                cartId: cartId,
                productId: parseInt(productId),
                variantId: parseInt(variantId),
            },
            include: { variant: true }
        });
        
        // Obtém preço da variação
        const variant = await prisma.productVariant.findUnique({
            where: { id: parseInt(variantId) },
            select: { price: true }
        });
        
        if (!variant) {
            return res.status(404).json({ error: 'Variação de produto não encontrada.' });
        }
        const pricePerUnit = variant.price;

        let updatedCartItem;
        let responseStatus;
        
        // Se existe, incrementa quantidade; senão, cria novo
        if (cartItem) {
            const newQuantity = cartItem.quantity + qty;
            updatedCartItem = await prisma.cartItem.update({
                where: { id: cartItem.id },
                data: {
                    quantity: newQuantity,
                    itemPrice: pricePerUnit 
                },
                include: { product: true, variant: true }
            });
            responseStatus = 200;
        } else {
            updatedCartItem = await prisma.cartItem.create({
                data: {
                    cartId: cartId,
                    productId: parseInt(productId),
                    variantId: parseInt(variantId),
                    quantity: qty,
                    itemPrice: pricePerUnit,
                },
                include: { product: true, variant: true }
            });
            responseStatus = 201;
        }

        // Recalcula total do carrinho
        const allItems = await prisma.cartItem.findMany({ where: { cartId } });
        const newTotalPrice = calculateTotalPrice(allItems);
        
        await prisma.cart.update({
            where: { id: cartId },
            data: { totalPrice: newTotalPrice }
        });

        res.status(responseStatus).json(updatedCartItem);

    } catch (error) {
        console.error('Erro ao adicionar/atualizar item no carrinho:', error);
        // Produto, variação ou carrinho não existem
        if (error.code === 'P2003') {
            return res.status(404).json({ error: 'Produto ou variação inválida fornecida.' });
        }
        res.status(500).json({ error: 'Falha interna do servidor.' });
    }
});

// =================================================================
// ROTA 3: ATUALIZAR QUANTIDADE (PUT /api/cart/items/:itemId) - PROTEGIDA
// =================================================================
// Atualizar quantidade de um item no carrinho (com recálculo de total)
router.put('/items/:itemId', authenticateToken, validateRequest(cartItemUpdateSchema), async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    const userId = req.user.id;
    const { quantity } = req.body;
    const newQty = parseInt(quantity);

    try {
        // Procurar item com informações do carrinho
        let cartItem = await prisma.cartItem.findUnique({
            where: { id: itemId },
            include: { cart: true, variant: true }
        });

        if (!cartItem) {
            return res.status(404).json({ error: 'Item do carrinho não encontrado.' });
        }
        
        // Validar que o item pertence ao carrinho ativo do utilizador autenticado
        if (cartItem.cart.userId !== userId || cartItem.cart.cartStatus !== 'ACTIVE') {
             return res.status(403).json({ error: 'Acesso negado: Este item não pertence ao seu carrinho ativo.' });
        }

        // Atualizar quantidade do item
        const updatedCartItem = await prisma.cartItem.update({
            where: { id: itemId },
            data: { quantity: newQty },
            include: { product: true, variant: true }
        });

        // Recalcula total do carrinho
        const allItems = await prisma.cartItem.findMany({ where: { cartId: cartItem.cartId } });
        const newTotalPrice = calculateTotalPrice(allItems);
        
        await prisma.cart.update({
            where: { id: cartItem.cartId },
            data: { totalPrice: newTotalPrice }
        });
        
        res.status(200).json(updatedCartItem);

    } catch (error) {
        // Item não encontrado
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Item do carrinho não encontrado.' });
        }
        console.error('Erro ao atualizar quantidade do item:', error);
        res.status(500).json({ error: 'Falha interna do servidor.' });
    }
});

// =================================================================
// ROTA 4: REMOVER ITEM (DELETE /api/cart/items/:itemId) - PROTEGIDA
// =================================================================
// Remover um item do carrinho (com recálculo de total)
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    const userId = req.user.id;

    try {
        // Procurar item com informações do carrinho
        const cartItem = await prisma.cartItem.findUnique({
            where: { id: itemId },
            include: { cart: true }
        });

        if (!cartItem) {
            return res.status(404).json({ error: 'Item do carrinho não encontrado.' });
        }
        
        // Validar que o item pertence ao carrinho ativo do utilizador autenticado
        if (cartItem.cart.userId !== userId || cartItem.cart.cartStatus !== 'ACTIVE') {
             return res.status(403).json({ error: 'Acesso negado: Este item não pertence ao seu carrinho ativo.' });
        }
        
        const cartId = cartItem.cartId;

        // Remover item do carrinho
        await prisma.cartItem.delete({
            where: { id: itemId },
        });

        // Recalcular total do carrinho após remoção
        const allItems = await prisma.cartItem.findMany({ where: { cartId } });
        const newTotalPrice = calculateTotalPrice(allItems);
        
        await prisma.cart.update({
            where: { id: cartId },
            data: { totalPrice: newTotalPrice }
        });

        res.status(204).send();
        
    } catch (error) {
        // Item não encontrado
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Item do carrinho não encontrado.' });
        }
        console.error('Erro ao remover item do carrinho:', error);
        res.status(500).json({ error: 'Falha interna do servidor.' });
    }
});


export default router;