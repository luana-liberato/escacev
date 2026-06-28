import { PrismaClient } from '@prisma/client';

/**
 * PrismaClient singleton. Use cases NUNCA importam isto diretamente —
 * o acesso ao banco é sempre via repositório injetado.
 */
export const prisma = new PrismaClient();
