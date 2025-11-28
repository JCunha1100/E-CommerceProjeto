// routes/productImage.js
// Gerencia galeria de imagens de produtos

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { productImageCreateSchema } from '../utils/schemas.js'; 

const prisma = new PrismaClient();
const router = Router();

// =================================================================
// ROTA 1: ADICIONAR IMAGEM A PRODUTO (POST /api/product-images) - PROTEGIDA
// =================================================================
// Adicionar nova imagem à galeria de um produto (marca como primária se indicado)
router.post('/', authenticateToken, requireAdmin, validateRequest(productImageCreateSchema), async (req, res) => {
    try {
        const { productId, url, isPrimary } = req.body;

        // Se marcada como primária, remover flag de primária em outras imagens do produto
        if (isPrimary) {
            await prisma.productImage.updateMany({
                where: { 
                    productId: productId,
                    isPrimary: true 
                },
                data: { isPrimary: false },
            });
        }

        // Criar nova imagem e associar ao produto
        const newImage = await prisma.productImage.create({
            data: {
                productId,
                url,
                isPrimary: isPrimary === true,
            },
        });

        res.status(201).json(newImage);
    } catch (error) {
        console.error('Erro ao adicionar imagem de produto:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao adicionar imagem.', details: error.message });
    }
});

// =================================================================
// ROTA 2: LISTAR IMAGENS DO PRODUTO (GET /api/product-images/:productId) - PÚBLICA
// =================================================================
// Retorna galeria completa de imagens de um produto (primária primeiro)
router.get('/:productId', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        
        // Recuperar imagens do produto ordenadas (primária primeiro, depois por ID)
        const images = await prisma.productImage.findMany({
            where: { productId },
            orderBy: [
                { isPrimary: 'desc' },
                { id: 'asc' },
            ],
        });

        if (images.length === 0) {
            return res.status(404).json({ error: 'Nenhuma imagem encontrada para este produto.' });
        }

        res.status(200).json(images);
    } catch (error) {
        console.error('Erro ao obter imagens de produto:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter imagens.' });
    }
});

// =================================================================
// ROTA 3: ELIMINAR IMAGEM (DELETE /api/product-images/:id) - PROTEGIDA
// =================================================================
// Eliminar uma imagem da galeria de um produto
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const imageId = parseInt(req.params.id);

        // Eliminar imagem do BD
        await prisma.productImage.delete({
            where: { id: imageId },
        });

        res.status(204).send(); 
    } catch (error) {
        // Erro P2025: Imagem não encontrada
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Imagem não encontrada.' });
        }
        console.error('Erro ao remover imagem:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao remover imagem.' });
    }
});

export default router;