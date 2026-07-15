import { EmailContent } from './email';

/**
 * Templates de e-mail da Fase 7 (mensagens ao usuário → português). Cada função
 * é pura: recebe os dados e devolve { subject, html, text }. Não envia nada —
 * quem envia é o EmailService (best-effort). Manter os textos aqui, longe dos
 * gatilhos, facilita ajustar redação sem tocar em regra de negócio.
 */

/** Formata uma data (UTC) como "dd/mm/aaaa às HH:mm" — determinístico p/ testes. */
function formatDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const dd = p(date.getUTCDate());
  const mm = p(date.getUTCMonth() + 1);
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy} às ${p(date.getUTCHours())}:${p(date.getUTCMinutes())}`;
}

/** Envolve o conteúdo num HTML mínimo e consistente entre os templates. */
function wrap(title: string, bodyHtml: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
  <h2 style="color:#1a1a1a">${title}</h2>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="font-size:12px;color:#888">Escacev — gestão de escalas de voluntários.</p>
</div>`;
}

/**
 * Convite para participar da instituição (e, opcionalmente, de um ministério).
 * `loginUrl` é o endereço para iniciar o login com Google (o fluxo que vincula a
 * conta ao membro convidado) — vem do ambiente, resolvido pela implementação.
 */
export function inviteEmail(params: {
  memberName: string;
  institutionName: string;
  loginUrl: string;
  ministryName?: string | null;
}): EmailContent {
  const { memberName, institutionName, loginUrl, ministryName } = params;
  const ministryLine = ministryName
    ? ` para participar do ministério <strong>${ministryName}</strong>`
    : '';
  const ministryLineText = ministryName ? ` para participar do ministério ${ministryName}` : '';

  return {
    subject: `Você foi convidado(a) para ${institutionName}`,
    html: wrap(
      'Você recebeu um convite',
      `<p>Olá, ${memberName}!</p>
       <p>Você foi convidado(a) para <strong>${institutionName}</strong>${ministryLine}.</p>
       <p>Para começar, acesse e faça login com sua conta Google:</p>
       <p><a href="${loginUrl}" style="display:inline-block;padding:10px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px">Acessar o Escacev</a></p>
       <p style="font-size:12px;color:#888">Se o botão não funcionar, copie e cole no navegador: ${loginUrl}</p>`,
    ),
    text:
      `Olá, ${memberName}!\n\n` +
      `Você foi convidado(a) para ${institutionName}${ministryLineText}.\n` +
      `Para começar, acesse e faça login com sua conta Google:\n${loginUrl}`,
  };
}

/** Aviso ao membro de que foi escalado em um evento (na publicação da escala). */
export function scheduledEmail(params: {
  memberName: string;
  eventName: string;
  startsAt: Date;
  positionName: string;
}): EmailContent {
  const { memberName, eventName, startsAt, positionName } = params;
  const when = formatDateTime(startsAt);

  return {
    subject: `Você foi escalado(a): ${eventName}`,
    html: wrap(
      'Nova escala publicada',
      `<p>Olá, ${memberName}!</p>
       <p>Você foi escalado(a) para <strong>${eventName}</strong> em <strong>${when}</strong>.</p>
       <p>Função: <strong>${positionName}</strong>.</p>`,
    ),
    text:
      `Olá, ${memberName}!\n\n` +
      `Você foi escalado(a) para ${eventName} em ${when}.\n` +
      `Função: ${positionName}.`,
  };
}

/**
 * Alerta ao admin de que um membro registrou indisponibilidade que conflita com
 * uma escala já existente (RN05, ponto de vista do admin).
 */
export function unavailabilityConflictEmail(params: {
  adminName: string;
  memberName: string;
  eventName: string;
  startsAt: Date;
}): EmailContent {
  const { adminName, memberName, eventName, startsAt } = params;
  const when = formatDateTime(startsAt);

  return {
    subject: `Indisponibilidade conflita com escala: ${memberName}`,
    html: wrap(
      'Conflito de indisponibilidade',
      `<p>Olá, ${adminName}.</p>
       <p><strong>${memberName}</strong> registrou uma indisponibilidade que conflita com
       a escala de <strong>${eventName}</strong> em <strong>${when}</strong>.</p>
       <p>Considere ajustar a escala ou combinar uma troca.</p>`,
    ),
    text:
      `Olá, ${adminName}.\n\n` +
      `${memberName} registrou uma indisponibilidade que conflita com a escala de ` +
      `${eventName} em ${when}.\n` +
      `Considere ajustar a escala ou combinar uma troca.`,
  };
}
