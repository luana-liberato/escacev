import { Ministry } from '../entities/Ministry';
import { MinistryRepository } from '../repositories/MinistryRepository';

/**
 * Lista todos os ministérios da instituição do usuário autenticado.
 * O institutionId vem do JWT (req.user) — garante o isolamento por tenant.
 */
export class ListMinistriesUseCase {
  constructor(private readonly ministryRepo: MinistryRepository) {}

  execute(dto: { institutionId: string }): Promise<Ministry[]> {
    return this.ministryRepo.findByInstitution(dto.institutionId);
  }
}
