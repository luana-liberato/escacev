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
 */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
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
 * Serviço de e-mail via Nodemailer/SMTP. Serve indistintamente Mailtrap (dev) e
 * SendGrid (prod) — ambos são SMTP; a diferença mora só no `.env`.
 *
 * Fallback: se as credenciais SMTP não estiverem preenchidas (o caso do template
 * `.env`, com `SMTP_USER="..."`), o serviço entra em MODO LOG — apenas registra o
 * e-mail no console em vez de tentar conectar. Assim S2/S3 rodam de ponta a ponta
 * sem nenhuma credencial; basta plugar `SMTP_*` depois para o envio real ligar,
 * sem tocar em código.
 */
export class NodemailerEmailService implements EmailService {
  private readonly config: SmtpConfig;
  private readonly configured: boolean;
  private readonly transporter: Transporter | null;

  /**
   * @param options.config  sobrescreve a config do .env (usado em testes).
   * @param options.transporter  transporter pronto (usado em testes p/ mockar o SMTP).
   *   Fornecê-lo já marca o serviço como configurado.
   */
  constructor(options?: { config?: SmtpConfig; transporter?: Transporter }) {
    this.config = options?.config ?? loadSmtpConfigFromEnv();
    this.configured = !!options?.transporter || isSmtpConfigured(this.config);

    if (options?.transporter) {
      this.transporter = options.transporter;
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

  async send(message: EmailMessage): Promise<void> {
    // Modo log: sem SMTP, só registra o que seria enviado. Não é erro.
    if (!this.transporter) {
      // eslint-disable-next-line no-console
      console.info(
        `[email:log] (SMTP não configurado) para=${message.to} assunto="${message.subject}"`,
      );
      return;
    }

    // Best-effort: qualquer falha de envio loga e é engolida — nunca propaga.
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[email:erro] falha ao enviar para=${message.to}:`, err);
    }
  }
}
