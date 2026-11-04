import { CausaRaiz, NivelRisco } from './risco';

const CAUSA_TEXTO: Record<CausaRaiz, string> = { NOTAS: 'notas', FALTAS: 'frequência', OCORRENCIAS: 'ocorrências', SAIDAS: 'saídas antecipadas' };

export interface DadosMensagemFamilia {
  responsavelNome: string;
  alunoNome: string;
  turma: string;
  nivel: NivelRisco;
  causa: CausaRaiz | null;
  link: string;
}

/**
 * Texto do e-mail para a família, conforme o nível de risco atual.
 * Curto e sem notas ou detalhes do aluno (LGPD): o detalhe fica no sistema, atrás do login.
 */
export function textoParaFamilia(d: DadosMensagemFamilia): string {
  const responsavel = d.responsavelNome.split(' ')[0];
  const aluno = d.alunoNome.split(' ')[0];
  const motivo = d.causa ? CAUSA_TEXTO[d.causa] : 'acompanhamento';
  const abertura = `Olá, ${responsavel}. Aqui é a escola, pelo EscolaAlerta.`;

  if (d.nivel === 'ALTO' || d.nivel === 'MODERADO') {
    return `${abertura}\n\n${aluno} (${d.turma}) está com risco ${d.nivel} no acompanhamento escolar. Principal motivo: ${motivo}.\n\n` +
      `A escola preparou um plano de ação. Veja os detalhes e fale com a orientação em: ${d.link}\n\n` +
      'Em caso de dúvida, responda este e-mail ou procure a orientação escolar.';
  }
  return `${abertura}\n\nGostaríamos de conversar sobre o acompanhamento de ${aluno} (${d.turma}). ` +
    `Quando puder, responda este e-mail ou acesse: ${d.link}`;
}

export function motivoTexto(causa: CausaRaiz | null): string {
  return causa ? CAUSA_TEXTO[causa] : 'acompanhamento';
}
