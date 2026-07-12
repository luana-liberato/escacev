import { Account } from '../../entities/Account';
import { AccountRepository } from '../../repositories/AccountRepository';
import { MemberRepository } from '../../repositories/MemberRepository';
import { JwtService } from '../../../infra/services/jwt';
import { AppError } from '../../../shared/errors/AppError';

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

    // 4. Busca o Member vinculado à Account (quando ela existe).
    let member = account ? await this.memberRepo.findByAccountId(account.id) : null;

    // 5. Sem Member vinculado: procura um convite pendente pelo e-mail. Cobre o
    //    primeiro login (Account ainda não existe) e também Contas órfãs criadas
    //    antes desta correção (Account existe, mas nunca foi vinculada).
    if (!member) {
      const pendingMember = await this.memberRepo.findPendingByEmail(profile.email);

      // 6. E-mail não convidado — nega ANTES de criar a Account (evita Conta órfã).
      if (!pendingMember) {
        throw new AppError('Usuário não autorizado — solicite um convite ao administrador', 403);
      }

      if (!account) {
        account = await this.accountRepo.save(
          Account.create({
            googleSub: profile.googleSub,
            email: profile.email,
            displayName: profile.name,
            photoUrl: profile.photoUrl,
          }),
        );
      }

      member = await this.memberRepo.linkAccount(pendingMember.id, account.id);
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
