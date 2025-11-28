// routes/category.js
// Gerencia categorias de produtos (criação, leitura, atualização e eliminação)

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { categoryCreateSchema, categoryUpdateSchema } from '../utils/schemas.js';

const prisma = new PrismaClient();
const router = Router();

// =================================================================
// ROTA 1: CRIAR CATEGORIA (POST /api/categories) - PROTEGIDA
// =================================================================
// Criar categoria principal ou subcategoria com slug gerado automaticamente
router.post('/', authenticateToken, requireAdmin, validateRequest(categoryCreateSchema), async (req, res) => {
    try {
        const { name, description, parentId } = req.body;
        
        // Gerar slug URL-friendly a partir do nome da categoria
        const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

        // Validar que o slug é único (slug = identificador único da categoria)
        const existingCategory = await prisma.category.findUnique({ where: { slug } });
        if (existingCategory) {
            return res.status(409).json({ error: 'Já existe uma categoria com este nome (slug). Tente um nome diferente.' });
        }

        // Criar categoria principal ou subcategoria (se parentId fornecido)
        const newCategory = await prisma.category.create({
            data: {
                name,
                slug,
                description: description || null,
                parentId: parentId ? parseInt(parentId) : null, 
            },
        });

        res.status(201).json(newCategory);
    } catch (error) {
        // Erro P2003: Categoria pai não existe (chave estrangeira violada)
        if (error.code === 'P2003') { 
            return res.status(400).json({ error: 'O ID da categoria pai (parentId) fornecido é inválido ou não existe.' });
        }
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao criar categoria.', details: error.message });
    }
});

// =================================================================
// ROTA 2: LISTAR CATEGORIAS HIERÁRQUICAS (GET /api/categories) - PÚBLICA
// =================================================================
// Retorna categorias principais com suas subcategorias aninhadas
router.get('/', async (req, res) => {
    try {
        // Recuperar categorias raiz (sem categoria pai) com subcategorias
        const categories = await prisma.category.findMany({
            where: { parentId: null },
            include: {
                // Incluir subcategorias ordenadas alfabeticamente
                subcategories: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        parentId: true,
                    },
                    orderBy: { name: 'asc' } 
                },
            },
            orderBy: { name: 'asc' }
        });

        res.status(200).json(categories);
    } catch (error) {
        console.error('Erro ao obter categorias:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter categorias.' });
    }
});

// =================================================================
// ROTA 3: OBTER CATEGORIA ESPECÍFICA (GET /api/categories/:id) - PÚBLICA
// =================================================================
// Retorna detalhes de uma categoria com sua categoria pai e subcategorias
router.get('/:id', async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        
        // Recuperar categoria com sua hierarquia (pai e filhos)
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            include: {
                parent: true,   // Categoria pai (se for subcategoria)
                subcategories: true, // Subcategorias (se for categoria principal)
            }
        });

        if (!category) {
            return res.status(404).json({ error: 'Categoria não encontrada.' });
        }

        res.status(200).json(category);
    } catch (error) {
        console.error('Erro ao obter categoria por ID:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter categoria.' });
    }
});

// =================================================================
// ROTA 4: ATUALIZAR CATEGORIA (PUT /api/categories/:id) - PROTEGIDA
// =================================================================
// Atualizar informações de uma categoria (nome, slug, descrição, categoria pai)
router.put('/:id', authenticateToken, requireAdmin, validateRequest(categoryUpdateSchema), async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const { name, description, parentId } = req.body; 

        // Construir objeto de atualização apenas com campos fornecidos
        const dataToUpdate = {};
        if (description !== undefined) dataToUpdate.description = description;
        
        // Se o nome muda, regenerar slug também (mantém sincronizado)
        if (name !== undefined) {
            dataToUpdate.name = name;
            dataToUpdate.slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        }
        
        // Atualizar categoria pai (permitir remover com null)
        if (parentId !== undefined) {
            dataToUpdate.parentId = parentId ? parseInt(parentId) : null;
        }

        // Validar que o novo slug é único (se estiver mudando)
        if (dataToUpdate.slug) {
            const existing = await prisma.category.findUnique({ where: { slug: dataToUpdate.slug } });
            if (existing && existing.id !== categoryId) {
                return res.status(409).json({ error: 'O novo slug já está a ser usado por outra categoria.' });
            }
        }
        
        // Validar que não cria auto-referência (categoria não pode ser pai de si mesma)
        if (dataToUpdate.parentId === categoryId) {
            return res.status(400).json({ error: 'Uma categoria não pode ser subcategoria de si própria.' });
        }

        // Atualizar categoria com dados fornecidos
        const updatedCategory = await prisma.category.update({
            where: { id: categoryId },
            data: dataToUpdate,
        });

        res.status(200).json(updatedCategory);

    } catch (error) {
        // Categoria não encontrada
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Categoria não encontrada.' });
        }
        // Categoria pai fornecida não existe
        if (error.code === 'P2003') { 
            return res.status(400).json({ error: 'O ID da categoria pai (parentId) fornecido é inválido ou não existe.' });
        }
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao atualizar categoria.', details: error.message });
    }
});


// =================================================================
// ROTA 5: ELIMINAR CATEGORIA (DELETE /api/categories/:id) - PROTEGIDA
// =================================================================
// Eliminar uma categoria (cascata Prisma para subcategorias e produtos)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);

        // Eliminar categoria (cascata dependente Prisma delete products/subcategories)
        await prisma.category.delete({
            where: { id: categoryId },
        });

        res.status(204).send(); 
    } catch (error) {
        // Erro P2025: Categoria não encontrada
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Categoria não encontrada.' });
        }
        console.error('Erro ao eliminar categoria:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao eliminar categoria.' });
    }
});


export default router;