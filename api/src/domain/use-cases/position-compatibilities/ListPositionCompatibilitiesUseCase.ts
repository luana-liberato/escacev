import { PositionCompatibility } from '../../entities/PositionCompatibility';
import { PositionCompatibilityRepository } from '../../repositories/PositionCompatibilityRepository';
import { Actor } from '../../services/MinistryAccessPolicy';

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
 * Permissão: alinhada ao Set/Remove — ADMIN_GERAL e ADMIN_MINISTERIO listam
 * (gate no rbac da rota; a matriz é escopo de instituição, ver
 * SetPositionCompatibilityUseCase).
 *
 * Dependência injetada via construtor (Seção 4.2).
 */
export class ListPositionCompatibilitiesUseCase {
  constructor(private readonly compatibilityRepo: PositionCompatibilityRepository) {}

  async execute(dto: ListPositionCompatibilitiesDTO): Promise<PositionCompatibility[]> {
    // Permissão é gate do rbac na rota; sem checagem de papel aqui (ver o cabeçalho).
    return this.compatibilityRepo.listByInstitution(dto.institutionId);
  }
}
