// routes/product.js
// Gerencia produtos: criação, leitura, atualização, eliminação e upload de imagens

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { productCreateSchema, productUpdateSchema } from '../utils/schemas.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();
const router = Router();

// Caminhos para diretórios de upload
const __dirname = path.resolve();
const TEMP_UPLOAD_DIR = path.join(__dirname, 'uploads', 'temp');
const FINAL_UPLOAD_DIR = path.join(__dirname, 'uploads', 'products');

// Cria diretórios se não existirem
fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true }).catch(console.error);
fs.mkdir(FINAL_UPLOAD_DIR, { recursive: true }).catch(console.error);

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Imagens fazem upload primeiro para pasta temporária
        cb(null, TEMP_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Cria nome único para evitar conflitos
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        // Valida tipos de imagem permitidos
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            req.fileValidationError = 'Apenas ficheiros de imagem são permitidos (.jpg, .jpeg, .png, .gif, .webp)!';
            return cb(null, false);
        }
        cb(null, true);
    }
});


// Fazer upload temporário de imagem de produto
router.post('/upload-image', authenticateToken, requireAdmin, upload.single('productImage'), (req, res) => {
    // Valida erros no upload da imagem
    if (req.fileValidationError) {
        return res.status(400).json({ 
            error: 'Validação de ficheiro falhou',
            details: [{ path: 'productImage', message: req.fileValidationError }]
        });
    }

    if (!req.file) {
        return res.status(400).json({ 
            error: 'Validação falhou',
            details: [{ path: 'productImage', message: 'Ficheiro de imagem é obrigatório' }]
        });
    }

    // Retorna nome do ficheiro temporário para uso na criação do produto
    res.status(200).json({ 
        tempFileName: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
    });
});


// Criar novo produto com inventário e imagem
router.post('/', authenticateToken, requireAdmin, validateRequest(productCreateSchema), async (req, res) => {
    try {
        const { 
            name, 
            slug, 
            description, 
            price, 
            stock, 
            categoryId, 
            brandId,
            tempFileName
        } = req.body;

        // Converte valores para tipos corretos
        const numericPrice = parseFloat(price);
        const numericStock = parseInt(stock || 0);
        const numericCategoryId = parseInt(categoryId);
        const numericBrandId = brandId ? parseInt(brandId) : null;

        // Verifica se slug já existe
        const existingProduct = await prisma.product.findUnique({ where: { slug } });
        if (existingProduct) {
            if (tempFileName) {
                 await fs.unlink(path.join(TEMP_UPLOAD_DIR, tempFileName)).catch(() => {});
            }
            return res.status(409).json({ error: 'O slug do produto já existe.' });
        }
        
        let finalImageName = null;
        let imageUrl = null;
        
        // Move ficheiro temporário para pasta final se existir
        if (tempFileName) {
            const tempFilePath = path.join(TEMP_UPLOAD_DIR, tempFileName);
            
            // Verifica se ficheiro temporário existe
            try {
                await fs.access(tempFilePath); 
            } catch (accessError) {
                console.warn(`Ficheiro temporário ${tempFileName} não encontrado. Continuando sem imagem.`);
                tempFileName = null;
            }

            if (tempFileName) {
                finalImageName = tempFileName;
                const finalFilePath = path.join(FINAL_UPLOAD_DIR, finalImageName);

                // Move ficheiro de temp para pasta final
                await fs.rename(tempFilePath, finalFilePath);
                
                // Cria URL de acesso público
                imageUrl = `/api/images/${finalImageName}`;
            }
        }
        
        // Cria produto, inventário e imagem em transação (tudo ou nada)
        const newProduct = await prisma.$transaction(async (tx) => {
            // Cria produto
            const product = await tx.product.create({
                data: {
                    name,
                    slug,
                    description,
                    price: numericPrice,
                    categoryId: numericCategoryId,
                    brandId: numericBrandId,
                },
            });
            
            // Cria entrada de inventário
            await tx.inventory.create({
                data: {
                    productId: product.id,
                    stock: numericStock,
                },
            });
            
            // Cria referência de imagem se existir
            if (imageUrl) {
                await tx.productImage.create({
                    data: {
                        productId: product.id,
                        url: imageUrl,
                        isPrimary: true,
                        altText: name,
                    },
                });
            }

            return product;
        });

        res.status(201).json(newProduct);

    } catch (error) {
        // Remove ficheiro temporário em caso de erro
        if (req.body.tempFileName) {
            await fs.unlink(path.join(TEMP_UPLOAD_DIR, req.body.tempFileName)).catch(() => {});
        }
        console.error('Erro ao criar produto:', error);
        // Categoria ou marca não existe
        if (error.code === 'P2003') {
            return res.status(400).json({ error: 'Categoria ou Marca fornecida não existe.' });
        }
        res.status(500).json({ error: 'Falha interna do servidor ao criar produto.', details: error.message });
    }
});


// Listar produtos com filtros e paginação
router.get('/', async (req, res) => {
    try {
        const { gender, categorySlug, brandSlug, minPrice, maxPrice, limit = 20, page = 1 } = req.query;
        const take = parseInt(limit);
        const skip = (parseInt(page) - 1) * take;

        // Constrói filtros dinâmicos
        const where = {
            isPublished: true,
            AND: [],
        };

        // Filtro por género
        if (gender && ['MALE', 'FEMALE'].includes(gender.toUpperCase())) {
            where.AND.push({ gender: gender.toUpperCase() });
        }

        // Filtro por intervalo de preço
        const priceFilter = {};
        if (minPrice) priceFilter.gte = parseFloat(minPrice);
        if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
        if (Object.keys(priceFilter).length > 0) {
            where.AND.push({ price: priceFilter });
        }

        // Filtro por categoria (inclui subcategorias)
        if (categorySlug) {
            where.AND.push({
                OR: [
                    { category: { slug: categorySlug } },
                    { category: { parent: { slug: categorySlug } } },
                ],
            });
        }

        // Filtro por marca
        if (brandSlug) {
            where.AND.push({
                brand: {
                    slug: brandSlug,
                },
            });
        }
        
        // Remove AND vazio
        if (where.AND.length === 0) {
            delete where.AND;
        }

        // Busca produtos e conta total em transação
        const [products, totalCount] = await prisma.$transaction([
            prisma.product.findMany({
                where: where,
                include: {
                    images: { where: { isPrimary: true }, select: { url: true } },
                    category: { select: { name: true, slug: true } },
                    brand: { select: { name: true, slug: true } },
                },
                orderBy: { name: 'asc' },
                take: take,
                skip: skip,
            }),
            prisma.product.count({ where: where }),
        ]);

        // Formata resultado com imagem principal
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

        res.status(200).json({
            data: formattedProducts,
            total: totalCount,
            page: parseInt(page),
            limit: take,
            totalPages: Math.ceil(totalCount / take),
        });

    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao listar produtos.' });
    }
});


// Listar produtos marcados como destaque
router.get('/featured', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const take = parseInt(limit);

        // Busca produtos em destaque mais recentes
        const featuredProducts = await prisma.product.findMany({
            where: {
                isPublished: true,
                isFeatured: true,
            },
            include: {
                images: { where: { isPrimary: true }, select: { url: true } },
                category: { select: { name: true, slug: true } },
                brand: { select: { name: true, slug: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: take,
        });

        // Formata resultado
        const formattedProducts = featuredProducts.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            description: product.description,
            category: product.category,
            brand: product.brand,
            primaryImageUrl: product.images.length > 0 ? product.images[0].url : null,
        }));

        res.status(200).json(formattedProducts);

    } catch (error) {
        console.error('Erro ao listar produtos em destaque:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao listar produtos em destaque.' });
    }
});


// Listar produtos marcados como novos
router.get('/new', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const take = parseInt(limit);

        // Busca produtos novos mais recentes
        const newProducts = await prisma.product.findMany({
            where: {
                isPublished: true,
                isNew: true,
            },
            include: {
                images: { where: { isPrimary: true }, select: { url: true } },
                category: { select: { name: true, slug: true } },
                brand: { select: { name: true, slug: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: take,
        });

        // Formata resultado
        const formattedProducts = newProducts.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            description: product.description,
            category: product.category,
            brand: product.brand,
            primaryImageUrl: product.images.length > 0 ? product.images[0].url : null,
        }));

        res.status(200).json(formattedProducts);

    } catch (error) {
        console.error('Erro ao listar novos produtos:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao listar novos produtos.' });
    }
});


// Obter detalhes completos de um produto por slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        // Busca produto com todas as informações relacionadas
        const product = await prisma.product.findUnique({
            where: { slug, isPublished: true },
            include: {
                images: { orderBy: { isPrimary: 'desc' } },
                category: true,
                brand: true,
                inventory: { select: { stock: true } },
                reviews: { select: { rating: true, comment: true, userId: true, createdAt: true }, take: 5 },
                variants: true,
            },
        });

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado ou não publicado.' });
        }
        
        // Simplifica resultado adicionando stock diretamente
        const productWithStock = {
            ...product,
            stock: product.inventory?.stock ?? 0,
            inventory: undefined,
        };

        res.status(200).json(productWithStock);
    } catch (error) {
        console.error('Erro ao obter produto por slug:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter produto.' });
    }
});


// Atualizar informações e inventário de um produto
router.put('/:id', authenticateToken, requireAdmin, validateRequest(productUpdateSchema), async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const { 
            name, 
            slug, 
            description, 
            price, 
            categoryId, 
            brandId, 
            isPublished,
            isFeatured,
            isNew,
            stock
        } = req.body;
        
        // Prepara dados a atualizar (apenas campos fornecidos)
        const dataToUpdate = { 
            name, 
            slug, 
            description, 
            price: price !== undefined ? parseFloat(price) : undefined,
            categoryId: categoryId !== undefined ? parseInt(categoryId) : undefined,
            brandId: brandId !== undefined ? parseInt(brandId) : undefined,
            isPublished,
            isFeatured,
            isNew,
        };

        // Verifica unicidade do novo slug
        if (slug) {
            const existing = await prisma.product.findUnique({ where: { slug } });
            if (existing && existing.id !== productId) {
                return res.status(409).json({ error: 'O novo slug já está a ser usado por outro produto.' });
            }
        }
        
        // Atualiza produto e inventário em transação
        const [updatedProduct, updatedInventory] = await prisma.$transaction([
            prisma.product.update({
                where: { id: productId },
                data: dataToUpdate,
            }),
            // Atualiza stock se fornecido
            stock !== undefined ? prisma.inventory.update({
                where: { productId: productId },
                data: { stock: parseInt(stock) },
            }) : Promise.resolve(null),
        ]);

        // Retorna resultado com stock incluído
        const productResponse = { 
            ...updatedProduct, 
            stock: updatedInventory ? updatedInventory.stock : undefined
        };
        
        res.status(200).json(productResponse);

    } catch (error) {
        // Produto não encontrado
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao atualizar produto.', details: error.message });
    }
});


// Eliminar um produto e todos os dados relacionados
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        // Obtém URLs de imagens para eliminação posterior
        const productImages = await prisma.productImage.findMany({
            where: { productId },
            select: { url: true },
        });

        // Elimina produto e dados relacionados em transação
        await prisma.$transaction(async (tx) => {
            // Remove dados relacionados
            await tx.productImage.deleteMany({ where: { productId } });
            await tx.inventory.deleteMany({ where: { productId } });
            await tx.review.deleteMany({ where: { productId } });
            await tx.productVariant.deleteMany({ where: { productId } });

            // Remove produto
            await tx.product.delete({ where: { id: productId } });
        });

        // Elimina ficheiros de imagem do servidor
        for (const image of productImages) {
            const fileName = image.url.split('/').pop();
            const filePath = path.join(FINAL_UPLOAD_DIR, fileName);
            
            // Falha silenciosa se ficheiro não existir
            await fs.unlink(filePath).catch((err) => {
                if (err.code !== 'ENOENT') {
                    console.warn(`Aviso: Não foi possível eliminar ficheiro ${fileName}: ${err.message}`);
                }
            });
        }

        res.status(204).send(); 
    } catch (error) {
        // Produto não encontrado
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        console.error('Erro ao eliminar produto:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao eliminar produto.' });
    }
});

export default router;