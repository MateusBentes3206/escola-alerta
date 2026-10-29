import { Gravidade } from '../domain/indicador';

/**
 * Limites do motor de correlação, num lugar só.
 * Mudar um limite aqui muda o comportamento sem tocar no código das regras,
 * e os testes podem injetar parâmetros próprios (IT05: "limite configurado").
 */
export interface ParametrosMotor {
  notas: { limite: number; muitoBaixa: number; disciplinasParaAlto: number; quedaRelevante: number };
  faltas: { janelaDias: number; moderado: number; alto: number; sequenciaAlto: number };
  ocorrencias: { janelaDias: number; pontos: Record<Gravidade, number>; moderado: number; alto: number };
  saidas: { janelaDias: number; atencao: number; moderado: number };
  correlacao: { sinaisModeradosParaAlto: number; sinaisParaModerado: number };
}

export const PARAMETROS_PADRAO: ParametrosMotor = {
  // RN04: média do bimestre abaixo de 6 em duas disciplinas = risco alto.
  // Média abaixo de 4 em uma disciplina é defasagem grave: sozinha já é risco moderado.
  // Queda de 1,5 ponto entre bimestres na mesma disciplina indica tendência, mesmo acima da média.
  notas: { limite: 6, muitoBaixa: 4, disciplinasParaAlto: 2, quedaRelevante: 1.5 },

  // RN05: 5 ou mais faltas sem justificativa em 30 dias, ou 3 dias letivos seguidos = risco alto.
  // 3 dias seguidos sem justificativa é o gatilho usual de busca ativa escolar. 3 ou 4 faltas = moderado.
  faltas: { janelaDias: 30, moderado: 3, alto: 5, sequenciaAlto: 3 },

  // RN06: ocorrências em 30 dias pontuadas pela gravidade (leve 1, moderada 2, grave 3).
  // 3+ pontos = risco alto (3 leves ou 1 grave); 2 pontos = moderado.
  ocorrencias: { janelaDias: 30, pontos: { leve: 1, moderada: 2, grave: 3 }, moderado: 2, alto: 3 },

  // Saídas antecipadas são sinal fraco: sozinhas nunca passam de moderado.
  saidas: { janelaDias: 30, atencao: 2, moderado: 4 },

  // Correlação: 2 sinais moderados juntos viram alto; 3 sinais fracos juntos viram moderado.
  correlacao: { sinaisModeradosParaAlto: 2, sinaisParaModerado: 3 },
};
