// routes/order.js
// Gerencia pedidos de compra (criar, listar, atualizar status)

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../utils/auth.js';
import { calculateTotalPrice } from '../utils/cartUtils.js';
import { validateRequest } from '../utils/validateRequest.js';
import { orderCreateSchema } from '../utils/schemas.js';

const prisma = new PrismaClient();
const router = Router();

// =================================================================
// ROTA 1: CRIAR NOVO PEDIDO (POST /api/orders) - PROTEGIDA
// =================================================================
// Criar novo pedido a partir do carrinho ativo (checkout)
router.post('/', authenticateToken, validateRequest(orderCreateSchema), async (req, res) => {
    const userId = req.user.id;
    const { shippingAddress, paymentMethod, notes } = req.body; 

    try {
        // Executar checkout em transação para garantir consistência de dados
        const order = await prisma.$transaction(async (tx) => {
            // 1. Procurar carrinho ativo do utilizador
            const activeCart = await tx.cart.findFirst({
                where: { userId: userId, cartStatus: 'ACTIVE' },
                include: {
                    items: {
                        include: {
                            variant: true
                        }
                    }
                },
            });

            if (!activeCart) {
                throw new Error('No active cart found to checkout.');
            }

            // 2. Validar que o carrinho não está vazio
            if (activeCart.items.length === 0) {
                throw new Error('Cart is empty. Cannot create an order.');
            }

            // 3. Calcular total do pedido baseado nos items do carrinho
            const calculatedTotal = calculateTotalPrice(activeCart.items);
            
            // 4. Criar novo pedido com status PENDING
            const newOrder = await tx.order.create({
                data: {
                    userId: userId,
                    orderStatus: 'PENDING',
                    totalPrice: calculatedTotal,
                    shippingAddress: shippingAddress,
                    paymentMethod: paymentMethod,
                    notes: notes,
                },
            });

            // 5. Converter items do carrinho em items do pedido (preservando preço de compra)
            const orderItemsData = activeCart.items.map(item => ({
                orderId: newOrder.id,
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                priceAtPurchase: item.itemPrice, 
            }));
            
            // 6. Guardar items do pedido
            await tx.orderItem.createMany({
                data: orderItemsData,
            });

            // 7. Marcar carrinho como COMPLETED e associar ao pedido
            await tx.cart.update({
                where: { id: activeCart.id },
                data: {
                    cartStatus: 'COMPLETED',
                    completedAt: new Date(),
                    orderId: newOrder.id, 
                },
            });
            
            // 8. Limpar items do carrinho após checkout bem-sucedido
            await tx.cartItem.deleteMany({
                 where: { cartId: activeCart.id },
            });

            return newOrder;

        });

        // Retornar o pedido criado com sucesso
        res.status(201).json({ 
            message: 'Pedido criado com sucesso. O seu carrinho foi finalizado.',
            orderId: order.id,
            total: order.totalPrice,
            status: order.orderStatus
        });

    } catch (error) {
        console.error('Erro na criação do Pedido (Checkout):', error);
        
        // Tratar erros específicos da nossa lógica de negócio
        if (error.message.includes('No active cart found') || error.message.includes('Cart is empty')) {
             return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Falha no processo de checkout. Tente novamente mais tarde.' });
    }
});

// =================================================================
// ROTA 2: OBTER TODOS OS PEDIDOS DO UTILIZADOR (GET /api/orders) - PROTEGIDA
// =================================================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Recuperar todos os pedidos do utilizador com detalhes dos items, produtos e variantes
        const orders = await prisma.order.findMany({
            where: { userId: userId },
            include: { 
                items: {
                    include: { 
                        product: { select: { id: true, name: true, imageUrl: true } },
                        variant: true
                    } 
                } 
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(orders);

    } catch (error) {
        console.error('Erro ao obter a lista de pedidos:', error);
        res.status(500).json({ error: 'Falha interna do servidor.' });
    }
});


// =================================================================
// ROTA 3: OBTER UM PEDIDO ESPECÍFICO (GET /api/orders/:orderId) - PROTEGIDA
// =================================================================
router.get('/:orderId', authenticateToken, async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const userId = req.user.id;
    
    try {
        // Recuperar pedido específico com todos os detalhes dos items, produtos e variantes
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { 
                items: {
                    include: { 
                        product: { select: { id: true, name: true, imageUrl: true, slug: true } },
                        variant: true
                    } 
                } 
            },
        });

        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }
        
        // Validar que o pedido pertence ao utilizador autenticado (proteção de acesso)
        if (order.userId !== userId) {
            return res.status(403).json({ error: 'Acesso negado: Este pedido não lhe pertence.' });
        }

        res.status(200).json(order);

    } catch (error) {
        console.error('Erro ao obter o pedido:', error);
        res.status(500).json({ error: 'Falha interna do servidor.' });
    }
});

export default router;