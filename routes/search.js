// routes/search.js
// Pesquisa de produtos com filtros avançados

import { Router } from 'express';
import prisma from '../db.js';
const router = Router();

// =================================================================
// ROTA: PESQUISAR PRODUTOS (GET /api/search) - PÚBLICA
// =================================================================
router.get('/', async (req, res) => {
    try {
        const { q, gender, categorySlug, brandSlug, minPrice, maxPrice, limit = 20, page = 1 } = req.query;
        const take = parseInt(limit);
        const skip = (parseInt(page) - 1) * take;

        // Construir objeto WHERE dinâmico para filtros
        const where = {
            isActive: true,
            AND: [],
        };

        // Validar que o texto de pesquisa (obrigatório) foi fornecido
        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'O parâmetro de pesquisa (q) é obrigatório.' });
        }

        // Adicionar filtro de texto de pesquisa em nome e descrição (case-insensitive)
        where.AND.push({
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ],
        });

        // Adicionar filtro de género se fornecido
        if (gender && ['MALE', 'FEMALE'].includes(gender.toUpperCase())) {
            where.AND.push({ gender: gender.toUpperCase() });
        }

        // Adicionar filtro de preço (mínimo e/ou máximo) se fornecido
        const priceFilter = {};
        if (minPrice) priceFilter.gte = parseFloat(minPrice);
        if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
        if (Object.keys(priceFilter).length > 0) {
            where.AND.push({ price: priceFilter });
        }

        // Adicionar filtro de categoria (incluindo subcategorias) se fornecido
        if (categorySlug) {
            where.AND.push({
                OR: [
                    { category: { slug: categorySlug } },
                    { category: { parent: { slug: categorySlug } } },
                ],
            });
        }

        // Adicionar filtro de marca se fornecido
        if (brandSlug) {
            where.AND.push({
                brand: {
                    slug: brandSlug,
                },
            });
        }

        // Remover AND se estiver vazio (evita sintaxe inválida)
        if (where.AND.length === 0) {
            delete where.AND;
        }

        // Executar query de produtos e contagem em transação
        const [products, totalCount] = await prisma.$transaction([
            prisma.product.findMany({
                where: where,
                include: {
                    images: { where: { isPrimary: true }, select: { imageUrl: true } },
                    category: { select: { name: true, slug: true } },
                    brand: { select: { name: true, slug: true } },
                },
                orderBy: { name: 'asc' },
                take: take,
                skip: skip,
            }),
            prisma.product.count({ where: where }),
        ]);

        // Formatar produtos para retorno, incluindo imagem principal
        const formattedProducts = products.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            description: product.description,
            gender: product.gender,
            category: product.category,
            brand: product.brand,
            primaryImageUrl: product.images.length > 0 ? product.images[0].url : null,
        }));

        // Retornar produtos com informações de paginação
        res.status(200).json({
            data: formattedProducts,
            total: totalCount,
            page: parseInt(page),
            limit: take,
            totalPages: Math.ceil(totalCount / take),
            query: q,
        });

    } catch (error) {
        console.error('Erro ao pesquisar produtos:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao pesquisar produtos.' });
    }
});

export default router;
