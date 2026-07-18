import { MinistryRepository } from '../../repositories/MinistryRepository';
import { PositionRepository } from '../../repositories/PositionRepository';

/** Uma função da instituição, já com o nome do ministério a que pertence. */
export interface InstitutionPosition {
  id: string;
  name: string;
  ministryId: string;
  ministryName: string;
}

/**
 * Catálogo de TODAS as funções da instituição, cada uma com o nome do seu
 * ministério — o insumo da tela de Funções (a lista e, sobretudo, os toggles de
 * compatibilidade do modal, que mostram todas as funções da instituição, não só
 * as do escopo do admin).
 *
 * Existe porque a API de funções é por ministério (`GET /ministerios/:id/funcoes`)
 * e não havia "todas da instituição". Sem isto, a tela buscaria ministério por
 * ministério (N+1 no cliente). Aqui a agregação é server-side, numa requisição.
 *
 * Reusa `findByMinistry` por ministério da instituição — o N é o número de
 * ministérios (poucos numa igreja), e não alarga a interface do repositório. O
 * nome do ministério vem do próprio laço, sem consulta extra.
 */
export class ListInstitutionPositionsUseCase {
  constructor(
    private readonly ministryRepo: MinistryRepository,
    private readonly positionRepo: PositionRepository,
  ) {}

  async execute(dto: { institutionId: string }): Promise<InstitutionPosition[]> {
    const ministries = await this.ministryRepo.findByInstitution(dto.institutionId);

    const positions: InstitutionPosition[] = [];
    for (const ministry of ministries) {
      const funcs = await this.positionRepo.findByMinistry(ministry.id);
      for (const func of funcs) {
        positions.push({
          id: func.id,
          name: func.name,
          ministryId: ministry.id,
          ministryName: ministry.name,
        });
      }
    }

    return positions;
  }
}
