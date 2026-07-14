import { Unavailability } from '../../entities/Unavailability';
import { UnavailabilityRepository } from '../../repositories/UnavailabilityRepository';

/** memberId vem do JWT (req.user): o membro lista só as PRÓPRIAS indisponibilidades. */
export interface ListMyUnavailabilitiesDTO {
  memberId: string;
}

/**
 * Lista as indisponibilidades do próprio membro, em ordem cronológica.
 * Dependência injetada via construtor (Seção 4.2).
 */
export class ListMyUnavailabilitiesUseCase {
  constructor(private readonly unavailabilityRepo: UnavailabilityRepository) {}

  async execute(dto: ListMyUnavailabilitiesDTO): Promise<Unavailability[]> {
    return this.unavailabilityRepo.findByMember(dto.memberId);
  }
}
