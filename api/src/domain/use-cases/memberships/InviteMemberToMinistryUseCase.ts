import { Member } from '../../entities/Member';
import { MinistryMembership } from '../../entities/MinistryMembership';
import { MemberRepository } from '../../repositories/MemberRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { MinistryMembershipRepository } from '../../repositories/MinistryMembershipRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { CreateMemberUseCase } from '../members/CreateMemberUseCase';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface InviteMemberToMinistryDTO {
  institutionId: string;
  actor: Actor;
  ministryId: string;
  name: string;
  email: string;
  isAdmin?: boolean;
}

export interface InviteMemberToMinistryResult {
  membership: MinistryMembership;
  member: Member;
  /** true quando o convite criou um Membro novo (e-mail ainda não existia). */
  created: boolean;
}

/**
 * Convida uma pessoa para um ministério a partir de { name, email, isAdmin? },
 * com lógica de "criar-ou-associar" (Seção 1 do CLAUDE.md — o Membro pertence à
 * INSTITUIÇÃO, não ao ministério):
 *  - e-mail ainda não existe na instituição → cria o Membro (perfil MEMBRO) e o associa;
 *  - e-mail já existe e ainda não está no ministério → apenas associa;
 *  - e-mail já existe e já está no ministério → 409.
 *
 * A criação do Membro reutiliza o CreateMemberUseCase (não duplica validação de
 * e-mail/duplicidade). Dependências injetadas via construtor (Seção 4.2).
 */
export class InviteMemberToMinistryUseCase {
  constructor(
    private readonly membershipRepo: MinistryMembershipRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly memberRepo: MemberRepository,
    private readonly createMember: CreateMemberUseCase,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: InviteMemberToMinistryDTO): Promise<InviteMemberToMinistryResult> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    // Definir admin do vínculo é exclusivo do ADMIN_GERAL: o ADMIN_MINISTERIO só
    // convida participantes (isAdmin = false) para o seu próprio ministério.
    const isAdmin = dto.actor.role === 'ADMIN_GERAL' ? dto.isAdmin ?? false : false;

    // Normaliza o e-mail pela própria entidade antes de procurar na instituição.
    const email = Member.create({
      institutionId: dto.institutionId,
      name: dto.name,
      email: dto.email,
    }).email;

    let member = await this.memberRepo.findByEmailAndInstitution(email, dto.institutionId);
    let created = false;

    if (member) {
      const existing = await this.membershipRepo.findByMemberAndMinistry(member.id, ministry.id);
      if (existing) {
        throw new AppError('Este membro já está neste ministério', 409);
      }
    } else {
      // E-mail novo: cria o Membro no nível da instituição (perfil MEMBRO) reutilizando
      // a regra de criação existente, e então associa ao ministério do convite.
      member = await this.createMember.execute({
        institutionId: dto.institutionId,
        name: dto.name,
        email: dto.email,
      });
      created = true;
    }

    const membership = await this.membershipRepo.save(
      MinistryMembership.create({
        memberId: member.id,
        ministryId: ministry.id,
        isAdmin,
      }),
    );

    // O disparo do e-mail de convite é responsabilidade da Fase 7 (Notificações);
    // este é o ponto de integração — por ora o convite apenas cria/associa o vínculo.

    return { membership, member, created };
  }
}
