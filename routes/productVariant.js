// routes/productVariant.js
// Gerencia variações de produtos (tamanhos, preços ajustados, inventário)

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { productVariantCreateSchema, productVariantUpdateSchema } from '../utils/schemas.js';

const prisma = new PrismaClient();
const router = Router();

// Criar nova variação de produto (tamanho/preço específicos)
router.post('/', authenticateToken, requireAdmin, validateRequest(productVariantCreateSchema), async (req, res) => {
    try {
        const { productId, size, stock, sku, priceAdjustment } = req.body;

        // Converte valores para tipos corretos
        const numericProductId = parseInt(productId);
        const numericStock = parseInt(stock);
        const numericPriceAdjustment = priceAdjustment !== undefined ? parseFloat(priceAdjustment) : 0.0;

        // Verifica se produto existe e obtém o preço base
        const product = await prisma.product.findUnique({ where: { id: numericProductId } });
        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        // Verifica se tamanho já existe para este produto
        const existingVariant = await prisma.productVariant.findFirst({
            where: {
                productId: numericProductId,
                size: size, 
            },
        });

        if (existingVariant) {
            return res.status(409).json({ error: `Já existe uma variação de tamanho '${size}' para este produto. Por favor, atualize o stock existente.` });
        }
        
        // Verifica se SKU é único
        const existingSku = await prisma.productVariant.findUnique({ where: { sku } });
        if (existingSku) {
            return res.status(409).json({ error: 'O SKU fornecido já existe no sistema. O SKU deve ser único.' });
        }

        // Calcula preço da variante (preço do produto + ajuste)
        const basePrice = product.price || 0;
        const variantPrice = basePrice + numericPriceAdjustment;
        
        // Gera título automaticamente (ex: "Tamanho 38")
        const title = `${product.name} - Tamanho ${size}`;

        // Cria nova variação
        const newVariant = await prisma.productVariant.create({
            data: {
                productId: numericProductId,
                title,
                size,
                stock: numericStock,
                sku,
                price: variantPrice,
                costPrice: basePrice, // Por defeito, usa o preço base do produto
            },
        });

        res.status(201).json(newVariant);

    } catch (error) {
        // Produto não existe
        if (error.code === 'P2003') { 
            return res.status(400).json({ error: 'O ID do produto fornecido é inválido.' });
        }
        console.error('Erro ao criar variação de produto:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao criar variação.', details: error.message });
    }
});


// =================================================================
// ROTA 2: LISTAR VARIAÇÕES DE PRODUTO (GET /api/variants/:productId) - PÚBLICA
// =================================================================
// Retorna todas as variações (tamanhos, SKU, preços) de um produto específico
router.get('/:productId', async (req, res) => {
    try {
        const numericProductId = parseInt(req.params.productId);
        
        // Validar que o produto existe
        const product = await prisma.product.findUnique({ where: { id: numericProductId } });
        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        // Recuperar todas as variações ordenadas por tamanho
        const variants = await prisma.productVariant.findMany({
            where: { productId: numericProductId },
            orderBy: { size: 'asc' },
        });

        res.status(200).json(variants);
    } catch (error) {
        console.error('Erro ao obter variações de produto:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter variações.' });
    }
});


// =================================================================
// ROTA 3: ATUALIZAR VARIAÇÃO (PUT /api/variants/:id) - PROTEGIDA
// =================================================================
// Atualizar informações de uma variação (tamanho, stock, SKU, preço ajustado)
router.put('/:id', authenticateToken, requireAdmin, validateRequest(productVariantUpdateSchema), async (req, res) => {
    try {
        const variantId = parseInt(req.params.id);
        const { size, stock, sku, priceAdjustment } = req.body; 

        // Construir objeto de atualização apenas com campos fornecidos
        const dataToUpdate = {};
        if (size !== undefined) dataToUpdate.size = size;
        if (stock !== undefined) dataToUpdate.stock = parseInt(stock);
        if (sku !== undefined) dataToUpdate.sku = sku;
        if (priceAdjustment !== undefined) dataToUpdate.priceAdjustment = parseFloat(priceAdjustment);

        // Validar unicidade do SKU ao atualizar
        if (dataToUpdate.sku) {
            const existingSku = await prisma.productVariant.findUnique({ where: { sku: dataToUpdate.sku } });
            if (existingSku && existingSku.id !== variantId) {
                return res.status(409).json({ error: 'O novo SKU já está a ser usado por outra variação.' });
            }
        }
        
        // Validar unicidade do tamanho dentro do mesmo produto ao atualizar
        if (dataToUpdate.size) {
            const currentVariant = await prisma.productVariant.findUnique({ where: { id: variantId } });
            if (!currentVariant) {
                return res.status(404).json({ error: 'Variação não encontrada.' });
            }

            // Verificar se o tamanho realmente está mudando antes de validar
            if (currentVariant.size !== dataToUpdate.size) { 
                const existingSize = await prisma.productVariant.findFirst({
                    where: {
                        productId: currentVariant.productId,
                        size: dataToUpdate.size, 
                        NOT: { id: variantId }
                    }
                });
                
                if (existingSize) {
                    return res.status(409).json({ error: `O tamanho '${dataToUpdate.size}' já existe para este produto.` });
                }
            }
        }

        // Atualizar variação com campos fornecidos
        const updatedVariant = await prisma.productVariant.update({
            where: { id: variantId },
            data: dataToUpdate,
        });

        res.status(200).json(updatedVariant);

    } catch (error) {
        // Erro P2025: Variação não encontrada
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Variação de produto não encontrada.' });
        }
        console.error('Erro ao atualizar variação:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao atualizar variação.', details: error.message });
    }
});


// =================================================================
// ROTA 4: ELIMINAR VARIAÇÃO (DELETE /api/variants/:id) - PROTEGIDA
// =================================================================
// Eliminar uma variação de produto (bloqueia se está em pedidos/carrinhos ativos)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const variantId = parseInt(req.params.id);
        
        // Eliminar variação do BD
        await prisma.productVariant.delete({
            where: { id: variantId },
        });

        res.status(204).send(); 
    } catch (error) {
        // Erro P2025: Variação não encontrada
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Variação de produto não encontrada.' });
        }
        
        // Erro P2003: Variação está referenciada em pedidos/carrinhos (proteção de histórico)
        if (error.code === 'P2003') {
            return res.status(409).json({ error: 'Não é possível eliminar esta variação. Está associada a um pedido ou carrinho de compras existente.' });
        }

        console.error('Erro ao eliminar variação:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao eliminar variação.' });
    }
});

export default router;