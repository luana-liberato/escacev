import {
  AssignmentRepository,
  DateRange,
  MemberScheduleEntry,
} from '../../repositories/AssignmentRepository';
import { AppError } from '../../../shared/errors/AppError';

/** memberId vem do JWT (req.user), nunca do body/query. */
export interface GetMyScheduleDTO {
  memberId: string;
  range: DateRange;
}

/** O período consultado + as alocações do membro nele (só PUBLICADA, RN04). */
export interface MyScheduleResult {
  from: Date;
  to: Date;
  entries: MemberScheduleEntry[];
}

/**
 * Visão do MEMBRO (GET /minhas-escalas): as alocações do próprio membro num
 * período, em TODOS os ministérios, apenas de escalas PUBLICADA (RN04 — rascunho
 * é invisível ao membro; o filtro por status é feito na origem, no repositório).
 * A visão mensal é a forma principal de consumo; o período vem já resolvido pelo
 * controller (mês corrente por padrão).
 *
 * Não há checagem de tenant explícita: a busca é `WHERE membroId = memberId` e um
 * Membro pertence a uma única instituição, então o resultado já é naturalmente
 * escopado — não há como ver alocações de outro tenant. Dependência via
 * construtor (Seção 4.2).
 */
export class GetMyScheduleUseCase {
  constructor(private readonly assignmentRepo: AssignmentRepository) {}

  async execute(dto: GetMyScheduleDTO): Promise<MyScheduleResult> {
    if (dto.range.from > dto.range.to) {
      throw new AppError('O início do período não pode ser depois do fim', 400);
    }

    const entries = await this.assignmentRepo.findByMemberPublishedInRange(dto.memberId, dto.range);
    return { from: dto.range.from, to: dto.range.to, entries };
  }
}
