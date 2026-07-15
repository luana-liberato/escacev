import { Schedule } from '../../entities/Schedule';
import { ScheduleRepository } from '../../repositories/ScheduleRepository';
import { MinistryRepository } from '../../repositories/MinistryRepository';
import { Actor, MinistryAccessPolicy } from '../../services/MinistryAccessPolicy';
import { PublishNotification } from '../../services/PublishNotification';
import { BackgroundTasks } from '../../services/BackgroundTasks';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface PublishScheduleDTO {
  institutionId: string;
  actor: Actor;
  id: string;
}

/**
 * Publica uma escala (RASCUNHO → PUBLICADA, RN04): a partir daqui ela fica
 * visível ao membro. É uma ESCRITA de escopo de ministério — reusa a
 * MinistryAccessPolicy (ADMIN_GERAL em qualquer, ou ADMIN_MINISTERIO com isAdmin
 * naquele ministério). Valida o tenant pela instituição do ministério da escala
 * (a Escala não tem instituicaoId próprio) e responde 404 quando não existe ou é
 * de outra instituição, sem vazar recursos de outro tenant.
 *
 * A transição e o carimbo de `publicadaEm` vivem na entidade (`Schedule.publish`),
 * que bloqueia republicar (409) para preservar a data da 1ª publicação — base da
 * precedência por publicação (RN07). A ordem 404 → 403 → 409 garante que o 409 de
 * "já publicada" só apareça a quem tem permissão. Dependências via construtor (4.2).
 *
 * Ao publicar (RN04), notifica cada escalado (Fase 7) — mas em SEGUNDO PLANO (via
 * BackgroundTasks): a resposta HTTP volta assim que a escala é persistida, sem
 * esperar os e-mails. O `actor` (quem publicou) é passado ao PublishNotification
 * para receber um aviso in-app caso algum e-mail não seja enviado.
 */
export class PublishScheduleUseCase {
  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly ministryRepo: MinistryRepository,
    private readonly accessPolicy: MinistryAccessPolicy,
    private readonly publishNotification: PublishNotification,
    private readonly background: BackgroundTasks,
  ) {}

  async execute(dto: PublishScheduleDTO): Promise<Schedule> {
    const schedule = await this.scheduleRepo.findById(dto.id);
    if (!schedule) {
      throw new AppError('Escala não encontrada', 404);
    }

    const ministry = await this.ministryRepo.findById(schedule.ministryId);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Escala não encontrada', 404);
    }

    await this.accessPolicy.ensureCanManage(dto.actor, ministry.id);

    const published = schedule.publish();
    const saved = await this.scheduleRepo.update(published);

    // Fire-and-forget: notifica os escalados fora do request (não bloqueia a
    // resposta). Falhas de envio viram aviso in-app ao publicador (dto.actor).
    this.background.run(() => this.publishNotification.notify(saved, dto.actor.memberId));
    return saved;
  }
}
