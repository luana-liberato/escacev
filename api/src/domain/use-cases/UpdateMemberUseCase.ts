import { PerfilUsuario } from '@prisma/client';
import { Member } from '../entities/Member';
import { MemberRepository } from '../repositories/MemberRepository';
import { AppError } from '../../shared/errors/AppError';

/** Campos atualizáveis. institutionId e id identificam o alvo; não são mutáveis. */
export interface UpdateMemberDTO {
  id: string;
  institutionId: string;
  name?: string;
  role?: PerfilUsuario;
  active?: boolean;
}

/**
 * Atualiza nome, perfil e/ou status ativo de um membro, garantindo que ele
 * pertence à instituição do usuário autenticado (isolamento por tenant).
 * A validação dos novos valores fica na entidade (Member.update).
 */
export class UpdateMemberUseCase {
  constructor(private readonly memberRepo: MemberRepository) {}

  async execute(dto: UpdateMemberDTO): Promise<Member> {
    const member = await this.memberRepo.findById(dto.id);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }

    const updated = member.update({ name: dto.name, role: dto.role, active: dto.active });
    return this.memberRepo.update(updated);
  }
}
