import { Unavailability } from '../../entities/Unavailability';
import { UnavailabilityRepository } from '../../repositories/UnavailabilityRepository';

/** memberId vem do JWT (req.user), nunca do body — o membro registra a PRÓPRIA. */
export interface CreateUnavailabilityDTO {
  memberId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
}

/**
 * Registra uma indisponibilidade do próprio membro (RN05). A validação do
 * intervalo (endsAt > startsAt) e do motivo mora na entidade; o use case
 * orquestra e persiste. Dependência injetada via construtor (Seção 4.2).
 */
export class CreateUnavailabilityUseCase {
  constructor(private readonly unavailabilityRepo: UnavailabilityRepository) {}

  async execute(dto: CreateUnavailabilityDTO): Promise<Unavailability> {
    const unavailability = Unavailability.create({
      memberId: dto.memberId,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      reason: dto.reason,
    });
    return this.unavailabilityRepo.save(unavailability);
  }
}
