/**
 * Notifier — porta (contrato) do canal de notificações da Fase 7. Os use cases
 * dos gatilhos (S3: convidar membro, publicar escala, registrar
 * indisponibilidade) dependem DESTA interface, nunca da implementação — mesma
 * filosofia dos repositórios (Seção 4.2). O domínio fala em dados semânticos
 * (nomes, datas); escolher tipo de notificação e template de e-mail é detalhe da
 * implementação em infra, que fica fora daqui.
 *
 * Contrato de robustez: nenhum método lança. Notificar é um efeito colateral da
 * operação, não parte da sua transação — uma falha de notificação (banco fora,
 * SMTP fora) loga e segue, JAMAIS quebra a ação que a disparou (publicar escala
 * funciona mesmo se a notificação falhar). O e-mail, além disso, é best-effort
 * por cima do registro in-app (o canal confiável).
 */
export interface Notifier {
  /**
   * Convite para a instituição. É e-mail-only: quem é convidado ainda não fez
   * login, logo não há inbox in-app para receber — por isso não há registro de
   * Notificacao aqui. O nome da instituição é resolvido pela implementação (no
   * MVP single-institution vem do ambiente), não pelo domínio.
   */
  memberInvited(input: { to: string; memberName: string }): Promise<void>;

  /**
   * Membro escalado em um evento (na publicação da escala, RN04). Grava a
   * notificação in-app e envia o e-mail best-effort. Devolve `true` se o e-mail
   * saiu (ou foi logado em modo-dev) e `false` se o envio real falhou — o
   * chamador usa isso para avisar o publicador quando algum e-mail não sai.
   */
  memberScheduled(input: {
    memberId: string;
    email: string;
    memberName: string;
    eventName: string;
    startsAt: Date;
    positionName: string;
  }): Promise<boolean>;

  /**
   * Aviso de sistema para um membro específico (tipo SISTEMA). É in-app apenas —
   * usado, por exemplo, para avisar o publicador da escala de que alguns e-mails
   * de notificação não puderam ser enviados. Sem e-mail: o canal que falhou é
   * justamente o e-mail.
   */
  systemNotice(input: { memberId: string; title: string; body: string }): Promise<void>;

  /**
   * Indisponibilidade recém-registrada por um membro conflita com uma escala já
   * existente — alerta ao admin (RN05, visão do admin). Grava in-app para o admin
   * e envia o e-mail best-effort.
   */
  unavailabilityConflict(input: {
    adminId: string;
    adminEmail: string;
    adminName: string;
    memberName: string;
    eventName: string;
    startsAt: Date;
  }): Promise<void>;
}
