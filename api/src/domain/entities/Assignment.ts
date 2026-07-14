import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * Assignment — um membro exercendo uma função dentro da escala de um ministério
 * (model `Alocacao` do Prisma). Alocação DIRETA: pessoa + função, sem vaga
 * abstrata. O membro e a função devem pertencer ao mesmo ministério da escala —
 * essa checagem é feita no use case (AddAssignmentsUseCase), não aqui.
 *
 * `conflict` nasce `false` por padrão; vira `true` só quando o admin confirma
 * cientemente uma alocação conflituosa (RN03 — AddAssignmentsUseCase, que
 * integra o ConflictDetectionService).
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
   * Cria uma nova alocação. `conflict` é opcional (default `false`); só nasce
   * `true` quando o admin confirma cientemente uma alocação conflituosa (RN03
   * — ver AddAssignmentsUseCase). A existência e o pertencimento de
   * escala/membro/função ao mesmo ministério são validados no use case.
   */
  static create(props: {
    scheduleId: string;
    memberId: string;
    positionId: string;
    conflict?: boolean;
  }): Assignment {
    const scheduleId = Assignment.requireId(props.scheduleId, 'Escala é obrigatória');
    const memberId = Assignment.requireId(props.memberId, 'Membro é obrigatório');
    const positionId = Assignment.requireId(props.positionId, 'Função é obrigatória');

    return new Assignment(cuid(), scheduleId, memberId, positionId, props.conflict ?? false, new Date());
  }

  /**
   * Retorna uma cópia com memberId, positionId e/ou conflict atualizados (troca
   * a pessoa, a função, ou ambos). `conflict` é opcional — quando omitido,
   * mantém o valor atual; o UpdateAssignmentUseCase o recalcula EXPLICITAMENTE
   * a cada edição (nunca herda o valor antigo por omissão silenciosa), para que
   * a flag reflita o estado APÓS a edição nos dois sentidos: um conflito que
   * some vira `false`; um conflito novo confirmado vira `true` (RN03).
   * scheduleId e createdAt são imutáveis. Entidade imutável: valida os campos
   * presentes e devolve nova instância (não muta a original).
   */
  update(props: { memberId?: string; positionId?: string; conflict?: boolean }): Assignment {
    const memberId =
      props.memberId !== undefined
        ? Assignment.requireId(props.memberId, 'Membro é obrigatório')
        : this.memberId;
    const positionId =
      props.positionId !== undefined
        ? Assignment.requireId(props.positionId, 'Função é obrigatória')
        : this.positionId;
    const conflict = props.conflict !== undefined ? props.conflict : this.conflict;

    return new Assignment(this.id, this.scheduleId, memberId, positionId, conflict, this.createdAt);
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

  /** Exige uma string não-vazia; não-string ou vazia vira 400 tratado, não TypeError → 500. */
  private static requireId(value: unknown, message: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(message, 400);
    }
    return value;
  }
}
