import { Member } from '../../entities/Member';
import { MemberRepository } from '../../repositories/MemberRepository';
import { AppError } from '../../../shared/errors/AppError';

/**
 * O único campo que o próprio usuário muda em si mesmo. `memberId` vem do JWT —
 * não é parâmetro de rota.
 */
export interface UpdateMyNameDTO {
  memberId: string;
  institutionId: string;
  name: string;
}

/**
 * O usuário corrige o próprio nome — qualquer perfil.
 *
 * Existe porque o nome do cadastro é o que o ADMIN digitou no convite, e é ele
 * que aparece nas telas. O `nomeExibido` que vem do Google fica só na `Conta` e
 * não é usado. Sem esta rota, quem foi cadastrado errado dependia de um
 * `ADMIN_GERAL` para se corrigir (o `PUT /membros/:id` é exclusivo dele).
 *
 * NÃO reusa o UpdateMemberUseCase de propósito. Aquele aceita `role` e `active`,
 * e aqui o alvo é sempre o PRÓPRIO usuário: bastaria um dia alguém repassar o
 * corpo da request inteiro para um MEMBRO se promover a ADMIN_GERAL. Este DTO não
 * tem onde escrever perfil nem status — a escalada de privilégio fica impossível
 * pela FORMA, não por convenção. A validação do nome segue na entidade
 * (Member.update -> normalizeName).
 */
export class UpdateMyNameUseCase {
  constructor(private readonly memberRepo: MemberRepository) {}

  async execute(dto: UpdateMyNameDTO): Promise<Member> {
    const member = await this.memberRepo.findById(dto.memberId);
    // O tenant é redundante aqui (o membro do JWT é do próprio tenant), mas a
    // checagem é barata e mantém o padrão das demais buscas por membro.
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }

    return this.memberRepo.update(member.update({ name: dto.name }));
  }
}
