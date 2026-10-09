import { FocoDeReforco } from '../domain/risco';
import { PARAMETROS_PADRAO } from './parametros';

export type AreaDoConhecimento = 'MATEMATICA' | 'LINGUAGENS' | 'CIENCIAS' | 'HUMANAS' | 'GERAL';

/** Áreas da BNCC para o Ensino Fundamental II; a disciplina é reconhecida pelo nome. */
const PALAVRAS_POR_AREA: [AreaDoConhecimento, string[]][] = [
  ['MATEMATICA', ['matemática', 'matematica', 'geometria', 'álgebra', 'algebra']],
  ['LINGUAGENS', ['português', 'portugues', 'língua', 'lingua', 'inglês', 'ingles', 'espanhol', 'redação', 'redacao', 'literatura', 'arte', 'educação física', 'educacao fisica']],
  ['CIENCIAS', ['ciências', 'ciencias', 'física', 'fisica', 'química', 'quimica', 'biologia']],
  ['HUMANAS', ['história', 'historia', 'geografia', 'filosofia', 'sociologia', 'ensino religioso']],
];

export function areaDaDisciplina(disciplina: string): AreaDoConhecimento {
  const nome = disciplina.trim().toLowerCase();
  return PALAVRAS_POR_AREA.find(([, palavras]) => palavras.some((p) => nome.includes(p)))?.[0] ?? 'GERAL';
}

/**
 * Matriz de recomendações de ensino por área. "{assunto}" é trocado pelo assunto avaliado.
 * São estratégias de recomposição da aprendizagem de uso comum nas redes públicas
 * (retomada com exemplos, prática graduada, devolutiva, aprendizagem entre pares).
 */
export const MATRIZ_DE_ENSINO: Record<AreaDoConhecimento, string[]> = {
  MATEMATICA: [
    'Retomar {assunto} com exemplos resolvidos passo a passo antes de propor novos exercícios.',
    'Aplicar uma lista graduada sobre {assunto}, do mais simples ao mais complexo, com correção comentada.',
    'Usar material concreto ou situações do cotidiano para dar sentido a {assunto}.',
  ],
  LINGUAGENS: [
    'Trabalhar {assunto} com leitura guiada de textos curtos e perguntas de interpretação.',
    'Propor uma produção curta envolvendo {assunto}, com devolutiva e reescrita orientada.',
    'Revisar {assunto} com mapa mental e exemplos de uso em frases do dia a dia.',
  ],
  CIENCIAS: [
    'Relacionar {assunto} a um experimento simples ou vídeo demonstrativo em sala.',
    'Pedir que o aluno explique {assunto} com as próprias palavras, em resumo ou esquema.',
    'Resolver questões-problema sobre {assunto} em dupla, com mediação do professor.',
  ],
  HUMANAS: [
    'Organizar {assunto} em uma linha do tempo ou mapa conceitual com o aluno.',
    'Ler e discutir uma fonte (texto, mapa ou imagem) ligada a {assunto}.',
    'Aplicar um estudo dirigido sobre {assunto}, com roteiro de perguntas.',
  ],
  GERAL: [
    'Retomar {assunto} em atendimento individual ou em pequeno grupo.',
    'Propor uma atividade de revisão sobre {assunto} com devolutiva rápida.',
  ],
};

export const LIMITE_NOTA_MUITO_BAIXA = PARAMETROS_PADRAO.notas.muitoBaixa;

export interface RecomendacoesDoFoco {
  resumo: string;
  ensino: string[];
  familia: string[];
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Monta, para uma disciplina/assunto, o que reforçar e como ensinar:
 *  - nota muito baixa (< 4): primeiro verificar os pré-requisitos;
 *  - queda entre bimestres: comparar com o bimestre anterior;
 *  - duas estratégias da área da disciplina;
 *  - uma orientação de estudo em casa para a família.
 */
export function recomendarParaFoco(foco: FocoDeReforco): RecomendacoesDoFoco {
  const assunto = foco.assunto?.trim() || `o conteúdo do ${foco.periodo ?? 'bimestre'}`;
  const trocar = (t: string) => t.split('{assunto}').join(assunto);

  const motivo = foco.notaAnterior !== null
    ? `caiu de ${fmt(foco.notaAnterior)} para ${fmt(foco.nota)}`
    : `nota ${fmt(foco.nota)}`;
  const resumo = `Reforçar ${assunto} em ${foco.disciplina} (${motivo}${foco.periodo ? ` no ${foco.periodo}` : ''}).`;

  const ensino: string[] = [];
  if (foco.nota < LIMITE_NOTA_MUITO_BAIXA) {
    ensino.push(trocar('Nota muito baixa: verificar os pré-requisitos de {assunto} antes de avançar no conteúdo.'));
  }
  if (foco.notaAnterior !== null) {
    ensino.push(trocar('Comparar com a avaliação anterior para identificar em que parte de {assunto} a aprendizagem se perdeu.'));
  }
  ensino.push(...MATRIZ_DE_ENSINO[areaDaDisciplina(foco.disciplina)].slice(0, 2).map(trocar));

  const familia = [trocar('Em casa: reservar 20 minutos por dia para revisar {assunto} e pedir que o aluno explique o que aprendeu.')];

  return { resumo, ensino, familia };
}
