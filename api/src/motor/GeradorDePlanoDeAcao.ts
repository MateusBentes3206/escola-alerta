import { CausaRaiz, Classificacao, PlanoDeAcao, Reforco, Sugestao, TipoSugestao } from '../domain/risco';
import { recomendarParaFoco } from './RecomendacoesDeEnsino';

/**
 * Matriz de sugestões pedagógicas por causa raiz (RF12).
 * Os textos das três primeiras causas são os mesmos do protótipo validado com os usuários.
 */
export const MATRIZ_DE_SUGESTOES: Record<CausaRaiz, string[]> = {
  FALTAS: [
    'Agendar conversa com a família sobre a rotina de frequência.',
    'Verificar se há barreiras de transporte, saúde ou apoio em casa.',
  ],
  NOTAS: [
    'Encaminhar para reforço escolar na disciplina em queda.',
    'Agendar atendimento pedagógico individual nas próximas duas semanas.',
  ],
  OCORRENCIAS: [
    'Encaminhar para escuta com a orientação educacional.',
    'Construir, junto ao aluno, um plano de convivência de curto prazo.',
  ],
  SAIDAS: [
    'Conferir com a família os motivos das saídas antecipadas e se há comprovantes.',
    'Avaliar se as saídas coincidem com aulas ou avaliações específicas.',
  ],
};

export const SUGESTAO_PRAZO_ALTO = 'Risco alto: a escola deve retornar o contato com a família em até 7 dias.';

/**
 * Gera o plano a partir da classificação:
 *  - sugestões da causa raiz;
 *  - se houve correlação, a 1ª sugestão de cada outro sinal moderado (o plano cobre os dois problemas);
 *  - se há sinal de notas, o que reforçar (disciplina + assunto) com recomendações de ensino e para a família;
 *  - em risco alto, um prazo de retorno da escola (sempre o último item).
 * Risco baixo não gera plano.
 */
export class GeradorDePlanoDeAcao {
  constructor(private readonly matriz: Record<CausaRaiz, string[]> = MATRIZ_DE_SUGESTOES) {}

  /** `matriz`: a da escola (editável); sem ela, vale a passada no construtor (padrão). */
  gerar(classificacao: Classificacao, matriz: Record<CausaRaiz, string[]> = this.matriz): PlanoDeAcao | null {
    const { nivel, causaRaiz, sinais, correlacao } = classificacao;
    if (nivel === 'BAIXO' || !causaRaiz) return null;

    const sugestoes: Sugestao[] = [];
    const adicionar = (texto: string, causa: CausaRaiz, tipo: TipoSugestao = 'ACAO', disciplina: string | null = null, assunto: string | null = null) =>
      sugestoes.push({ texto, causa, ordem: sugestoes.length + 1, tipo, disciplina, assunto });

    for (const texto of matriz[causaRaiz]) adicionar(texto, causaRaiz);

    if (correlacao) {
      for (const sinal of sinais) {
        if (sinal.causa !== causaRaiz && sinal.peso >= 2) adicionar(matriz[sinal.causa][0], sinal.causa);
      }
    }

    const focos = sinais.find((s) => s.causa === 'NOTAS')?.focos ?? [];
    for (const foco of focos) {
      const r = recomendarParaFoco(foco);
      adicionar(r.resumo, 'NOTAS', 'REFORCO', foco.disciplina, foco.assunto);
      for (const texto of r.ensino) adicionar(texto, 'NOTAS', 'ENSINO', foco.disciplina, foco.assunto);
      for (const texto of r.familia) adicionar(texto, 'NOTAS', 'FAMILIA', foco.disciplina, foco.assunto);
    }

    if (nivel === 'ALTO') adicionar(SUGESTAO_PRAZO_ALTO, causaRaiz);

    return { causaRaiz, sugestoes };
  }
}

/** Separa o plano gravado em ações gerais e reforços agrupados por disciplina/assunto (formato das telas). */
export function organizarPlano(sugestoes: Sugestao[]): { acoes: Sugestao[]; reforcos: Reforco[] } {
  const acoes = sugestoes.filter((s) => s.tipo === 'ACAO');
  const reforcos: Reforco[] = [];
  for (const s of sugestoes) {
    if (s.tipo === 'ACAO') continue;
    let r = reforcos.find((x) => x.disciplina === s.disciplina && x.assunto === s.assunto);
    if (!r) reforcos.push((r = { disciplina: s.disciplina ?? '', assunto: s.assunto, resumo: '', ensino: [], familia: [] }));
    if (s.tipo === 'REFORCO') r.resumo = s.texto;
    else if (s.tipo === 'ENSINO') r.ensino.push(s.texto);
    else r.familia.push(s.texto);
  }
  return { acoes, reforcos };
}
