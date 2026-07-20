import nodemailer, { Transporter } from 'nodemailer';

/** Conteúdo pronto de um e-mail (o que os templates produzem). */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** Uma mensagem a enviar: o conteúdo + o destinatário. */
export interface EmailMessage extends EmailContent {
  to: string;
}

/**
 * Porta de envio de e-mail. É best-effort por contrato: `send` NUNCA lança —
 * falha de e-mail loga e segue, jamais quebra a operação que a disparou (Fase 7).
 * Devolve `true` quando o e-mail foi enviado (ou logado, em modo-dev sem SMTP) e
 * `false` quando o envio real falhou — para quem quiser reagir à falha sem tratar
 * exceção (ex.: avisar o publicador da escala).
 */
export interface EmailService {
  send(message: EmailMessage): Promise<boolean>;
}

/** Configuração SMTP lida do ambiente. */
export interface SmtpConfig {
  host?: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
}

/** Lê a config SMTP do .env. Os MESMOS campos servem para os dois provedores:
 *  Mailtrap (dev) e SendGrid (prod) — só mudam os valores, não o código. */
function loadSmtpConfigFromEnv(): SmtpConfig {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.FROM_EMAIL ?? 'noreply@escacev.app',
  };
}

/** SMTP está utilizável? Placeholder do template (`"..."`) e vazio contam como não configurado. */
function isSmtpConfigured(config: SmtpConfig): boolean {
  const filled = (v?: string) => !!v && v.trim() !== '' && v.trim() !== '...';
  return filled(config.host) && filled(config.user) && filled(config.pass);
}

/**
 * `SMTP_HOST="ethereal"` liga a caixa de teste do próprio Nodemailer. Não é um
 * host real: é a palavra-chave que pede uma conta descartável ao Ethereal.
 */
function isEtherealRequested(config: SmtpConfig): boolean {
  return config.host?.trim().toLowerCase() === 'ethereal';
}

/**
 * Serviço de e-mail via Nodemailer/SMTP. Serve indistintamente Mailtrap (dev) e
 * SendGrid (prod) — ambos são SMTP; a diferença mora só no `.env`.
 *
 * Fallback: se as credenciais SMTP não estiverem preenchidas (o caso do template
 * `.env`, com `SMTP_USER="..."`), o serviço entra em MODO LOG — apenas registra o
 * e-mail no console em vez de tentar conectar. Assim S2/S3 rodam de ponta a ponta
 * sem nenhuma credencial; basta plugar `SMTP_*` depois para o envio real ligar,
 * sem tocar em código.
 *
 * DESENVOLVIMENTO — `SMTP_HOST="ethereal"`: usa a caixa de teste do próprio
 * Nodemailer, criada na hora e sem cadastro. Nada é entregue de verdade; cada
 * envio imprime no console um link com o e-mail RENDERIZADO. É o substituto do
 * Mailtrap: o modo log sozinho mostra só destinatário e assunto, e não permite
 * conferir o HTML dos templates. Nunca use em produção — as mensagens ficam numa
 * caixa pública e não chegam a ninguém.
 */
export class NodemailerEmailService implements EmailService {
  private readonly config: SmtpConfig;
  private readonly configured: boolean;
  private readonly ethereal: boolean;
  private transporter: Transporter | null;
  /** Criação da conta Ethereal em voo — memoizada para não abrir uma por e-mail. */
  private etherealSetup: Promise<Transporter | null> | null = null;

  /**
   * @param options.config  sobrescreve a config do .env (usado em testes).
   * @param options.transporter  transporter pronto (usado em testes p/ mockar o SMTP).
   *   Fornecê-lo já marca o serviço como configurado.
   */
  constructor(options?: { config?: SmtpConfig; transporter?: Transporter }) {
    this.config = options?.config ?? loadSmtpConfigFromEnv();
    this.ethereal = !options?.transporter && isEtherealRequested(this.config);
    this.configured = !!options?.transporter || isSmtpConfigured(this.config);

    if (options?.transporter) {
      this.transporter = options.transporter;
    } else if (this.ethereal) {
      // Resolvido no primeiro envio: criar a conta é assíncrono e o construtor não é.
      this.transporter = null;
    } else if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.port === 465, // 465 = TLS implícito; 587/2525 = STARTTLS
        auth: { user: this.config.user as string, pass: this.config.pass as string },
      });
    } else {
      this.transporter = null; // modo log
    }
  }

  /**
   * Cria (uma vez) a caixa de teste do Ethereal. Se falhar — tipicamente sem
   * rede —, devolve null e o serviço cai no modo log, que é o comportamento
   * seguro: e-mail é best-effort e não pode derrubar a operação que o disparou.
   */
  private async resolveEthereal(): Promise<Transporter | null> {
    if (this.transporter) return this.transporter;
    if (!this.etherealSetup) {
      this.etherealSetup = nodemailer
        .createTestAccount()
        .then((account) => {
          const transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: { user: account.user, pass: account.pass },
          });
          this.transporter = transporter;
          // eslint-disable-next-line no-console
          console.info(`[email:ethereal] caixa de teste criada (${account.user})`);
          return transporter;
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[email:ethereal] não foi possível criar a caixa; caindo no modo log:', err);
          return null;
        });
    }
    return this.etherealSetup;
  }

  async send(message: EmailMessage): Promise<boolean> {
    if (this.ethereal) await this.resolveEthereal();

    // Modo log: sem SMTP, só registra o que seria enviado. Não é erro — conta como
    // "ok" (true) para não sinalizar falha em ambiente sem credencial.
    if (!this.transporter) {
      // eslint-disable-next-line no-console
      console.info(
        `[email:log] (SMTP não configurado) para=${message.to} assunto="${message.subject}"`,
      );
      return true;
    }

    // Best-effort: qualquer falha de envio loga e é engolida — nunca propaga.
    // Devolve false para o caller poder reagir (sem tratar exceção).
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      // O Ethereal não entrega nada: guarda a mensagem e expõe um link com o
      // e-mail RENDERIZADO. É esse link que substitui a caixa do Mailtrap —
      // sem ele o modo de teste não teria como conferir o HTML do template.
      if (this.ethereal) {
        const preview = nodemailer.getTestMessageUrl(info);
        // eslint-disable-next-line no-console
        if (preview) console.info(`[email:ethereal] preview de "${message.subject}": ${preview}`);
      }
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[email:erro] falha ao enviar para=${message.to}:`, err);
      return false;
    }
  }
}
