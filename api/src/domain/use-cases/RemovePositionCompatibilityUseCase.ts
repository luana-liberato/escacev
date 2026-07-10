import { PositionCompatibilityRepository } from '../repositories/PositionCompatibilityRepository';
import { PositionRepository } from '../repositories/PositionRepository';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { Actor } from '../services/MinistryAccessPolicy';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface RemovePositionCompatibilityDTO {
  institutionId: string;
  actor: Actor;
  positionAId: string;
  positionBId: string;
}

/**
 * Remove a compatibilidade de um par de funções (volta ao default incompatível,
 * RN02). O repositório ordena o par na forma canônica antes de remover.
 *
 * Permissão: mesma regra do Set — só ADMIN_GERAL define/desfaz a matriz (ver a
 * justificativa em SetPositionCompatibilityUseCase; a compatibilidade pode cruzar
 * ministérios, logo é escopo de instituição).
 *
 * Remover par inexistente → IDEMPOTENTE quando as duas funções são válidas: o
 * objetivo do comando é "garantir que estas duas NÃO estão marcadas como
 * compatíveis"; se já não estão, o estado desejado já vale (semântica DELETE). Um
 * 404 aqui só tornaria o desligar de uma célula da matriz um erro à toa. A
 * distinção importante: ids de função INVÁLIDOS (inexistentes ou de outro tenant)
 * continuam 404 — isso é entrada inválida, não "par ausente".
 *
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class RemovePositionCompatibilityUseCase {
  constructor(
    private readonly compatibilityRepo: PositionCompatibilityRepository,
    private readonly positionRepo: PositionRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: RemovePositionCompatibilityDTO): Promise<void> {
    if (dto.actor.role !== 'ADMIN_GERAL') {
      throw new AppError('Apenas o administrador geral pode remover compatibilidades', 403);
    }

    // Funções inválidas/de outro tenant → 404 (entrada inválida). A ausência do
    // PAR entre funções válidas, essa sim, é tratada de forma idempotente abaixo.
    await this.ensurePositionInInstitution(dto.positionAId, dto.institutionId);
    await this.ensurePositionInInstitution(dto.positionBId, dto.institutionId);

    // Idempotente: não importa se o par existia — o estado final é "sem par".
    await this.compatibilityRepo.delete(dto.positionAId, dto.positionBId);
  }

  /** 404 se a função não existe ou pertence a outra instituição (tenant). */
  private async ensurePositionInInstitution(
    positionId: string,
    institutionId: string,
  ): Promise<void> {
    const position = await this.positionRepo.findById(positionId);
    if (!position) {
      throw new AppError('Função não encontrada', 404);
    }
    const ministry = await this.ministryRepo.findById(position.ministryId);
    if (!ministry || ministry.institutionId !== institutionId) {
      throw new AppError('Função não encontrada', 404);
    }
  }
}
