import jwt, { SignOptions } from 'jsonwebtoken';
import { PerfilUsuario } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

/**
 * Conteúdo do JWT stateless. É exatamente o que o middleware auth injeta
 * em req.user. O institutionId vem SEMPRE daqui — nunca do body (Seção 4.5).
 */
export interface JwtPayload {
  memberId: string;
  institutionId: string;
  role: PerfilUsuario;
}

/**
 * Geração e verificação do JWT. Assina com JWT_SECRET e expira em
 * JWT_EXPIRES_IN (ambos do .env).
 */
export class JwtService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não está definido no ambiente');
    }
    this.secret = secret;
    this.expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
  }

  sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as SignOptions);
  }

  verify(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as JwtPayload;
      return {
        memberId: decoded.memberId,
        institutionId: decoded.institutionId,
        role: decoded.role,
      };
    } catch {
      throw new AppError('Token inválido ou expirado', 401);
    }
  }
}
