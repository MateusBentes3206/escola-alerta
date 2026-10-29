import { Indicador } from '../src/domain/indicador';
import { NivelRisco } from '../src/domain/risco';
import { diasAntes, falta, faltasEspacadas, nota, ocorrencia, saida } from '../tests/helpers/indicadores';

/**
 * Cenários simulados para avaliar a precisão do motor (RNF04, meta: 80% de acerto).
 *
 * O "esperado" de cada cenário foi definido por julgamento pedagógico ANTES de rodar o motor.
 * O gabarito não foi ajustado para bater com o resultado. Por isso alguns cenários discordam
 * do motor: eles mostram limitações reais das regras atuais.
 * C37 e C38 (acrescentados depois) testam casos acima do limite das RN05 e RN06.
 * Data de referência: 2026-09-30 (quarta-feira).
 */
export interface Cenario {
  id: string;
  descricao: string;
  esperado: NivelRisco;
  historico: Indicador[];
}

const disc = (pares: [string, number][]) => pares.map(([d, v]) => nota(d, v));
const seguidas = ['2026-09-28', '2026-09-29', '2026-09-30'];

export const CENARIOS: Cenario[] = [
  // Sem risco
  { id: 'C01', esperado: 'BAIXO', descricao: 'Sem nenhum registro', historico: [] },
  { id: 'C02', esperado: 'BAIXO', descricao: 'Notas boas em três disciplinas', historico: disc([['Matemática', 8], ['Português', 7.5], ['Ciências', 9]]) },
  { id: 'C03', esperado: 'BAIXO', descricao: 'Uma falta sem justificativa no mês', historico: [falta(diasAntes(4))] },
  { id: 'C04', esperado: 'BAIXO', descricao: 'Duas faltas justificadas', historico: [falta(diasAntes(2), true), falta(diasAntes(9), true)] },
  { id: 'C05', esperado: 'BAIXO', descricao: 'Uma ocorrência leve', historico: [ocorrencia('leve')] },
  { id: 'C06', esperado: 'BAIXO', descricao: 'Uma nota 5,5 isolada, demais boas', historico: disc([['Matemática', 5.5], ['Português', 8], ['Ciências', 7]]) },
  { id: 'C07', esperado: 'BAIXO', descricao: 'Queda de 9 para 7, ainda acima da média', historico: [nota('História', 9, '2º bimestre', diasAntes(60)), nota('História', 7)] },
  { id: 'C08', esperado: 'BAIXO', descricao: 'Nota baixa antiga já recuperada (4 -> 8)', historico: [nota('Matemática', 4, '2º bimestre', diasAntes(60)), nota('Matemática', 8)] },
  { id: 'C09', esperado: 'BAIXO', descricao: 'Duas faltas e uma ocorrência leve', historico: [falta(diasAntes(3)), falta(diasAntes(12)), ocorrencia('leve')] },
  { id: 'C10', esperado: 'BAIXO', descricao: 'Duas saídas antecipadas no mês', historico: [saida(diasAntes(2)), saida(diasAntes(10))] },
  { id: 'C11', esperado: 'BAIXO', descricao: 'Cinco faltas, todas com atestado', historico: [1, 2, 3, 6, 7].map((d) => falta(diasAntes(d), true)) },
  { id: 'C12', esperado: 'BAIXO', descricao: 'Seis faltas, mas de 40 a 65 dias atrás', historico: [40, 45, 50, 55, 60, 65].map((d) => falta(diasAntes(d))) },
  { id: 'C13', esperado: 'BAIXO', descricao: 'Ocorrência grave de 45 dias atrás', historico: [ocorrencia('grave', diasAntes(45))] },
  { id: 'C14', esperado: 'BAIXO', descricao: 'Duas faltas seguidas, nada mais', historico: [falta('2026-09-29'), falta('2026-09-30')] },
  { id: 'C15', esperado: 'BAIXO', descricao: 'Queda em duas disciplinas, ambas acima de 6', historico: [
    nota('História', 9, '2º bimestre', diasAntes(60)), nota('História', 7),
    nota('Geografia', 8.5, '2º bimestre', diasAntes(60)), nota('Geografia', 6.5),
  ] },
  { id: 'C16', esperado: 'BAIXO', descricao: 'Três faltas, só uma sem justificativa', historico: [falta(diasAntes(2)), falta(diasAntes(8), true), falta(diasAntes(15), true)] },

  // Risco moderado
  { id: 'C17', esperado: 'MODERADO', descricao: 'Três faltas espaçadas no mês', historico: faltasEspacadas(3) },
  { id: 'C18', esperado: 'MODERADO', descricao: 'Quatro faltas espaçadas no mês', historico: faltasEspacadas(4) },
  { id: 'C19', esperado: 'MODERADO', descricao: 'Uma ocorrência moderada', historico: [ocorrencia('moderada')] },
  { id: 'C20', esperado: 'MODERADO', descricao: 'Duas ocorrências leves', historico: [ocorrencia('leve'), ocorrencia('leve', diasAntes(12))] },
  { id: 'C21', esperado: 'MODERADO', descricao: 'Nota 4 em Matemática, caindo de 7', historico: [nota('Matemática', 7, '2º bimestre', diasAntes(60)), nota('Matemática', 4)] },
  { id: 'C22', esperado: 'MODERADO', descricao: 'Nota baixa + 1 falta + 1 ocorrência leve (sinais convergentes)', historico: [nota('Matemática', 5.5), falta(diasAntes(2)), ocorrencia('leve')] },
  { id: 'C23', esperado: 'MODERADO', descricao: 'Quatro saídas antecipadas no mês', historico: [1, 3, 8, 10].map((d) => saida(diasAntes(d))) },
  { id: 'C24', esperado: 'MODERADO', descricao: 'Uma disciplina abaixo de 6 + três faltas', historico: [nota('Matemática', 5), ...faltasEspacadas(3)] },
  { id: 'C25', esperado: 'MODERADO', descricao: 'Ocorrência moderada + uma nota 5,8', historico: [ocorrencia('moderada', diasAntes(10)), nota('Português', 5.8)] },
  { id: 'C26', esperado: 'MODERADO', descricao: 'Uma falta + três saídas antecipadas (padrão de evasão)', historico: [falta(diasAntes(4)), saida(diasAntes(1)), saida(diasAntes(6)), saida(diasAntes(11))] },
  { id: 'C27', esperado: 'MODERADO', descricao: 'Nota 3,0 isolada em uma disciplina', historico: disc([['Matemática', 3], ['Português', 7.5]]) },

  // Risco alto
  { id: 'C28', esperado: 'ALTO', descricao: 'Cinco faltas sem justificativa no mês', historico: faltasEspacadas(5) },
  { id: 'C29', esperado: 'ALTO', descricao: 'Três dias letivos seguidos sem justificativa', historico: seguidas.map((d) => falta(d)) },
  { id: 'C30', esperado: 'ALTO', descricao: 'Uma ocorrência grave', historico: [ocorrencia('grave')] },
  { id: 'C31', esperado: 'ALTO', descricao: 'Três ocorrências leves no mês', historico: [ocorrencia('leve'), ocorrencia('leve', diasAntes(8)), ocorrencia('leve', diasAntes(15))] },
  { id: 'C32', esperado: 'ALTO', descricao: 'Duas disciplinas abaixo de 6', historico: disc([['Matemática', 5.2], ['Português', 5.8]]) },
  { id: 'C33', esperado: 'ALTO', descricao: 'Três faltas + ocorrência moderada (correlação)', historico: [...faltasEspacadas(3), ocorrencia('moderada')] },
  { id: 'C34', esperado: 'ALTO', descricao: 'Caso Rafael: notas + faltas + ocorrência', historico: [...disc([['Matemática', 5.2], ['Português', 5.8]]), ...faltasEspacadas(3), ocorrencia('leve')] },
  { id: 'C35', esperado: 'ALTO', descricao: 'Quatro faltas + duas disciplinas abaixo de 6', historico: [...faltasEspacadas(4), ...disc([['Matemática', 4.5], ['Ciências', 5.0]])] },
  { id: 'C36', esperado: 'ALTO', descricao: 'Ocorrência grave com notas boas', historico: [ocorrencia('grave'), ...disc([['Matemática', 8], ['Português', 9]])] },
  { id: 'C37', esperado: 'ALTO', descricao: 'Seis faltas sem justificativa no mês', historico: faltasEspacadas(6) },
  { id: 'C38', esperado: 'ALTO', descricao: 'Uma ocorrência grave e duas leves no mês', historico: [ocorrencia('grave'), ocorrencia('leve', diasAntes(9)), ocorrencia('leve', diasAntes(16))] },
];
