// utils/auth.js
// Autenticação JWT, hash de passwords e middleware de autorização

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import 'dotenv/config'; 

// Gera token JWT para utilizador autenticado
export const signToken = (user) => {
    if (!user || !user.role) {
        throw new Error("Não é possível gerar o token: O campo 'role' do utilizador está em falta.");
    }
    
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
    );
}

// Middleware de autenticação JWT
// Valida token no header Authorization: Bearer <token>
// Anexa req.user com id, email, role
export const authenticateToken = (req, res, next) => {
    const hdr = req.headers.authorization;
    
    if (!hdr || !hdr.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token de autenticação em falta ou malformado." });
    }
    
    const token = hdr.slice(7);

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = { 
            id: payload.sub, 
            email: payload.email, 
            role: payload.role
        };

        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
};

// Middleware de autorização para ADMIN e OWNER
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Utilizador não autenticado." });
    }

    if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
        return res.status(403).json({ error: "Acesso negado: Permissões de administrador necessárias." });
    }

    next();
};

// Middleware de autorização apenas para OWNER
export const requireOwner = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Utilizador não autenticado." });
    }

    if (req.user.role !== 'OWNER') {
        return res.status(403).json({ error: "Acesso negado: Apenas o proprietário pode executar esta ação." });
    }

    next();
};

// Hash seguro de password com bcrypt (salt rounds: 10)
export const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, 10); 

// Comparação de password com hash armazenado
export const checkPassword = (plainPassword, hash) => bcrypt.compare(plainPassword, hash);