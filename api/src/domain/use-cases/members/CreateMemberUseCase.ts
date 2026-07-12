import { PerfilUsuario } from '@prisma/client';
import { Member } from '../../entities/Member';
import { MemberRepository } from '../../repositories/MemberRepository';
import { AppError } from '../../../shared/errors/AppError';

/** Dados de criação. institutionId vem do JWT (req.user), nunca do body. */
export interface CreateMemberDTO {
  institutionId: string;
  name: string;
  email: string;
  role?: PerfilUsuario;
}

/**
 * Cria um membro na instituição — é o "convite": o membro nasce sem Account
 * (accountId nulo) e o vínculo acontece no primeiro login com Google.
 * Impede e-mail duplicado dentro da mesma instituição.
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class CreateMemberUseCase {
  constructor(private readonly memberRepo: MemberRepository) {}

  async execute(dto: CreateMemberDTO): Promise<Member> {
    // Valida e normaliza (e-mail em minúsculas) antes de checar duplicidade.
    const member = Member.create(dto);

    const existing = await this.memberRepo.findByEmailAndInstitution(
      member.email,
      member.institutionId,
    );
    if (existing) {
      throw new AppError('Já existe um membro com este e-mail nesta instituição', 409);
    }

    return this.memberRepo.save(member);
  }
}
