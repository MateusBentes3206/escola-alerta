import { IAlunoRepository } from '../repositories/AlunoRepository';
import { ServicoDeRisco } from './ServicoDeRisco';

/**
 * Correlação temporal: o risco também muda só com a passagem do tempo
 * (uma falta sai da janela de 30 dias sem ninguém registrar nada).
 * Esta rotina reavalia todos os alunos na subida da API e a cada intervalo,
 * para o histórico de alertas acompanhar essas mudanças.
 */
export class ReavaliacaoPeriodica {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly alunos: IAlunoRepository,
    private readonly risco: ServicoDeRisco,
  ) {}

  async executar(): Promise<number> {
    let alertas = 0;
    for (const id of await this.alunos.listarIds()) {
      const { alerta } = await this.risco.reavaliar(id);
      if (alerta) alertas++;
    }
    return alertas;
  }

  iniciar(intervaloMs: number) {
    const rodar = () =>
      this.executar()
        .then((n) => n > 0 && console.log(`Reavaliação periódica: ${n} alerta(s) novo(s).`))
        .catch((err) => console.error('Reavaliação periódica falhou:', err));
    rodar();
    this.timer = setInterval(rodar, intervaloMs);
    this.timer.unref();
  }
}
