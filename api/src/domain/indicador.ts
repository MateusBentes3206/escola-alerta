export type TipoIndicador = 'NOTA' | 'FALTA' | 'OCORRENCIA' | 'SAIDA';
export type Gravidade = 'leve' | 'moderada' | 'grave';

/**
 * Indicador registrado pela escola (classe abstrata Indicador do diagrama de classes).
 * Uma estrutura só, com os campos de cada tipo opcionais, espelhando a tabela única "indicadores".
 */
export interface Indicador {
  id: string;
  alunoId: string;
  tipo: TipoIndicador;
  data: string;                 // AAAA-MM-DD
  disciplina: string | null;    // NOTA
  valor: number | null;         // NOTA (0 a 10)
  periodo: string | null;       // NOTA, ex.: "3º bimestre"
  assunto: string | null;       // NOTA, assunto avaliado, ex.: "Frações"
  justificada: boolean | null;  // FALTA
  gravidade: Gravidade | null;  // OCORRENCIA
  horario: string | null;       // SAIDA, HH:MM
  descricao: string | null;     // ocorrência / motivo da saída / comprovante da falta
}

/** Dados de um indicador novo ou editado (sem id e aluno). */
export type DadosIndicador = Omit<Indicador, 'id' | 'alunoId'>;
