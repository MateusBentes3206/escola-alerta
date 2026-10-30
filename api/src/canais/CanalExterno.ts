export type TipoCanal = 'EMAIL' | 'WHATSAPP';

/** Resultado de um envio: ENVIADA (saiu de verdade) ou SIMULADA (canal sem credenciais configuradas). */
export type ResultadoEnvio = 'ENVIADA' | 'SIMULADA';

export interface MensagemExterna {
  destino: string;   // e-mail ou telefone +55...
  assunto: string;   // usado no e-mail
  texto: string;
  nomeDestinatario: string;
  variaveis: string[]; // parâmetros do modelo do WhatsApp (nome do aluno, nível, motivo, link)
}

/**
 * Canal de comunicação fora do app. Cada implementação esconde o provedor (SMTP, API da Meta):
 * o resto do sistema só conhece esta interface. Sem credenciais, o canal funciona em simulação.
 */
export interface CanalExterno {
  readonly tipo: TipoCanal;
  readonly configurado: boolean;
  enviar(mensagem: MensagemExterna): Promise<ResultadoEnvio>;
}
