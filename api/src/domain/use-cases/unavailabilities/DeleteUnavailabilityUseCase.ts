import { UnavailabilityRepository } from '../../repositories/UnavailabilityRepository';
import { AppError } from '../../../shared/errors/AppError';

/** memberId vem do JWT (req.user): o membro só remove as PRÓPRIAS indisponibilidades. */
export interface DeleteUnavailabilityDTO {
  id: string;
  memberId: string;
}

/**
 * Remove uma indisponibilidade do próprio membro. Responde 404 quando não existe
 * OU pertence a outro membro — não vaza a existência de dados de terceiros
 * (mesma filosofia do 404 por tenant nos demais use cases). Delete não
 * idempotente, como os outros deletes do projeto. Dependência via construtor.
 */
export class DeleteUnavailabilityUseCase {
  constructor(private readonly unavailabilityRepo: UnavailabilityRepository) {}

  async execute(dto: DeleteUnavailabilityDTO): Promise<void> {
    const unavailability = await this.unavailabilityRepo.findById(dto.id);
    if (!unavailability || unavailability.memberId !== dto.memberId) {
      throw new AppError('Indisponibilidade não encontrada', 404);
    }
    await this.unavailabilityRepo.delete(dto.id);
  }
}
