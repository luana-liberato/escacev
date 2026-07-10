import { PositionCompatibility } from '../entities/PositionCompatibility';
import { PositionCompatibilityRepository } from '../repositories/PositionCompatibilityRepository';
import { PositionRepository } from '../repositories/PositionRepository';
import { MinistryRepository } from '../repositories/MinistryRepository';
import { Actor } from '../services/MinistryAccessPolicy';
import { AppError } from '../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface SetPositionCompatibilityDTO {
  institutionId: string;
  actor: Actor;
  positionAId: string;
  positionBId: string;
}

/**
 * Marca um par de funções como compatível (RN01/RN02). Ordena o par na forma
 * canônica pela entidade, valida que as duas funções existem e pertencem à
 * instituição do usuário (tenant) e persiste.
 *
 * Permissão: por ora a matriz de compatibilidade é definida SÓ pelo ADMIN_GERAL,
 * e por isso NÃO passa pela MinistryAccessPolicy (que é de escopo de ministério).
 * Justificativa: a compatibilidade pode ligar funções de MINISTÉRIOS DIFERENTES —
 * o motor de conflito (RN01) avalia o membro ACROSS ministérios —, então definir a
 * matriz é uma ação de escopo de INSTITUIÇÃO, não de um ministério isolado. Abrir
 * para ADMIN_MINISTERIO escopado pode ser reavaliado no futuro, mas esbarra
 * justamente nos pares que cruzam ministérios (qual admin escopado os define?).
 *
 * Duplicata → IDEMPOTENTE: se o par já existe, retorna o existente em vez de 409.
 * A matriz é um conjunto de fatos ("estas duas são compatíveis"); remarcar um par
 * já compatível é um no-op que chega ao mesmo estado desejado (semântica PUT),
 * o que casa com uma tela de matriz onde se liga/desliga células.
 *
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class SetPositionCompatibilityUseCase {
  constructor(
    private readonly compatibilityRepo: PositionCompatibilityRepository,
    private readonly positionRepo: PositionRepository,
    private readonly ministryRepo: MinistryRepository,
  ) {}

  async execute(dto: SetPositionCompatibilityDTO): Promise<PositionCompatibility> {
    if (dto.actor.role !== 'ADMIN_GERAL') {
      throw new AppError('Apenas o administrador geral pode definir compatibilidades', 403);
    }

    // Valida e ordena o par pela entidade (ids diferentes, forma canônica) antes
    // de tocar o banco.
    const compatibility = PositionCompatibility.create({
      positionAId: dto.positionAId,
      positionBId: dto.positionBId,
    });

    // Ambas as funções precisam existir e ser da instituição do usuário.
    await this.ensurePositionInInstitution(compatibility.positionAId, dto.institutionId);
    await this.ensurePositionInInstitution(compatibility.positionBId, dto.institutionId);

    const existing = await this.compatibilityRepo.findByPair(
      compatibility.positionAId,
      compatibility.positionBId,
    );
    if (existing) return existing; // idempotente

    return this.compatibilityRepo.save(compatibility);
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
