// routes/brand.js
// Gerencia marcas de produtos (criação, leitura, atualização e eliminação)

import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken, requireAdmin } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { brandCreateSchema, brandUpdateSchema } from '../utils/schemas.js';
const router = Router();

// Criar nova marca com logo
router.post('/', authenticateToken, requireAdmin, validateRequest(brandCreateSchema), async (req, res) => {
    try {
        const { name, description, logoUrl } = req.body;

        // Gerar slug URL-friendly a partir do nome da marca
        const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

        // Verifica que o nome é único
        const existingBrand = await prisma.brand.findFirst({ where: { name } });
        if (existingBrand) {
            return res.status(409).json({ error: 'Já existe uma marca com este nome.' });
        }

        // Verifica que o slug é único
        const existingSlug = await prisma.brand.findFirst({ where: { slug } });
        if (existingSlug) {
            return res.status(409).json({ error: 'Já existe uma marca com este slug.' });
        }

        // Cria marca com logo URL (para exibição no frontend)
        const newBrand = await prisma.brand.create({
            data: {
                name,
                slug,
                description: description || null,
                logoUrl,
            },
        });

        res.status(201).json(newBrand);
    } catch (error) {
        console.error('Erro ao criar marca:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao criar a marca.', details: error.message });
    }
});

// =================================================================
// ROTA 2: LISTAR TODAS AS MARCAS (GET /api/brands) - PÚBLICA
// =================================================================
// Retorna todas as marcas ordenadas alfabeticamente para exibição
router.get('/', async (req, res) => {
    try {
        // Recuperar todas as marcas ordenadas alfabeticamente por nome
        const brands = await prisma.brand.findMany({
            orderBy: { name: 'asc' },
        });

        res.status(200).json(brands);
    } catch (error) {
        console.error('Erro ao obter todas as marcas:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter as marcas.' });
    }
});

// =================================================================
// ROTA 3: OBTER MARCA ESPECÍFICA (GET /api/brands/:id) - PÚBLICA
// =================================================================
// Retorna detalhes de uma marca pelo ID
router.get('/:id', async (req, res) => {
    try {
        const brandId = parseInt(req.params.id);
        
        // Recuperar marca pelo ID
        const brand = await prisma.brand.findUnique({
            where: { id: brandId },
        });

        if (!brand) {
            return res.status(404).json({ error: 'Marca não encontrada.' });
        }

        res.status(200).json(brand);
    } catch (error) {
        console.error('Erro ao obter marca por ID:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter a marca.' });
    }
});

// =================================================================
// ROTA 4: ATUALIZAR MARCA (PUT /api/brands/:id) - PROTEGIDA
// =================================================================
// Atualizar informações de uma marca (nome, descrição, logo)
router.put('/:id', authenticateToken, requireAdmin, validateRequest(brandUpdateSchema), async (req, res) => {
    try {
        const brandId = parseInt(req.params.id);
        const { name, description, logoUrl } = req.body; 

        // Construir objeto de atualização apenas com campos fornecidos
        const dataToUpdate = {};
        if (name !== undefined) {
            dataToUpdate.name = name;
            // Gerar novo slug se nome mudar
            dataToUpdate.slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        }
        if (description !== undefined) dataToUpdate.description = description;
        if (logoUrl !== undefined) dataToUpdate.logoUrl = logoUrl;

        // Validar unicidade do nome ao atualizar
        if (dataToUpdate.name) {
            const existingBrand = await prisma.brand.findFirst({ where: { name: dataToUpdate.name } });
            // Permitir manter o mesmo nome, mas bloquear duplicatas de outras marcas
            if (existingBrand && existingBrand.id !== brandId) {
                return res.status(409).json({ error: 'Já existe outra marca com este nome.' });
            }
        }

        // Validar unicidade do novo slug
        if (dataToUpdate.slug) {
            const existingSlug = await prisma.brand.findFirst({ where: { slug: dataToUpdate.slug } });
            if (existingSlug && existingSlug.id !== brandId) {
                return res.status(409).json({ error: 'O novo slug já está a ser usado por outra marca.' });
            }
        }

        // Atualizar marca com campos fornecidos
        const updatedBrand = await prisma.brand.update({
            where: { id: brandId },
            data: dataToUpdate,
        });

        res.status(200).json(updatedBrand);

    } catch (error) {
        // Erro P2025: Marca não encontrada
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Marca não encontrada.' });
        }
        console.error('Erro ao atualizar marca:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao atualizar marca.' });
    }
});

// =================================================================
// ROTA 5: ELIMINAR MARCA (DELETE /api/brands/:id) - PROTEGIDA
// =================================================================
// Eliminar uma marca (bloqueia se tem produtos associados)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const brandId = parseInt(req.params.id);

        // Eliminar marca do BD
        await prisma.brand.delete({
            where: { id: brandId },
        });

        res.status(204).send(); 
    } catch (error) {
        // Erro P2025: Marca não encontrada
        if (error.code === 'P2025') { 
            return res.status(404).json({ error: 'Marca não encontrada.' });
        }
        // Erro P2003: Marca tem produtos associados (proteção de referência)
        if (error.code === 'P2003') {
             return res.status(409).json({ error: 'Não é possível eliminar esta marca. Existem produtos associados a ela.' });
        }
        console.error('Erro ao eliminar marca:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao eliminar marca.' });
    }
});

export default router;