import { PerfilUsuario } from '@prisma/client';
import { Member } from '../../entities/Member';
import { MemberRepository } from '../../repositories/MemberRepository';
import { Notifier } from '../../services/Notifier';
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
 *
 * Ao criar, dispara o e-mail de convite (Fase 7) — é o ÚNICO ponto de disparo do
 * convite: o InviteMemberToMinistryUseCase delega a este use case ao criar um
 * membro novo, então convidar pelo ADMIN_GERAL ou pelo ADMIN_MINISTERIO cai aqui.
 * O disparo é best-effort e não-lançante (contrato do Notifier): uma falha de
 * notificação nunca impede a criação do membro. Dependências via construtor (4.2).
 */
export class CreateMemberUseCase {
  constructor(
    private readonly memberRepo: MemberRepository,
    private readonly notifier: Notifier,
  ) {}

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

    const saved = await this.memberRepo.save(member);
    await this.notifier.memberInvited({ to: saved.email, memberName: saved.name });
    return saved;
  }
}
