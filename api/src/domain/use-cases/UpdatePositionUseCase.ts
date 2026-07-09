import { Position } from '../entities/Position';
import { PositionRepository } from '../repositories/PositionRepository';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface UpdatePositionDTO {
  institutionId: string;
  id: string;
  name?: string;
}

/**
 * Atualiza o nome de uma função, garantindo que ela pertence a um ministério da
 * instituição do usuário (tenant) e mantendo a invariante de nome único dentro
 * do ministério. A validação do novo nome fica na entidade (Position.update).
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class UpdatePositionUseCase {
  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: UpdatePositionDTO): Promise<Position> {
    const position = await this.positionRepo.findById(dto.id);
    if (!position) {
      throw new AppError('Função não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(position.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Função não encontrada', 404);
    }

    const updated = position.update({ name: dto.name });

    // Renomear para um nome já usado por OUTRA função do mesmo ministério é duplicidade.
    if (updated.name !== position.name) {
      const existing = await this.positionRepo.findByNameInMinistry(
        position.ministryId,
        updated.name,
      );
      if (existing && existing.id !== position.id) {
        throw new AppError('Já existe uma função com este nome neste ministério', 409);
      }
    }

    return this.positionRepo.update(updated);
  }
}
