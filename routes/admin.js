// routes/admin.js
// Painel administrativo: gestão de pedidos, utilizadores, relatórios

import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken, requireAdmin, requireOwner } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { orderStatusUpdateSchema, fulfillmentStatusUpdateSchema } from '../utils/schemas.js';
import { Decimal } from '@prisma/client/runtime/library';
const router = Router();

// =================================================================
// ROTA 1: LISTAR TODOS OS PEDIDOS (GET /api/admin/orders) - PROTEGIDA
// =================================================================
router.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, financialStatus, fulfillmentStatus, limit = 50, page = 1, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const take = parseInt(limit);
        const skip = (parseInt(page) - 1) * take;

        // Construir filtros dinamicamente baseado nos parâmetros fornecidos
        const where = {};

        if (status) where.status = status;
        if (financialStatus) where.financialStatus = financialStatus;
        if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;

        // Executar query de pedidos e contagem total em transação
        const [orders, totalCount] = await prisma.$transaction([
            prisma.order.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    lineItems: { select: { id: true, title: true, quantity: true, price: true } },
                },
                orderBy: { [sortBy]: sortOrder },
                take,
                skip,
            }),
            prisma.order.count({ where }),
        ]);

        // Retornar com informações de paginação
        res.status(200).json({
            data: orders,
            total: totalCount,
            page: parseInt(page),
            limit: take,
            totalPages: Math.ceil(totalCount / take),
        });

    } catch (error) {
        console.error('Erro ao listar pedidos (admin):', error);
        res.status(500).json({ error: 'Falha ao listar pedidos.' });
    }
});

// =================================================================
// ROTA 2: OBTER DETALHES DO PEDIDO (GET /api/admin/orders/:id) - PROTEGIDA
// =================================================================
router.get('/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);

        // Retornar pedido completo com informações do utilizador, items, produtos e transações
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                lineItems: {
                    include: {
                        product: { select: { id: true, name: true, slug: true } },
                        variant: { select: { id: true, title: true, size: true } },
                    },
                },
                transactions: { select: { id: true, stripeId: true, status: true, amount: true, createdAt: true } },
            },
        });

        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        res.status(200).json(order);

    } catch (error) {
        console.error('Erro ao obter detalhes do pedido:', error);
        res.status(500).json({ error: 'Falha ao obter detalhes do pedido.' });
    }
});

// =================================================================
// ROTA 3: ATUALIZAR STATUS DO PEDIDO (PUT /api/admin/orders/:id/status) - PROTEGIDA
// =================================================================
router.put('/orders/:id/status', authenticateToken, requireAdmin, validateRequest(orderStatusUpdateSchema), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;

        const order = await prisma.order.findUnique({ where: { id: orderId } });

        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        // Atualizar status do pedido (ex: processing, shipped, delivered, cancelled)
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status },
            include: {
                user: { select: { id: true, email: true } },
                lineItems: true,
            },
        });

        res.status(200).json(updatedOrder);

    } catch (error) {
        console.error('Erro ao atualizar status do pedido:', error);
        res.status(500).json({ error: 'Falha ao atualizar status do pedido.' });
    }
});

// =================================================================
// ROTA 4: ATUALIZAR FULFILLMENT STATUS (PUT /api/admin/orders/:id/fulfillment) - PROTEGIDA
// =================================================================
router.put('/orders/:id/fulfillment', authenticateToken, requireAdmin, validateRequest(fulfillmentStatusUpdateSchema), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { fulfillmentStatus } = req.body;

        const order = await prisma.order.findUnique({ where: { id: orderId } });

        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        // Atualizar status de cumprimento do pedido (ex: unfulfilled, fulfilled, partial)
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { fulfillmentStatus },
            include: {
                user: { select: { id: true, email: true } },
                lineItems: true,
            },
        });

        res.status(200).json(updatedOrder);

    } catch (error) {
        console.error('Erro ao atualizar fulfillment status:', error);
        res.status(500).json({ error: 'Falha ao atualizar fulfillment status.' });
    }
});

// =================================================================
// ROTA 5: DASHBOARD STATS (GET /api/admin/stats) - PROTEGIDA
// =================================================================
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Aplicar filtro de data se fornecido
        let where = {};

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        // Executar múltiplas contagens e agregações em transação para eficiência
        const [totalOrders, paidOrders, cancelledOrders, totalProducts, totalUsers, revenueData] = await prisma.$transaction([
            prisma.order.count({ where }),
            prisma.order.count({ where: { ...where, financialStatus: 'paid' } }),
            prisma.order.count({ where: { ...where, status: 'cancelled' } }),
            prisma.product.count(),
            prisma.user.count(),
            prisma.order.aggregate({
                where: { ...where, financialStatus: 'paid' },
                _sum: { totalAmount: true },
            }),
        ]);

        // Calcular receita total e média por pedido
        const totalRevenue = revenueData._sum.totalAmount ? parseFloat(revenueData._sum.totalAmount) : 0;

        const stats = {
            orders: {
                total: totalOrders,
                paid: paidOrders,
                cancelled: cancelledOrders,
            },
            revenue: {
                total: totalRevenue,
                average: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            },
            products: totalProducts,
            users: totalUsers,
        };

        res.status(200).json(stats);

    } catch (error) {
        console.error('Erro ao obter stats:', error);
        res.status(500).json({ error: 'Falha ao obter estatísticas.' });
    }
});

// =================================================================
// ROTA 6: PRODUTOS TOP (GET /api/admin/top-products) - PROTEGIDA
// =================================================================
router.get('/top-products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const take = parseInt(limit);

        // Agrupar items de pedido por produto e calcular total vendido e receita
        const topProducts = await prisma.orderLineItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true, total: true },
            _count: true,
            orderBy: [
                { _sum: { quantity: 'desc' } },
            ],
            take,
        });

        // Recuperar detalhes dos produtos top (incluindo imagem principal)
        const productIds = topProducts.map(item => item.productId).filter(id => id !== null);

        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
            },
        });

        // Combinar dados de agregação com detalhes do produto
        const result = topProducts.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
                product,
                quantitySold: item._sum.quantity || 0,
                revenue: item._sum.total ? parseFloat(item._sum.total) : 0,
                orderCount: item._count,
            };
        });

        res.status(200).json(result);

    } catch (error) {
        console.error('Erro ao obter top produtos:', error);
        res.status(500).json({ error: 'Falha ao obter produtos top.' });
    }
});

// =================================================================
// ROTA 7: REVENUE OVER TIME (GET /api/admin/revenue-chart) - PROTEGIDA
// =================================================================
router.get('/revenue-chart', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { days = 30 } = req.query;

        // Calcular data inicial (X dias atrás)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Recuperar pedidos pagos dentro do período especificado
        const orders = await prisma.order.findMany({
            where: {
                financialStatus: 'paid',
                createdAt: { gte: startDate },
            },
            select: {
                createdAt: true,
                totalAmount: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Agrupar receita por data
        const chartData = {};
        orders.forEach(order => {
            const date = order.createdAt.toISOString().split('T')[0];
            if (!chartData[date]) {
                chartData[date] = 0;
            }
            chartData[date] += parseFloat(order.totalAmount);
        });

        // Transformar em array para retorno
        const result = Object.entries(chartData).map(([date, revenue]) => ({
            date,
            revenue,
        }));

        res.status(200).json(result);

    } catch (error) {
        console.error('Erro ao obter revenue chart:', error);
        res.status(500).json({ error: 'Falha ao obter gráfico de receita.' });
    }
});

// =================================================================
// ROTA 8: LISTAR UTILIZADORES (GET /api/admin/users) - PROTEGIDA
// =================================================================
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { role, limit = 50, page = 1, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const take = parseInt(limit);
        const skip = (parseInt(page) - 1) * take;

        // Filtrar por role se fornecido
        const where = {};
        if (role) where.role = role;

        // Executar query de utilizadores e contagem em transação
        const [users, totalCount] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    createdAt: true,
                    phone: true,
                },
                orderBy: { [sortBy]: sortOrder },
                take,
                skip,
            }),
            prisma.user.count({ where }),
        ]);

        // Retornar com informações de paginação
        res.status(200).json({
            data: users,
            total: totalCount,
            page: parseInt(page),
            limit: take,
            totalPages: Math.ceil(totalCount / take),
        });

    } catch (error) {
        console.error('Erro ao listar utilizadores:', error);
        res.status(500).json({ error: 'Falha ao listar utilizadores.' });
    }
});

// =================================================================
// ROTA 9: ATUALIZAR ROLE DO UTILIZADOR (PUT /api/admin/users/:id/role) - OWNER ONLY
// =================================================================
router.put('/users/:id/role', authenticateToken, requireOwner, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;

        // Validar que o role é válido
        const validRoles = ['USER', 'ADMIN', 'OWNER'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Role inválido. Deve ser USER, ADMIN ou OWNER.' });
        }

        // Não permitir alterar o próprio role
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Não pode alterar o seu próprio role.' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }

        // Não permitir remover OWNER (apenas há um Owner) - manter invariante de segurança
        if (user.role === 'OWNER' && role !== 'OWNER') {
            return res.status(400).json({ error: 'Não pode remover o role de OWNER. Deve haver sempre um proprietário.' });
        }

        // Atualizar role do utilizador
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
            },
        });

        res.status(200).json(updatedUser);

    } catch (error) {
        console.error('Erro ao atualizar role do utilizador:', error);
        res.status(500).json({ error: 'Falha ao atualizar role do utilizador.' });
    }
});

export default router;
