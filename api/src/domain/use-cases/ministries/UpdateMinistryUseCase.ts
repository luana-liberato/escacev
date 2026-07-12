import { Ministry } from '../../entities/Ministry';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** Campos atualizáveis. id e institutionId identificam o alvo; não são mutáveis. */
export interface UpdateMinistryDTO {
  id: string;
  institutionId: string;
  actor: Actor;
  name?: string;
  description?: string | null;
}

/**
 * Atualiza nome e/ou descrição de um ministério, garantindo que ele pertence
 * à instituição do usuário autenticado (isolamento por tenant) e que o ator
 * administra aquele ministério (ADMIN_GERAL ou admin escopado — Permissão
 * Escopada). Mantém a mesma invariante do create: nome único dentro da
 * instituição. A validação dos novos valores fica na entidade (Ministry.update).
 */
export class UpdateMinistryUseCase {
  constructor(
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: UpdateMinistryDTO): Promise<Ministry> {
    const ministry = await this.ministryRepo.findById(dto.id);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    const updated = ministry.update({ name: dto.name, description: dto.description });

    // Renomear para um nome já usado por OUTRO ministério da instituição é duplicidade.
    if (updated.name !== ministry.name) {
      const existing = await this.ministryRepo.findByName(updated.name, dto.institutionId);
      if (existing && existing.id !== ministry.id) {
        throw new AppError('Já existe um ministério com este nome nesta instituição', 409);
      }
    }

    return this.ministryRepo.update(updated);
  }
}
