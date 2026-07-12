import { Position } from '../../entities/Position';
import { PositionRepository } from '../../repositories/PositionRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface ListPositionsDTO {
  institutionId: string;
  ministryId: string;
}

/**
 * Lista as funções de um ministério, validando que o ministério pertence à
 * instituição do usuário. Dependências injetadas via construtor (Seção 4.2).
 */
export class ListPositionsUseCase {
  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: ListPositionsDTO): Promise<Position[]> {
    const ministry = await this.ministryRepo.findById(dto.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    return this.positionRepo.findByMinistry(ministry.id);
  }
}
