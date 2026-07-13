import { AssignmentRepository } from '../../repositories/AssignmentRepository';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface RemoveAssignmentDTO {
  institutionId: string;
  actor: Actor;
  id: string;
}

/**
 * Remove uma alocação, garantindo que ela pertence à instituição do usuário
 * (tenant, validado via escala → ministério) e que o ator administra o
 * ministério da escala (Permissão Escopada — reusa a MinistryAccessPolicy).
 *
 * Remoção de alocação INEXISTENTE responde 404 (não é idempotente) — mesmo
 * padrão de todos os outros deletes do projeto (Ministry, Position, Schedule):
 * são recursos com identidade própria, não um toggle. A única exceção
 * documentada é RemovePositionCompatibilityUseCase, idempotente porque a
 * matriz é uma relação booleana ligar/desligar — não é o caso aqui.
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class RemoveAssignmentUseCase {
  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
  ) {}

  async execute(dto: RemoveAssignmentDTO): Promise<void> {
    const assignment = await this.assignmentRepo.findById(dto.id);
    if (!assignment) {
      throw new AppError('Alocação não encontrada', 404);
    }

    const schedule = await this.scheduleRepo.findById(assignment.scheduleId);
    if (!schedule) {
      throw new AppError('Alocação não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Alocação não encontrada', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    await this.assignmentRepo.delete(assignment.id);
  }
}
