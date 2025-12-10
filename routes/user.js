import { Router } from 'express';
import prisma from '../db.js';
import { hashPassword, checkPassword, signToken, authenticateToken } from '../utils/auth.js';
import { validateRequest } from '../utils/validateRequest.js';
import { userRegisterSchema, userLoginSchema, userUpdateSchema, userProfileUpdateSchema, userChangePasswordSchema } from '../utils/schemas.js';
const router = Router();

// =================================================================
// ROTA 1: REGISTO DE NOVO UTILIZADOR (POST /api/users/register)
// =================================================================

router.post('/register', validateRequest(userRegisterSchema), async (req, res) => {
    try {
        const { firstName, lastName, email, password, role = 'USER' } = req.body; 

        // Validar que o email não está já registado
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'O email já está registado.' });
        }

        // Hash da password antes de guardar no BD
        const hashedPassword = await hashPassword(password);

        // Criar novo utilizador com role padrão de USER
        const newUser = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                passwordHash: hashedPassword, 
                role,
            },
        });

        // Gerar token JWT para autenticação imediata
        const token = signToken(newUser);
        
        res.status(201).json({
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            role: newUser.role,
            token: token,
        });

    } catch (error) {
        console.error('Erro no registo do utilizador:', error); 
        res.status(500).json({ error: 'Falha interna do servidor ao registar utilizador.' });
    }
});


// =================================================================
// ROTA 2: LOGIN DE UTILIZADOR (POST /api/users/login)
// =================================================================

router.post('/login', validateRequest(userLoginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        // Procurar utilizador pelo email
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        // Verificar password contra hash guardado
        const isMatch = await checkPassword(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        // Gerar token JWT para sessão
        const token = signToken(user);

        res.status(200).json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            token: token,
        });

    } catch (error) {
        console.error('Erro no login do utilizador:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao fazer login.' });
    }
});


// =================================================================
// ROTA 3: PERFIL DE UTILIZADOR (GET /api/users/profile) - PROTEGIDA
// =================================================================

router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; 

        // Retornar perfil do utilizador autenticado (sem password)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }

        res.status(200).json(user);

    } catch (error) {
        console.error('Erro ao aceder ao perfil:', error);
        res.status(500).json({ error: 'Falha interna do servidor.' });
    }
});


// =================================================================
// ROTA 4: ATUALIZAR PERFIL DO UTILIZADOR (PUT /api/users/profile) - PROTEGIDA
// =================================================================

router.put('/profile', authenticateToken, validateRequest(userProfileUpdateSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, phone, dateOfBirth } = req.body;

        // Construir objeto de atualização apenas com campos fornecidos
        const dataToUpdate = {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phone !== undefined && { phone }),
            ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        };

        // Atualizar perfil do utilizador autenticado
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                dateOfBirth: true,
                role: true,
                updatedAt: true,
            },
        });

        res.status(200).json(updatedUser);

    } catch (error) {
        // Erro P2025: Utilizador não encontrado
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao atualizar perfil.' });
    }
});


// =================================================================
// ROTA 5: ALTERAR PASSWORD DO UTILIZADOR (PUT /api/users/change-password) - PROTEGIDA
// =================================================================

router.put('/change-password', authenticateToken, validateRequest(userChangePasswordSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Recuperar password hash do utilizador
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { passwordHash: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'Utilizador não encontrado.' });
        }

        // Validar que a password atual está correta
        const isCurrentPasswordValid = await checkPassword(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: 'Password atual incorreta.' });
        }

        // Hash da nova password
        const hashedNewPassword = await hashPassword(newPassword);

        // Atualizar password no BD
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashedNewPassword },
        });

        res.status(200).json({ message: 'Password alterada com sucesso.' });

    } catch (error) {
        console.error('Erro ao alterar password:', error);
        res.status(500).json({ error: 'Falha interna do servidor ao alterar password.' });
    }
});


export default router;