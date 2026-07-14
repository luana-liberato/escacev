import { Unavailability } from '../../entities/Unavailability';
import { UnavailabilityRepository } from '../../repositories/UnavailabilityRepository';
import { MemberRepository } from '../../repositories/MemberRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user); memberId é o membro-alvo (param da rota). */
export interface ListMemberUnavailabilitiesDTO {
  institutionId: string;
  memberId: string;
}

/**
 * O admin consulta as indisponibilidades de UM membro ao montar a escala (RN05).
 * Diferente do fluxo do próprio membro (ListMy), aqui o alvo vem da rota, então
 * valida o tenant: o membro precisa pertencer à instituição do admin — 404 caso
 * contrário, sem vazar dados de outro tenant. A autorização grossa (só admins) é
 * do rbac na rota; não há guarda escopada por ministério porque um membro
 * pertence à instituição, não a um ministério. Dependências via construtor (4.2).
 */
export class ListMemberUnavailabilitiesUseCase {
  constructor(
    private readonly unavailabilityRepo: UnavailabilityRepository,
    private readonly memberRepo: MemberRepository,
  ) {}

  async execute(dto: ListMemberUnavailabilitiesDTO): Promise<Unavailability[]> {
    const member = await this.memberRepo.findById(dto.memberId);
    if (!member || member.institutionId !== dto.institutionId) {
      throw new AppError('Membro não encontrado', 404);
    }

    return this.unavailabilityRepo.findByMember(dto.memberId);
  }
}
