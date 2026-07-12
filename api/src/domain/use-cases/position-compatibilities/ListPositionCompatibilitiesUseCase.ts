import { PositionCompatibility } from '../../entities/PositionCompatibility';
import { PositionCompatibilityRepository } from '../../repositories/PositionCompatibilityRepository';
import { Actor } from '../../services/MinistryAccessPolicy';
import { AppError } from '../../../shared/errors/AppError';

/** institutionId vem do JWT (req.user), nunca do body. */
export interface ListPositionCompatibilitiesDTO {
  institutionId: string;
  actor: Actor;
}

/**
 * Lista todos os pares compatíveis da instituição — insumo para a tela de matriz
 * no frontend futuramente. Escopo por tenant garantido no repositório (via
 * função → ministério → instituição).
 *
 * Permissão: alinhada ao Set/Remove (a matriz é de escopo de instituição), então
 * por ora só ADMIN_GERAL lista. A leitura pode ser aberta a ADMIN_MINISTERIO no
 * futuro (ver a discussão de permissão em SetPositionCompatibilityUseCase).
 *
 * Dependência injetada via construtor (Seção 4.2).
 */
export class ListPositionCompatibilitiesUseCase {
  constructor(private readonly compatibilityRepo: PositionCompatibilityRepository) {}

  async execute(dto: ListPositionCompatibilitiesDTO): Promise<PositionCompatibility[]> {
    if (dto.actor.role !== 'ADMIN_GERAL') {
      throw new AppError('Apenas o administrador geral pode listar compatibilidades', 403);
    }
    return this.compatibilityRepo.listByInstitution(dto.institutionId);
  }
}
