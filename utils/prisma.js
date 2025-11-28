// Instância única e centralizada do Prisma Client
// Evita problemas de múltiplas conexões e garante coerência em toda a aplicação

import { PrismaClient } from '@prisma/client';

const prismaInstance = new PrismaClient();

console.log('Prisma.js - Instância criada:', typeof prismaInstance);

export default prismaInstance;
