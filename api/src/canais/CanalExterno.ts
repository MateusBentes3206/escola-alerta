export type TipoCanal = 'EMAIL';

/** Resultado de um envio: ENVIADA (saiu de verdade) ou SIMULADA (e-mail sem servidor SMTP configurado). */
export type ResultadoEnvio = 'ENVIADA' | 'SIMULADA';

export interface MensagemExterna {
  destino: string;   // endereço de e-mail
  assunto: string;
  texto: string;
  nomeDestinatario: string;
}

/**
 * Canal de comunicação fora do app. A implementação esconde o provedor (SMTP): o resto do sistema
 * só conhece esta interface. Um canal novo no futuro (SMS, WhatsApp) é só mais uma implementação
 * inscrita como observador, sem mexer no motor. Sem credenciais, o canal funciona em simulação.
 */
export interface CanalExterno {
  readonly tipo: TipoCanal;
  readonly configurado: boolean;
  enviar(mensagem: MensagemExterna): Promise<ResultadoEnvio>;
}
