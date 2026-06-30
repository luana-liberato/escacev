import { Account } from '../entities/Account';
import { AccountRepository } from '../repositories/AccountRepository';
import { MemberRepository } from '../repositories/MemberRepository';
import { JwtService } from '../../infra/services/jwt';
import { AppError } from '../../shared/errors/AppError';

/** Perfil normalizado vindo do Google (extraído no controller). */
export interface GoogleProfileDTO {
  googleSub: string;
  email: string;
  name: string;
  photoUrl?: string;
}

/**
 * Autentica um usuário a partir do perfil do Google e emite o JWT.
 * Implementa exatamente a lógica do callback descrita na Seção 5 do CLAUDE.md.
 * Dependências injetadas via construtor (Seção 4.2).
 */
export class AuthenticateWithGoogleUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly memberRepo: MemberRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(profile: GoogleProfileDTO): Promise<{ token: string }> {
    // 2. Busca uma Account pelo googleSub.
    let account = await this.accountRepo.findByGoogleSub(profile.googleSub);

    // 3. Fallback: sem Account para esse googleSub, mas existe uma com o mesmo email.
    if (!account) {
      account = await this.accountRepo.findByEmail(profile.email);
    }

    // 4. Não existe nenhuma Account — cria.
    let accountJustCreated = false;
    if (!account) {
      account = await this.accountRepo.save(
        Account.create({
          googleSub: profile.googleSub,
          email: profile.email,
          displayName: profile.name,
          photoUrl: profile.photoUrl,
        }),
      );
      accountJustCreated = true;
    }

    // 5. Busca o Member vinculado a essa Account. Se a Account acabou de ser criada,
    //    procura um Member pendente pelo email (convite) e vincula a Account a ele.
    let member = await this.memberRepo.findByAccountId(account.id);
    if (!member && accountJustCreated) {
      const pendingMember = await this.memberRepo.findPendingByEmail(profile.email);
      if (pendingMember) {
        member = await this.memberRepo.linkAccount(pendingMember.id, account.id);
      }
    }

    // 6. E-mail não convidado — acesso negado.
    if (!member) {
      throw new AppError('Usuário não autorizado — solicite um convite ao administrador', 403);
    }

    // 7. Emite o JWT com { memberId, institutionId, role }.
    const token = this.jwtService.sign({
      memberId: member.id,
      institutionId: member.institutionId,
      role: member.role,
    });

    return { token };
  }
}
