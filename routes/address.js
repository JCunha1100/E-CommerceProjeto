// routes/address.js
// Gerencia endereços de envio do utilizador

import { Router } from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { addressCreateSchema, addressUpdateSchema } from '../utils/schemas.js';
const router = Router();

// =================================================================
// ROTA 1: CRIAR NOVO ENDEREÇO (POST /api/addresses) - PROTEGIDA
// =================================================================

router.post('/', authenticateToken, validateRequest(addressCreateSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { street, city, state, postalCode, country, type, isDefault } = req.body;

        // Criar novo endereço associado ao utilizador autenticado
        const newAddress = await prisma.userAddress.create({
            data: {
                userId,
                type,
                addressLine1: street,
                city,
                state: state || null,
                postalCode,
                country: country || 'Portugal',
                isDefault: isDefault || false,
            },
        });

        res.status(201).json(newAddress);
    } catch (error) {
        console.error('Erro ao criar endereço:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao criar endereço.' });
    }
});

// =================================================================
// ROTA 2: LISTAR TODOS OS ENDEREÇOS DO UTILIZADOR (GET /api/addresses) - PROTEGIDA
// =================================================================

router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Retorna todos os endereços do utilizador, ordenados com endereço padrão primeiro
        const addresses = await prisma.userAddress.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' },
        });

        res.status(200).json(addresses);
    } catch (error) {
        console.error('Erro ao listar endereços:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao listar endereços.' });
    }
});

// =================================================================
// ROTA 3: OBTER ENDEREÇO POR ID (GET /api/addresses/:id) - PROTEGIDA
// =================================================================

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const addressId = parseInt(req.params.id);
        const userId = req.user.id;

        const address = await prisma.userAddress.findUnique({
            where: { id: addressId },
        });

        if (!address) {
            return res.status(404).json({ error: 'Endereço não encontrado.' });
        }

        // Validar que o endereço pertence ao utilizador autenticado
        if (address.userId !== userId) {
            return res.status(403).json({ error: 'Sem permissão para aceder a este endereço.' });
        }

        res.status(200).json(address);
    } catch (error) {
        console.error('Erro ao obter endereço:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao obter endereço.' });
    }
});

// =================================================================
// ROTA 4: ATUALIZAR ENDEREÇO (PUT /api/addresses/:id) - PROTEGIDA
// =================================================================

router.put('/:id', authenticateToken, validateRequest(addressUpdateSchema), async (req, res) => {
    try {
        const addressId = parseInt(req.params.id);
        const userId = req.user.id;
        const { street, city, state, postalCode, country, type, isDefault } = req.body;

        const address = await prisma.userAddress.findUnique({
            where: { id: addressId },
        });

        if (!address) {
            return res.status(404).json({ error: 'Endereço não encontrado.' });
        }

        // Validar que o endereço pertence ao utilizador autenticado
        if (address.userId !== userId) {
            return res.status(403).json({ error: 'Sem permissão para atualizar este endereço.' });
        }

        // Atualizar apenas os campos fornecidos, mantendo os existentes caso contrário
        const updatedAddress = await prisma.userAddress.update({
            where: { id: addressId },
            data: {
                type: type || address.type,
                addressLine1: street || address.addressLine1,
                city: city || address.city,
                state: state !== undefined ? state : address.state,
                postalCode: postalCode || address.postalCode,
                country: country || address.country,
                isDefault: isDefault !== undefined ? isDefault : address.isDefault,
            },
        });

        res.status(200).json(updatedAddress);
    } catch (error) {
        console.error('Erro ao atualizar endereço:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao atualizar endereço.' });
    }
});

// =================================================================
// ROTA 5: ELIMINAR ENDEREÇO (DELETE /api/addresses/:id) - PROTEGIDA
// =================================================================

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const addressId = parseInt(req.params.id);
        const userId = req.user.id;

        const address = await prisma.userAddress.findUnique({
            where: { id: addressId },
        });

        if (!address) {
            return res.status(404).json({ error: 'Endereço não encontrado.' });
        }

        // Validar que o endereço pertence ao utilizador autenticado
        if (address.userId !== userId) {
            return res.status(403).json({ error: 'Sem permissão para eliminar este endereço.' });
        }

        await prisma.userAddress.delete({
            where: { id: addressId },
        });

        res.status(204).send();
    } catch (error) {
        console.error('Erro ao eliminar endereço:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao eliminar endereço.' });
    }
});

export default router;
