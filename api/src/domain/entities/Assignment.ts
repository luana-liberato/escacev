import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Assignment — um membro exercendo uma função dentro da escala de um ministério
 * (model `Alocacao` do Prisma). Alocação DIRETA: pessoa + função, sem vaga
 * abstrata. O membro e a função devem pertencer ao mesmo ministério da escala —
 * essa checagem é feita no use case (AddAssignmentsUseCase), não aqui.
 *
 * `conflict` nasce sempre `false`; vira `true` só quando o admin confirma uma
 * alocação sabendo do conflito (RN03, motor de conflito — fora deste bloco).
 *
 * Nome do campo `positionId` (não `functionId`) para manter coerência com a
 * entidade `Position`, que já mapeia o model `Funcao` (Seção 4.6). Construtor
 * privado + factory create() (padrão da Seção 4.1); a tradução PT↔EN acontece
 * só no repositório.
 */
export class Assignment {
  private constructor(
    public readonly id: string,
    public readonly scheduleId: string,
    public readonly memberId: string,
    public readonly positionId: string,
    public readonly conflict: boolean,
    public readonly createdAt: Date,
  ) {}

  /**
   * Cria uma nova alocação (conflict sempre false — RN03 é responsabilidade do
   * motor de conflito, fora deste bloco). A existência e o pertencimento de
   * escala/membro/função ao mesmo ministério são validados no use case.
   */
  static create(props: { scheduleId: string; memberId: string; positionId: string }): Assignment {
    if (typeof props.scheduleId !== 'string' || !props.scheduleId.trim()) {
      throw new AppError('Escala é obrigatória', 400);
    }
    if (typeof props.memberId !== 'string' || !props.memberId.trim()) {
      throw new AppError('Membro é obrigatório', 400);
    }
    if (typeof props.positionId !== 'string' || !props.positionId.trim()) {
      throw new AppError('Função é obrigatória', 400);
    }

    return new Assignment(cuid(), props.scheduleId, props.memberId, props.positionId, false, new Date());
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso do repositório). */
  static restore(props: {
    id: string;
    scheduleId: string;
    memberId: string;
    positionId: string;
    conflict: boolean;
    createdAt: Date;
  }): Assignment {
    return new Assignment(
      props.id,
      props.scheduleId,
      props.memberId,
      props.positionId,
      props.conflict,
      props.createdAt,
    );
  }
}
