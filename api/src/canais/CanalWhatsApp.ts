import { env } from '../config/env';
import { CanalExterno, MensagemExterna } from './CanalExterno';

/**
 * WhatsApp pela API oficial do WhatsApp Business (Meta Cloud API).
 * Para a escola iniciar a conversa, a Meta exige um modelo de mensagem aprovado (WHATSAPP_TEMPLATE);
 * sem modelo, envia texto simples (só funciona se a família falou com o número nas últimas 24h).
 * Sem token configurado, fica em simulação: a mensagem é registrada, mas não sai.
 */
export class CanalWhatsApp implements CanalExterno {
  readonly tipo = 'WHATSAPP' as const;

  constructor(private readonly config = env.whatsapp) {}

  get configurado() {
    return Boolean(this.config.token && this.config.phoneNumberId);
  }

  async enviar(m: MensagemExterna) {
    if (!this.configurado) return 'SIMULADA' as const;

    const para = m.destino.replace(/\D/g, ''); // a API recebe só dígitos: 5592...
    const corpo = this.config.template
      ? {
          messaging_product: 'whatsapp', to: para, type: 'template',
          template: {
            name: this.config.template, language: { code: this.config.idioma },
            // modelo sem variáveis (ex.: hello_world) não leva "components"
            ...(m.variaveis.length > 0 && { components: [{ type: 'body', parameters: m.variaveis.map((text) => ({ type: 'text', text })) }] }),
          },
        }
      : { messaging_product: 'whatsapp', to: para, type: 'text', text: { body: m.texto, preview_url: true } };

    const resposta = await fetch(
      `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      throw new Error(`WhatsApp API ${resposta.status}: ${detalhe.slice(0, 300)}`);
    }
    return 'ENVIADA' as const;
  }
}
