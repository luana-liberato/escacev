import { Request, Response } from 'express';
import { AuthenticatedUser } from '../middlewares/auth';
import { AppError } from '../../../shared/errors/AppError';
import {
  GetMyScheduleUseCase,
  MyScheduleResult,
} from '../../../domain/use-cases/schedules/GetMyScheduleUseCase';
import { DateRange } from '../../../domain/repositories/AssignmentRepository';
import { PrismaAssignmentRepository } from '../../database/repositories/PrismaAssignmentRepository';
import { respond } from '../../../shared/utils/respond';

/**
 * Visão do MEMBRO das suas escalas (GET /minhas-escalas). Só `auth` (sem rbac):
 * qualquer usuário autenticado — inclusive MEMBRO — vê as SUAS alocações, apenas
 * de escalas PUBLICADA (RN04). memberId sempre do JWT (req.user), nunca da query.
 */
export class MyScheduleController {
  // GET /minhas-escalas?from=&to= — agenda do membro no período (mês corrente por padrão).
  list = async (req: Request, res: Response): Promise<void> => {
    const { memberId } = MyScheduleController.authUser(req);
    const range = MyScheduleController.resolveRange(req);

    const useCase = new GetMyScheduleUseCase(new PrismaAssignmentRepository());
    const result = await useCase.execute({ memberId, range });

    respond(res, 200, MyScheduleController.serialize(result), 'Minhas escalas');
  };

  /**
   * Extrai o usuário autenticado injetado pelo middleware auth. O guard mantém
   * o tipo estreito e devolve 401 caso a rota seja montada sem o auth antes.
   */
  private static authUser(req: Request): AuthenticatedUser {
    if (!req.user) throw new AppError('Não autenticado', 401);
    return req.user;
  }

  /**
   * Resolve o período da consulta (fronteira HTTP, não regra de negócio):
   * `?from` e `?to` (datas ISO) são opcionais mas vêm JUNTOS — informar só um é
   * 400. Ausentes os dois, cai no MÊS CORRENTE (a visão principal do membro).
   */
  private static resolveRange(req: Request): DateRange {
    const { from, to } = req.query;
    if (from === undefined && to === undefined) {
      return MyScheduleController.currentMonth(new Date());
    }
    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new AppError('Informe "from" e "to" juntos (datas ISO)', 400);
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new AppError('"from" e "to" devem ser datas válidas (ISO)', 400);
    }
    return { from: fromDate, to: toDate };
  }

  /** Primeiro instante do mês de `now` até o último instante do mesmo mês (UTC). */
  private static currentMonth(now: Date): DateRange {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1);
    return { from, to };
  }

  /** Projeção para a resposta da API (entries já são serializáveis: strings/datas). */
  private static serialize(result: MyScheduleResult) {
    return {
      from: result.from,
      to: result.to,
      entries: result.entries,
    };
  }
}
