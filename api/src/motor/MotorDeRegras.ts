import { Indicador } from '../domain/indicador';
import { Classificacao, NivelRisco, SinalDeRisco } from '../domain/risco';
import { hojeIso } from './datas';
import { PARAMETROS_PADRAO, ParametrosMotor } from './parametros';
import { RegraDeRisco } from './RegraDeRisco';
import { RegraFaltas } from './regras/RegraFaltas';
import { RegraNotas } from './regras/RegraNotas';
import { RegraOcorrencias } from './regras/RegraOcorrencias';
import { RegraSaidas } from './regras/RegraSaidas';

const NIVEL_POR_PESO: Record<number, NivelRisco> = { 1: 'BAIXO', 2: 'MODERADO', 3: 'ALTO' };
const NIVEL_TEXTO: Record<NivelRisco, string> = { BAIXO: 'baixo', MODERADO: 'moderado', ALTO: 'alto' };

/**
 * Frase que explica o nível daquele aluno (RNF07), ex.:
 * "Risco alto porque: Matemática 5,2 e Português 5,8 no 3º bimestre (RN04) + 3 faltas em 8 dias (RN05)."
 * Sinais em ordem de peso; a correlação, quando houve, é dita no fim.
 */
function montarResumo(nivel: NivelRisco, sinais: SinalDeRisco[], correlacao: boolean): string {
  if (sinais.length === 0) return 'Nenhum sinal de risco nos últimos 30 dias.';
  const partes = [...sinais]
    .sort((a, b) => b.peso - a.peso)
    .map((s) => `${s.resumo}${s.regraNegocio ? ` (${s.regraNegocio})` : ''}`);
  return `Risco ${NIVEL_TEXTO[nivel]} porque: ${partes.join(' + ')}${correlacao ? '. Os sinais apareceram juntos (correlação)' : ''}.`;
}

/**
 * Contexto do padrão Strategy: executa cada regra e combina os sinais.
 *
 * 1. Nível base = maior peso entre os sinais (3 alto, 2 moderado, 1 baixo).
 * 2. Correlação: sinais diferentes apontando na mesma direção reforçam o risco.
 *    - 2+ sinais moderados (peso >= 2) ao mesmo tempo -> ALTO
 *    - 3+ sinais de qualquer peso ao mesmo tempo      -> pelo menos MODERADO
 * 3. Causa raiz = sinal de maior peso. Empate: vale a ordem das regras
 *    (ocorrências, faltas, notas, saídas), a mesma do protótipo.
 */
export class MotorDeRegras {
  constructor(
    private readonly regras: RegraDeRisco[],
    private readonly correlacao: ParametrosMotor['correlacao'] = PARAMETROS_PADRAO.correlacao,
  ) {}

  /** Motor com as quatro regras padrão; parâmetros podem ser trocados (testes, outra escola). */
  static padrao(p: ParametrosMotor = PARAMETROS_PADRAO): MotorDeRegras {
    return new MotorDeRegras(
      [new RegraOcorrencias(p.ocorrencias), new RegraFaltas(p.faltas), new RegraNotas(p.notas), new RegraSaidas(p.saidas)],
      p.correlacao,
    );
  }

  get nomesDasRegras(): string[] {
    return this.regras.map((r) => r.nome);
  }

  classificar(historico: Indicador[], dataReferencia: string = hojeIso()): Classificacao {
    const sinais = this.regras
      .map((regra) => regra.avaliar(historico, dataReferencia))
      .filter((s): s is SinalDeRisco => s !== null);

    if (sinais.length === 0) {
      return { nivel: 'BAIXO', causaRaiz: null, regraOrigem: null, correlacao: false, sinais, resumo: montarResumo('BAIXO', sinais, false), dataReferencia };
    }

    const maiorPeso = Math.max(...sinais.map((s) => s.peso));
    const principal = sinais.find((s) => s.peso === maiorPeso)!;
    let nivel = NIVEL_POR_PESO[maiorPeso];
    let correlacao = false;

    const moderados = sinais.filter((s) => s.peso >= 2).length;
    if (moderados >= this.correlacao.sinaisModeradosParaAlto) {
      correlacao = true;
      nivel = 'ALTO';
    } else if (sinais.length >= this.correlacao.sinaisParaModerado && nivel === 'BAIXO') {
      correlacao = true;
      nivel = 'MODERADO';
    }

    return {
      nivel,
      // Risco baixo com um sinal fraco ainda guarda a causa, para o histórico; o front decide se mostra.
      causaRaiz: principal.causa,
      regraOrigem: principal.regra,
      correlacao,
      sinais,
      resumo: montarResumo(nivel, sinais, correlacao),
      dataReferencia,
    };
  }
}
