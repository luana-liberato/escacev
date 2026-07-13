import { MemberRepository } from '../repositories/MemberRepository';
import { PositionRepository } from '../repositories/PositionRepository';
import { MinistryMembershipRepository } from '../repositories/MinistryMembershipRepository';

/** Motivo textual da inelegibilidade + o statusCode que o caller deve usar. */
export interface EligibilityFailure {
  reason: string;
  statusCode: number;
}

/**
 * Checa se um membro/uma função podem ser usados numa alocação de um ministério
 * (pertencimento ao MESMO ministério da escala). Extraído do
 * AddAssignmentsUseCase para ser reutilizado também pelo UpdateAssignmentUseCase
 * — a mesma regra de negócio, um único ponto de verdade.
 *
 * Retorna o motivo (nunca lança) para servir os dois consumidores:
 *  - Add: usa só o texto do motivo, num item do lote parcial (created/failed);
 *  - Update: usa texto + statusCode para lançar um AppError (operação unitária).
 * `statusCode` distingue "não encontrado" (404) de "existe, mas é de outro
 * ministério" (400 — entrada válida porém inelegível para esta escala).
 */
export class AssignmentEligibility {
  constructor(
    private readonly memberRepo: MemberRepository,
    private readonly positionRepo: PositionRepository,
    private readonly membershipRepo: MinistryMembershipRepository,
  ) {}

  /** null quando o membro pode ser alocado neste ministério. */
  async checkMember(memberId: string, ministryId: string): Promise<EligibilityFailure | null> {
    const member = await this.memberRepo.findById(memberId);
    if (!member) return { reason: 'Membro não encontrado', statusCode: 404 };

    const membership = await this.membershipRepo.findByMemberAndMinistry(memberId, ministryId);
    if (!membership) return { reason: 'Membro não pertence a este ministério', statusCode: 400 };

    return null;
  }

  /** null quando a função pertence a este ministério. */
  async checkPosition(positionId: string, ministryId: string): Promise<EligibilityFailure | null> {
    const position = await this.positionRepo.findById(positionId);
    if (!position) return { reason: 'Função não encontrada', statusCode: 404 };
    if (position.ministryId !== ministryId) {
      return { reason: 'Função não pertence a este ministério', statusCode: 400 };
    }

    return null;
  }
}
