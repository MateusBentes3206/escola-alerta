import { Indicador } from '../../domain/indicador';
import { Peso, SinalDeRisco } from '../../domain/risco';
import { dentroDaJanela } from '../datas';
import { PARAMETROS_PADRAO, ParametrosMotor } from '../parametros';
import { RegraDeRisco } from '../RegraDeRisco';

/**
 * Ocorrências: soma pontos pela gravidade dentro da janela (leve 1, moderada 2, grave 3).
 *  - 3+ pontos (ex.: 3 leves ou 1 grave) ... peso 3
 *  - 2 pontos .............................. peso 2
 *  - 1 ponto ............................... peso 1
 */
export class RegraOcorrencias implements RegraDeRisco {
  readonly nome = 'RegraOcorrencias';
  readonly causa = 'OCORRENCIAS' as const;

  constructor(private readonly p: ParametrosMotor['ocorrencias'] = PARAMETROS_PADRAO.ocorrencias) {}

  avaliar(historico: Indicador[], dataReferencia: string): SinalDeRisco | null {
    const ocorrencias = historico.filter(
      (i) => i.tipo === 'OCORRENCIA' && dentroDaJanela(i.data, dataReferencia, this.p.janelaDias),
    );
    if (ocorrencias.length === 0) return null;

    const pontos = ocorrencias.reduce((soma, o) => soma + this.p.pontos[o.gravidade ?? 'leve'], 0);
    const graves = ocorrencias.filter((o) => o.gravidade === 'grave').length;

    const evidencias = [`${ocorrencias.length} ocorrência(s) nos últimos ${this.p.janelaDias} dias (${pontos} ponto(s) de gravidade)`];
    if (graves > 0) evidencias.push(`${graves} ocorrência(s) grave(s)`);

    let peso: Peso = 1;
    if (pontos >= this.p.alto) peso = 3;
    else if (pontos >= this.p.moderado) peso = 2;

    return { regra: this.nome, causa: this.causa, peso, evidencias };
  }
}
