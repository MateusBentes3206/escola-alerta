import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { CanalExterno, MensagemExterna } from './CanalExterno';

/** E-mail via SMTP. Em desenvolvimento usa o Mailpit (docker compose): os e-mails aparecem em http://localhost:8025. */
export class CanalEmail implements CanalExterno {
  readonly tipo = 'EMAIL' as const;
  private readonly transporte: Transporter | null;

  constructor(private readonly config = env.smtp) {
    this.transporte = config.host
      ? nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.port === 465,
          auth: config.user ? { user: config.user, pass: config.pass } : undefined,
          connectionTimeout: 10_000,
        })
      : null;
  }

  get configurado() {
    return this.transporte !== null;
  }

  async enviar(m: MensagemExterna) {
    if (!this.transporte) return 'SIMULADA' as const;
    await this.transporte.sendMail({
      from: this.config.remetente,
      to: `"${m.nomeDestinatario}" <${m.destino}>`,
      subject: m.assunto,
      text: m.texto,
    });
    return 'ENVIADA' as const;
  }
}
