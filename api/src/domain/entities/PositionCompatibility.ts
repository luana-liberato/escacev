import cuid from 'cuid';
import { AppError } from '../../shared/errors/AppError';

/**
 * PositionCompatibility — marca que DUAS funções (Position) são compatíveis:
 * um mesmo membro pode ocupá-las em eventos sobrepostos sem gerar conflito
 * (RN01/RN02). Mapeia o model `CompatibilidadeFuncao` do Prisma; a tradução
 * PT↔EN acontece só no repositório (Seção 4.6).
 *
 * A relação é SIMÉTRICA — "Vocal compatível com Baterista" é a MESMA informação
 * que "Baterista compatível com Vocal". Para que cada par tenha exatamente UMA
 * linha possível, o par é sempre guardado na FORMA CANÔNICA: positionAId < positionBId
 * (ordem crescente dos ids). Toda criação/consulta ordena os ids antes de operar.
 *
 * Default do sistema (RN02): AUSÊNCIA de linha = funções INCOMPATÍVEIS. A linha
 * só existe para marcar compatibilidade.
 *
 * Construtor privado + factory create() (padrão da Seção 4.1).
 */
export class PositionCompatibility {
  private constructor(
    public readonly id: string,
    public readonly positionAId: string,
    public readonly positionBId: string,
    public readonly createdAt: Date,
  ) {}

  /**
   * Cria um par compatível já na forma canônica (menor id = A, maior id = B).
   * Valida que os dois ids são diferentes — uma função não é compatível consigo
   * mesma — e que ambos são strings preenchidas (não-string vira 400 tratado).
   */
  static create(props: { positionAId: string; positionBId: string }): PositionCompatibility {
    const { positionAId, positionBId } = props;
    if (
      typeof positionAId !== 'string' ||
      typeof positionBId !== 'string' ||
      !positionAId.trim() ||
      !positionBId.trim()
    ) {
      throw new AppError('São necessárias duas funções válidas', 400);
    }
    if (positionAId === positionBId) {
      throw new AppError('Uma função não pode ser compatível consigo mesma', 400);
    }

    const [aId, bId] = PositionCompatibility.orderPair(positionAId, positionBId);
    return new PositionCompatibility(cuid(), aId, bId, new Date());
  }

  /** Reconstrói a entidade a partir de uma linha persistida (uso do repositório). */
  static restore(props: {
    id: string;
    positionAId: string;
    positionBId: string;
    createdAt: Date;
  }): PositionCompatibility {
    return new PositionCompatibility(
      props.id,
      props.positionAId,
      props.positionBId,
      props.createdAt,
    );
  }

  /**
   * Ordena um par de ids na forma canônica (menor = A, maior = B). Função PURA:
   * não valida nem lança — serve para a fronteira do repositório ordenar qualquer
   * par antes de buscar/remover, sem o caller se preocupar com a ordem. A
   * validação de par (ids diferentes/preenchidos) mora em create().
   */
  static orderPair(id1: string, id2: string): [string, string] {
    return id1 <= id2 ? [id1, id2] : [id2, id1];
  }
}
