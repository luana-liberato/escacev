import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface DeleteScheduleDTO {
  institutionId: string;
  actor: Actor;
  id: string;
}

/**
 * Remove uma escala, garantindo que ela pertence à instituição do usuário
 * (tenant, validado via ministério) e que o ator administra o ministério da
 * escala (Permissão Escopada — reusa a MinistryAccessPolicy).
 *
 * Hoje a escala nasce vazia, então a remoção é simples. Quando existirem
 * alocações (bloco seguinte da Fase 5), o repositório deve passar a apagá-las em
 * transação junto com a escala — as alocações são o corpo da escala, não
 * histórico compartilhado (diferente do delete de Evento, que bloqueia com 409).
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class DeleteScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: DeleteScheduleDTO): Promise<void> {
    const schedule = await this.scheduleRepo.findById(dto.id);
    if (!schedule) {
      throw new AppError('Escala não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Escala não encontrada', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, schedule.ministryId);

    await this.scheduleRepo.delete(schedule.id);
  }
}
