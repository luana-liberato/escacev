import { Position } from '../entities/Position';
import { PositionRepository } from '../repositories/PositionRepository';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface GetPositionDTO {
  institutionId: string;
  id: string;
}

/**
 * Busca uma função por id, garantindo que ela pertence a um ministério da
 * instituição do usuário (tenant). Responde 404 quando a função não existe ou é
 * de outra instituição — sem vazar a existência de recursos de outro tenant.
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class GetPositionUseCase {
  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: GetPositionDTO): Promise<Position> {
    const position = await this.positionRepo.findById(dto.id);
    if (!position) {
      throw new AppError('Função não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(position.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Função não encontrada', 404);
    }

    return position;
  }
}
