import { Indicador } from '../../src/domain/indicador';
import { somarDias } from '../../src/motor/datas';

// Data fixa para os testes do motor não dependerem do dia em que rodam (quarta-feira).
export const REF = '2026-09-30';
export const diasAntes = (n: number) => somarDias(REF, -n);

let seq = 0;
const base = (): Omit<Indicador, 'tipo' | 'data'> => ({
  id: `ind-${++seq}`, alunoId: 'aluno-teste',
  disciplina: null, valor: null, periodo: null, assunto: null, justificada: null, gravidade: null, horario: null, descricao: null,
});

export const nota = (disciplina: string, valor: number, periodo = '3º bimestre', data = diasAntes(5), assunto: string | null = null): Indicador =>
  ({ ...base(), tipo: 'NOTA', data, disciplina, valor, periodo, assunto });

export const falta = (data: string, justificada = false): Indicador =>
  ({ ...base(), tipo: 'FALTA', data, justificada });

export const ocorrencia = (gravidade: 'leve' | 'moderada' | 'grave', data = diasAntes(3)): Indicador =>
  ({ ...base(), tipo: 'OCORRENCIA', data, gravidade, descricao: `ocorrência ${gravidade}` });

export const saida = (data: string): Indicador =>
  ({ ...base(), tipo: 'SAIDA', data, horario: '10:00', descricao: 'consulta' });

/** N faltas não consecutivas (uma por semana) dentro da janela de 30 dias. */
export const faltasEspacadas = (n: number) => Array.from({ length: n }, (_, i) => falta(diasAntes(i * 6 + 1)));
