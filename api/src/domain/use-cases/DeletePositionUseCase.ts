import { PositionRepository } from '../repositories/PositionRepository';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../services/MinistryAccessPolicy';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface DeletePositionDTO {
  institutionId: string;
  actor: Actor;
  id: string;
}

/**
 * Remove uma função, garantindo que ela pertence a um ministério da instituição
 * do usuário (tenant).
 *
 * Estratégia de remoção (espelha a de ministérios): o que é HISTÓRICO/de escala
 * bloqueia — se a função já foi usada em alguma VagaEvento, a remoção é negada
 * com 409 (a vaga pertence a um evento da instituição; apagar a função
 * destruiria dado de escala). O que é ESTRUTURAL da função cai em cascata: as
 * linhas de CompatibilidadeFuncao que a referenciam são apagadas junto, na
 * transação do repositório. Dependências injetadas via construtor (Seção 4.2).
 */
export class DeletePositionUseCase {
  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: DeletePositionDTO): Promise<void> {
    const position = await this.positionRepo.findById(dto.id);
    if (!position) {
      throw new AppError('Função não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(position.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Função não encontrada', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    const usage = await this.positionRepo.countEventSlotUsage(position.id);
    if (usage > 0) {
      throw new AppError(
        'Não é possível remover: esta função está em uso em vagas de eventos. Remova antes essas vagas',
        409,
      );
    }

    await this.positionRepo.delete(position.id);
  }
}
