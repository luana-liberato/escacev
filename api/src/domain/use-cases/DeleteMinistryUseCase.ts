import { MinistryRepository } from '../repositories/MinistryRepository';
import { AppError } from '../../shared/errors/AppError';

/**
 * Remove um ministério, garantindo que ele pertence à instituição do usuário
 * autenticado.
 *
 * Estratégia de remoção: o que é ESTRUTURAL do ministério cai em cascata numa
 * transação — funções (com as linhas de CompatibilidadeFuncao que as
 * referenciam) e vínculos MembroMinisterio, de modo que admins e membros
 * deixam de estar ligados ao ministério apagado. O que é HISTÓRICO ou
 * COMPARTILHADO bloqueia a remoção (409): escalas do ministério (registro de
 * quem serviu) e funções já usadas em vagas de eventos (a vaga pertence ao
 * evento da instituição — apagá-la destruiria dados fora do ministério).
 */
export class DeleteMinistryUseCase {
  constructor(private readonly ministryRepo: MinistryRepository) {}

  async execute(dto: { id: string; institutionId: string }): Promise<void> {
    const ministry = await this.ministryRepo.findById(dto.id);
    if (!ministry || ministry.institutionId !== dto.institutionId) {
      throw new AppError('Ministério não encontrado', 404);
    }

    const blocking = await this.ministryRepo.countBlockingDependencies(dto.id);
    if (blocking.schedules > 0) {
      throw new AppError(
        'Não é possível remover: o ministério possui escalas. Remova antes as escalas deste ministério',
        409,
      );
    }
    if (blocking.functionsInUse > 0) {
      throw new AppError(
        'Não é possível remover: há funções deste ministério em uso por vagas de eventos. Remova antes essas vagas',
        409,
      );
    }

    await this.ministryRepo.delete(dto.id);
  }
}
