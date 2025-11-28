// routes/payment.js
// Processamento de pagamentos com Stripe (WIP - ainda em desenvolvimento)

import { Router, raw } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../utils/auth.js';
import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();
const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// =================================================================
// ROTA 1: CRIAR SESSÃO DE CHECKOUT (POST /api/payment/checkout-session) - PROTEGIDA
// =================================================================
router.post('/checkout-session', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { cartId } = req.body; // Idealmente o cartId seria verificado no middleware

        if (!cartId) {
            return res.status(400).json({ error: 'cartId é obrigatório.' });
        }

        // 1. Obter carrinho e itens (com relações necessárias para preço/nome)
        const cart = await prisma.shoppingCart.findUnique({
            where: { id: parseInt(cartId) },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, slug: true } },
                        variant: { select: { id: true, title: true, price: true, stock: true, sku: true } },
                    },
                },
            },
        });

        if (!cart || cart.userId !== userId) {
            return res.status(404).json({ error: 'Carrinho não encontrado ou acesso negado.' });
        }

        if (cart.items.length === 0) {
            return res.status(400).json({ error: 'Carrinho vazio. Adicione itens antes de prosseguir.' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true, lastName: true },
        });

        // 2. Pré-verificação de Stock (A ÚLTIMA oportunidade antes do Stripe)
        for (const item of cart.items) {
            if (item.variant.stock < item.quantity) {
                return res.status(400).json({ error: `Stock insuficiente para ${item.product.name} (${item.variant.title}).` });
            }
        }
        
        // 3. Preparar Line Items para o Stripe
        const lineItems = cart.items.map(item => ({
            price_data: {
                currency: 'eur',
                product_data: {
                    name: item.product.name,
                    description: item.variant.title,
                },
                // Preço é enviado em centavos (o preço do Prisma deve ser convertido para float * 100 e arredondado)
                unit_amount: Math.round(new Decimal(item.variant.price).toNumber() * 100),
            },
            quantity: item.quantity,
        }));

        // 4. Criar Sessão Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/checkout/cancel`,
            customer_email: user.email,
            // CRÍTICO: Metadata para referenciar o carrinho/utilizador no webhook
            metadata: {
                userId: userId.toString(),
                cartId: cartId.toString(),
            },
        });

        res.status(200).json({ 
            sessionId: session.id,
            url: session.url,
        });

    } catch (error) {
        console.error('Erro ao criar sessão de checkout:', error);
        res.status(500).json({ error: 'Falha ao criar sessão de pagamento.' });
    }
});

// =================================================================
// WEBHOOK HANDLER - EXPORTADO PARA index.js (usa body RAW)
// =================================================================
export async function handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    
    let event;

    try {
        // Verifica a assinatura
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Erro na verificação de assinatura:', err.message);
        // Retorna 400 se a assinatura for inválida
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // Processa o evento
        switch (event.type) {
            case 'checkout.session.completed':
                // O pagamento foi bem-sucedido
                await handleCheckoutSessionCompleted(event.data.object);
                break;

            case 'checkout.session.expired':
                // A sessão expirou, nenhuma ação na base de dados é necessária além de log
                await handleCheckoutSessionExpired(event.data.object);
                break;

            // Adicione outros eventos importantes (ex: payment_intent.succeeded) se o checkout não for usado
            
            default:
                console.log(`Tipo de evento Stripe não tratado: ${event.type}`);
        }

        // Retorna 200 para o Stripe (indica sucesso)
        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Erro ao processar webhook:', error);
        // Em caso de erro interno, retorne 500 para que o Stripe possa tentar novamente
        res.status(500).json({ error: 'Erro ao processar webhook.' });
    }
}


// =================================================================
// ROTA 3: VERIFICAR SESSÃO DE PAGAMENTO (GET /api/payment/session/:sessionId) - PROTEGIDA
// =================================================================
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Sessão de pagamento não encontrada.' });
        }

        // Devolve o status e detalhes relevantes para o frontend
        res.status(200).json({
            id: session.id,
            status: session.payment_status,
            customer_email: session.customer_email,
            total_details: session.total_details,
            payment_intent: session.payment_intent,
        });

    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        res.status(500).json({ error: 'Falha ao verificar sessão de pagamento.' });
    }
});

// =================================================================
// FUNÇÕES AUXILIARES (Lógica de Negócio CRÍTICA)
// =================================================================

/**
 * Lógica executada quando o Stripe confirma o pagamento.
 * CRÍTICO: Deve ser atómico (transação) para garantir que stock e order são criados/atualizados.
 */
async function handleCheckoutSessionCompleted(session) {
    try {
        const { userId, cartId } = session.metadata;

        const userIdNum = parseInt(userId);
        const cartIdNum = parseInt(cartId);
        
        // 1. Obter o carrinho (agora com as relações completas necessárias)
        const cart = await prisma.shoppingCart.findUnique({
            where: { id: cartIdNum },
            include: {
                items: {
                    include: {
                        variant: { select: { id: true, price: true, sku: true, stock: true, title: true } },
                        product: { select: { id: true, name: true } }
                    }
                }
            },
        });

        if (!cart) {
            console.error(`[WEBHOOK] Erro: Carrinho ${cartIdNum} não encontrado para criação de pedido.`);
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: userIdNum },
            select: { email: true },
        });

        // 2. Preparar dados para o Pedido e Line Items
        const orderNumber = `ORD-${Date.now()}-${userId}`;

        let totalAmount = 0;
        const lineItemsData = [];

        for (const item of cart.items) {
            const variantPrice = new Decimal(item.variant.price);
            const itemTotal = variantPrice.mul(item.quantity);
            totalAmount = new Decimal(totalAmount).add(itemTotal);

            // Confirmação final de stock (redundante, mas seguro)
            if (item.variant.stock < item.quantity) {
                console.error(`[WEBHOOK] FATAL: Overselling detectado para Variant ${item.variantId}. Stock não deduzido. Requer intervenção manual.`);
                // Aqui pode-se implementar um reembolso automático, mas por agora, apenas logamos.
                return; 
            }
            
            lineItemsData.push({
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                price: variantPrice.toNumber(),
                total: itemTotal.toNumber(),
                title: item.product.name,
                variantTitle: item.variant.title,
                sku: item.variant.sku,
            });
        }
        
        // O valor do Stripe é sempre a fonte da verdade, mas vamos usar o nosso cálculo interno
        // como o Stripe não fornece subtotal/shipping diretamente no objecto de sessão.
        const orderTotal = totalAmount.toNumber();

        // 3. TRANSAÇÃO PRISMA: Garante integridade atómica
        await prisma.$transaction(async (tx) => {
            
            // 3.1. DEDUÇÃO DE STOCK
            // Se esta operação falhar por qualquer motivo (ex: outro processo deduza o último stock),
            // a transação inteira será revertida.
            const stockUpdates = cart.items.map(item =>
                tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } },
                })
            );
            await Promise.all(stockUpdates);
            
            // 3.2. CRIAÇÃO DA ENCOMENDA (ORDER)
            const newOrder = await tx.order.create({
                data: {
                    orderNumber,
                    userId: userIdNum,
                    email: user.email,
                    subtotal: orderTotal, // Assumindo 0 taxas e portes para simplificação, deve ser calculado
                    taxAmount: 0,
                    shippingAmount: 0,
                    totalAmount: orderTotal,
                    status: 'processing',
                    financialStatus: 'paid',
                    fulfillmentStatus: 'unfulfilled',
                    lineItems: {
                        create: lineItemsData, // Cria todos os OrderLineItem
                    },
                },
            });
            
            // 3.3. CRIAÇÃO DA TRANSAÇÃO (ORDER TRANSACTION)
            await tx.orderTransaction.create({
                data: {
                    orderId: newOrder.id, // CRÍTICO: Usa o ID da nova encomenda
                    stripeId: session.payment_intent,
                    stripeObjectType: 'checkout.session',
                    status: 'succeeded',
                    paymentMethod: session.payment_method_types?.[0] || 'card',
                    amount: orderTotal,
                    feeAmount: 0.00, // Preencher com a lógica de taxa do Stripe
                },
            });
            
            // 3.4. LIMPEZA DO CARRINHO (REMOVE ITENS)
            await tx.shoppingCart.update({
                where: { id: cartIdNum },
                data: {
                    // Remove todos os itens do carrinho após a criação do pedido
                    items: { deleteMany: {} }, 
                },
            });

            console.log(`[WEBHOOK] Encomenda ${orderNumber} criada e stock deduzido com sucesso.`);
            return newOrder;
        });

    } catch (error) {
        console.error('[WEBHOOK] Erro CRÍTICO ao processar pagamento concluído:', error);
        // Lidar com o erro (ex: notificar administrador)
    }
}

async function handleCheckoutSessionExpired(session) {
    try {
        console.log(`[WEBHOOK] Sessão de checkout expirada: ${session.id}. Sem ação na DB.`);
    } catch (error) {
        console.error('[WEBHOOK] Erro ao processar sessão expirada:', error);
    }
}

export default router;