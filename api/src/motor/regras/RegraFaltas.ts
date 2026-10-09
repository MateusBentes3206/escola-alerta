import { Indicador } from '../../domain/indicador';
import { Peso, SinalDeRisco } from '../../domain/risco';
import { dentroDaJanela, formatarDataBr, maiorSequenciaLetiva } from '../datas';
import { PARAMETROS_PADRAO, ParametrosMotor } from '../parametros';
import { RegraDeRisco } from '../RegraDeRisco';

/**
 * Faltas: só as não justificadas, e só dentro da janela de tempo (correlação temporal):
 * uma falta de três meses atrás não pesa como uma desta semana.
 *  - 5+ faltas na janela, ou 3+ dias letivos seguidos ... peso 3
 *  - 3 ou 4 faltas na janela ............................ peso 2
 *  - 1 ou 2 faltas na janela ............................ peso 1
 */
export class RegraFaltas implements RegraDeRisco {
  readonly nome = 'RegraFaltas';
  readonly causa = 'FALTAS' as const;

  constructor(private readonly p: ParametrosMotor['faltas'] = PARAMETROS_PADRAO.faltas) {}

  avaliar(historico: Indicador[], dataReferencia: string): SinalDeRisco | null {
    const faltas = historico
      .filter((i) => i.tipo === 'FALTA' && !i.justificada && dentroDaJanela(i.data, dataReferencia, this.p.janelaDias))
      .map((i) => i.data);

    if (faltas.length === 0) return null;

    const sequencia = maiorSequenciaLetiva(faltas);
    const evidencias = [
      `${faltas.length} falta(s) sem justificativa nos últimos ${this.p.janelaDias} dias (${[...faltas].sort().map(formatarDataBr).join(', ')})`,
    ];
    if (sequencia >= this.p.sequenciaAlto) {
      evidencias.push(`${sequencia} dias letivos seguidos sem justificativa`);
    }

    let peso: Peso = 1;
    if (faltas.length >= this.p.alto || sequencia >= this.p.sequenciaAlto) peso = 3;
    else if (faltas.length >= this.p.moderado) peso = 2;

    return { regra: this.nome, causa: this.causa, peso, evidencias };
  }
}
