import { Ministry } from '../entities/Ministry';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { AppError } from '../../shared/errors/AppError';

/**
 * Busca um ministério por id, garantindo que ele pertence à instituição do
 * usuário autenticado. Se não existir ou for de outra instituição, responde
 * 404 (não vaza a existência de ministérios de outros tenants — relevante para v2).
 */
export class GetMinistryUseCase {
  constructor(private readonly ministryRepo: MinistryRepository) {}

  async execute(dto: { id: string; institutionId: string }): Promise<Ministry> {
    const ministry = await this.ministryRepo.findById(dto.id);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }
    return ministry;
  }
}
