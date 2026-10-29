import { Indicador } from '../../domain/indicador';
import { SinalDeRisco } from '../../domain/risco';
import { dentroDaJanela } from '../datas';
import { PARAMETROS_PADRAO, ParametrosMotor } from '../parametros';
import { RegraDeRisco } from '../RegraDeRisco';

/**
 * Saídas antecipadas (RF06). Sinal fraco: sozinho nunca passa de moderado, mas soma na correlação.
 * Esta regra foi acrescentada depois das outras três sem alterar o MotorDeRegras:
 * é a demonstração prática do benefício do padrão Strategy.
 *  - 4+ saídas na janela ... peso 2
 *  - 2 ou 3 saídas ......... peso 1
 */
export class RegraSaidas implements RegraDeRisco {
  readonly nome = 'RegraSaidas';
  readonly causa = 'SAIDAS' as const;

  constructor(private readonly p: ParametrosMotor['saidas'] = PARAMETROS_PADRAO.saidas) {}

  avaliar(historico: Indicador[], dataReferencia: string): SinalDeRisco | null {
    const saidas = historico.filter((i) => i.tipo === 'SAIDA' && dentroDaJanela(i.data, dataReferencia, this.p.janelaDias));
    if (saidas.length < this.p.atencao) return null;

    return {
      regra: this.nome,
      causa: this.causa,
      regraNegocio: null, // 4º indicador do artigo, sem limite numérico definido: limites próprios
      peso: saidas.length >= this.p.moderado ? 2 : 1,
      evidencias: [`${saidas.length} saídas antecipadas nos últimos ${this.p.janelaDias} dias`],
      resumo: `${saidas.length} saídas antecipadas em ${this.p.janelaDias} dias`,
    };
  }
}
