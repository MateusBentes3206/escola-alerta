export type NivelRisco = 'BAIXO' | 'MODERADO' | 'ALTO';
export type CausaRaiz = 'NOTAS' | 'FALTAS' | 'OCORRENCIAS' | 'SAIDAS';
export type Peso = 1 | 2 | 3;

/** Disciplina/assunto que precisa de reforço, encontrado pela RegraNotas. */
export interface FocoDeReforco {
  disciplina: string;
  assunto: string | null;
  nota: number;
  periodo: string | null;
  notaAnterior: number | null;  // preenchida quando houve queda relevante
  abaixoDoLimite: boolean;
}

/** O que uma regra encontrou: peso do sinal e as evidências que o justificam (RNF07). */
export interface SinalDeRisco {
  regra: string;          // nome da estratégia, ex.: 'RegraFaltas'
  causa: CausaRaiz;
  peso: Peso;             // 1 = atenção, 2 = moderado, 3 = alto
  evidencias: string[];   // frases legíveis para o responsável e a escola
  focos?: FocoDeReforco[]; // só na RegraNotas: o que reforçar
}

/** Resultado do MotorDeRegras para um aluno numa data de referência. */
export interface Classificacao {
  nivel: NivelRisco;
  causaRaiz: CausaRaiz | null;
  regraOrigem: string | null;
  correlacao: boolean;     // nível elevado pela convergência de sinais
  sinais: SinalDeRisco[];
  dataReferencia: string;  // AAAA-MM-DD
}

export type TipoSugestao = 'ACAO' | 'REFORCO' | 'ENSINO' | 'FAMILIA';

export interface Sugestao {
  texto: string;
  ordem: number;
  causa: CausaRaiz;
  tipo: TipoSugestao;
  disciplina: string | null;
  assunto: string | null;
}

/** Itens de reforço agrupados por disciplina/assunto, como as telas exibem. */
export interface Reforco {
  disciplina: string;
  assunto: string | null;
  resumo: string;
  ensino: string[];
  familia: string[];
}

export interface PlanoDeAcao {
  causaRaiz: CausaRaiz;
  sugestoes: Sugestao[];
}

export interface Alerta {
  id: string;
  alunoId: string;
  nivel: NivelRisco;
  causaRaiz: CausaRaiz | null;
  regraOrigem: string | null;
  correlacao: boolean;
  detalhes: { sinais: SinalDeRisco[]; dataReferencia: string } | null;
  criadoEm: string;
}

export const ORDEM_NIVEL: Record<NivelRisco, number> = { BAIXO: 0, MODERADO: 1, ALTO: 2 };
