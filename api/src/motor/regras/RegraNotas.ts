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
const media = (lista: Indicador[]) => lista.reduce((s, n) => s + n.valor!, 0) / lista.length;

/** Média de uma disciplina num bimestre, com o assunto da pior avaliação (o que mais precisa de reforço). */
interface MediaDoPeriodo {
  periodo: string | null;
  media: number;
  avaliacoes: number;
  assunto: string | null;
}

function mediasPorPeriodo(notas: Indicador[]): MediaDoPeriodo[] {
  const grupos = new Map<number, Indicador[]>();
  for (const n of notas) grupos.set(ordemDoPeriodo(n.periodo), [...(grupos.get(ordemDoPeriodo(n.periodo)) ?? []), n]);
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, lista]) => {
      const pior = [...lista].sort((a, b) => a.valor! - b.valor!)[0];
      return { periodo: lista[0].periodo, media: media(lista), avaliacoes: lista.length, assunto: pior.assunto };
    });
}

/**
 * RN04: média do bimestre mais recente de cada disciplina (o que importa é a situação atual).
 *  - 2+ disciplinas com média abaixo de 6 ........................ peso 3
 *  - 1 disciplina com média abaixo de 4, ou abaixo de 6 e em queda .. peso 2
 *  - 1 disciplina com média abaixo de 6 .......................... peso 1
 *  - nenhuma abaixo, mas queda forte em alguma (tendência) ....... peso 1
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

    const abaixo: { disciplina: string; media: number; periodo: string | null }[] = [];
    const emQueda: string[] = [];
    const evidencias: string[] = [];
    const focos: FocoDeReforco[] = [];

    for (const lista of porDisciplina.values()) {
      const periodos = mediasPorPeriodo(lista);
      const atual = periodos[periodos.length - 1];
      const anterior = periodos.length > 1 ? periodos[periodos.length - 2] : null;
      const disciplina = lista[0].disciplina ?? 'Disciplina';
      const rotulo = atual.assunto ? `${disciplina} (${atual.assunto})` : disciplina;
      const descricaoMedia = atual.avaliacoes > 1 ? `média ${fmt(atual.media)} em ${atual.avaliacoes} avaliações` : `nota ${fmt(atual.media)}`;
      const abaixoDoLimite = atual.media < this.p.limite;
      const caiu = anterior !== null && anterior.media - atual.media >= this.p.quedaRelevante;

      if (abaixoDoLimite) {
        abaixo.push({ disciplina, media: atual.media, periodo: atual.periodo });
        evidencias.push(`${rotulo}: ${descricaoMedia}${atual.periodo ? ` no ${atual.periodo}` : ''} (abaixo de ${this.p.limite})`);
      }
      if (caiu) {
        emQueda.push(disciplina);
        evidencias.push(`${rotulo}: caiu de ${fmt(anterior!.media)} para ${fmt(atual.media)}`);
      }
      if (abaixoDoLimite || caiu) {
        focos.push({
          disciplina, assunto: atual.assunto, nota: atual.media, periodo: atual.periodo,
          notaAnterior: caiu ? anterior!.media : null, abaixoDoLimite,
        });
      }
    }
    focos.sort((a, b) => a.nota - b.nota); // a pior média primeiro
    abaixo.sort((a, b) => a.media - b.media);

    let peso: Peso | 0 = 0;
    if (abaixo.length >= this.p.disciplinasParaAlto) peso = 3;
    else if (abaixo.length === 1) peso = emQueda.includes(abaixo[0].disciplina) || abaixo[0].media < this.p.muitoBaixa ? 2 : 1;
    else if (emQueda.length > 0) peso = 1;
    if (peso === 0) return null;

    // Frase curta para o resumo do alerta, ex.: "Matemática 5,2 e Português 5,8 no 3º bimestre"
    const lista = abaixo.map((a) => `${a.disciplina} ${fmt(a.media)}`);
    const periodo = abaixo[0]?.periodo ? ` no ${abaixo[0].periodo}` : '';
    const resumo = abaixo.length > 0
      ? `${lista.length > 1 ? `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}` : lista[0]}${periodo}`
      : `queda de nota em ${emQueda.join(', ')}`;

    return { regra: this.nome, causa: this.causa, regraNegocio: 'RN04', peso, evidencias, resumo, focos };
  }
}
