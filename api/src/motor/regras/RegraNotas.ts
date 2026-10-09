import { Indicador } from '../../domain/indicador';
import { FocoDeReforco, Peso, SinalDeRisco } from '../../domain/risco';
import { PARAMETROS_PADRAO, ParametrosMotor } from '../parametros';
import { RegraDeRisco } from '../RegraDeRisco';

/** "3º bimestre" -> 3. Sem período, conta como 0 (mais antigo). */
function ordemDoPeriodo(periodo: string | null): number {
  const n = parseInt(periodo ?? '', 10);
  return Number.isNaN(n) ? 0 : n;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Notas: olha a nota mais recente de cada disciplina (não a média de tudo),
 * porque o que importa é a situação atual do aluno.
 *  - 2+ disciplinas abaixo do limite ............ peso 3
 *  - 1 disciplina abaixo de 4, ou abaixo e em queda ... peso 2
 *  - 1 disciplina abaixo do limite ............... peso 1
 *  - nenhuma abaixo, mas queda forte em alguma ... peso 1 (tendência)
 * Também devolve os focos de reforço (disciplina + assunto) usados no plano de ação.
 */
export class RegraNotas implements RegraDeRisco {
  readonly nome = 'RegraNotas';
  readonly causa = 'NOTAS' as const;

  constructor(private readonly p: ParametrosMotor['notas'] = PARAMETROS_PADRAO.notas) {}

  avaliar(historico: Indicador[], dataReferencia: string): SinalDeRisco | null {
    const notas = historico.filter((i) => i.tipo === 'NOTA' && i.valor !== null && i.data <= dataReferencia);

    const porDisciplina = new Map<string, Indicador[]>();
    for (const n of notas) {
      const chave = (n.disciplina ?? '').trim().toLowerCase();
      porDisciplina.set(chave, [...(porDisciplina.get(chave) ?? []), n]);
    }

    const abaixo: string[] = [];
    const emQueda: string[] = [];
    const evidencias: string[] = [];
    const focos: FocoDeReforco[] = [];

    for (const lista of porDisciplina.values()) {
      lista.sort((a, b) => ordemDoPeriodo(a.periodo) - ordemDoPeriodo(b.periodo) || a.data.localeCompare(b.data));
      const atual = lista[lista.length - 1];
      const anterior = lista.length > 1 ? lista[lista.length - 2] : null;
      const disciplina = atual.disciplina ?? 'Disciplina';
      const rotulo = atual.assunto ? `${disciplina} (${atual.assunto})` : disciplina;
      const abaixoDoLimite = atual.valor! < this.p.limite;
      const caiu = anterior !== null && anterior.valor! - atual.valor! >= this.p.quedaRelevante;

      if (abaixoDoLimite) {
        abaixo.push(disciplina);
        evidencias.push(`${rotulo}: nota ${fmt(atual.valor!)}${atual.periodo ? ` no ${atual.periodo}` : ''} (abaixo de ${this.p.limite})`);
      }
      if (caiu) {
        emQueda.push(disciplina);
        evidencias.push(`${rotulo}: caiu de ${fmt(anterior!.valor!)} para ${fmt(atual.valor!)}`);
      }
      if (abaixoDoLimite || caiu) {
        focos.push({
          disciplina, assunto: atual.assunto, nota: atual.valor!, periodo: atual.periodo,
          notaAnterior: caiu ? anterior!.valor! : null, abaixoDoLimite,
        });
      }
    }
    focos.sort((a, b) => a.nota - b.nota); // a pior nota primeiro

    let peso: Peso | 0 = 0;
    if (abaixo.length >= this.p.disciplinasParaAlto) peso = 3;
    else if (abaixo.length === 1) peso = emQueda.includes(abaixo[0]) || focos.some((f) => f.nota < this.p.muitoBaixa) ? 2 : 1;
    else if (emQueda.length > 0) peso = 1;

    return peso === 0 ? null : { regra: this.nome, causa: this.causa, peso, evidencias, focos };
  }
}
